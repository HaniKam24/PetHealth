import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { insights, pets } from "./care";

// A Pawlie chat turn's proposed edit — deliberately parallel to
// document_import_items (Smart Document Upload's own review-gated write
// path): the model never writes directly, it proposes a structured action,
// the owner confirms or cancels, and only a confirm applies it through the
// same mutation helper every other route already uses.
export const aiActions = pgTable("ai_actions", {
  id: serial("id").primaryKey(),
  petId: integer("pet_id").notNull().references(() => pets.id, { onDelete: "cascade" }),
  // The chat turn that proposed this — nullable so a future non-chat
  // source (unlikely, but the shape shouldn't assume one) isn't blocked.
  insightId: integer("insight_id").references(() => insights.id, { onDelete: "set null" }),
  actionType: text("action_type", {
    enum: ["create_reminder", "complete_reminder", "update_pet_profile", "log_symptom"],
  }).notNull(),
  proposedData: jsonb("proposed_data").notNull(),
  status: text("status", { enum: ["pending", "confirmed", "cancelled"] })
    .notNull()
    .default("pending"),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
