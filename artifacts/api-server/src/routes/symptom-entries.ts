import { Router, type IRouter, type Request } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  CreateSymptomEntryBody,
  CreateSymptomEntryParams,
  DeleteSymptomEntryParams,
  ListSymptomEntriesParams,
} from "@workspace/api-zod";
import { db, petOwners, symptomEntries } from "@workspace/db";

const router: IRouter = Router();

// Duplicated from care.ts rather than shared — same call as
// document-imports.ts makes for the same two three-line helpers.
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

const asSymptomEntry = (entry: typeof symptomEntries.$inferSelect) => ({
  ...entry,
  loggedAt: entry.loggedAt.toISOString(),
});

router.get("/pets/:petId/symptom-entries", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId } = ListSymptomEntriesParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const rows = await db
      .select()
      .from(symptomEntries)
      .where(eq(symptomEntries.petId, petId))
      .orderBy(desc(symptomEntries.loggedAt));
    res.json(rows.map(asSymptomEntry));
  } catch (error) {
    next(error);
  }
});

router.post("/pets/:petId/symptom-entries", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId } = CreateSymptomEntryParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const body = CreateSymptomEntryBody.parse(req.body);
    // Every field is individually optional (the owner logs whatever they
    // actually observed), but a request with nothing at all set isn't
    // worth a row — same defensive check the client's own quick-log
    // widget already does, re-asserted server-side.
    if (Object.keys(body).length === 0) {
      res.status(400).json({ error: "Log at least one observation." });
      return;
    }
    const [created] = await db
      .insert(symptomEntries)
      .values({ petId, ...body })
      .returning();
    res.status(201).json(asSymptomEntry(created!));
  } catch (error) {
    next(error);
  }
});

router.delete("/pets/:petId/symptom-entries/:entryId", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId, entryId } = DeleteSymptomEntryParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const [deleted] = await db
      .delete(symptomEntries)
      .where(and(eq(symptomEntries.id, entryId), eq(symptomEntries.petId, petId)))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
