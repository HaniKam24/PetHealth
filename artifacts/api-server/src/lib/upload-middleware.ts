import multer from "multer";
import type { NextFunction, Request, Response } from "express";

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
]);

/**
 * Wraps a single-file multer upload so an oversized file gets a clean 400
 * instead of falling through to the generic error handler (multer's own
 * size-limit error otherwise bypasses the route handler entirely).
 */
export function handleSingleFileUpload(fieldName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    upload.single(fieldName)(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: "File is too large. Maximum size is 10MB." });
        return;
      }
      next(err);
    });
  };
}
