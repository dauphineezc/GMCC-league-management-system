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
import {
  backfillSnapshotFromFile,
  countPostgresRows,
  loadSnapshot,
} from "../src/lib/kvExport/backfillSnapshot";

config({ path: ".env.local" });

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
        "Usage: npm run backfill:kv [-- --in <snapshot.json>] [--dry] [--fresh]"
      );
      process.exit(0);
    }
  }

  if (!inPath) {
    inPath = findLatestSnapshot();
    if (!inPath) {
      throw new Error("No snapshot found. Pass --in path/to/snapshot.json");
    }
    console.log(`Using latest snapshot: ${inPath}`);
  }

  return { inPath, dry, fresh };
}

async function main() {
  const { inPath, dry, fresh } = parseArgs(process.argv.slice(2));
  const snapshot = loadSnapshot(inPath);

  console.log(`Snapshot exported at ${snapshot.exportedAt}`);
  console.log("Source counts:", snapshot.counts);

  if (fresh && !dry) {
    console.log("WARNING: --fresh will TRUNCATE all app tables before import.");
  }

  const report = await backfillSnapshotFromFile(inPath, { dry, fresh });

  if (dry) {
    console.log("Dry run — no database writes.");
    console.log("Would upsert:", report.upserted);
    return;
  }

  console.log("Upserted:", report.upserted);
  if (Object.keys(report.skipped).length) console.log("Skipped:", report.skipped);

  const dbCounts = await countPostgresRows();
  console.log("Postgres row counts:", dbCounts);

  const newWarnings = report.warnings.length - snapshot.warnings.length;
  if (newWarnings > 0) {
    console.log(`Backfill warnings (${newWarnings} new):`);
    for (const w of report.warnings.slice(-newWarnings).slice(0, 20)) {
      console.log(`  - ${w}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
