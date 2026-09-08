import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "health-record-documents";
// Short-lived by design: URLs are minted on demand each time a document is
// actually viewed (see createSignedDocumentUrl), not once at upload time.
// A leaked link expires on its own instead of staying valid for years.
const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 60;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} must be set. Did you forget to provision Supabase Storage?`,
    );
  }
  return value;
}

const supabase = createClient(
  requireEnv("SUPABASE_URL"),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
);

let bucketEnsured = false;

async function ensureBucket() {
  if (bucketEnsured) return;

  const { data: existing } = await supabase.storage.getBucket(BUCKET);
  if (!existing) {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: "10MB",
    });
    if (error && !error.message.toLowerCase().includes("already exists")) {
      throw error;
    }
  }

  bucketEnsured = true;
}

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

// Uploads the file and returns its private storage path — deliberately not a
// URL. Callers persist the path and mint a fresh signed URL only when a
// document is actually viewed, via createSignedDocumentUrl.
export async function uploadHealthRecordDocument(
  petId: number,
  file: UploadedFile,
): Promise<{ path: string; name: string }> {
  await ensureBucket();

  const ext = file.originalname.includes(".")
    ? file.originalname.slice(file.originalname.lastIndexOf("."))
    : "";
  const path = `pet-${petId}/${randomUUID()}${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
  if (uploadError) {
    throw uploadError;
  }

  return { path, name: file.originalname };
}

export async function createSignedDocumentUrl(
  path: string,
  ttlSeconds: number = DEFAULT_SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, ttlSeconds);
  if (error || !data) {
    throw error ?? new Error("Failed to create a signed URL for the document.");
  }
  return data.signedUrl;
}

// Best-effort: callers should catch and log rather than fail a request whose
// primary (DB) effect already succeeded.
export async function deleteDocument(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) {
    throw error;
  }
}
