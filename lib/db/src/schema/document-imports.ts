import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { pets } from "./care";

export const documentImports = pgTable("document_imports", {
  id: serial("id").primaryKey(),
  petId: integer("pet_id").notNull().references(() => pets.id, { onDelete: "cascade" }),
  // The private Supabase Storage object key, not a working URL — see the
  // matching comment on health_records.documentStoragePath.
  sourceDocumentPath: text("source_document_path").notNull(),
  documentName: text("document_name").notNull(),
  lane: text("lane", { enum: ["onboarding", "ongoing"] }).notNull(),
  status: text("status", { enum: ["pending_review", "reviewed"] })
    .notNull()
    .default("pending_review"),
  analyzedAt: timestamp("analyzed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documentImportItems = pgTable("document_import_items", {
  id: serial("id").primaryKey(),
  importId: integer("import_id")
    .notNull()
    .references(() => documentImports.id, { onDelete: "cascade" }),
  itemType: text("item_type", { enum: ["health_record", "medication", "reminder"] }).notNull(),
  proposedData: jsonb("proposed_data").notNull(),
  // Loosely matched against existing records (pet + type/name + date
  // proximity) — flagged for the owner to decide, never auto-dropped.
  duplicateOfType: text("duplicate_of_type", { enum: ["health_record", "medication", "reminder"] }),
  duplicateOfId: integer("duplicate_of_id"),
  status: text("status", { enum: ["pending", "accepted", "rejected"] })
    .notNull()
    .default("pending"),
  createdRecordId: integer("created_record_id"),
});
