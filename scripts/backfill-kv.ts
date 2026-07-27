#!/usr/bin/env node
/**
 * Phase 3 — import a KV export snapshot into Postgres (idempotent upserts).
 *
 * Usage:
 *   npm run backfill:kv -- --in data/kv-export/<stamp>/snapshot.json
 *   npm run backfill:kv -- --in ... --dry
 *   npm run backfill:kv -- --in ... --fresh   # TRUNCATE all app tables first
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

function findLatestSnapshot(): string | null {
  const base = resolve("data/kv-export");
  if (!existsSync(base)) return null;

  let latest: { path: string; mtime: number } | null = null;
  for (const dir of readdirSync(base)) {
    const candidate = join(base, dir, "snapshot.json");
    if (!existsSync(candidate)) continue;
    const mtime = statSync(candidate).mtimeMs;
    if (!latest || mtime > latest.mtime) latest = { path: candidate, mtime };
  }
  return latest?.path ?? null;
}

function parseArgs(argv: string[]) {
  let inPath: string | null = null;
  let dry = false;
  let fresh = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--in" && argv[i + 1]) {
      inPath = resolve(argv[++i]);
    } else if (arg === "--dry") {
      dry = true;
    } else if (arg === "--fresh") {
      fresh = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: npm run backfill:kv [-- --in snapshot.json] [--dry] [--fresh]"
      );
      process.exit(0);
    }
  }

  if (!inPath) inPath = findLatestSnapshot();
  if (!inPath) {
    throw new Error("No snapshot found. Run npm run export:kv first or pass --in");
  }

  return { inPath, dry, fresh };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const { backfillSnapshotFromFile, countPostgresRows, loadSnapshot } = await import(
    "../src/lib/kvExport/backfillSnapshot"
  );

  const { inPath, dry, fresh } = parseArgs(process.argv.slice(2));

  console.log(`Backfill from ${inPath}${dry ? " (dry run)" : ""}${fresh ? " (fresh)" : ""}`);

  const snapshot = loadSnapshot(inPath);
  console.log("Snapshot counts:", snapshot.counts);

  const before = await countPostgresRows();
  console.log("Before:", before);

  const report = await backfillSnapshotFromFile(inPath, { dry, fresh });
  console.log("\nBackfill upserted:", report.upserted);
  console.log("Backfill skipped:", report.skipped);

  if (!dry) {
    const after = await countPostgresRows();
    console.log("\nAfter:", after);
  }

  if (report.warnings.length) {
    console.log(`\nWarnings (${report.warnings.length}):`);
    for (const w of report.warnings.slice(0, 15)) console.log(`  - ${w}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
