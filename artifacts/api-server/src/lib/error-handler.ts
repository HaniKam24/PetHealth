import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { logger } from "./logger";

// Every route's `catch (error) { next(error); }` ends up here once it isn't
// one of the specific, already-handled error types (QuotaExceededError,
// TooManyPagesError, etc. are caught inline and never reach this). Without
// this, an unhandled error — a Zod validation failure, a DB error, an
// upstream AI-provider failure — fell through to Express's default handler:
// non-JSON HTML output, and in a misconfigured NODE_ENV, a raw stack trace
// or upstream error body (confirmed live during testing: OpenAI's own HTML
// error page, before the Claude migration) leaked straight to the client.
// This keeps every API response JSON and never exposes internal details —
// the real error is logged server-side instead.
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof ZodError) {
    const detail = error.issues
      .map((issue) => `${issue.path.join(".") || "value"} ${issue.message}`)
      .join("; ");
    res.status(400).json({ error: `Invalid request: ${detail}` });
    return;
  }

  (req.log ?? logger).error({ err: error }, "Unhandled request error");
  res.status(500).json({ error: "Something went wrong. Please try again." });
};

// Catches requests to routes that don't exist at all — same reasoning as
// above, JSON instead of Express's default HTML 404 page.
export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Not found" });
};
