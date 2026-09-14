import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { pets } from "./care";
import { symptomEntries } from "./symptom-entries";

// Predictive Health Monitoring (Bolts 23/24) — the Care Recommendations
// Engine's own pattern, applied to symptom_entries instead of health
// records: pure rule-based logic, re-evaluated synchronously right after a
// new entry is saved. `reasoning` is a structured list the client renders
// through a fixed template — this table (and the code that writes it)
// never stores or generates freeform AI text. One row represents this
// pet's *current* assessment — re-evaluation upserts it rather than
// piling up a new row per entry, mirroring how upsertSystemReminder works.
// No "green" in the severity enum: green means nothing is flagged, which
// is the absence of an active row, not a stored state.
export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  petId: integer("pet_id").notNull().references(() => pets.id, { onDelete: "cascade" }),
  triggeredByEntryId: integer("triggered_by_entry_id").references(() => symptomEntries.id, { onDelete: "set null" }),
  severity: text("severity", { enum: ["yellow", "red"] }).notNull(),
  confidence: text("confidence", { enum: ["low", "medium", "high"] }).notNull(),
  // Structured {signal, value, historicalDataPoint, weight}[] — see
  // lib/predictive-monitoring.ts. Never freeform text; a fixed template on
  // both server (copyable summary) and client renders this into words.
  reasoning: jsonb("reasoning").notNull(),
  status: text("status", { enum: ["active", "dismissed", "resolved"] }).notNull().default("active"),
  outcomeNote: text("outcome_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});
