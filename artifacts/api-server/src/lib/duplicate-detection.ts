import { and, eq } from "drizzle-orm";
import { db, healthRecords, medications, reminders } from "@workspace/db";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function daysApart(a: string | Date, b: string | Date): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime());
}

function looselyMatches(a: string, b: string): boolean {
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  return x.length > 0 && y.length > 0 && (x.includes(y) || y.includes(x));
}

// CreateHealthRecordBody/CreateReminderBody parse their date fields with
// zod.coerce.date() — by the time a proposed item's data reaches here, its
// date is a real Date instance, never a plain string. A prior version of
// this file only accepted a string here, which silently made date-based
// duplicate matching a no-op for every health_record/reminder proposal.
function asDateInput(value: unknown): string | Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string" && value) return value;
  return null;
}

export interface DuplicateMatch {
  type: "health_record" | "medication" | "reminder";
  id: number;
}

/**
 * Loose heuristics only — pet + type/name + date proximity. Never used to
 * silently drop a proposed item, only to flag it for the owner to decide.
 */
export async function findDuplicate(
  petId: number,
  itemType: "health_record" | "medication" | "reminder",
  data: Record<string, unknown>,
): Promise<DuplicateMatch | null> {
  if (itemType === "health_record") {
    const type = typeof data.type === "string" ? data.type : null;
    const date = asDateInput(data.date);
    if (!type || !date) return null;
    const rows = await db
      .select()
      .from(healthRecords)
      .where(and(eq(healthRecords.petId, petId), eq(healthRecords.type, type)));
    const match = rows.find((r) => daysApart(r.date, date) <= THREE_DAYS_MS);
    return match ? { type: "health_record", id: match.id } : null;
  }

  if (itemType === "medication") {
    const name = typeof data.name === "string" ? data.name : null;
    if (!name) return null;
    const rows = await db
      .select()
      .from(medications)
      .where(and(eq(medications.petId, petId), eq(medications.active, true)));
    const match = rows.find((r) => looselyMatches(r.name, name));
    return match ? { type: "medication", id: match.id } : null;
  }

  const title = typeof data.title === "string" ? data.title : null;
  const dueDate = asDateInput(data.dueDate);
  if (!title || !dueDate) return null;
  const rows = await db.select().from(reminders).where(eq(reminders.petId, petId));
  const match = rows.find((r) => daysApart(r.dueDate, dueDate) <= THREE_DAYS_MS && looselyMatches(r.title, title));
  return match ? { type: "reminder", id: match.id } : null;
}
