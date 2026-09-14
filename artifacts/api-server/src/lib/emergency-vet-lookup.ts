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

export interface EmergencyVetLookupResult {
  vets: EmergencyVet[];
  script: string;
}

const SYSTEM_PROMPT = `You are helping a pet owner in a possible emergency find real, nearby emergency veterinary clinics. Use the web_search tool to search for emergency or 24-hour veterinary clinics near the given zipcode.

Rules — these matter, this is a genuine emergency:
- Only include clinics you actually found via search. Never invent a name, phone number, or address.
- Never state or imply a clinic is currently open — web search results don't reliably reflect real-time hours. Every clinic in your list is understood to need a call to confirm they're open and can take the pet before driving over.
- Write a short script (2-4 sentences) the owner can read when they call: it must mention the specific symptom described below, that they believe it's an emergency, and that they're on their way — grounded in what was actually described, not generic.
- If you can't find any real results for this area, return an empty vets array rather than guessing.

After searching, respond with ONLY a single JSON object in this exact shape, no commentary, no markdown fences:
{ "vets": [ { "name": string, "phone": string, "address": string|null } ], "script": string }`;

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

  return { vets, script: obj.script };
}

export async function lookupEmergencyVets(
  petName: string,
  zipCode: string,
  recentQuestion: string,
): Promise<EmergencyVetLookupResult | null> {
  const completion = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    messages: [
      {
        role: "user",
        content: `Pet: ${petName}\nZipcode: ${zipCode}\nWhat the owner described: ${recentQuestion}`,
      },
    ],
  });

  const textBlocks = completion.content.filter((block) => block.type === "text");
  const lastText = textBlocks[textBlocks.length - 1];
  if (!lastText || lastText.type !== "text") return null;

  return parseResult(parseJsonObject(lastText.text));
}
