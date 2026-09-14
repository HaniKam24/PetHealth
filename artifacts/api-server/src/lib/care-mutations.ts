import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, healthRecords, medications, pets, reminders, symptomLogs, weightLogs } from "@workspace/db";
import type { CreateHealthRecordBody, CreateMedicationBody, CreateReminderBody } from "@workspace/api-zod";
import { runCareRecommendationsEngine, suppressRedundantSystemReminder } from "./care-recommendations";

// Shared with the direct-create routes in routes/care.ts conceptually, but
// kept as a separate module rather than refactoring those already-working
// handlers: this is the one path Smart Document Upload's "accept" endpoint
// also needs, and duplicating ~5 lines here is lower risk than touching
// tested code for a bolt this size.

const asDateString = (value: Date | string | null | undefined) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : value;

export async function insertHealthRecordForPet(petId: number, body: z.infer<typeof CreateHealthRecordBody>) {
  const [created] = await db
    .insert(healthRecords)
    .values({ petId, ...body, date: asDateString(body.date)! })
    .returning();
  const [pet] = await db.select().from(pets).where(eq(pets.id, petId));
  if (pet) await runCareRecommendationsEngine(pet);
  return created!;
}

export async function insertMedicationForPet(petId: number, body: z.infer<typeof CreateMedicationBody>) {
  const [created] = await db
    .insert(medications)
    .values({ petId, ...body, nextDoseAt: body.nextDoseAt ? new Date(body.nextDoseAt) : null })
    .returning();
  return created!;
}

export async function insertReminderForPet(petId: number, body: z.infer<typeof CreateReminderBody>) {
  const [created] = await db
    .insert(reminders)
    .values({ petId, ...body, dueDate: asDateString(body.dueDate)!, completed: false, source: "owner" })
    .returning();
  await suppressRedundantSystemReminder(petId, created!);
  return created!;
}

export async function insertSymptomLogForPet(petId: number, description: string, insightId: number | null = null) {
  const [created] = await db
    .insert(symptomLogs)
    .values({ petId, description, insightId })
    .returning();
  return created!;
}

// Returns null (not a throw) when the reminder doesn't exist or belongs to
// a different pet than expected — same "let the caller decide the HTTP
// response" convention the rest of this file's insert helpers don't need,
// but this one does since it's a lookup-then-mutate, not a pure insert.
export async function completeReminderForPet(petId: number, reminderId: number) {
  const [reminder] = await db.select().from(reminders).where(eq(reminders.id, reminderId));
  if (!reminder || reminder.petId !== petId) return null;
  const [updated] = await db.update(reminders).set({ completed: true }).where(eq(reminders.id, reminderId)).returning();
  return updated!;
}

// Every field optional and, when present, non-empty (or positive, for
// weight) — matches how buildProfileUpdate (document-extraction.ts) builds
// a "vet_info" item's proposedData: only the fields the source document
// actually stated and that differ from the pet's current profile, never
// null. An owner editing the proposal before accepting goes through this
// same schema, so it can't smuggle in an empty string to blank a field —
// clearing a profile field is done from the pet's own profile page, not here.
export const ProfileUpdateBody = z.object({
  vetName: z.string().min(1).optional(),
  vetClinic: z.string().min(1).optional(),
  vetPhone: z.string().min(1).optional(),
  vetAddress: z.string().min(1).optional(),
  breed: z.string().min(1).optional(),
  weight: z.number().positive().optional(),
  weightUnit: z.enum(["lb", "kg"]).optional(),
  sex: z.enum(["female", "male"]).optional(),
});

// previousPet is passed in by the caller (already fetched for the ownership
// check) rather than re-queried here — same "duplicate a few lines instead
// of a risky shared refactor" call as the rest of this file, and it's the
// only way to know whether an accepted weight actually changed for the
// weight_logs snapshot below (mirrors logWeightIfChanged in routes/care.ts,
// not reused directly since that one is a private, unexported function).
export async function updatePetProfile(
  petId: number,
  body: z.infer<typeof ProfileUpdateBody>,
  previousPet: typeof pets.$inferSelect,
) {
  const { weight, weightUnit, ...rest } = body;
  const [updated] = await db
    .update(pets)
    .set({
      ...rest,
      ...(weight !== undefined ? { weight: weight.toString() } : {}),
      ...(weightUnit !== undefined ? { weightUnit } : {}),
    })
    .where(eq(pets.id, petId))
    .returning();
  if (weight !== undefined) {
    const previousWeight = previousPet.weight === null ? null : Number(previousPet.weight);
    if (previousWeight !== weight) {
      await db.insert(weightLogs).values({ petId, weight: weight.toString(), weightUnit: updated!.weightUnit });
    }
  }
  return updated!;
}
