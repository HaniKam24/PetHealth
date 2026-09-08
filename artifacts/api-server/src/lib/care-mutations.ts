import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, healthRecords, medications, pets, reminders } from "@workspace/db";
import type { CreateHealthRecordBody, CreateMedicationBody, CreateReminderBody } from "@workspace/api-zod";
import { runCareRecommendationsEngine } from "./care-recommendations";

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
  return created!;
}

// Every field optional and, when present, non-empty — matches how
// buildVetInfoUpdate (document-extraction.ts) builds a vet_info item's
// proposedData: only the fields the source document actually stated, never
// null. An owner editing the proposal before accepting goes through this
// same schema, so it can't smuggle in an empty string to blank a field —
// clearing a vet field is done from the pet's own profile page, not here.
export const VetInfoUpdateBody = z.object({
  vetName: z.string().min(1).optional(),
  vetClinic: z.string().min(1).optional(),
  vetPhone: z.string().min(1).optional(),
  vetAddress: z.string().min(1).optional(),
});

export async function updatePetVetInfo(petId: number, body: z.infer<typeof VetInfoUpdateBody>) {
  const [updated] = await db.update(pets).set(body).where(eq(pets.id, petId)).returning();
  return updated!;
}
