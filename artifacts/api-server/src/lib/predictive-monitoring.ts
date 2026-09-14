import { and, desc, eq, gte } from "drizzle-orm";
import { db, alerts, symptomEntries } from "@workspace/db";

// Predictive Health Monitoring (Bolts 23/24) — same shape as the Care
// Recommendations Engine (care-recommendations.ts): pure rule-based date
// arithmetic, zero AI-provider calls, run synchronously right after the
// mutation that could change its inputs (a new symptom_entries row).
//
// Every threshold here is cited against real veterinary guidance in
// docs/PRD.md §7e, not assumed. This file has exactly one job — detect a
// pattern and decide severity from that pattern's own timing and
// combination with other patterns. It NEVER attempts to connect a symptom
// to a medication or a diagnosis — that requires real judgment applied to
// a specific case, which is Pawlie's job (see the "Ask Pawlie about this"
// handoff on the alert card), not a hardcoded rule table this file would
// have to maintain and could get wrong.

const DAY_MS = 24 * 60 * 60 * 1000;

type Entry = typeof symptomEntries.$inferSelect;

export interface ReasoningItem {
  signal: string;
  value: string;
  // Always null in this version — see the file-level note above. Kept in
  // the shape (matches the published data model) for forward-compatibility
  // with a real, structured historical-fact source, if one is ever built.
  historicalDataPoint: string | null;
  weight: number;
}

interface PatternMatch {
  reasoning: ReasoningItem;
  confidence: "low" | "medium" | "high";
}

function confidenceFromRatio(matched: number, considered: number): "low" | "medium" | "high" {
  const ratio = considered > 0 ? matched / considered : 0;
  if (ratio >= 0.85) return "high";
  if (ratio >= 0.6) return "medium";
  return "low";
}

function confidenceFromCount(count: number, mediumAt: number, highAt: number): "low" | "medium" | "high" {
  if (count >= highAt) return "high";
  if (count >= mediumAt) return "medium";
  return "low";
}

function dateLabel(entries: Entry[]): string {
  if (entries.length === 0) return "";
  const dates = entries.map((e) => e.loggedAt.toISOString().slice(0, 10)).sort();
  const first = dates[0]!;
  const last = dates[dates.length - 1]!;
  return first === last ? first : `${first} to ${last}`;
}

function toUtcDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Energy/appetite: low in 3 of the pet's last 4 entries, within 7 days.
// "A couple of off days is generally not a big problem... but recurring
// episodes... frequently point to a chronic progressive illness" — VCA.
function checkLowScale(
  entries: Entry[],
  field: "energy" | "appetite",
  windowDays: number,
  consideredCount: number,
  neededCount: number,
): PatternMatch | null {
  const cutoff = new Date(Date.now() - windowDays * DAY_MS);
  // Only entries that actually recorded this field — an owner logging just
  // "limping today" with energy left blank must not count as one of the
  // "last N energy observations" and crowd out the entries that did.
  const inWindow = entries.filter((e) => e.loggedAt >= cutoff && e[field] !== null).slice(0, consideredCount);
  const matched = inWindow.filter((e) => e[field] === "low");
  if (matched.length < neededCount) return null;
  return {
    confidence: confidenceFromRatio(matched.length, inWindow.length),
    reasoning: {
      signal: `low_${field}`,
      value: `Low ${field} in ${matched.length} of the last ${inWindow.length} entries (${dateLabel(inWindow)})`,
      historicalDataPoint: null,
      weight: inWindow.length > 0 ? matched.length / inWindow.length : 0,
    },
  };
}

// Diarrhea: 2 of the last 3 entries, within 5 days. Soft stool alone is
// common and usually transient — not specific enough to flag responsibly.
function checkDiarrhea(entries: Entry[]): PatternMatch | null {
  const cutoff = new Date(Date.now() - 5 * DAY_MS);
  const inWindow = entries.filter((e) => e.loggedAt >= cutoff && e.stoolQuality !== null).slice(0, 3);
  const matched = inWindow.filter((e) => e.stoolQuality === "diarrhea");
  if (matched.length < 2) return null;
  return {
    confidence: confidenceFromRatio(matched.length, inWindow.length),
    reasoning: {
      signal: "diarrhea",
      value: `Diarrhea in ${matched.length} of the last ${inWindow.length} entries (${dateLabel(inWindow)})`,
      historicalDataPoint: null,
      weight: inWindow.length > 0 ? matched.length / inWindow.length : 0,
    },
  };
}

// Vomiting has two independent checks, since the journal allows multiple
// same-day entries and real guidance treats same-day frequency and
// recurrence-across-days as two different signals (Merck / VCA).
function checkVomitingSameDaySevere(entries: Entry[]): PatternMatch | null {
  const cutoff = new Date(Date.now() - 7 * DAY_MS);
  const inWindow = entries.filter((e) => e.loggedAt >= cutoff && e.vomiting === true);
  const byDay = new Map<string, number>();
  for (const e of inWindow) {
    const day = toUtcDateString(e.loggedAt);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  const worstDay = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!worstDay || worstDay[1] < 2) return null;
  const [day, count] = worstDay;
  return {
    confidence: confidenceFromCount(count, 2, 3),
    reasoning: {
      signal: "vomiting_severe_sameday",
      value: `Vomited ${count} times on ${day}`,
      historicalDataPoint: null,
      weight: 1,
    },
  };
}

function checkVomitingRecurring(entries: Entry[]): PatternMatch | null {
  const cutoff = new Date(Date.now() - 7 * DAY_MS);
  const days = new Set(
    entries.filter((e) => e.loggedAt >= cutoff && e.vomiting === true).map((e) => toUtcDateString(e.loggedAt)),
  );
  if (days.size < 2) return null;
  return {
    confidence: confidenceFromCount(days.size, 2, 3),
    reasoning: {
      signal: "vomiting_recurring",
      value: `Vomiting logged on ${days.size} separate days in the last week`,
      historicalDataPoint: null,
      weight: Math.min(1, days.size / 4),
    },
  };
}

// Limping: 2+ entries within 4 days — approximates "persisting more than a
// day," the standard threshold. A genuinely acute case is an emergency the
// owner would describe in a Pawlie chat message, where the existing
// red-flag escalation already handles it immediately — this is for the
// slower, easy-to-miss case, not a replacement for that.
function checkLimping(entries: Entry[]): PatternMatch | null {
  const cutoff = new Date(Date.now() - 4 * DAY_MS);
  const matched = entries.filter((e) => e.loggedAt >= cutoff && e.limping === true);
  if (matched.length < 2) return null;
  return {
    confidence: confidenceFromCount(matched.length, 2, 3),
    reasoning: {
      signal: "limping",
      value: `Limping logged ${matched.length} times in the last 4 days (${dateLabel(matched)})`,
      historicalDataPoint: null,
      weight: Math.min(1, matched.length / 4),
    },
  };
}

const CONFIDENCE_RANK: Record<PatternMatch["confidence"], number> = { low: 1, medium: 2, high: 3 };

export async function runPredictiveMonitoringEngine(petId: number, triggeredByEntryId: number | null): Promise<void> {
  const cutoff = new Date(Date.now() - 7 * DAY_MS);
  const recentEntries = await db
    .select()
    .from(symptomEntries)
    .where(and(eq(symptomEntries.petId, petId), gte(symptomEntries.loggedAt, cutoff)))
    .orderBy(desc(symptomEntries.loggedAt));

  const sameDaySevereVomiting = checkVomitingSameDaySevere(recentEntries);
  const yellowLevelMatches = [
    checkLowScale(recentEntries, "energy", 7, 4, 3),
    checkLowScale(recentEntries, "appetite", 7, 4, 3),
    checkDiarrhea(recentEntries),
    checkVomitingRecurring(recentEntries),
    checkLimping(recentEntries),
  ].filter((m): m is PatternMatch => m !== null);

  const allMatches = sameDaySevereVomiting ? [sameDaySevereVomiting, ...yellowLevelMatches] : yellowLevelMatches;

  let severity: "yellow" | "red" | null = null;
  if (sameDaySevereVomiting || yellowLevelMatches.length >= 2) {
    severity = "red";
  } else if (yellowLevelMatches.length === 1) {
    severity = "yellow";
  }

  const [existingActive] = await db
    .select()
    .from(alerts)
    .where(and(eq(alerts.petId, petId), eq(alerts.status, "active")));

  if (!severity) {
    // Nothing flagged now — if a previously-active alert exists, the
    // pattern that triggered it no longer holds, so it's resolved rather
    // than left stale forever.
    if (existingActive) {
      await db
        .update(alerts)
        .set({ status: "resolved", resolvedAt: new Date() })
        .where(eq(alerts.id, existingActive.id));
    }
    return;
  }

  const confidence = allMatches.reduce<PatternMatch["confidence"]>(
    (best, m) => (CONFIDENCE_RANK[m.confidence] > CONFIDENCE_RANK[best] ? m.confidence : best),
    "low",
  );
  const reasoning = allMatches.map((m) => m.reasoning);

  if (existingActive) {
    await db
      .update(alerts)
      .set({ severity, confidence, reasoning, triggeredByEntryId })
      .where(eq(alerts.id, existingActive.id));
  } else {
    await db.insert(alerts).values({ petId, triggeredByEntryId, severity, confidence, reasoning, status: "active" });
  }
}
