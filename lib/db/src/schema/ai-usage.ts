import { integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./auth";

// One row per account per calendar month ("2026-09"). chatQuestionsUsed is
// unused until the symptom-chat bolt lands — both counters live on one row
// since they share the same per-account-per-month shape.
export const aiUsageMonthly = pgTable(
  "ai_usage_monthly",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    periodMonth: text("period_month").notNull(),
    chatQuestionsUsed: integer("chat_questions_used").notNull().default(0),
    documentUploadsUsed: integer("document_uploads_used").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("ai_usage_monthly_user_period_uidx").on(table.userId, table.periodMonth)],
);
