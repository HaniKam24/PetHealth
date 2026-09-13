import { and, eq } from "drizzle-orm";
import { db, aiUsageMonthly } from "@workspace/db";

// One account-wide monthly allowance for symptom-chat AI questions (separate
// from the document-upload lanes in document-import-quota.ts, even though
// both live on the same ai_usage_monthly row). Unit economics: at low-cost-
// model pricing a single-turn grounded answer costs a fraction of a cent, so
// this is an abuse/cost-bound guardrail, not a margin necessity — see
// docs/PRD.md section 7c and the "Symptom chat" row in section 5.
const CHAT_LIMIT = 50;

export interface ChatQuota {
  used: number;
  limit: number;
  remaining: number;
}

export class ChatQuotaExceededError extends Error {
  constructor() {
    super("You've used all of this month's AI questions. The allowance resets next month.");
  }
}

function currentPeriodMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function getChatUsed(userId: string): Promise<number> {
  const [row] = await db
    .select()
    .from(aiUsageMonthly)
    .where(and(eq(aiUsageMonthly.userId, userId), eq(aiUsageMonthly.periodMonth, currentPeriodMonth())));
  return row?.chatQuestionsUsed ?? 0;
}

export async function getChatQuota(userId: string): Promise<ChatQuota> {
  const used = await getChatUsed(userId);
  return { used, limit: CHAT_LIMIT, remaining: Math.max(0, CHAT_LIMIT - used) };
}

/**
 * Throws ChatQuotaExceededError if the account is out of chat questions for
 * this month. Call BEFORE the AI call so a used-up quota doesn't cost
 * anything; call recordChatUsage AFTER a successful answer so a failed call
 * doesn't consume the owner's allowance. Red-flag escalations skip both —
 * they're a deterministic, zero-AI-cost short-circuit (see
 * symptom-escalation.ts) and must never be blocked by a maxed-out quota.
 */
export async function assertChatQuotaAvailable(userId: string): Promise<void> {
  const quota = await getChatQuota(userId);
  if (quota.remaining <= 0) {
    throw new ChatQuotaExceededError();
  }
}

export async function recordChatUsage(userId: string): Promise<void> {
  const period = currentPeriodMonth();
  const [existing] = await db
    .select()
    .from(aiUsageMonthly)
    .where(and(eq(aiUsageMonthly.userId, userId), eq(aiUsageMonthly.periodMonth, period)));

  if (existing) {
    await db
      .update(aiUsageMonthly)
      .set({ chatQuestionsUsed: existing.chatQuestionsUsed + 1, updatedAt: new Date() })
      .where(eq(aiUsageMonthly.id, existing.id));
  } else {
    await db.insert(aiUsageMonthly).values({ userId, periodMonth: period, chatQuestionsUsed: 1 });
  }
}
