import { Router, type IRouter, type Request } from "express";
import { and, desc, eq } from "drizzle-orm";
import { DismissAlertParams, ListAlertsParams } from "@workspace/api-zod";
import { alerts, db, petOwners } from "@workspace/db";

const router: IRouter = Router();

// Duplicated from care.ts rather than shared — same call as
// document-imports.ts and symptom-entries.ts make for the same helpers.
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

const asAlert = (alert: typeof alerts.$inferSelect) => ({
  ...alert,
  createdAt: alert.createdAt.toISOString(),
  resolvedAt: alert.resolvedAt ? alert.resolvedAt.toISOString() : null,
});

router.get("/pets/:petId/alerts", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId } = ListAlertsParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const rows = await db
      .select()
      .from(alerts)
      .where(eq(alerts.petId, petId))
      .orderBy(desc(alerts.createdAt));
    res.json(rows.map(asAlert));
  } catch (error) {
    next(error);
  }
});

router.post("/pets/:petId/alerts/:alertId/dismiss", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { petId, alertId } = DismissAlertParams.parse(req.params);
    if (!(await isPetOwnedByUser(userId, petId))) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }
    const [alert] = await db.select().from(alerts).where(and(eq(alerts.id, alertId), eq(alerts.petId, petId)));
    if (!alert) {
      res.status(404).json({ error: "Alert not found" });
      return;
    }
    const [updated] = await db
      .update(alerts)
      .set({ status: "dismissed" })
      .where(eq(alerts.id, alertId))
      .returning();
    res.json(asAlert(updated!));
  } catch (error) {
    next(error);
  }
});

export default router;
