import { pgTable, integer, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { pets } from "./care";

export const petOwners = pgTable(
  "pet_owners",
  {
    // Clerk's user id (e.g. "user_2abc...") — Clerk is the source of truth
    // for accounts, so there's no local `users` table to foreign-key into.
    userId: text("user_id").notNull(),
    petId: integer("pet_id")
      .notNull()
      .references(() => pets.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "co_owner"] })
      .notNull()
      .default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.petId] })],
);
