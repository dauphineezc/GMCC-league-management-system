import { db } from "@/db/index";
import { joinCodeFailures } from "@/db/schema";
import { and, eq, gte, lt, or, sql } from "drizzle-orm";

export const JOIN_CODE_MAX_FAILURES = 10;
export const JOIN_CODE_WINDOW_MINUTES = 15;

/** True when this user or IP has too many recent failed join-code attempts. */
export async function isJoinCodeRateLimited(userId: string, ip: string | null): Promise<boolean> {
  const since = new Date(Date.now() - JOIN_CODE_WINDOW_MINUTES * 60_000);
  const who = ip
    ? or(eq(joinCodeFailures.userId, userId), eq(joinCodeFailures.ip, ip))
    : eq(joinCodeFailures.userId, userId);

  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(joinCodeFailures)
    .where(and(who, gte(joinCodeFailures.createdAt, since)));
  return (row?.n ?? 0) >= JOIN_CODE_MAX_FAILURES;
}

export async function recordJoinCodeFailure(userId: string, ip: string | null): Promise<void> {
  await db.insert(joinCodeFailures).values({ userId, ip });
  // Opportunistic cleanup keeps the table small without a cron job.
  const cutoff = new Date(Date.now() - 24 * 60 * 60_000);
  await db.delete(joinCodeFailures).where(lt(joinCodeFailures.createdAt, cutoff));
}
