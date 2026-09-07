import { pgTable, integer, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { pets } from "./care";
import { users } from "./auth";

export const petOwners = pgTable(
  "pet_owners",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
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
