import type { NextFunction, Request, RequestHandler, Response } from "express";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import type { Session, User } from "better-auth";
import { auth } from "./auth";

export { auth } from "./auth";

/** Express handler for better-auth's own routes (signup/login/session/etc). Mount at `/api/auth`. */
export const authHandler = toNodeHandler(auth);

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
      session?: Session;
    }
  }
}

/**
 * Requires a signed-in session. Attaches `req.user` / `req.session` on
 * success; responds 401 otherwise. Every pet-scoped route added from Bolt 2
 * onward sits behind this.
 */
export const requireAuth: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!result) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    req.user = result.user;
    req.session = result.session;
    next();
  } catch (error) {
    next(error);
  }
};
