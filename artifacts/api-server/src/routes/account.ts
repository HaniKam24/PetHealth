import { Router, type IRouter, type Request } from "express";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  users,
  aiUsageMonthly,
  petOwners,
  pets,
  healthRecords,
  medications,
  medicationDoseLogs,
  reminders,
  conversations,
  insights,
  aiActions,
  symptomLogs,
  symptomEntries,
  weightLogs,
  alerts,
  petShareLinks,
  documentImports,
  documentImportItems,
} from "@workspace/db";
import { createSignedDocumentUrl } from "../lib/storage";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Duplicated from care.ts rather than shared — same call as every other
// route file in this app.
function requireUserId(req: Request): number {
  return Number(req.user!.id);
}

// Deliberately longer-lived than the 1-hour default elsewhere in storage.ts
// (see createSignedDocumentUrl) — an export is something someone might
// generate and then actually click through a bit later, not view instantly.
const EXPORT_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24; // 24 hours

// Best-effort: a document whose signed URL fails to mint (e.g. the file was
// since deleted) shouldn't fail the whole export — that one link is just null.
async function signedUrlOrNull(path: string | null): Promise<string | null> {
  if (!path) return null;
  try {
    return await createSignedDocumentUrl(path, EXPORT_SIGNED_URL_TTL_SECONDS);
  } catch (error) {
    logger.error({ err: error, path }, "Failed to sign a document URL for an account data export");
    return null;
  }
}

const asAccountUser = (user: typeof users.$inferSelect) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  emailVerified: user.emailVerified,
  createdAt: user.createdAt.toISOString(),
});

const asAiUsage = (row: typeof aiUsageMonthly.$inferSelect) => ({
  periodMonth: row.periodMonth,
  chatQuestionsUsed: row.chatQuestionsUsed,
  documentUploadsUsed: row.documentUploadsUsed,
});

const asPet = (pet: typeof pets.$inferSelect) => ({
  ...pet,
  weight: pet.weight === null ? null : Number(pet.weight),
});

const asMedication = (medication: typeof medications.$inferSelect) => ({
  ...medication,
  nextDoseAt: medication.nextDoseAt ? medication.nextDoseAt.toISOString() : null,
});

const asDoseLog = (row: typeof medicationDoseLogs.$inferSelect) => ({
  id: row.id,
  medicationId: row.medicationId,
  loggedAt: row.loggedAt.toISOString(),
});

const asReminder = (reminder: typeof reminders.$inferSelect) => ({ ...reminder });

const asAiAction = (action: typeof aiActions.$inferSelect) => ({
  ...action,
  appliedAt: action.appliedAt ? action.appliedAt.toISOString() : null,
  createdAt: action.createdAt.toISOString(),
});

const asInsight = (
  insight: typeof insights.$inferSelect,
  action: typeof aiActions.$inferSelect | null,
) => ({
  ...insight,
  createdAt: insight.createdAt.toISOString(),
  dismissedAt: insight.dismissedAt ? insight.dismissedAt.toISOString() : null,
  action: action ? asAiAction(action) : null,
});

const asSymptomLog = (log: typeof symptomLogs.$inferSelect) => ({
  ...log,
  loggedAt: log.loggedAt.toISOString(),
});

const asSymptomEntry = (entry: typeof symptomEntries.$inferSelect) => ({
  ...entry,
  loggedAt: entry.loggedAt.toISOString(),
});

const asWeightLog = (row: typeof weightLogs.$inferSelect) => ({
  ...row,
  weight: Number(row.weight),
  recordedAt: row.recordedAt.toISOString(),
});

const asAlert = (alert: typeof alerts.$inferSelect) => ({
  ...alert,
  createdAt: alert.createdAt.toISOString(),
  resolvedAt: alert.resolvedAt ? alert.resolvedAt.toISOString() : null,
});

// The frontend origin the shareable link points at — same lookup share-links.ts
// uses, duplicated here per this codebase's per-file helper convention.
function getWebOrigin(): string {
  const first = (process.env["WEB_ORIGIN"] ?? "").split(",")[0]?.trim();
  return first || "http://localhost:5173";
}

// Every share link ever created for this pet, not just the currently active
// one — reconstructing a URL for a revoked/expired token is harmless (the
// server already refuses it), and a full export should include history.
const asShareLink = (link: typeof petShareLinks.$inferSelect) => ({
  id: link.id,
  petId: link.petId,
  url: `${getWebOrigin()}/share/${link.token}`,
  startsAt: link.startsAt.toISOString(),
  expiresAt: link.expiresAt.toISOString(),
  lastViewedAt: link.lastViewedAt ? link.lastViewedAt.toISOString() : null,
  createdAt: link.createdAt.toISOString(),
});

const asDocumentImportItem = (item: typeof documentImportItems.$inferSelect) => ({ ...item });

router.get("/account/export", async (req, res, next) => {
  try {
    const userId = requireUserId(req);

    const [userRow] = await db.select().from(users).where(eq(users.id, userId));
    if (!userRow) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    const usageRows = await db
      .select()
      .from(aiUsageMonthly)
      .where(eq(aiUsageMonthly.userId, userId));

    const ownedRows = await db
      .select({ petId: petOwners.petId })
      .from(petOwners)
      .where(eq(petOwners.userId, userId));
    const petIds = ownedRows.map((row) => row.petId);

    if (petIds.length === 0) {
      res.setHeader("Content-Disposition", `attachment; filename="pethealth-export-${Date.now()}.json"`);
      res.json({
        exportedAt: new Date().toISOString(),
        account: asAccountUser(userRow),
        aiUsage: usageRows.map(asAiUsage),
        pets: [],
      });
      return;
    }

    const [
      petRows,
      healthRecordRows,
      medicationRows,
      doseLogRows,
      reminderRows,
      conversationRows,
      insightRows,
      actionRows,
      symptomLogRows,
      symptomEntryRows,
      weightLogRows,
      alertRows,
      shareLinkRows,
      documentImportRows,
    ] = await Promise.all([
      db.select().from(pets).where(inArray(pets.id, petIds)),
      db.select().from(healthRecords).where(inArray(healthRecords.petId, petIds)),
      db.select().from(medications).where(inArray(medications.petId, petIds)),
      db.select().from(medicationDoseLogs).where(inArray(medicationDoseLogs.petId, petIds)),
      db.select().from(reminders).where(inArray(reminders.petId, petIds)),
      db.select().from(conversations).where(inArray(conversations.petId, petIds)),
      db.select().from(insights).where(inArray(insights.petId, petIds)),
      db.select().from(aiActions).where(inArray(aiActions.petId, petIds)),
      db.select().from(symptomLogs).where(inArray(symptomLogs.petId, petIds)),
      db.select().from(symptomEntries).where(inArray(symptomEntries.petId, petIds)),
      db.select().from(weightLogs).where(inArray(weightLogs.petId, petIds)),
      db.select().from(alerts).where(inArray(alerts.petId, petIds)),
      db.select().from(petShareLinks).where(inArray(petShareLinks.petId, petIds)),
      db.select().from(documentImports).where(inArray(documentImports.petId, petIds)),
    ]);

    // documentImportItems only FKs to documentImports (not directly to a
    // pet), so this has to wait for documentImportRows above to know which
    // import ids to look up.
    const documentImportIds = documentImportRows.map((row) => row.id);
    const documentImportItemRows =
      documentImportIds.length > 0
        ? await db
            .select()
            .from(documentImportItems)
            .where(inArray(documentImportItems.importId, documentImportIds))
        : [];

    const actionByInsightId = new Map(
      actionRows.filter((action) => action.insightId !== null).map((action) => [action.insightId, action]),
    );

    const healthRecordDocuments = await Promise.all(
      healthRecordRows.map(async (record) => ({
        id: record.id,
        petId: record.petId,
        type: record.type,
        title: record.title,
        date: record.date,
        clinic: record.clinic,
        summary: record.summary,
        documentUrl:
          record.documentType === "upload"
            ? await signedUrlOrNull(record.documentStoragePath)
            : record.documentUrl,
        documentType: record.documentType,
        documentName: record.documentName,
      })),
    );

    const documentImportsWithLinks = await Promise.all(
      documentImportRows.map(async (imp) => ({
        id: imp.id,
        petId: imp.petId,
        documentName: imp.documentName,
        documentUrl: await signedUrlOrNull(imp.sourceDocumentPath),
        lane: imp.lane,
        status: imp.status,
        analyzedAt: imp.analyzedAt.toISOString(),
        items: documentImportItemRows
          .filter((item) => item.importId === imp.id)
          .map(asDocumentImportItem),
      })),
    );

    const pets_ = petRows.map((pet) => {
      const petConversations = conversationRows
        .filter((c) => c.petId === pet.id)
        .map((conversation) => ({
          ...conversation,
          createdAt: conversation.createdAt.toISOString(),
          lastMessageAt: conversation.lastMessageAt.toISOString(),
          insights: insightRows
            .filter((insight) => insight.conversationId === conversation.id)
            .map((insight) => asInsight(insight, actionByInsightId.get(insight.id) ?? null)),
        }));

      return {
        ...asPet(pet),
        healthRecords: healthRecordDocuments.filter((r) => r.petId === pet.id),
        medications: medicationRows.filter((m) => m.petId === pet.id).map(asMedication),
        doseLogs: doseLogRows.filter((d) => d.petId === pet.id).map(asDoseLog),
        reminders: reminderRows.filter((r) => r.petId === pet.id).map(asReminder),
        conversations: petConversations,
        symptomLogs: symptomLogRows.filter((s) => s.petId === pet.id).map(asSymptomLog),
        symptomEntries: symptomEntryRows.filter((s) => s.petId === pet.id).map(asSymptomEntry),
        weightLogs: weightLogRows.filter((w) => w.petId === pet.id).map(asWeightLog),
        alerts: alertRows.filter((a) => a.petId === pet.id).map(asAlert),
        shareLinks: shareLinkRows.filter((s) => s.petId === pet.id).map(asShareLink),
        documentImports: documentImportsWithLinks.filter((d) => d.petId === pet.id),
      };
    });

    res.setHeader("Content-Disposition", `attachment; filename="pethealth-export-${Date.now()}.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
      account: asAccountUser(userRow),
      aiUsage: usageRows.map(asAiUsage),
      pets: pets_,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
