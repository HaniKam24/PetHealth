import {
  boolean,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const pets = pgTable("pets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  species: text("species").notNull(),
  breed: text("breed"),
  sex: text("sex").notNull().default("unknown"),
  birthDate: text("birth_date"),
  weight: numeric("weight"),
  weightUnit: text("weight_unit").notNull().default("lb"),
  photoUrl: text("photo_url"),
  notes: text("notes"),
  vetName: text("vet_name"),
  vetClinic: text("vet_clinic"),
  vetPhone: text("vet_phone"),
  vetAddress: text("vet_address"),
  // One-time Smart Document Upload "onboarding" import allowance (20 docs,
  // first 30 days) — see lib/document-import-quota.ts. Null on pets created
  // before this existed, which simply means that lane isn't available for
  // them; only the ongoing monthly lane applies.
  importDocsUsed: integer("import_docs_used").notNull().default(0),
  importWindowEndsAt: timestamp("import_window_ends_at", { withTimezone: true }),
});

export const healthRecords = pgTable("health_records", {
  id: serial("id").primaryKey(),
  petId: integer("pet_id").notNull().references(() => pets.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  date: text("date").notNull(),
  clinic: text("clinic"),
  summary: text("summary"),
  documentUrl: text("document_url"),
  documentType: text("document_type", { enum: ["link", "upload"] }),
  documentName: text("document_name"),
});

export const medications = pgTable("medications", {
  id: serial("id").primaryKey(),
  petId: integer("pet_id").notNull().references(() => pets.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  dose: text("dose").notNull(),
  frequency: text("frequency").notNull(),
  // Structured schedule driving auto-calculated next-dose times. Optional —
  // a medication can stay purely descriptive (frequency text only) if its
  // schedule doesn't fit a fixed interval.
  doseIntervalValue: integer("dose_interval_value"),
  doseIntervalUnit: text("dose_interval_unit", { enum: ["hours", "days", "weeks", "months"] }),
  nextDoseAt: timestamp("next_dose_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  instructions: text("instructions"),
});

export const reminders = pgTable("reminders", {
  id: serial("id").primaryKey(),
  petId: integer("pet_id").notNull().references(() => pets.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  dueDate: text("due_date").notNull(),
  category: text("category").notNull(),
  completed: boolean("completed").notNull().default(false),
  note: text("note"),
  source: text("source", { enum: ["owner", "system"] }).notNull().default("owner"),
  // Stable per-rule key (e.g. "vaccine:rabies") used to upsert the same
  // system-generated reminder across Care Recommendations Engine runs
  // instead of creating duplicates. Null for owner-created reminders.
  ruleId: text("rule_id"),
});

export const insights = pgTable("insights", {
  id: serial("id").primaryKey(),
  petId: integer("pet_id").notNull().references(() => pets.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  tone: text("tone").notNull().default("helpful"),
  source: text("source").notNull().default("ai"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  disclaimer: text("disclaimer").notNull(),
});