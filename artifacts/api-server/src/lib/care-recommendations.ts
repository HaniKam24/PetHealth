import { and, eq } from "drizzle-orm";
import { db, healthRecords, pets, reminders } from "@workspace/db";

// ---------------------------------------------------------------------------
// Care Recommendations Engine — pure rule-based date/age arithmetic, no AI
// calls. Runs synchronously right after whatever mutation could change its
// inputs (a pet's birth date, or a new/edited vaccine record) — there's no
// background job scheduler in this app, so "re-run on the mutations that
// matter" is the trigger model instead of a cron.
//
// Every reminder it writes carries `source: "system"` and a stable
// `ruleId`, so re-running for the same pet updates the existing reminder
// instead of creating duplicates.
// ---------------------------------------------------------------------------

const GUIDELINE_NOTE = "General guideline — confirm with your vet.";

type VaccineRule = {
  key: string;
  species: "dog" | "cat" | "any";
  keywords: string[];
  label: string;
  intervalMonths: number;
};

// Deliberately small and conservative — not a general veterinary schedule.
const VACCINE_RULES: VaccineRule[] = [
  { key: "rabies", species: "any", keywords: ["rabies"], label: "Rabies booster", intervalMonths: 12 },
  { key: "dhpp", species: "dog", keywords: ["dhpp", "dapp", "distemper"], label: "DHPP/DAPP booster", intervalMonths: 12 },
  { key: "fvrcp", species: "cat", keywords: ["fvrcp"], label: "FVRCP booster", intervalMonths: 12 },
  { key: "bordetella", species: "dog", keywords: ["bordetella", "kennel cough"], label: "Bordetella booster", intervalMonths: 12 },
];

// PRD defaults: 7yr for dogs, 10yr for cats. Other species have no rule yet.
const SENIOR_SCREENING_AGE_YEARS: Partial<Record<string, number>> = {
  dog: 7,
  cat: 10,
};

function addMonthsToDateString(dateStr: string, months: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

function addDaysToDateString(from: Date, days: number): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function ageInYears(birthDateStr: string): number {
  const birth = new Date(`${birthDateStr}T00:00:00.000Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }
  return age;
}

/**
 * Creates or updates the one reminder for this pet+rule. Only touches
 * `completed` when the computed due date actually changed (a newer source
 * record came in) — otherwise leaves it alone so marking a reminder done
 * doesn't get silently reverted by the next engine run.
 */
async function upsertSystemReminder(input: {
  petId: number;
  ruleId: string;
  title: string;
  category: string;
  dueDate: string;
}) {
  const [existing] = await db
    .select()
    .from(reminders)
    .where(and(eq(reminders.petId, input.petId), eq(reminders.ruleId, input.ruleId)));

  if (!existing) {
    await db.insert(reminders).values({
      petId: input.petId,
      title: input.title,
      category: input.category,
      dueDate: input.dueDate,
      note: GUIDELINE_NOTE,
      source: "system",
      ruleId: input.ruleId,
      completed: false,
    });
    return;
  }

  if (existing.dueDate !== input.dueDate) {
    await db
      .update(reminders)
      .set({ title: input.title, dueDate: input.dueDate, note: GUIDELINE_NOTE, completed: false })
      .where(eq(reminders.id, existing.id));
  }
}

export async function runCareRecommendationsEngine(pet: typeof pets.$inferSelect): Promise<void> {
  const vaccineRecords = await db
    .select()
    .from(healthRecords)
    .where(and(eq(healthRecords.petId, pet.id), eq(healthRecords.type, "vaccine")));

  for (const rule of VACCINE_RULES) {
    if (rule.species !== "any" && rule.species !== pet.species) continue;

    // Latest matching record wins — the renewal date should track the most
    // recent shot, not the first one ever logged.
    const match = vaccineRecords
      .filter((r) => rule.keywords.some((k) => r.title.toLowerCase().includes(k)))
      .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    if (!match) continue;

    await upsertSystemReminder({
      petId: pet.id,
      ruleId: `vaccine:${rule.key}`,
      title: `${rule.label} due`,
      category: "vaccine",
      dueDate: addMonthsToDateString(match.date, rule.intervalMonths),
    });
  }

  if (pet.birthDate) {
    const threshold = SENIOR_SCREENING_AGE_YEARS[pet.species];
    if (threshold !== undefined && ageInYears(pet.birthDate) >= threshold) {
      await upsertSystemReminder({
        petId: pet.id,
        ruleId: "senior-screening",
        title: "Senior wellness bloodwork due",
        category: "wellness",
        dueDate: addDaysToDateString(new Date(), 30),
      });
    }
  }
}
