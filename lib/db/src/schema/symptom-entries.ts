import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { pets } from "./care";

// The dedicated Symptom Journal (Bolt 22) — deliberately separate from the
// existing symptom_logs table (a free-text note saved from a Pawlie chat
// answer, tied to an insights row). Different shape (structured fields vs.
// free text) and different source (a purpose-built logging UI vs. a chat
// side effect), kept apart so this can't regress the already-shipped
// symptom-chat flow. Every field nullable — an owner logs whatever they
// actually observed, never a mandatory checklist. A logged weight goes to
// the existing weight_logs table (already trend-charted, Bolt 12) instead
// of a column here.
export const symptomEntries = pgTable("symptom_entries", {
  id: serial("id").primaryKey(),
  petId: integer("pet_id").notNull().references(() => pets.id, { onDelete: "cascade" }),
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
  appetite: text("appetite", { enum: ["low", "normal", "high"] }),
  energy: text("energy", { enum: ["low", "normal", "high"] }),
  stoolQuality: text("stool_quality", { enum: ["normal", "soft", "diarrhea", "constipated"] }),
  vomiting: boolean("vomiting"),
  limping: boolean("limping"),
  behaviorNote: text("behavior_note"),
  note: text("note"),
});
