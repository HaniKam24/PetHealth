import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { PDFParse } from "pdf-parse";
import convertHeic from "heic-convert";
import { anthropic } from "@workspace/integrations-anthropic-ai-server";
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
//
// require.resolve() returns a plain OS path (on Windows, "C:\...\pdf.worker.mjs").
// pdfjs loads the worker via the ESM loader, which requires an actual file://
// URL — a bare Windows path fails with "Received protocol 'c:'". pathToFileURL
// converts correctly on both Windows and POSIX.
const require = createRequire(import.meta.url);
const pdfParseEntry = require.resolve("pdf-parse");
const workerPath = createRequire(pdfParseEntry).resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
PDFParse.setWorker(pathToFileURL(workerPath).href);

// Same low-cost model tier as symptom chat / the AI insights route — the
// Care Recommendations Engine (rule-based) is the one AI feature in this
// app that costs nothing per run; this and chat are the two that do.
const MODEL = "claude-haiku-4-5";
const MAX_PAGES = 20;
// Below this, a "text-based" PDF is almost certainly a scanned image with
// no real text layer — not a precise detector, just a cheap first filter.
const MIN_TEXT_LENGTH = 40;

export class TooManyPagesError extends Error {}
export class ScannedDocumentError extends Error {}
export class PetNameMismatchError extends Error {}

interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
}

async function readContent(
  file: UploadedFile,
): Promise<{ kind: "text"; text: string } | { kind: "image"; mimetype: string; base64: string }> {
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
  // Claude's vision input doesn't accept HEIC/HEIF (the format iPhone camera
  // photos use by default), even though it's an allowed upload type — convert
  // to JPEG first so an iPhone photo of a vet report is actually readable.
  if (file.mimetype === "image/heic" || file.mimetype === "image/heif") {
    const jpegBuffer = Buffer.from(await convertHeic({ buffer: file.buffer, format: "JPEG", quality: 0.92 }));
    return { kind: "image", mimetype: "image/jpeg", base64: jpegBuffer.toString("base64") };
  }
  return { kind: "image", mimetype: file.mimetype, base64: file.buffer.toString("base64") };
}

const SYSTEM_PROMPT = `You are a document-extraction assistant for a pet health records app. You will be given the text or an image of a veterinary report. Extract ONLY information explicitly present in the document — never invent, guess, or infer facts that aren't stated. If the document is unrelated to pet health, or unreadable, return all three arrays empty and vetInfo null.

Return a single JSON object with exactly these fields:

{
  "patientName": string|null,
  "healthRecords": [ { "type": "visit"|"vaccine"|"lab"|"procedure"|"note", "title": string, "date": "YYYY-MM-DD", "clinic": string|null, "summary": string|null } ],
  "medications": [ { "name": string, "dose": string, "frequency": string, "doseIntervalValue": number|null, "doseIntervalUnit": "hours"|"days"|"weeks"|"months"|null, "instructions": string|null } ],
  "reminders": [ { "title": string, "dueDate": "YYYY-MM-DD", "category": "appointment"|"vaccine"|"medication"|"wellness"|"other", "note": string|null } ],
  "vetInfo": { "name": string|null, "clinic": string|null, "phone": string|null, "address": string|null } | null
}

Rules:
- patientName: the pet/patient's name exactly as written in the document (e.g. next to "Patient:", "Pet Name:", or similar). null if the document doesn't state one or it's illegible — never guess.
- healthRecords: one entry per distinct visit/vaccine/lab/procedure/note documented. "type" must be exactly one of the listed values — pick the closest match (an exam/checkup is "visit", a vaccination is "vaccine").
- medications: one entry per medication/prescription mentioned, "dose" as written (e.g. "5mg", "1 tablet"). Only set doseIntervalValue/doseIntervalUnit if the document states a clear fixed interval (e.g. "twice daily" -> 12/"hours", "every 30 days" -> 30/"days"); otherwise leave both null and describe the schedule in "frequency" as free text.
- reminders: only include a follow-up if the document explicitly states one is needed (e.g. "recheck in 2 weeks", "next booster due March 2027"). Compute "dueDate" as an absolute date from the document's own dated context; omit the reminder if no date can be determined.
- vetInfo: the attending veterinarian and/or clinic's contact info as stated in the document (letterhead, signature block, a "Veterinarian:" field, etc.) — name, clinic, phone, address, each null if that specific piece isn't stated. Return vetInfo itself as null if the document gives no vet/clinic contact info at all.
- Dates must be in YYYY-MM-DD format.
- Output only the JSON object — no commentary, no markdown fences.`;

export interface ExtractionResult {
  healthRecords: z.infer<typeof CreateHealthRecordBody>[];
  medications: z.infer<typeof CreateMedicationBody>[];
  reminders: z.infer<typeof CreateReminderBody>[];
  // Only the pet-profile fields that are both (a) actually stated in the
  // document and (b) different from what's already on the pet's profile.
  // Omitted keys mean "leave this field alone" when later applied as a
  // partial pet update — never null, which would mean "clear this field".
  // Null (not an empty object) when there's nothing worth proposing at all.
  vetInfoUpdate: { vetName?: string; vetClinic?: string; vetPhone?: string; vetAddress?: string } | null;
}

interface CurrentPetVetInfo {
  vetName: string | null;
  vetClinic: string | null;
  vetPhone: string | null;
  vetAddress: string | null;
}

type CurrentPet = CurrentPetVetInfo & { name: string };

function normalizeForCompare(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function buildVetInfoUpdate(
  raw: unknown,
  currentPet: CurrentPetVetInfo,
): ExtractionResult["vetInfoUpdate"] {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  const fieldMap: [sourceKey: string, petKey: keyof CurrentPetVetInfo][] = [
    ["name", "vetName"],
    ["clinic", "vetClinic"],
    ["phone", "vetPhone"],
    ["address", "vetAddress"],
  ];
  const update: NonNullable<ExtractionResult["vetInfoUpdate"]> = {};
  for (const [sourceKey, petKey] of fieldMap) {
    const value = obj[sourceKey];
    if (typeof value !== "string" || !value.trim()) continue;
    if (normalizeForCompare(value) !== normalizeForCompare(currentPet[petKey])) {
      update[petKey] = value.trim();
    }
  }
  return Object.keys(update).length > 0 ? update : null;
}

// Despite the system prompt's "no markdown fences" instruction, Claude
// sometimes wraps the JSON in a ```json ... ``` code fence anyway — a plain
// JSON.parse on that throws and (by design) silently falls back to "no items
// found" rather than erroring, which made a real, correct extraction look
// like an empty one. Strip a fence if present before parsing.
function parseJsonObject(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenced ? fenced[1] : raw;
  try {
    return JSON.parse(candidate);
  } catch {
    return {};
  }
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

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Loose on purpose: word-boundary substring match in either direction, so
// "Milo" matches a document that says "Milo" or "Milo (Canine)" or "Milo
// Smith", not just an exact string. A name the document never states at all
// (patientName null) is not treated as a mismatch — plenty of real reports
// don't repeat the pet's name anywhere machine-readable, and that's not
// evidence it's the wrong pet.
function namesLikelyMatch(expectedPetName: string, documentPatientName: string): boolean {
  const a = expectedPetName.trim().toLowerCase();
  const b = documentPatientName.trim().toLowerCase();
  if (!a || !b) return true;
  if (a === b) return true;
  const aInB = new RegExp(`\\b${escapeRegExp(a)}\\b`).test(b);
  const bInA = new RegExp(`\\b${escapeRegExp(b)}\\b`).test(a);
  return aInB || bInA;
}

// Claude's vision input only accepts these four formats. HEIC/HEIF (allowed
// at upload time, per ALLOWED_DOCUMENT_MIME_TYPES) is converted to JPEG in
// readContent() above before reaching this type, so by the time content.kind
// is "image" here, content.mimetype is always one of these four already.
type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export async function extractDocument(file: UploadedFile, pet: CurrentPet): Promise<ExtractionResult> {
  const content = await readContent(file);

  const completion = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      content.kind === "text"
        ? { role: "user", content: `Vet report text:\n\n${content.text}` }
        : {
            role: "user",
            content: [
              { type: "text", text: "Extract structured info from this vet report image." },
              {
                type: "image",
                source: { type: "base64", media_type: content.mimetype as ImageMediaType, data: content.base64 },
              },
            ],
          },
    ],
  });

  const textBlock = completion.content.find((block) => block.type === "text");
  const raw = textBlock?.text ?? "{}";
  const parsed = parseJsonObject(raw);
  const obj = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};

  const patientName = typeof obj.patientName === "string" ? obj.patientName.trim() : "";
  if (patientName && !namesLikelyMatch(pet.name, patientName)) {
    throw new PetNameMismatchError(
      `This document appears to be for a pet named "${patientName}", not ${pet.name}. Please double-check you're uploading the correct report.`,
    );
  }

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
    vetInfoUpdate: buildVetInfoUpdate(obj.vetInfo, pet),
  };
}
