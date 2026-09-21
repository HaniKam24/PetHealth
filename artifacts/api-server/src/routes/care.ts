import { Router, type IRouter, type Request } from "express";
import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  AskInsightBody,
  CancelAiActionParams,
  CompleteReminderParams,
  ConfirmAiActionParams,
  DismissInsightParams,
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
  DeleteMedicationParams,
  DeletePetParams,
  GetDashboardSummaryQueryParams,
  GetHealthRecordDocumentUrlParams,
  GetPetParams,
  GetPetTrendsParams,
  GetPetVaccinesParams,
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
  UploadPetPhotoParams,
  RemovePetPhotoParams,
  UpdatePetBody,
  UpdatePetParams,
} from "@workspace/api-zod";
import {
  aiActions,
  db,
  documentImports,
  healthRecords,
  insights,
  medicationDoseLogs,
  medications,
  petOwners,
  pets,
  reminders,
  symptomEntries,
  symptomLogs,
  weightLogs,
} from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai-server";
import { createSignedDocumentUrl, deleteDocument, uploadHealthRecordDocument, uploadPetPhoto } from "../lib/storage";
import { computeVaccineStatuses, runCareRecommendationsEngine, suppressRedundantSystemReminder } from "../lib/care-recommendations";
import { buildEscalationMessage, isRedFlagQuestion, extractZipCode } from "../lib/symptom-escalation";
import { lookupEmergencyVets } from "../lib/emergency-vet-lookup";
import { assertChatQuotaAvailable, ChatQuotaExceededError, getChatQuota, recordChatUsage } from "../lib/chat-quota";
import { ALLOWED_DOCUMENT_MIME_TYPES, ALLOWED_IMAGE_MIME_TYPES, handleSingleFileUpload } from "../lib/upload-middleware";
import { logger } from "../lib/logger";
import {
  completeReminderForPet,
  insertHealthRecordForPet,
  insertReminderForPet,
  insertSymptomEntryForPet,
  insertSymptomLogForPet,
  ProfileUpdateBody,
  updatePetProfile,
} from "../lib/care-mutations";
import { AI_ACTION_SCHEMAS, isPawlieActionType, PAWLIE_TOOLS } from "../lib/pawlie-tools";

const router: IRouter = Router();
const MAX_PETS_PER_ACCOUNT = 3;
const DISCLAIMER =
  "AI guidance is educational and is not a diagnosis. Contact a licensed veterinarian for medical advice, and seek urgent care for severe or rapidly worsening symptoms.";

// Pawlie: the app's one AI voice (formerly split across "Symptom Chat" and
// "AI Insights" naming, same underlying feature). Personality is deliberate
// here, not decorative — a warm, steady tone is what makes an owner
// comfortable asking an anxious 11pm question, and it has to hold up
// whether the question is symptom-shaped or just a plain factual one about
// the pet's own record (Bolt 19 broadens scope beyond symptom guidance).
const PAWLIE_SYSTEM_PROMPT = `You are Pawlie, a warm and steady AI companion built into this pet-health app. Owners talk to you about anything related to their pet — symptoms, routines, questions about a past visit, or just how their pet's been doing.

Personality:
- Warm but not cutesy — talk like a knowledgeable friend, not a mascot. No forced puns, no more than the occasional light touch of warmth.
- Calm and steady, even when the owner sounds worried. Reassure with substance, not empty comfort.
- Say "I'm not a vet, but..." at most once, naturally, when it's actually relevant — never as a bolted-on disclaimer on every reply (a separate disclaimer is already shown alongside your answer).
- Use the pet's name when you have it, not "your pet."

What you answer:
- Symptom questions ("she's limping, should I worry?") — give concise, practical, plain-language guidance grounded only in the supplied data. Never diagnose, prescribe, or change medication. Explain what to observe, safe supportive steps, and when to contact a vet.
- Plain factual questions about the pet's own record ("when was her last rabies shot", "what's she currently taking") — answer directly and specifically from the supplied data. If it's not in the data, say so plainly rather than guessing.
- General pet-care questions unrelated to a specific symptom (diet, behavior, preventive care) — answer helpfully, still grounded in what you know about this particular pet where relevant.

Connecting the Symptom Journal to the medical record:
- You're given symptomJournal (structured, dated entries the owner logged — energy, appetite, stool, vomiting, limping, notes) separately from symptomLogHistory (older free-text notes from past chat answers) and the pet's healthRecords/activeMedications/weightTrend/medicationAdherence. Actually use all of it together, not just whichever the owner's question happens to mention.
- Look for a pattern across journal entries before treating one entry as the whole picture — e.g. low energy in several recent entries is a different, more worth-mentioning signal than one off day.
- When a pattern in the journal plausibly connects to something in the medical record (an active medication that lists this as a side effect, a past record of a related issue, a trend in weight or adherence), say so explicitly and explain the connection — this is exactly the kind of thing an owner can't easily piece together themselves from separate lists.
- Still never diagnose or state a connection as certain — "worth mentioning to your vet" and "could be related to X, given Y" are the right register, not "this is caused by X."

Making changes — conversational actions:
- The owner can ask you to make a change: add a reminder, mark one done, update something on the pet's profile, or log a symptom they describe. Use the matching tool for this.
- You never make the change yourself. Using a tool only proposes it — the owner still has to explicitly confirm it before anything is saved. So always also write a short, natural reply alongside the tool call describing exactly what you're proposing (e.g. "I'll add a reminder to trim his nails, due September 30th — want me to save that?"), never a bare tool call with no explanation.
- Compute any relative date ("by the end of the month", "next Friday") into an absolute YYYY-MM-DD using the 'today' value supplied in context.
- For completing a reminder, only ever use the id of a reminder that's actually present in the supplied reminders list — never guess one.
- If a request is ambiguous (which reminder, which pet, unclear value), ask a clarifying question in plain text instead of guessing with a tool call.

Rules:
- Ground every answer only in the supplied data — never invent a record, date, or value that isn't there.
- Never claim certainty about anything requiring an in-person exam, bloodwork, or imaging.
- Keep answers concise and skimmable — under 170 words unless the question genuinely needs more.`;

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

const asAiAction = (action: typeof aiActions.$inferSelect) => ({
  ...action,
  appliedAt: action.appliedAt ? action.appliedAt.toISOString() : null,
  createdAt: action.createdAt.toISOString(),
});

const asInsight = (
  insight: typeof insights.$inferSelect,
  action: typeof aiActions.$inferSelect | null = null,
) => ({
  ...insight,
  createdAt: insight.createdAt.toISOString(),
  action: action ? asAiAction(action) : null,
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
        gotchaDate: asDateString(body.gotchaDate),
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
        gotchaDate: asDateString(body.gotchaDate),
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

router.post(
  "/pets/:petId/photo",
  handleSingleFileUpload("file"),
  async (req, res, next) => {
    try {
      const userId = requireUserId(req);
      const { petId } = UploadPetPhotoParams.parse(req.params);
      if (!(await isPetOwnedByUser(userId, petId))) {
        res.status(404).json({ error: "Pet not found" });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "A file is required." });
        return;
      }
      if (!ALLOWED_IMAGE_MIME_TYPES.has(req.file.mimetype)) {
        res.status(400).json({ error: "Only JPEG, PNG, WEBP, or HEIC images are supported." });
        return;
      }
      const { url } = await uploadPetPhoto(petId, req.file);
      const [updated] = await db
        .update(pets)
        .set({ photoUrl: url })
        .where(eq(pets.id, petId))
        .returning();
      if (!updated) {
        res.status(404).json({ error: "Pet not found" });
        return;
      }
      res.status(201).json(asPet(updated));
    } catch (error) {
      next(error);
    }
  },
);

router.delete("/pets/:petId/photo", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId } = RemovePetPhotoParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const [updated] = await db
      .update(pets)
      .set({ photoUrl: null })
      .where(eq(pets.id, petId))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    res.json(asPet(updated));
  } catch (error) {
    next(error);
  }
});

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

router.delete("/pets/:petId/medications/:medicationId", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId, medicationId } = DeleteMedicationParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const [deleted] = await db
      .delete(medications)
      .where(and(eq(medications.id, medicationId), eq(medications.petId, petId)))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Medication not found" });
      return;
    }
    res.status(204).end();
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

// Shared by GET /trends (the chart data) and Pawlie's grounding query
// (POST /insights) — same numbers, just one rendered as a chart and the
// other handed to the model as context.
async function computePetTrends(petId: number) {
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

  return {
    weightLogs: weightRows.map((row) => ({
      ...row,
      weight: Number(row.weight),
      recordedAt: row.recordedAt.toISOString(),
    })),
    medicationAdherence,
  };
}

router.get("/pets/:petId/trends", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId } = GetPetTrendsParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    res.json(await computePetTrends(petId));
  } catch (error) {
    next(error);
  }
});

router.get("/pets/:petId/vaccines", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId } = GetPetVaccinesParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const [pet] = await db.select().from(pets).where(eq(pets.id, petId));
    if (!pet) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    res.json({ vaccines: await computeVaccineStatuses(pet) });
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
    await suppressRedundantSystemReminder(petId, created!);
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
    const insightIds = rows.map((row) => row.id);
    const actionRows =
      insightIds.length > 0
        ? await db.select().from(aiActions).where(inArray(aiActions.insightId, insightIds))
        : [];
    const actionByInsightId = new Map(actionRows.map((action) => [action.insightId, action]));
    res.json({
      insights: rows.map((row) => asInsight(row, actionByInsightId.get(row.id) ?? null)),
      quota,
    });
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

    // A zipcode-shaped reply right after an escalation is treated as an
    // answer to "what's your zipcode?" (see symptom-escalation.ts), not a
    // fresh question — no other code path would ever ask for one. Same
    // quota exemption as the escalation itself: a maxed-out quota must
    // never block finding real emergency care.
    const [mostRecentInsight] = await db
      .select()
      .from(insights)
      .where(eq(insights.petId, petId))
      .orderBy(desc(insights.createdAt))
      .limit(1);
    const zipCode = extractZipCode(question);
    if (mostRecentInsight?.kind === "escalation" && zipCode) {
      // The triggering question alone is often just "emergency" or "nearest
      // vet" with no real symptom detail — the Symptom Journal (timestamped,
      // structured) is what actually grounds the call script in what's
      // really been going on, same data the normal chat path grounds on.
      const recentSymptomEntries = await db
        .select()
        .from(symptomEntries)
        .where(eq(symptomEntries.petId, petId))
        .orderBy(desc(symptomEntries.loggedAt))
        .limit(20);
      const result = await lookupEmergencyVets(pet.name, zipCode, mostRecentInsight.question, question, recentSymptomEntries);

      // Everything below writes immediately, with no owner confirm step —
      // the one deliberate exception to Bolt 21's "nothing written without
      // confirmation" rule, scoped strictly to this active-emergency
      // exchange (see emergency-vet-lookup.ts's file-level note for why).
      if (result?.symptomEntry) {
        await insertSymptomEntryForPet(petId, result.symptomEntry);
      }
      const foundVetNames = result?.vets.map((v) => v.name).join(", ");
      await insertHealthRecordForPet(petId, {
        type: "visit",
        title: "Emergency vet visit",
        date: new Date(),
        clinic: null,
        summary: foundVetNames
          ? `Owner reported a possible emergency and was directed to nearby clinics near ${zipCode}: ${foundVetNames}. Placeholder record — replace with the real visit details once available.`
          : `Owner reported a possible emergency near ${zipCode}. Placeholder record — replace with the real visit details once available.`,
      });
      await insertReminderForPet(petId, {
        title: "Add the emergency visit report",
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        category: "other",
        note: "Once you're back, add what the emergency vet found — replace this reminder with the real visit summary.",
      });

      const [created] = await db
        .insert(insights)
        .values({
          petId,
          title: result ? "Nearby emergency vets" : "Couldn't find nearby emergency vets",
          content: result
            ? "Here's what I found — call ahead to confirm they're open before heading over."
            : "I couldn't find emergency vet listings for that area. Please call your own vet's after-hours line or the nearest emergency animal hospital directly.",
          question,
          tone: "urgent",
          kind: "emergency_vet_result",
          source: "ai",
          disclaimer: DISCLAIMER,
          metadata: result,
        })
        .returning();
      res.json({ insight: asInsight(created!), quota: await getChatQuota(userId) });
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

    // Pawlie's grounding: the pet's full relevant record, not the partial
    // slice this used to fetch — health history, meds, reminders (open and
    // recently completed), symptom-log history, weight/adherence trends,
    // any Smart Upload reports still awaiting review, and its own recent
    // chat history with this owner. All read-only, all scoped to this pet.
    const records = await db
      .select()
      .from(healthRecords)
      .where(eq(healthRecords.petId, petId))
      .orderBy(desc(healthRecords.date))
      .limit(20);
    const meds = await db
      .select()
      .from(medications)
      .where(and(eq(medications.petId, petId), eq(medications.active, true)));
    const reminderRows = await db
      .select()
      .from(reminders)
      .where(eq(reminders.petId, petId))
      .orderBy(asc(reminders.dueDate))
      .limit(20);
    const symptomHistory = await db
      .select()
      .from(symptomLogs)
      .where(eq(symptomLogs.petId, petId))
      .orderBy(desc(symptomLogs.loggedAt))
      .limit(10);
    // The Symptom Journal (Bolt 22) — structured, dated observations,
    // distinct from symptomHistory above (free-text notes saved from a
    // past chat answer). This is what lets Pawlie notice a pattern
    // ("low energy the last three entries") and connect it to the medical
    // record, not just answer the single question asked.
    const symptomJournal = await db
      .select()
      .from(symptomEntries)
      .where(eq(symptomEntries.petId, petId))
      .orderBy(desc(symptomEntries.loggedAt))
      .limit(20);
    const trends = await computePetTrends(petId);
    const pendingUploadCount = await db
      .select()
      .from(documentImports)
      .where(and(eq(documentImports.petId, petId), eq(documentImports.status, "pending_review")));
    const pastChatTurns = await db
      .select()
      .from(insights)
      .where(and(eq(insights.petId, petId), eq(insights.kind, "chat")))
      .orderBy(desc(insights.createdAt))
      .limit(5);

    const completion = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8192,
      system: PAWLIE_SYSTEM_PROMPT,
      tools: PAWLIE_TOOLS,
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            today: new Date().toISOString().slice(0, 10),
            pet: asPet(pet),
            healthRecords: records,
            activeMedications: meds.map(asMedication),
            reminders: reminderRows.map((r) => ({ ...r, status: r.completed ? "completed" : "open" })),
            symptomLogHistory: symptomHistory.map(asSymptomLog),
            symptomJournal: symptomJournal.map((entry) => ({ ...entry, loggedAt: entry.loggedAt.toISOString() })),
            weightTrend: trends.weightLogs,
            medicationAdherence: trends.medicationAdherence,
            pendingSmartUploadReports: pendingUploadCount.length,
            recentConversation: pastChatTurns.reverse().map((turn) => ({ question: turn.question, answer: turn.content })),
            ownerQuestion: question,
          }),
        },
      ],
    });

    const textBlock = completion.content.find((block) => block.type === "text");
    const toolUseBlock = completion.content.find((block) => block.type === "tool_use");

    // A proposed action is only ever stored once its shape is verified
    // against the same Zod schema the direct-mutation route would use, and
    // (for completing a reminder specifically) once the referenced id is
    // confirmed to actually belong to this pet — never trusted blindly
    // just because the model named a tool.
    let proposedActionType: keyof typeof AI_ACTION_SCHEMAS | null = null;
    let proposedActionData: unknown = null;
    if (toolUseBlock && toolUseBlock.type === "tool_use" && isPawlieActionType(toolUseBlock.name)) {
      const schema = AI_ACTION_SCHEMAS[toolUseBlock.name];
      const result = schema.safeParse(toolUseBlock.input);
      if (result.success) {
        const validForThisPet =
          toolUseBlock.name !== "complete_reminder" ||
          reminderRows.some((r) => r.id === (result.data as { reminderId: number }).reminderId);
        if (validForThisPet) {
          proposedActionType = toolUseBlock.name;
          proposedActionData = result.data;
        } else {
          logger.warn({ petId, toolInput: toolUseBlock.input }, "Pawlie proposed completing a reminder that isn't this pet's — dropped");
        }
      } else {
        logger.warn({ petId, tool: toolUseBlock.name, issues: result.error.issues }, "Pawlie proposed an action with invalid input — dropped");
      }
    }

    const content =
      textBlock?.text.trim() ||
      (proposedActionType
        ? "Here's what I'd like to do — take a look below and let me know if it's right."
        : "I could not prepare guidance right now. If you are concerned about a new or worsening symptom, contact your veterinarian.");
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

    let createdAction: typeof aiActions.$inferSelect | null = null;
    if (proposedActionType && proposedActionData) {
      const [insertedAction] = await db
        .insert(aiActions)
        .values({
          petId,
          insightId: created!.id,
          actionType: proposedActionType,
          proposedData: proposedActionData,
          status: "pending",
        })
        .returning();
      createdAction = insertedAction!;
    }

    await recordChatUsage(userId);
    res.json({ insight: asInsight(created!, createdAction), quota: await getChatQuota(userId) });
  } catch (error) {
    next(error);
  }
});

router.post("/pets/:petId/insights/:insightId/dismiss", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId, insightId } = DismissInsightParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const [insight] = await db
      .select()
      .from(insights)
      .where(and(eq(insights.id, insightId), eq(insights.petId, petId)));
    if (!insight) {
      res.status(404).json({ error: "Insight not found" });
      return;
    }
    const [updated] = await db
      .update(insights)
      .set({ dismissedAt: new Date() })
      .where(eq(insights.id, insightId))
      .returning();
    res.json(asInsight(updated!));
  } catch (error) {
    next(error);
  }
});

router.post("/pets/:petId/ai-actions/:actionId/confirm", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId, actionId } = ConfirmAiActionParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const [action] = await db
      .select()
      .from(aiActions)
      .where(and(eq(aiActions.id, actionId), eq(aiActions.petId, petId)));
    if (!action) {
      res.status(404).json({ error: "Action not found" });
      return;
    }
    if (action.status !== "pending") {
      res.status(400).json({ error: "This action has already been reviewed." });
      return;
    }

    // Re-validated here, not just trusted from when it was first proposed —
    // same "never trust a stored proposal blindly" principle Smart Upload's
    // accept endpoint already follows for document_import_items.
    const schema = AI_ACTION_SCHEMAS[action.actionType];
    const parsed = schema.safeParse(action.proposedData);
    if (!parsed.success) {
      res.status(400).json({ error: "This action's data no longer matches the expected format." });
      return;
    }

    if (action.actionType === "create_reminder") {
      await insertReminderForPet(petId, parsed.data as z.infer<typeof CreateReminderBody>);
    } else if (action.actionType === "complete_reminder") {
      const { reminderId } = parsed.data as { reminderId: number };
      const updated = await completeReminderForPet(petId, reminderId);
      if (!updated) {
        res.status(400).json({ error: "That reminder no longer exists." });
        return;
      }
    } else if (action.actionType === "update_pet_profile") {
      const [currentPet] = await db.select().from(pets).where(eq(pets.id, petId));
      await updatePetProfile(petId, parsed.data as z.infer<typeof ProfileUpdateBody>, currentPet!);
    } else {
      const { description } = parsed.data as { description: string };
      await insertSymptomLogForPet(petId, description, action.insightId);
    }

    const [updatedAction] = await db
      .update(aiActions)
      .set({ status: "confirmed", appliedAt: new Date() })
      .where(eq(aiActions.id, actionId))
      .returning();
    res.json(asAiAction(updatedAction!));
  } catch (error) {
    next(error);
  }
});

router.post("/pets/:petId/ai-actions/:actionId/cancel", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId, actionId } = CancelAiActionParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const [action] = await db
      .select()
      .from(aiActions)
      .where(and(eq(aiActions.id, actionId), eq(aiActions.petId, petId)));
    if (!action) {
      res.status(404).json({ error: "Action not found" });
      return;
    }
    if (action.status !== "pending") {
      res.status(400).json({ error: "This action has already been reviewed." });
      return;
    }
    const [updatedAction] = await db
      .update(aiActions)
      .set({ status: "cancelled" })
      .where(eq(aiActions.id, actionId))
      .returning();
    res.json(asAiAction(updatedAction!));
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

    // Surfaces on the dashboard until the owner dismisses it (no
    // auto-expiry per the design decision) but bounded to a recent window
    // regardless — a months-old undismissed emergency the owner simply
    // never got back to shouldn't linger as an active banner forever.
    const EMERGENCY_WINDOW_MS = 48 * 60 * 60 * 1000;
    const mostRecentForEmergency = recentInsights[0];
    const activeEmergency =
      mostRecentForEmergency &&
      (mostRecentForEmergency.kind === "escalation" || mostRecentForEmergency.kind === "emergency_vet_result") &&
      !mostRecentForEmergency.dismissedAt &&
      Date.now() - mostRecentForEmergency.createdAt.getTime() <= EMERGENCY_WINDOW_MS
        ? asInsight(mostRecentForEmergency)
        : null;

    res.json({
      pet: asPet(pet),
      upcomingReminders: todos.slice(0, 5),
      activeMedications: meds.map(asMedication),
      recentRecords: records.slice(0, 5),
      recentInsights: recentInsights.map((insight) => asInsight(insight)),
      activeEmergency,
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
