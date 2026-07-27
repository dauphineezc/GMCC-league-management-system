#!/usr/bin/env node
/**
 * One-off KV → normalized JSON export for Postgres backfill (Phase 2).
 *
 * Usage:
 *   npm run export:kv
 *   npm run export:kv -- --out data/kv-export/latest.json
 *   npm run export:kv -- --skip-firebase
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

function parseArgs(argv: string[]) {
  let outPath: string | null = null;
  let includeFirebase = true;
  let includeInviteScan = true;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out" && argv[i + 1]) {
      outPath = argv[++i];
    } else if (arg === "--skip-firebase") {
      includeFirebase = false;
    } else if (arg === "--skip-invites") {
      includeInviteScan = false;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: npm run export:kv [-- --out <path>] [--skip-firebase] [--skip-invites]`);
      process.exit(0);
    }
  }

  if (!outPath) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    outPath = join("data", "kv-export", stamp, "snapshot.json");
  }

  return {
    outPath: resolve(outPath),
    includeFirebase,
    includeInviteScan,
  };
}

async function main() {
  const { exportKvSnapshot } = await import("../src/lib/kvExport/exportSnapshot");
  const { outPath, includeFirebase, includeInviteScan } = parseArgs(process.argv.slice(2));

  console.log("Exporting KV snapshot...");
  const snapshot = await exportKvSnapshot({
    includeFirebaseUsers: includeFirebase,
    includeInviteScan,
  });

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2), "utf8");

  console.log(`Wrote ${outPath}`);
  console.log("Counts:", snapshot.counts);
  if (snapshot.warnings.length) {
    console.log(`Warnings (${snapshot.warnings.length}):`);
    for (const w of snapshot.warnings.slice(0, 20)) console.log(`  - ${w}`);
    if (snapshot.warnings.length > 20) {
      console.log(`  ... and ${snapshot.warnings.length - 20} more (see snapshot.json)`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
