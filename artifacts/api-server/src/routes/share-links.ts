import { randomBytes } from "node:crypto";
import { Router, type IRouter, type Request } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  CreateShareLinkBody,
  CreateShareLinkParams,
  GetShareLinkParams,
  GetSitterReportParams,
  RevokeShareLinkParams,
} from "@workspace/api-zod";
import { db, medications, petOwners, petShareLinks, pets } from "@workspace/db";
import { requireAuth } from "@workspace/auth";

const router: IRouter = Router();

// Duplicated from care.ts rather than shared — same call as every other
// route file in this app.
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

// The frontend origin the shareable link points at — WEB_ORIGIN is a
// comma-separated CORS allowlist (see app.ts); the first entry is this
// deployment's own primary frontend URL.
function getWebOrigin(): string {
  const first = (process.env["WEB_ORIGIN"] ?? "").split(",")[0]?.trim();
  return first || "http://localhost:5173";
}

const MAX_SHARE_DURATION_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

async function findActiveShareLink(petId: number) {
  const [row] = await db
    .select()
    .from(petShareLinks)
    .where(and(eq(petShareLinks.petId, petId), isNull(petShareLinks.revokedAt)))
    .orderBy(desc(petShareLinks.createdAt))
    .limit(1);
  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  return row;
}

const asShareLink = (link: typeof petShareLinks.$inferSelect) => ({
  id: link.id,
  petId: link.petId,
  url: `${getWebOrigin()}/share/${link.token}`,
  startsAt: link.startsAt.toISOString(),
  expiresAt: link.expiresAt.toISOString(),
  lastViewedAt: link.lastViewedAt ? link.lastViewedAt.toISOString() : null,
  createdAt: link.createdAt.toISOString(),
});

router.get("/pets/:petId/share-link", requireAuth, async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId } = GetShareLinkParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const active = await findActiveShareLink(petId);
    res.json(active ? asShareLink(active) : null);
  } catch (error) {
    next(error);
  }
});

router.post("/pets/:petId/share-link", requireAuth, async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId } = CreateShareLinkParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const body = CreateShareLinkBody.parse(req.body);
    const startsAt = body.startsAt ?? new Date();
    const expiresAt = body.expiresAt;
    if (expiresAt.getTime() <= startsAt.getTime()) {
      res.status(400).json({ error: "expiresAt must be after startsAt" });
      return;
    }
    if (expiresAt.getTime() - startsAt.getTime() > MAX_SHARE_DURATION_MS) {
      res.status(400).json({ error: "Share links can span at most 60 days" });
      return;
    }

    // Only one active link per pet — revoke any existing one first. Both
    // steps run in one transaction so a double-fired request (double-click,
    // a retried request) can never leave two links active at once.
    const token = randomBytes(24).toString("base64url");
    const created = await db.transaction(async (tx) => {
      await tx
        .update(petShareLinks)
        .set({ revokedAt: new Date() })
        .where(and(eq(petShareLinks.petId, petId), isNull(petShareLinks.revokedAt)));

      const [row] = await tx
        .insert(petShareLinks)
        .values({ petId, token, startsAt, expiresAt })
        .returning();
      return row!;
    });
    res.status(201).json(asShareLink(created));
  } catch (error) {
    next(error);
  }
});

router.delete("/pets/:petId/share-link", requireAuth, async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId } = RevokeShareLinkParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    await db
      .update(petShareLinks)
      .set({ revokedAt: new Date() })
      .where(and(eq(petShareLinks.petId, petId), isNull(petShareLinks.revokedAt)));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Public — deliberately not behind requireAuth. The token is the only
// credential; see the petShareLinks table comment in lib/db/src/schema/care.ts.
router.get("/share/:token", async (req, res, next) => {
  try {
    const { token } = GetSitterReportParams.parse(req.params);
    const [link] = await db
      .select()
      .from(petShareLinks)
      .where(eq(petShareLinks.token, token));

    const now = Date.now();
    if (
      !link ||
      link.revokedAt ||
      link.startsAt.getTime() > now ||
      link.expiresAt.getTime() <= now
    ) {
      res.status(404).json({ error: "This link is no longer available." });
      return;
    }

    const [pet] = await db.select().from(pets).where(eq(pets.id, link.petId));
    if (!pet) {
      res.status(404).json({ error: "This link is no longer available." });
      return;
    }
    const activeMeds = await db
      .select()
      .from(medications)
      .where(and(eq(medications.petId, link.petId), eq(medications.active, true)));

    db.update(petShareLinks)
      .set({ lastViewedAt: new Date() })
      .where(eq(petShareLinks.id, link.id))
      .catch(() => {
        // Best-effort — a failed view-timestamp write shouldn't fail the read.
      });

    res.json({
      petName: pet.name,
      species: pet.species,
      sex: pet.sex,
      weight: pet.weight === null ? null : Number(pet.weight),
      weightUnit: pet.weightUnit,
      microchipId: pet.microchipId,
      photoUrl: pet.photoUrl,
      vetName: pet.vetName,
      vetClinic: pet.vetClinic,
      vetPhone: pet.vetPhone,
      vetAddress: pet.vetAddress,
      medications: activeMeds.map((m) => ({
        name: m.name,
        dose: m.dose,
        frequency: m.frequency,
        instructions: m.instructions,
      })),
      notes: pet.notes,
      criticalInfoSummary: pet.criticalInfoSummary,
      criticalInfoDetails: pet.criticalInfoDetails,
      feedingInstructions: pet.feedingInstructions,
      whereThingsAre: pet.whereThingsAre,
      walksAndTriggers: pet.walksAndTriggers,
      handlingNotes: pet.handlingNotes,
      whatNormalLooksLike: pet.whatNormalLooksLike,
      caretakingPreference: pet.caretakingPreference,
      emergencyVetName: pet.emergencyVetName,
      emergencyVetPhone: pet.emergencyVetPhone,
      emergencyVetHours: pet.emergencyVetHours,
      expiresAt: link.expiresAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
