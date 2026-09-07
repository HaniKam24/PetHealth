import { Router, type IRouter, type Request } from "express";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  AskInsightBody,
  CompleteReminderParams,
  CreateHealthRecordBody,
  CreateHealthRecordParams,
  CreateMedicationBody,
  CreateMedicationParams,
  CreatePetBody,
  CreateReminderBody,
  CreateReminderParams,
  DeleteHealthRecordParams,
  DeletePetParams,
  GetDashboardSummaryQueryParams,
  GetPetParams,
  ListHealthRecordsParams,
  ListInsightsQueryParams,
  ListMedicationsParams,
  ListRemindersParams,
  LogMedicationDoseParams,
  UpdateHealthRecordBody,
  UpdateHealthRecordParams,
  UpdateMedicationBody,
  UpdateMedicationParams,
  UploadHealthRecordDocumentParams,
  UpdatePetBody,
  UpdatePetParams,
} from "@workspace/api-zod";
import {
  db,
  healthRecords,
  insights,
  medications,
  petOwners,
  pets,
  reminders,
} from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { uploadHealthRecordDocument } from "../lib/storage";
import { runCareRecommendationsEngine } from "../lib/care-recommendations";
import { ALLOWED_DOCUMENT_MIME_TYPES, handleSingleFileUpload } from "../lib/upload-middleware";

const router: IRouter = Router();
const MAX_PETS_PER_ACCOUNT = 3;
const DISCLAIMER =
  "AI guidance is educational and is not a diagnosis. Contact a licensed veterinarian for medical advice, and seek urgent care for severe or rapidly worsening symptoms.";

// Passes `null`/`undefined` through as-is rather than coalescing to `null` —
// an omitted field on a partial PATCH must leave the column untouched, not
// clear it, while an explicit `null` still clears it.
const asDateString = (value: Date | string | null | undefined) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : value;

const asWeightString = (value: number | null | undefined) =>
  value === undefined ? undefined : value === null ? null : value.toString();

const asPet = (pet: typeof pets.$inferSelect) => ({
  ...pet,
  weight: pet.weight === null ? null : Number(pet.weight),
});

const asMedication = (medication: typeof medications.$inferSelect) => ({
  ...medication,
  nextDoseAt: medication.nextDoseAt?.toISOString() ?? null,
});

// A calendar month has no fixed length — 30 days is an approximation, fine
// for scheduling reminders but not for anything date-precise.
const INTERVAL_MS: Record<"hours" | "days" | "weeks" | "months", number> = {
  hours: 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
  weeks: 7 * 24 * 60 * 60 * 1000,
  months: 30 * 24 * 60 * 60 * 1000,
};

const asInsight = (insight: typeof insights.$inferSelect) => ({
  ...insight,
  createdAt: insight.createdAt.toISOString(),
});

// ---------------------------------------------------------------------------
// Ownership helpers — every pet-scoped read/write goes through one of these.
// ---------------------------------------------------------------------------

// better-auth's `User.id` is typed `string` regardless of adapter; our schema
// uses integer ids (`advanced.database.generateId: "serial"`), so the actual
// runtime value is already numeric — this just satisfies the type checker.
function requireUserId(req: Request): number {
  return Number(req.user!.id);
}

async function getOwnedPetIds(userId: number): Promise<number[]> {
  const rows = await db
    .select({ petId: petOwners.petId })
    .from(petOwners)
    .where(eq(petOwners.userId, userId));
  return rows.map((row) => row.petId);
}

async function isPetOwnedByUser(userId: number, petId: number): Promise<boolean> {
  const [row] = await db
    .select({ petId: petOwners.petId })
    .from(petOwners)
    .where(and(eq(petOwners.userId, userId), eq(petOwners.petId, petId)));
  return !!row;
}

router.get("/pets", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const ownedIds = await getOwnedPetIds(userId);
    if (ownedIds.length === 0) {
      res.json([]);
      return;
    }
    const rows = await db
      .select()
      .from(pets)
      .where(inArray(pets.id, ownedIds))
      .orderBy(asc(pets.id));
    res.json(rows.map(asPet));
  } catch (error) {
    next(error);
  }
});

router.post("/pets", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const owned = await getOwnedPetIds(userId);
    if (owned.length >= MAX_PETS_PER_ACCOUNT) {
      res.status(400).json({
        error: `Accounts are limited to ${MAX_PETS_PER_ACCOUNT} pets. Remove a pet before adding another.`,
      });
      return;
    }
    const body = CreatePetBody.parse(req.body);
    const [created] = await db
      .insert(pets)
      .values({
        ...body,
        birthDate: asDateString(body.birthDate),
        weight: asWeightString(body.weight),
        // Starts the one-time Smart Document Upload onboarding-import window
        // (see lib/document-import-quota.ts) — first 30 days of this pet existing.
        importWindowEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })
      .returning();
    await db
      .insert(petOwners)
      .values({ userId, petId: created!.id, role: "owner" });
    await runCareRecommendationsEngine(created!);
    res.status(201).json(asPet(created!));
  } catch (error) {
    next(error);
  }
});

router.get("/pets/:petId", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId } = GetPetParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const [pet] = await db.select().from(pets).where(eq(pets.id, petId));
    if (!pet) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    res.json(asPet(pet));
  } catch (error) {
    next(error);
  }
});

router.patch("/pets/:petId", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId } = UpdatePetParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const body = UpdatePetBody.parse(req.body);
    const [updated] = await db
      .update(pets)
      .set({
        ...body,
        birthDate: asDateString(body.birthDate),
        weight: asWeightString(body.weight),
      })
      .where(eq(pets.id, petId))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    await runCareRecommendationsEngine(updated);
    res.json(asPet(updated));
  } catch (error) {
    next(error);
  }
});

router.delete("/pets/:petId", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId } = DeletePetParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    await db.delete(pets).where(eq(pets.id, petId));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get("/pets/:petId/records", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId } = ListHealthRecordsParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    res.json(
      await db
        .select()
        .from(healthRecords)
        .where(eq(healthRecords.petId, petId))
        .orderBy(desc(healthRecords.date)),
    );
  } catch (error) {
    next(error);
  }
});

router.post("/pets/:petId/records", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId } = CreateHealthRecordParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const body = CreateHealthRecordBody.parse(req.body);
    const [created] = await db
      .insert(healthRecords)
      .values({ petId, ...body, date: asDateString(body.date)! })
      .returning();
    const [pet] = await db.select().from(pets).where(eq(pets.id, petId));
    if (pet) await runCareRecommendationsEngine(pet);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.patch("/pets/:petId/records/:recordId", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId, recordId } = UpdateHealthRecordParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const body = UpdateHealthRecordBody.parse(req.body);
    const [updated] = await db
      .update(healthRecords)
      .set({ ...body, date: asDateString(body.date)! })
      .where(and(eq(healthRecords.id, recordId), eq(healthRecords.petId, petId)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Record not found" });
      return;
    }
    const [pet] = await db.select().from(pets).where(eq(pets.id, petId));
    if (pet) await runCareRecommendationsEngine(pet);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete("/pets/:petId/records/:recordId", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId, recordId } = DeleteHealthRecordParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const [deleted] = await db
      .delete(healthRecords)
      .where(and(eq(healthRecords.id, recordId), eq(healthRecords.petId, petId)))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Record not found" });
      return;
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post(
  "/pets/:petId/documents",
  handleSingleFileUpload("file"),
  async (req, res, next) => {
    try {
      const userId = requireUserId(req);
      const { petId } = UploadHealthRecordDocumentParams.parse(req.params);
      if (!(await isPetOwnedByUser(userId, petId))) {
        res.status(404).json({ error: "Pet not found" });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "A file is required." });
        return;
      }
      if (!ALLOWED_DOCUMENT_MIME_TYPES.has(req.file.mimetype)) {
        res.status(400).json({ error: "Only PDF and image files are supported." });
        return;
      }
      const result = await uploadHealthRecordDocument(petId, req.file);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },
);

router.get("/pets/:petId/medications", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId } = ListMedicationsParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const rows = await db
      .select()
      .from(medications)
      .where(eq(medications.petId, petId))
      .orderBy(asc(medications.nextDoseAt));
    res.json(rows.map(asMedication));
  } catch (error) {
    next(error);
  }
});

router.post("/pets/:petId/medications", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId } = CreateMedicationParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const body = CreateMedicationBody.parse(req.body);
    const [created] = await db
      .insert(medications)
      .values({
        petId,
        ...body,
        nextDoseAt: body.nextDoseAt ? new Date(body.nextDoseAt) : null,
      })
      .returning();
    res.status(201).json(asMedication(created!));
  } catch (error) {
    next(error);
  }
});

router.patch("/pets/:petId/medications/:medicationId", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId, medicationId } = UpdateMedicationParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const body = UpdateMedicationBody.parse(req.body);
    const [updated] = await db
      .update(medications)
      .set(body)
      .where(and(eq(medications.id, medicationId), eq(medications.petId, petId)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Medication not found" });
      return;
    }
    res.json(asMedication(updated));
  } catch (error) {
    next(error);
  }
});

router.post("/pets/:petId/medications/:medicationId/log-dose", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId, medicationId } = LogMedicationDoseParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const [medication] = await db
      .select()
      .from(medications)
      .where(and(eq(medications.id, medicationId), eq(medications.petId, petId)));
    if (!medication) {
      res.status(404).json({ error: "Medication not found" });
      return;
    }
    if (!medication.doseIntervalValue || !medication.doseIntervalUnit) {
      res.status(400).json({
        error: "This medication doesn't have a structured schedule set, so the next dose can't be calculated automatically. Edit the medication to add one.",
      });
      return;
    }
    const intervalMs = medication.doseIntervalValue * INTERVAL_MS[medication.doseIntervalUnit];
    // Base off the previous scheduled dose (not "now") so an early or late
    // mark-as-given doesn't drift the schedule.
    const base = medication.nextDoseAt ?? new Date();
    const nextDoseAt = new Date(base.getTime() + intervalMs);
    const [updated] = await db
      .update(medications)
      .set({ nextDoseAt })
      .where(eq(medications.id, medicationId))
      .returning();
    res.json(asMedication(updated!));
  } catch (error) {
    next(error);
  }
});

router.get("/pets/:petId/reminders", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId } = ListRemindersParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    res.json(
      await db
        .select()
        .from(reminders)
        .where(eq(reminders.petId, petId))
        .orderBy(asc(reminders.dueDate)),
    );
  } catch (error) {
    next(error);
  }
});

router.post("/pets/:petId/reminders", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId } = CreateReminderParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const body = CreateReminderBody.parse(req.body);
    const [created] = await db
      .insert(reminders)
      .values({
        petId,
        ...body,
        dueDate: asDateString(body.dueDate)!,
        completed: false,
        source: "owner",
      })
      .returning();
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.post("/reminders/:reminderId/complete", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { reminderId } = CompleteReminderParams.parse(req.params);
    const [reminder] = await db
      .select()
      .from(reminders)
      .where(eq(reminders.id, reminderId));
    if (!reminder || !(await isPetOwnedByUser(userId, reminder.petId))) {
      res.status(404).json({ error: "Reminder not found" });
      return;
    }
    const [updated] = await db
      .update(reminders)
      .set({ completed: true })
      .where(eq(reminders.id, reminderId))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Reminder not found" });
      return;
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.get("/insights", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId } = ListInsightsQueryParams.parse(req.query);
    const ownedIds = await getOwnedPetIds(userId);
    if (ownedIds.length === 0) {
      res.json([]);
      return;
    }
    if (petId && !ownedIds.includes(petId)) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const condition = petId ? eq(insights.petId, petId) : inArray(insights.petId, ownedIds);
    const rows = await db
      .select()
      .from(insights)
      .where(condition)
      .orderBy(desc(insights.createdAt))
      .limit(12);
    res.json(rows.map(asInsight));
  } catch (error) {
    next(error);
  }
});

router.post("/insights", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId, question } = AskInsightBody.parse(req.body);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }

    const [pet] = await db.select().from(pets).where(eq(pets.id, petId));
    if (!pet) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }

    const records = await db
      .select()
      .from(healthRecords)
      .where(eq(healthRecords.petId, petId))
      .orderBy(desc(healthRecords.date))
      .limit(8);
    const meds = await db
      .select()
      .from(medications)
      .where(and(eq(medications.petId, petId), eq(medications.active, true)));

    const completion = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content:
            "You are a cautious pet care education assistant for pet owners. Give concise, practical, plain-language guidance grounded only in the supplied profile and records. Never diagnose, prescribe, change medication, or claim certainty. If the question mentions trouble breathing, collapse, seizures, uncontrolled bleeding, poisoning, inability to urinate, a swollen abdomen, severe pain, or rapidly worsening symptoms, lead with seeking emergency veterinary care now. Otherwise explain what to observe, low-risk supportive steps, and when to contact a veterinarian. Keep the answer under 170 words.",
        },
        {
          role: "user",
          content: JSON.stringify({
            pet: asPet(pet),
            recentRecords: records,
            activeMedications: meds.map(asMedication),
            ownerQuestion: question,
          }),
        },
      ],
    });

    const content =
      completion.choices[0]?.message?.content?.trim() ||
      "I could not prepare guidance right now. If you are concerned about a new or worsening symptom, contact your veterinarian.";
    const urgentPattern =
      /trouble breathing|collapse|seizure|uncontrolled bleeding|poison|cannot urinate|swollen abdomen|severe pain|emergency/i;
    const tone = urgentPattern.test(question) ? "urgent" : "helpful";
    const [created] = await db
      .insert(insights)
      .values({
        petId,
        title: tone === "urgent" ? "Please seek urgent veterinary care" : "Guidance for your question",
        content,
        tone,
        source: "ai",
        disclaimer: DISCLAIMER,
      })
      .returning();
    res.json(asInsight(created!));
  } catch (error) {
    next(error);
  }
});

router.get("/dashboard/summary", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId } = GetDashboardSummaryQueryParams.parse(req.query);
    const ownedIds = await getOwnedPetIds(userId);
    if (ownedIds.length === 0) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    if (petId && !ownedIds.includes(petId)) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }

    const [pet] = petId
      ? await db.select().from(pets).where(eq(pets.id, petId))
      : await db
          .select()
          .from(pets)
          .where(inArray(pets.id, ownedIds))
          .orderBy(asc(pets.id))
          .limit(1);
    if (!pet) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }

    const [records, meds, todos, recentInsights] = await Promise.all([
      db.select().from(healthRecords).where(eq(healthRecords.petId, pet.id)).orderBy(desc(healthRecords.date)),
      db.select().from(medications).where(and(eq(medications.petId, pet.id), eq(medications.active, true))).orderBy(asc(medications.nextDoseAt)),
      db.select().from(reminders).where(and(eq(reminders.petId, pet.id), eq(reminders.completed, false))).orderBy(asc(reminders.dueDate)),
      db.select().from(insights).where(eq(insights.petId, pet.id)).orderBy(desc(insights.createdAt)).limit(4),
    ]);

    res.json({
      pet: asPet(pet),
      upcomingReminders: todos.slice(0, 5),
      activeMedications: meds.map(asMedication),
      recentRecords: records.slice(0, 5),
      recentInsights: recentInsights.map(asInsight),
      stats: {
        recordCount: records.length,
        activeMedicationCount: meds.length,
        upcomingReminderCount: todos.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
