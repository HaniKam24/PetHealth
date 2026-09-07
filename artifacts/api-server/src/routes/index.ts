import { Router, type IRouter } from "express";
import { requireAuth } from "@workspace/auth";
import healthRouter from "./health";
import careRouter from "./care";
import documentImportsRouter from "./document-imports";

const router: IRouter = Router();

router.use(healthRouter);
// Every pet-scoped route requires a signed-in session. Per-owner data
// scoping (does this session's user actually own this pet) lands in Bolt 2.
router.use(requireAuth, careRouter, documentImportsRouter);

export default router;
