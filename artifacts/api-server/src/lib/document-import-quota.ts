import { and, eq } from "drizzle-orm";
import { db, aiUsageMonthly, pets } from "@workspace/db";

// Two lanes, checked in this order: a one-time 20-document onboarding
// allowance per pet (first 30 days after the pet was created) so someone
// backfilling years of history isn't blocked by a small recurring cap on
// day one, then a 10/month ongoing allowance per account. Unit economics:
// at low-cost-model pricing this tops out around $0.10-0.15/account/month
// even maxed out — the caps are an abuse/storage guardrail, not a margin
// necessity. See docs/PRD.md section 7b.
const ONBOARDING_LIMIT = 20;
const ONGOING_LIMIT = 10;

export type ImportLane = "onboarding" | "ongoing";

export interface DocumentImportQuota {
  onboardingRemaining: number | null;
  onboardingLimit: number;
  ongoingRemaining: number;
  ongoingLimit: number;
}

export class QuotaExceededError extends Error {
  constructor() {
    super("You've used all of this month's document uploads. The allowance resets next month.");
  }
}

function currentPeriodMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function getOngoingUsed(userId: number): Promise<number> {
  const [row] = await db
    .select()
    .from(aiUsageMonthly)
    .where(and(eq(aiUsageMonthly.userId, userId), eq(aiUsageMonthly.periodMonth, currentPeriodMonth())));
  return row?.documentUploadsUsed ?? 0;
}

export async function getDocumentImportQuota(
  userId: number,
  pet: typeof pets.$inferSelect,
): Promise<DocumentImportQuota> {
  const onboardingActive = pet.importWindowEndsAt !== null && pet.importWindowEndsAt.getTime() > Date.now();
  const ongoingUsed = await getOngoingUsed(userId);
  return {
    onboardingRemaining: onboardingActive ? Math.max(0, ONBOARDING_LIMIT - pet.importDocsUsed) : null,
    onboardingLimit: ONBOARDING_LIMIT,
    ongoingRemaining: Math.max(0, ONGOING_LIMIT - ongoingUsed),
    ongoingLimit: ONGOING_LIMIT,
  };
}

/**
 * Read-only: picks which lane a new upload would draw from, without
 * reserving it. Throws QuotaExceededError if both lanes are exhausted.
 * Call this BEFORE the AI extraction call so a used-up quota doesn't cost
 * anything; call recordDocumentImportUsage AFTER a successful extraction
 * so a failed call doesn't consume the owner's allowance.
 */
export async function pickImportLane(
  userId: number,
  pet: typeof pets.$inferSelect,
): Promise<{ quota: DocumentImportQuota; lane: ImportLane }> {
  const quota = await getDocumentImportQuota(userId, pet);
  if (quota.onboardingRemaining !== null && quota.onboardingRemaining > 0) {
    return { quota, lane: "onboarding" };
  }
  if (quota.ongoingRemaining > 0) {
    return { quota, lane: "ongoing" };
  }
  throw new QuotaExceededError();
}

export async function recordDocumentImportUsage(
  userId: number,
  pet: typeof pets.$inferSelect,
  lane: ImportLane,
): Promise<void> {
  if (lane === "onboarding") {
    await db
      .update(pets)
      .set({ importDocsUsed: pet.importDocsUsed + 1 })
      .where(eq(pets.id, pet.id));
    return;
  }

  const period = currentPeriodMonth();
  const [existing] = await db
    .select()
    .from(aiUsageMonthly)
    .where(and(eq(aiUsageMonthly.userId, userId), eq(aiUsageMonthly.periodMonth, period)));

  if (existing) {
    await db
      .update(aiUsageMonthly)
      .set({ documentUploadsUsed: existing.documentUploadsUsed + 1, updatedAt: new Date() })
      .where(eq(aiUsageMonthly.id, existing.id));
  } else {
    await db.insert(aiUsageMonthly).values({ userId, periodMonth: period, documentUploadsUsed: 1 });
  }
}
