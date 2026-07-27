import { db } from "@/db/index";
import { schedulePdfs } from "@/db/schema";
import { resolveLeagueByRef } from "@/lib/db/resolveLeague";
import { eq } from "drizzle-orm";

export type SchedulePdfInfo = {
  filename: string;
  size: number | null;
  uploadedAt: string;
};

const B64_PREFIX = "b64:";

export function isSchedulePdfInPostgres(blobUrl: string): boolean {
  return blobUrl.startsWith(B64_PREFIX);
}

export function schedulePdfBlobUrlFromBytes(bytes: Buffer): string {
  return B64_PREFIX + bytes.toString("base64");
}

async function bytesFromBlobUrl(blobUrl: string): Promise<Buffer | null> {
  if (blobUrl.startsWith(B64_PREFIX)) {
    return Buffer.from(blobUrl.slice(B64_PREFIX.length), "base64");
  }

  if (blobUrl.startsWith("http://") || blobUrl.startsWith("https://")) {
    const res = await fetch(blobUrl, { cache: "no-store" });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  }

  return null;
}

export async function getSchedulePdfInfo(
  leagueRef: string
): Promise<SchedulePdfInfo | null> {
  const league = await resolveLeagueByRef(leagueRef);
  if (!league) return null;

  const rows = await db
    .select()
    .from(schedulePdfs)
    .where(eq(schedulePdfs.leagueId, league.id))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    filename: row.filename ?? "schedule.pdf",
    size: row.size,
    uploadedAt: row.uploadedAt.toISOString(),
  };
}

export async function getSchedulePdfBytes(leagueRef: string): Promise<{
  bytes: Buffer;
  filename: string;
} | null> {
  const league = await resolveLeagueByRef(leagueRef);
  if (!league) return null;

  const rows = await db
    .select()
    .from(schedulePdfs)
    .where(eq(schedulePdfs.leagueId, league.id))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const bytes = await bytesFromBlobUrl(row.blobUrl);
  if (!bytes) return null;

  return { bytes, filename: row.filename ?? "schedule.pdf" };
}

export async function upsertSchedulePdf(
  leagueRef: string,
  input: { filename: string; bytes: Buffer }
): Promise<SchedulePdfInfo> {
  const league = await resolveLeagueByRef(leagueRef);
  if (!league) throw new Error("League not found");

  const now = new Date();
  const blobUrl = schedulePdfBlobUrlFromBytes(input.bytes);

  const [row] = await db
    .insert(schedulePdfs)
    .values({
      leagueId: league.id,
      blobUrl,
      filename: input.filename,
      size: input.bytes.length,
      uploadedAt: now,
    })
    .onConflictDoUpdate({
      target: schedulePdfs.leagueId,
      set: {
        blobUrl,
        filename: input.filename,
        size: input.bytes.length,
        uploadedAt: now,
      },
    })
    .returning();

  return {
    filename: row.filename ?? input.filename,
    size: row.size,
    uploadedAt: row.uploadedAt.toISOString(),
  };
}

export async function deleteSchedulePdf(leagueRef: string): Promise<boolean> {
  const league = await resolveLeagueByRef(leagueRef);
  if (!league) return false;

  const rows = await db
    .select()
    .from(schedulePdfs)
    .where(eq(schedulePdfs.leagueId, league.id))
    .limit(1);

  if (!rows[0]) return false;

  await db.delete(schedulePdfs).where(eq(schedulePdfs.leagueId, league.id));
  return true;
}
