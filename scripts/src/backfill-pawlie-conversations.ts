import { eq, isNull, and, desc, count } from "drizzle-orm";
import { db, pets, insights, conversations } from "@workspace/db";

// One-time backfill for the Pawlie conversations redesign: every insight
// row predates the `conversations` concept, so each pet with at least one
// un-grouped insight gets a single "Earlier conversations" thread holding
// everything it had before this feature existed. Nothing is deleted or
// hidden — see docs/PRD.md's Pawlie conversations change for why this
// grouping (one legacy thread, not a guessed-at split) was chosen.
//
// Safe to re-run: a pet already fully backfilled (no null-conversationId
// insights left) is skipped entirely.
async function main() {
  const allPets = await db.select({ id: pets.id }).from(pets);

  let petsBackfilled = 0;
  let insightsMoved = 0;

  for (const pet of allPets) {
    const ungrouped = await db
      .select()
      .from(insights)
      .where(and(eq(insights.petId, pet.id), isNull(insights.conversationId)))
      .orderBy(desc(insights.createdAt));

    if (ungrouped.length === 0) continue;

    const [conversation] = await db
      .insert(conversations)
      .values({
        petId: pet.id,
        title: "Earlier conversations",
        // Newest-first query above, so [0] is the most recent of the
        // group — matches what lastMessageAt means everywhere else.
        lastMessageAt: ungrouped[0]!.createdAt,
      })
      .returning();

    await db
      .update(insights)
      .set({ conversationId: conversation!.id })
      .where(and(eq(insights.petId, pet.id), isNull(insights.conversationId)));

    petsBackfilled += 1;
    insightsMoved += ungrouped.length;
    console.log(`Pet ${pet.id}: moved ${ungrouped.length} insight(s) into conversation ${conversation!.id}.`);
  }

  const [{ remaining }] = await db
    .select({ remaining: count() })
    .from(insights)
    .where(isNull(insights.conversationId));

  console.log(`\nDone. ${petsBackfilled} pet(s) backfilled, ${insightsMoved} insight(s) moved.`);
  console.log(`Remaining insights with no conversationId: ${remaining}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  });
