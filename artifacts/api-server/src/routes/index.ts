import { Router, type IRouter } from "express";
import { requireAuth } from "@workspace/auth";
import healthRouter from "./health";
import careRouter from "./care";
import documentImportsRouter from "./document-imports";
import symptomEntriesRouter from "./symptom-entries";
import alertsRouter from "./alerts";
import shareLinksRouter from "./share-links";

const router: IRouter = Router();

router.use(healthRouter);
// shareLinksRouter applies requireAuth itself, per-route, since it's the one
// router with a deliberately public route (GET /share/:token) mixed in
// alongside owner-only ones — see share-links.ts.
router.use(shareLinksRouter);
// Every pet-scoped route requires a signed-in session. Per-owner data
// scoping (does this session's user actually own this pet) lands in Bolt 2.
router.use(requireAuth, careRouter, documentImportsRouter, symptomEntriesRouter, alertsRouter);

export default router;
