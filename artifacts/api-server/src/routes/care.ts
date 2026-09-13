import { Router, type IRouter, type Request } from "express";
import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
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
  CreateSymptomLogBody,
  CreateSymptomLogParams,
  DeleteHealthRecordParams,
  DeletePetParams,
  GetDashboardSummaryQueryParams,
  GetHealthRecordDocumentUrlParams,
  GetPetParams,
  GetPetTrendsParams,
  ListHealthRecordsParams,
  ListInsightsQueryParams,
  ListMedicationsParams,
  ListRemindersParams,
  ListSymptomLogsParams,
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
  medicationDoseLogs,
  medications,
  petOwners,
  pets,
  reminders,
  symptomLogs,
  weightLogs,
} from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai-server";
import { createSignedDocumentUrl, deleteDocument, uploadHealthRecordDocument } from "../lib/storage";
import { runCareRecommendationsEngine } from "../lib/care-recommendations";
import { buildEscalationMessage, isRedFlagQuestion } from "../lib/symptom-escalation";
import { assertChatQuotaAvailable, ChatQuotaExceededError, getChatQuota, recordChatUsage } from "../lib/chat-quota";
import { ALLOWED_DOCUMENT_MIME_TYPES, handleSingleFileUpload } from "../lib/upload-middleware";
import { logger } from "../lib/logger";

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

// Auto-records a weight_logs snapshot when weight actually changes — never
// on an unrelated PATCH that just happens to re-send the current weight (the
// profile edit form always includes it), and never on an explicit clear to
// null. `previousWeight` is the pet's weight column value before this write.
async function logWeightIfChanged(
  petId: number,
  newWeight: number | null | undefined,
  weightUnit: string,
  previousWeight: string | null,
): Promise<void> {
  if (newWeight === undefined || newWeight === null) return;
  const previous = previousWeight === null ? null : Number(previousWeight);
  if (previous === newWeight) return;
  await db.insert(weightLogs).values({ petId, weight: newWeight.toString(), weightUnit });
}

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

const asSymptomLog = (log: typeof symptomLogs.$inferSelect) => ({
  ...log,
  loggedAt: log.loggedAt.toISOString(),
});

// Best-effort storage cleanup: the DB write it accompanies has already
// succeeded, so a storage failure here is logged, not surfaced to the client.
async function deleteDocumentBestEffort(path: string) {
  try {
    await deleteDocument(path);
  } catch (error) {
    logger.error({ err: error, path }, "Failed to delete health record document from storage");
  }
}

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
    await logWeightIfChanged(created!.id, body.weight, created!.weightUnit, null);
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
    const [before] = await db.select().from(pets).where(eq(pets.id, petId));
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
    await logWeightIfChanged(petId, body.weight, updated.weightUnit, before?.weight ?? null);
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
    // Read the attached-document paths before the cascade delete removes the
    // rows that reference them — otherwise there's nothing left to clean up.
    const docs = await db
      .select({ path: healthRecords.documentStoragePath })
      .from(healthRecords)
      .where(and(eq(healthRecords.petId, petId), eq(healthRecords.documentType, "upload")));
    await db.delete(pets).where(eq(pets.id, petId));
    await Promise.all(docs.map((doc) => (doc.path ? deleteDocumentBestEffort(doc.path) : undefined)));
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
    const [existing] = await db
      .select()
      .from(healthRecords)
      .where(and(eq(healthRecords.id, recordId), eq(healthRecords.petId, petId)));
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
    // The old uploaded file is now either replaced or detached — either way
    // it's no longer reachable from this record, so it's cleaned up here.
    if (
      existing?.documentStoragePath &&
      existing.documentStoragePath !== updated.documentStoragePath
    ) {
      await deleteDocumentBestEffort(existing.documentStoragePath);
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
    if (deleted.documentStoragePath) {
      await deleteDocumentBestEffort(deleted.documentStoragePath);
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get("/pets/:petId/records/:recordId/document-url", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId, recordId } = GetHealthRecordDocumentUrlParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const [record] = await db
      .select()
      .from(healthRecords)
      .where(and(eq(healthRecords.id, recordId), eq(healthRecords.petId, petId)));
    if (!record) {
      res.status(404).json({ error: "Record not found" });
      return;
    }
    if (record.documentType === "upload" && record.documentStoragePath) {
      res.json({ url: await createSignedDocumentUrl(record.documentStoragePath) });
      return;
    }
    if (record.documentType === "link" && record.documentUrl) {
      res.json({ url: record.documentUrl });
      return;
    }
    res.status(404).json({ error: "This record has no attached document." });
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
    await db.insert(medicationDoseLogs).values({ medicationId, petId });
    res.json(asMedication(updated!));
  } catch (error) {
    next(error);
  }
});

// Frequency-based, not timing-based: doses logged ÷ doses expected from the
// medication's own interval, over this trailing window. Simpler than judging
// "late" vs "on time" against no real basis for a lateness threshold.
const ADHERENCE_WINDOW_DAYS = 30;

router.get("/pets/:petId/trends", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId } = GetPetTrendsParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }

    const weightRows = await db
      .select()
      .from(weightLogs)
      .where(eq(weightLogs.petId, petId))
      .orderBy(asc(weightLogs.recordedAt));

    const activeMeds = await db
      .select()
      .from(medications)
      .where(and(eq(medications.petId, petId), eq(medications.active, true)));

    const windowMs = ADHERENCE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const windowStart = new Date(Date.now() - windowMs);

    const medicationAdherence = [];
    for (const med of activeMeds) {
      // Only meaningful for a medication with a structured schedule — one
      // that's purely descriptive (frequency text only) has no interval to
      // compute an expected dose count from.
      if (!med.doseIntervalValue || !med.doseIntervalUnit) continue;
      const intervalMs = med.doseIntervalValue * INTERVAL_MS[med.doseIntervalUnit];
      const dosesExpected = Math.max(1, Math.round(windowMs / intervalMs));
      const doseLogs = await db
        .select()
        .from(medicationDoseLogs)
        .where(and(eq(medicationDoseLogs.medicationId, med.id), gte(medicationDoseLogs.loggedAt, windowStart)));
      const dosesLogged = doseLogs.length;
      medicationAdherence.push({
        medicationId: med.id,
        medicationName: med.name,
        adherencePercent: Math.min(100, Math.round((dosesLogged / dosesExpected) * 100)),
        dosesLogged,
        dosesExpected,
      });
    }

    res.json({
      weightLogs: weightRows.map((row) => ({
        ...row,
        weight: Number(row.weight),
        recordedAt: row.recordedAt.toISOString(),
      })),
      medicationAdherence,
    });
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

router.get("/pets/:petId/symptom-logs", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId } = ListSymptomLogsParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const rows = await db
      .select()
      .from(symptomLogs)
      .where(eq(symptomLogs.petId, petId))
      .orderBy(desc(symptomLogs.loggedAt));
    res.json(rows.map(asSymptomLog));
  } catch (error) {
    next(error);
  }
});

router.post("/pets/:petId/symptom-logs", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId } = CreateSymptomLogParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const body = CreateSymptomLogBody.parse(req.body);
    if (body.insightId != null) {
      const [insight] = await db.select().from(insights).where(eq(insights.id, body.insightId));
      if (!insight || insight.petId !== petId) {
        res.status(404).json({ error: "Insight not found" });
        return;
      }
    }
    const [created] = await db
      .insert(symptomLogs)
      .values({ petId, ...body })
      .returning();
    res.status(201).json(asSymptomLog(created!));
  } catch (error) {
    next(error);
  }
});

router.get("/insights", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId } = ListInsightsQueryParams.parse(req.query);
    const ownedIds = await getOwnedPetIds(userId);
    const quota = await getChatQuota(userId);
    if (ownedIds.length === 0) {
      res.json({ insights: [], quota });
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
    res.json({ insights: rows.map(asInsight), quota });
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

    // Red flags short-circuit before any AI call — see symptom-escalation.ts.
    // This never draws on the chat quota below: it's a deterministic,
    // zero-AI-cost message, and a maxed-out quota must never block a
    // genuine emergency escalation.
    if (isRedFlagQuestion(question)) {
      const [created] = await db
        .insert(insights)
        .values({
          petId,
          title: "Please seek urgent veterinary care",
          content: buildEscalationMessage(pet),
          question,
          tone: "urgent",
          kind: "escalation",
          source: "ai",
          disclaimer: DISCLAIMER,
        })
        .returning();
      res.json({ insight: asInsight(created!), quota: await getChatQuota(userId) });
      return;
    }

    try {
      await assertChatQuotaAvailable(userId);
    } catch (error) {
      if (error instanceof ChatQuotaExceededError) {
        res.status(400).json({ error: error.message });
        return;
      }
      throw error;
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
    const upcomingReminders = await db
      .select()
      .from(reminders)
      .where(and(eq(reminders.petId, petId), eq(reminders.completed, false)))
      .orderBy(asc(reminders.dueDate));

    const completion = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8192,
      system:
        "You are a cautious pet care education assistant for pet owners. Give concise, practical, plain-language guidance grounded only in the supplied profile and records. Never diagnose, prescribe, change medication, or claim certainty. Explain what to observe, low-risk supportive steps, and when to contact a veterinarian. Keep the answer under 170 words.",
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            pet: asPet(pet),
            recentRecords: records,
            activeMedications: meds.map(asMedication),
            upcomingReminders,
            ownerQuestion: question,
          }),
        },
      ],
    });

    const textBlock = completion.content.find((block) => block.type === "text");
    const content =
      textBlock?.text.trim() ||
      "I could not prepare guidance right now. If you are concerned about a new or worsening symptom, contact your veterinarian.";
    const [created] = await db
      .insert(insights)
      .values({
        petId,
        title: "Guidance for your question",
        content,
        question,
        tone: "helpful",
        kind: "chat",
        source: "ai",
        disclaimer: DISCLAIMER,
      })
      .returning();
    await recordChatUsage(userId);
    res.json({ insight: asInsight(created!), quota: await getChatQuota(userId) });
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
