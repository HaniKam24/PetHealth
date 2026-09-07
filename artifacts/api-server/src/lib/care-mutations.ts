import { eq } from "drizzle-orm";
import type { z } from "zod";
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
