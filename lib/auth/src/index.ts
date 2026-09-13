import type { NextFunction, Request, RequestHandler, Response } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";

/**
 * Reads the Clerk session (JWT, sent as `Authorization: Bearer <token>` by
 * the frontend — see setAuthTokenGetter() in the api client) and attaches
 * it to `req.auth` when present. Doesn't reject unauthenticated requests by
 * itself — pair with requireAuth for routes that need a signed-in user.
 */
export const clerkAuthMiddleware: RequestHandler = clerkMiddleware();

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Clerk's user id (e.g. "user_2abc...") — set by requireAuth. */
      userId?: string;
    }
  }
}

/**
 * Requires a signed-in Clerk session. Attaches `req.userId`; responds 401
 * otherwise. Every pet-scoped route sits behind this.
 */
export const requireAuth: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  req.userId = userId;
  next();
};
