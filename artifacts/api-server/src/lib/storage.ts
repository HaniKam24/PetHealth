import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "health-record-documents";
// The bucket is private (not publicly readable) — every document is served
// via a signed URL. Ten years is effectively "doesn't expire" for an MVP
// without a signed-URL-refresh flow, while still not being a truly public link.
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365 * 10;

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

export async function uploadHealthRecordDocument(
  petId: number,
  file: UploadedFile,
): Promise<{ url: string; name: string }> {
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

  const { data, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (signError || !data) {
    throw signError ?? new Error("Failed to create a signed URL for the upload.");
  }

  return { url: data.signedUrl, name: file.originalname };
}
