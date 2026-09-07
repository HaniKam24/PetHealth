import { createRequire } from "node:module";
import { PDFParse } from "pdf-parse";
import { openai } from "@workspace/integrations-openai-ai-server";
import { CreateHealthRecordBody, CreateMedicationBody, CreateReminderBody } from "@workspace/api-zod";
import type { z } from "zod";

// pdf-parse's default workerSrc resolution assumes pdfjs-dist's own file
// layout on disk; once esbuild bundles everything into a single dist/index.mjs,
// that relative path no longer points anywhere. Resolving it explicitly against
// the real node_modules location (independent of bundling) fixes "Setting up
// fake worker failed: Cannot find module '.../dist/pdf.worker.mjs'".
// pdfjs-dist is only a transitive dependency (via pdf-parse), so pnpm's strict
// node_modules layout blocks resolving it directly from this package's scope —
// resolve it relative to pdf-parse's own location instead.
const require = createRequire(import.meta.url);
const pdfParseEntry = require.resolve("pdf-parse");
PDFParse.setWorker(createRequire(pdfParseEntry).resolve("pdfjs-dist/legacy/build/pdf.worker.mjs"));

// Same low-cost model tier as symptom chat / the AI insights route — the
// Care Recommendations Engine (rule-based) is the one AI feature in this
// app that costs nothing per run; this and chat are the two that do.
const MODEL = "gpt-5.4-mini";
const MAX_PAGES = 20;
// Below this, a "text-based" PDF is almost certainly a scanned image with
// no real text layer — not a precise detector, just a cheap first filter.
const MIN_TEXT_LENGTH = 40;

export class TooManyPagesError extends Error {}
export class ScannedDocumentError extends Error {}

interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
}

async function readContent(
  file: UploadedFile,
): Promise<{ kind: "text"; text: string } | { kind: "image"; dataUrl: string }> {
  if (file.mimetype === "application/pdf") {
    const parser = new PDFParse({ data: file.buffer });
    try {
      const result = await parser.getText();
      if (result.total > MAX_PAGES) {
        throw new TooManyPagesError(
          `This document has ${result.total} pages; Smart Upload supports up to ${MAX_PAGES}. Try splitting it into smaller files.`,
        );
      }
      if (result.text.trim().length < MIN_TEXT_LENGTH) {
        throw new ScannedDocumentError(
          "This looks like a scanned or image-only PDF, which Smart Upload can't read yet. Try uploading it as an image instead, or enter the details manually.",
        );
      }
      return { kind: "text", text: result.text };
    } finally {
      await parser.destroy();
    }
  }
  return { kind: "image", dataUrl: `data:${file.mimetype};base64,${file.buffer.toString("base64")}` };
}

const SYSTEM_PROMPT = `You are a document-extraction assistant for a pet health records app. You will be given the text or an image of a veterinary report. Extract ONLY information explicitly present in the document — never invent, guess, or infer facts that aren't stated. If the document is unrelated to pet health, or unreadable, return all three arrays empty.

Return a single JSON object with exactly these three arrays (empty if nothing applies):

{
  "healthRecords": [ { "type": "visit"|"vaccine"|"lab"|"procedure"|"note", "title": string, "date": "YYYY-MM-DD", "clinic": string|null, "summary": string|null } ],
  "medications": [ { "name": string, "dose": string, "frequency": string, "doseIntervalValue": number|null, "doseIntervalUnit": "hours"|"days"|"weeks"|"months"|null, "instructions": string|null } ],
  "reminders": [ { "title": string, "dueDate": "YYYY-MM-DD", "category": "appointment"|"vaccine"|"medication"|"wellness"|"other", "note": string|null } ]
}

Rules:
- healthRecords: one entry per distinct visit/vaccine/lab/procedure/note documented. "type" must be exactly one of the listed values — pick the closest match (an exam/checkup is "visit", a vaccination is "vaccine").
- medications: one entry per medication/prescription mentioned, "dose" as written (e.g. "5mg", "1 tablet"). Only set doseIntervalValue/doseIntervalUnit if the document states a clear fixed interval (e.g. "twice daily" -> 12/"hours", "every 30 days" -> 30/"days"); otherwise leave both null and describe the schedule in "frequency" as free text.
- reminders: only include a follow-up if the document explicitly states one is needed (e.g. "recheck in 2 weeks", "next booster due March 2027"). Compute "dueDate" as an absolute date from the document's own dated context; omit the reminder if no date can be determined.
- Dates must be in YYYY-MM-DD format.
- Output only the JSON object — no commentary, no markdown fences.`;

export interface ExtractionResult {
  healthRecords: z.infer<typeof CreateHealthRecordBody>[];
  medications: z.infer<typeof CreateMedicationBody>[];
  reminders: z.infer<typeof CreateReminderBody>[];
}

function parseArray<T>(value: unknown, parseOne: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  const out: T[] = [];
  for (const item of value) {
    const parsed = parseOne(item);
    if (parsed) out.push(parsed);
  }
  return out;
}

export async function extractDocument(file: UploadedFile): Promise<ExtractionResult> {
  const content = await readContent(file);

  const completion = await openai.chat.completions.create({
    model: MODEL,
    max_completion_tokens: 4096,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      content.kind === "text"
        ? { role: "user", content: `Vet report text:\n\n${content.text}` }
        : {
            role: "user",
            content: [
              { type: "text", text: "Extract structured info from this vet report image." },
              { type: "image_url", image_url: { url: content.dataUrl } },
            ],
          },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }
  const obj = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};

  return {
    healthRecords: parseArray(obj.healthRecords, (item) => {
      const result = CreateHealthRecordBody.safeParse(item);
      return result.success ? result.data : null;
    }),
    medications: parseArray(obj.medications, (item) => {
      const result = CreateMedicationBody.safeParse({ ...(item as object), active: true });
      return result.success ? result.data : null;
    }),
    reminders: parseArray(obj.reminders, (item) => {
      const result = CreateReminderBody.safeParse(item);
      return result.success ? result.data : null;
    }),
  };
}
