import { Router, type IRouter, type Request } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  AcceptDocumentImportItemBody,
  AcceptDocumentImportItemParams,
  CreateDocumentImportParams,
  CreateHealthRecordBody,
  CreateMedicationBody,
  CreateReminderBody,
  GetDocumentImportDocumentUrlParams,
  GetDocumentImportParams,
  ListDocumentImportsParams,
  RejectDocumentImportItemParams,
} from "@workspace/api-zod";
import { db, documentImportItems, documentImports, petOwners, pets } from "@workspace/db";
import { ALLOWED_DOCUMENT_MIME_TYPES, handleSingleFileUpload } from "../lib/upload-middleware";
import { createSignedDocumentUrl, deleteDocument, uploadHealthRecordDocument } from "../lib/storage";
import { logger } from "../lib/logger";
import {
  PetNameMismatchError,
  ScannedDocumentError,
  TooManyPagesError,
  extractDocument,
} from "../lib/document-extraction";
import {
  type DocumentImportQuota,
  type ImportLane,
  QuotaExceededError,
  getDocumentImportQuota,
  pickImportLane,
  recordDocumentImportUsage,
} from "../lib/document-import-quota";
import { findDuplicate } from "../lib/duplicate-detection";
import { insertHealthRecordForPet, insertMedicationForPet, insertReminderForPet } from "../lib/care-mutations";

const router: IRouter = Router();

// Duplicated from care.ts rather than shared: both files need "is this
// petId owned by this user", and importing across route files for two
// three-line helpers isn't worth the coupling.
function requireUserId(req: Request): number {
  return Number(req.user!.id);
}

async function isPetOwnedByUser(userId: number, petId: number): Promise<boolean> {
  const [row] = await db
    .select({ petId: petOwners.petId })
    .from(petOwners)
    .where(and(eq(petOwners.userId, userId), eq(petOwners.petId, petId)));
  return !!row;
}

function serializeItem(item: typeof documentImportItems.$inferSelect) {
  return { ...item };
}

function serializeImport(
  imp: typeof documentImports.$inferSelect,
  items: (typeof documentImportItems.$inferSelect)[],
) {
  // sourceDocumentPath is a private storage key, not a usable URL — omitted
  // from the response on purpose; fetch a viewable link via document-url.
  const { sourceDocumentPath: _sourceDocumentPath, ...rest } = imp;
  return {
    ...rest,
    analyzedAt: imp.analyzedAt.toISOString(),
    items: items.map(serializeItem),
  };
}

// Best-effort storage cleanup: both call sites below are about to return a
// 400 (or rethrow) regardless of whether this succeeds, since extraction
// failed before any document_imports row was created — nothing to roll back,
// just an orphaned file to avoid leaving behind.
async function deleteDocumentBestEffort(path: string) {
  try {
    await deleteDocument(path);
  } catch (error) {
    logger.error({ err: error, path }, "Failed to delete document-import source file from storage");
  }
}

async function markReviewedIfComplete(importId: number) {
  const items = await db.select().from(documentImportItems).where(eq(documentImportItems.importId, importId));
  if (items.length > 0 && items.every((i) => i.status !== "pending")) {
    await db.update(documentImports).set({ status: "reviewed" }).where(eq(documentImports.id, importId));
  }
}

router.get("/pets/:petId/document-imports", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId } = ListDocumentImportsParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const [pet] = await db.select().from(pets).where(eq(pets.id, petId));
    if (!pet) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const quota = await getDocumentImportQuota(userId, pet);
    const imports = await db
      .select()
      .from(documentImports)
      .where(eq(documentImports.petId, petId))
      .orderBy(desc(documentImports.analyzedAt));
    const results = [];
    for (const imp of imports) {
      const items = await db.select().from(documentImportItems).where(eq(documentImportItems.importId, imp.id));
      results.push(serializeImport(imp, items));
    }
    res.json({ imports: results, quota });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/pets/:petId/document-imports",
  handleSingleFileUpload("file"),
  async (req, res, next) => {
    try {
      const userId = requireUserId(req);
      const { petId } = CreateDocumentImportParams.parse(req.params);
      if (!(await isPetOwnedByUser(userId, petId))) {
        res.status(404).json({ error: "Pet not found" });
        return;
      }
      const [pet] = await db.select().from(pets).where(eq(pets.id, petId));
      if (!pet) {
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

      let lane: ImportLane;
      try {
        ({ lane } = await pickImportLane(userId, pet));
      } catch (error) {
        if (error instanceof QuotaExceededError) {
          res.status(400).json({ error: error.message });
          return;
        }
        throw error;
      }

      // Stored regardless of what extraction finds, so the source document
      // is always retrievable from the import. If extraction fails below and
      // no document_imports row ends up referencing it, it's deleted again
      // rather than left as an orphaned file.
      const uploaded = await uploadHealthRecordDocument(petId, req.file);

      let extraction;
      try {
        extraction = await extractDocument(req.file, pet.name);
      } catch (error) {
        if (error instanceof PetNameMismatchError) {
          // Tagged with a code (unlike the other 400 cases below) so the
          // client can single this one out and show it as a prominent
          // dialog instead of an easy-to-miss toast — this is the one
          // upload failure that means "you probably grabbed the wrong
          // file," not just "this file didn't work."
          await deleteDocumentBestEffort(uploaded.path);
          res.status(400).json({ error: error.message, code: "pet_name_mismatch" });
          return;
        }
        if (error instanceof TooManyPagesError || error instanceof ScannedDocumentError) {
          await deleteDocumentBestEffort(uploaded.path);
          res.status(400).json({ error: error.message });
          return;
        }
        await deleteDocumentBestEffort(uploaded.path);
        throw error;
      }

      // Only charged against the quota after a successful extraction — a
      // failed call shouldn't cost the owner an upload.
      await recordDocumentImportUsage(userId, pet, lane);

      const [documentImport] = await db
        .insert(documentImports)
        .values({
          petId,
          sourceDocumentPath: uploaded.path,
          documentName: uploaded.name,
          lane,
          status: "pending_review",
        })
        .returning();

      const candidates: { itemType: "health_record" | "medication" | "reminder"; proposedData: object }[] = [
        ...extraction.healthRecords.map((d) => ({ itemType: "health_record" as const, proposedData: d })),
        ...extraction.medications.map((d) => ({ itemType: "medication" as const, proposedData: d })),
        ...extraction.reminders.map((d) => ({ itemType: "reminder" as const, proposedData: d })),
      ];

      const insertedItems: (typeof documentImportItems.$inferSelect)[] = [];
      for (const candidate of candidates) {
        const duplicate = await findDuplicate(petId, candidate.itemType, candidate.proposedData as Record<string, unknown>);
        const [item] = await db
          .insert(documentImportItems)
          .values({
            importId: documentImport!.id,
            itemType: candidate.itemType,
            proposedData: candidate.proposedData,
            duplicateOfType: duplicate?.type ?? null,
            duplicateOfId: duplicate?.id ?? null,
            status: "pending",
          })
          .returning();
        insertedItems.push(item!);
      }

      const quota = await getDocumentImportQuota(userId, pet);
      res.status(201).json({ import: serializeImport(documentImport!, insertedItems), quota });
    } catch (error) {
      next(error);
    }
  },
);

router.get("/pets/:petId/document-imports/:importId", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId, importId } = GetDocumentImportParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const [imp] = await db
      .select()
      .from(documentImports)
      .where(and(eq(documentImports.id, importId), eq(documentImports.petId, petId)));
    if (!imp) {
      res.status(404).json({ error: "Import not found" });
      return;
    }
    const [pet] = await db.select().from(pets).where(eq(pets.id, petId));
    if (!pet) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const items = await db.select().from(documentImportItems).where(eq(documentImportItems.importId, importId));
    const quota = await getDocumentImportQuota(userId, pet);
    res.json({ import: serializeImport(imp, items), quota });
  } catch (error) {
    next(error);
  }
});

router.get("/pets/:petId/document-imports/:importId/document-url", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId, importId } = GetDocumentImportDocumentUrlParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const [imp] = await db
      .select()
      .from(documentImports)
      .where(and(eq(documentImports.id, importId), eq(documentImports.petId, petId)));
    if (!imp) {
      res.status(404).json({ error: "Import not found" });
      return;
    }
    res.json({ url: await createSignedDocumentUrl(imp.sourceDocumentPath) });
  } catch (error) {
    next(error);
  }
});

router.post("/pets/:petId/document-imports/:importId/items/:itemId/accept", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId, importId, itemId } = AcceptDocumentImportItemParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const [imp] = await db
      .select()
      .from(documentImports)
      .where(and(eq(documentImports.id, importId), eq(documentImports.petId, petId)));
    if (!imp) {
      res.status(404).json({ error: "Import not found" });
      return;
    }
    const [item] = await db
      .select()
      .from(documentImportItems)
      .where(and(eq(documentImportItems.id, itemId), eq(documentImportItems.importId, importId)));
    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    if (item.status !== "pending") {
      res.status(400).json({ error: "This item has already been reviewed." });
      return;
    }

    const body = AcceptDocumentImportItemBody.parse(req.body ?? {});
    const dataToUse = body.proposedData ?? item.proposedData;

    let createdRecordId: number;
    try {
      if (item.itemType === "health_record") {
        const parsed = CreateHealthRecordBody.parse(dataToUse);
        createdRecordId = (await insertHealthRecordForPet(petId, parsed)).id;
      } else if (item.itemType === "medication") {
        const parsed = CreateMedicationBody.parse(dataToUse);
        createdRecordId = (await insertMedicationForPet(petId, parsed)).id;
      } else {
        const parsed = CreateReminderBody.parse(dataToUse);
        createdRecordId = (await insertReminderForPet(petId, parsed)).id;
      }
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") {
        res.status(400).json({ error: "The data for this item didn't match the expected format." });
        return;
      }
      throw error;
    }

    const [updatedItem] = await db
      .update(documentImportItems)
      .set({ status: "accepted", createdRecordId })
      .where(eq(documentImportItems.id, itemId))
      .returning();
    await markReviewedIfComplete(importId);
    res.json(serializeItem(updatedItem!));
  } catch (error) {
    next(error);
  }
});

router.post("/pets/:petId/document-imports/:importId/items/:itemId/reject", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId, importId, itemId } = RejectDocumentImportItemParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const [imp] = await db
      .select()
      .from(documentImports)
      .where(and(eq(documentImports.id, importId), eq(documentImports.petId, petId)));
    if (!imp) {
      res.status(404).json({ error: "Import not found" });
      return;
    }
    const [updatedItem] = await db
      .update(documentImportItems)
      .set({ status: "rejected" })
      .where(and(eq(documentImportItems.id, itemId), eq(documentImportItems.importId, importId)))
      .returning();
    if (!updatedItem) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    await markReviewedIfComplete(importId);
    res.json(serializeItem(updatedItem));
  } catch (error) {
    next(error);
  }
});

export default router;
