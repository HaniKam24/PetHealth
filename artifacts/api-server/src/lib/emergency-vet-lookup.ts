import { anthropic } from "@workspace/integrations-anthropic-ai-server";

// Same low-cost model tier as symptom chat / document extraction — this is
// the one Pawlie path that spends real per-call money beyond that tier
// (Anthropic's web_search server tool, ~$10/1,000 searches), so there's no
// reason to reach for anything pricier.
const MODEL = "claude-haiku-4-5";

export interface EmergencyVet {
  name: string;
  phone: string;
  address: string | null;
}

// Same field vocabulary as symptom_entries, all optional — only fields the
// owner actually described (in either message) get filled in.
export interface ExtractedSymptomEntry {
  appetite?: "low" | "normal" | "high";
  energy?: "low" | "normal" | "high";
  stoolQuality?: "normal" | "soft" | "diarrhea" | "constipated";
  vomiting?: boolean;
  limping?: boolean;
  behaviorNote?: string;
  note?: string;
}

export interface EmergencyVetLookupResult {
  vets: EmergencyVet[];
  script: string;
  symptomEntry: ExtractedSymptomEntry | null;
}

// Structurally compatible with symptomEntries.$inferSelect (lib/db) without
// importing the schema directly — this file stays a plain Anthropic-calling
// lib, same shape as document-extraction.ts's own CurrentPet interface.
export interface RecentSymptomEntry {
  loggedAt: Date;
  appetite: string | null;
  energy: string | null;
  stoolQuality: string | null;
  vomiting: boolean | null;
  limping: boolean | null;
  behaviorNote: string | null;
  note: string | null;
}

// One line per entry, timestamped, only the fields actually logged — lets
// the model see real recurrence/frequency (e.g. "vomiting on 3 separate
// days this week") directly from the raw dated list rather than a
// pre-aggregated summary that could get the counting wrong.
function formatSymptomJournal(entries: RecentSymptomEntry[]): string {
  if (entries.length === 0) return "No Symptom Journal entries logged for this pet.";
  return entries
    .map((e) => {
      const signals = [
        e.appetite && e.appetite !== "normal" ? `${e.appetite} appetite` : null,
        e.energy && e.energy !== "normal" ? `${e.energy} energy` : null,
        e.stoolQuality && e.stoolQuality !== "normal" ? e.stoolQuality : null,
        e.vomiting ? "vomiting" : null,
        e.limping ? "limping" : null,
        e.behaviorNote,
        e.note,
      ].filter((s): s is string => !!s);
      if (signals.length === 0) return null;
      return `${e.loggedAt.toISOString().replace("T", " ").slice(0, 16)} — ${signals.join(", ")}`;
    })
    .filter((line): line is string => line !== null)
    .join("\n");
}

const SYSTEM_PROMPT = `You are helping a pet owner in a possible emergency find real, nearby emergency veterinary clinics. Use the web_search tool to search for emergency or 24-hour veterinary clinics near the given zipcode.

Rules — these matter, this is a genuine emergency:
- Only include clinics you actually found via search. Never invent a name, phone number, or address.
- Never state or imply a clinic is currently open — web search results don't reliably reflect real-time hours. Every clinic in your list is understood to need a call to confirm they're open and can take the pet before driving over.
- Write a short script (2-4 sentences) the owner can read when they call: it must mention the specific symptom(s), grounded in what the owner actually described AND the pet's own logged Symptom Journal entries below (timestamps included — reference recency/frequency where it's relevant, e.g. "vomiting again this morning, third time in two days") — say they believe it's an emergency and that they're on their way. Never write a generic placeholder like "please provide symptom details" — you have real data below; use it. If genuinely neither the description nor the journal has anything concrete, use whatever the owner actually said, even if brief, rather than asking a question back.
- If you can't find any real results for this area, return an empty vets array rather than guessing.
- Separately, extract any NEW symptom detail the owner just described in either of their two messages below (the original description and their zipcode reply — that reply often adds more, e.g. "02143, he's also drooling a lot") into a structured symptomEntry, using ONLY these fields: appetite (low/normal/high), energy (low/normal/high), stoolQuality (normal/soft/diarrhea/constipated), vomiting (boolean), limping (boolean), behaviorNote (short string), note (short string, anything else concrete). Only include a field if it was actually stated or unambiguously implied — never infer from the Symptom Journal history (that's already logged, don't duplicate it) and never guess. Omit a field entirely rather than including a low-confidence value. If nothing new and concrete was said, symptomEntry must be null.

After searching, respond with ONLY a single JSON object in this exact shape, no commentary, no markdown fences:
{ "vets": [ { "name": string, "phone": string, "address": string|null } ], "script": string, "symptomEntry": { "appetite"?: string, "energy"?: string, "stoolQuality"?: string, "vomiting"?: boolean, "limping"?: boolean, "behaviorNote"?: string, "note"?: string } | null }`;

// Same defensive parsing as document-extraction.ts's parseJsonObject —
// Claude sometimes wraps JSON in a ```json fence despite instructions not
// to, and a plain JSON.parse on that throws.
function parseJsonObject(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenced ? fenced[1] : raw;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

const APPETITE_ENERGY_VALUES = new Set(["low", "normal", "high"]);
const STOOL_QUALITY_VALUES = new Set(["normal", "soft", "diarrhea", "constipated"]);

function parseSymptomEntry(raw: unknown): ExtractedSymptomEntry | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  const entry: ExtractedSymptomEntry = {};

  if (typeof obj.appetite === "string" && APPETITE_ENERGY_VALUES.has(obj.appetite)) {
    entry.appetite = obj.appetite as ExtractedSymptomEntry["appetite"];
  }
  if (typeof obj.energy === "string" && APPETITE_ENERGY_VALUES.has(obj.energy)) {
    entry.energy = obj.energy as ExtractedSymptomEntry["energy"];
  }
  if (typeof obj.stoolQuality === "string" && STOOL_QUALITY_VALUES.has(obj.stoolQuality)) {
    entry.stoolQuality = obj.stoolQuality as ExtractedSymptomEntry["stoolQuality"];
  }
  if (typeof obj.vomiting === "boolean") entry.vomiting = obj.vomiting;
  if (typeof obj.limping === "boolean") entry.limping = obj.limping;
  if (typeof obj.behaviorNote === "string" && obj.behaviorNote.trim()) entry.behaviorNote = obj.behaviorNote;
  if (typeof obj.note === "string" && obj.note.trim()) entry.note = obj.note;

  return Object.keys(entry).length > 0 ? entry : null;
}

function parseResult(raw: unknown): EmergencyVetLookupResult | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.vets) || typeof obj.script !== "string" || !obj.script.trim()) return null;

  const vets: EmergencyVet[] = [];
  for (const item of obj.vets) {
    if (typeof item !== "object" || item === null) continue;
    const v = item as Record<string, unknown>;
    if (typeof v.name !== "string" || !v.name.trim() || typeof v.phone !== "string" || !v.phone.trim()) continue;
    vets.push({ name: v.name, phone: v.phone, address: typeof v.address === "string" ? v.address : null });
  }

  return { vets, script: obj.script, symptomEntry: parseSymptomEntry(obj.symptomEntry) };
}

export async function lookupEmergencyVets(
  petName: string,
  zipCode: string,
  recentQuestion: string,
  zipReplyMessage: string,
  symptomJournal: RecentSymptomEntry[],
): Promise<EmergencyVetLookupResult | null> {
  const completion = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    messages: [
      {
        role: "user",
        content: `Pet: ${petName}\nZipcode: ${zipCode}\nOriginal description: ${recentQuestion}\nZipcode reply message (may include more than just the zip): ${zipReplyMessage}\n\nRecent Symptom Journal entries (most recent first):\n${formatSymptomJournal(symptomJournal)}`,
      },
    ],
  });

  const textBlocks = completion.content.filter((block) => block.type === "text");
  const lastText = textBlocks[textBlocks.length - 1];
  if (!lastText || lastText.type !== "text") return null;

  return parseResult(parseJsonObject(lastText.text));
}
