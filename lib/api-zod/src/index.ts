export * from "./generated/api";
export * from "./generated/types";
// Orval emits both a Zod schema (generated/api.ts) and a plain type alias
// (generated/types/*.ts) under the same name for inline (non-$ref) request
// bodies — multipart file uploads, and bodies with no required fields. An
// explicit re-export resolves the collision in favor of the runtime schema.
export { UploadHealthRecordDocumentBody } from "./generated/api";
export { CreateDocumentImportBody } from "./generated/api";
export { AcceptDocumentImportItemBody } from "./generated/api";
