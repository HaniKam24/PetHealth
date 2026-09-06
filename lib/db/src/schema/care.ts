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
});

export const medications = pgTable("medications", {
  id: serial("id").primaryKey(),
  petId: integer("pet_id").notNull().references(() => pets.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  dose: text("dose").notNull(),
  frequency: text("frequency").notNull(),
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