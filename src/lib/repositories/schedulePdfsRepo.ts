import { db } from "@/db/index";
import { schedulePdfs } from "@/db/schema";
import { resolveLeagueByRef } from "@/lib/db/resolveLeague";
import { kvDelRaw, kvGetRaw, parseDoc, SCHEDULE_KEY } from "@/lib/scheduleKv";
import { eq } from "drizzle-orm";

export type SchedulePdfInfo = {
  filename: string;
  size: number | null;
  uploadedAt: string;
};

const KV_LEGACY_PREFIX = "kv-legacy://";
const B64_PREFIX = "b64:";

function kvLegacyKey(blobUrl: string): string | null {
  if (!blobUrl.startsWith(KV_LEGACY_PREFIX)) return null;
  return blobUrl.slice(KV_LEGACY_PREFIX.length);
}

async function bytesFromBlobUrl(blobUrl: string): Promise<Buffer | null> {
  if (blobUrl.startsWith(B64_PREFIX)) {
    return Buffer.from(blobUrl.slice(B64_PREFIX.length), "base64");
  }

  const legacyKey = kvLegacyKey(blobUrl);
  if (legacyKey) {
    const doc = parseDoc(await kvGetRaw(legacyKey));
    if (doc?.data) return Buffer.from(String(doc.data), "base64");
    return null;
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
  if (row) {
    return {
      filename: row.filename ?? "schedule.pdf",
      size: row.size,
      uploadedAt: row.uploadedAt.toISOString(),
    };
  }

  // Fallback: PDF exists in KV but no Postgres row yet (pre-backfill / drift)
  const legacyKey = SCHEDULE_KEY(leagueRef);
  const doc = parseDoc(await kvGetRaw(legacyKey));
  if (!doc?.data) return null;

  return {
    filename: String(doc.filename ?? "schedule.pdf"),
    size: doc.size != null ? Number(doc.size) : null,
    uploadedAt: String(doc.uploadedAt ?? new Date().toISOString()),
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
  if (row) {
    const bytes = await bytesFromBlobUrl(row.blobUrl);
    if (!bytes) return null;
    return { bytes, filename: row.filename ?? "schedule.pdf" };
  }

  const legacyKey = SCHEDULE_KEY(leagueRef);
  const doc = parseDoc(await kvGetRaw(legacyKey));
  if (!doc?.data) return null;

  return {
    bytes: Buffer.from(String(doc.data), "base64"),
    filename: String(doc.filename ?? "schedule.pdf"),
  };
}

export async function upsertSchedulePdf(
  leagueRef: string,
  input: { filename: string; bytes: Buffer }
): Promise<SchedulePdfInfo> {
  const league = await resolveLeagueByRef(leagueRef);
  if (!league) throw new Error("League not found");

  const now = new Date();
  const blobUrl = B64_PREFIX + input.bytes.toString("base64");

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

  // Remove legacy KV copy if present
  const legacyKey = SCHEDULE_KEY(leagueRef);
  try {
    await kvDelRaw(legacyKey);
  } catch {
    /* best-effort */
  }

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

  const row = rows[0];
  if (row) {
    await db.delete(schedulePdfs).where(eq(schedulePdfs.leagueId, league.id));
    const legacyKey = kvLegacyKey(row.blobUrl);
    if (legacyKey) {
      try {
        await kvDelRaw(legacyKey);
      } catch {
        /* best-effort */
      }
    }
    return true;
  }

  const legacyKey = SCHEDULE_KEY(leagueRef);
  const doc = parseDoc(await kvGetRaw(legacyKey));
  if (doc?.data) {
    await kvDelRaw(legacyKey);
    return true;
  }

  return false;
}
