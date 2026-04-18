#!/usr/bin/env tsx
/**
 * sync-freemail-list.ts — monthly upstream diff runner for the committed freemail list.
 *
 * WHAT: Fetches `Kikobeats/free-email-domains/master/domains.json` (MIT, HubSpot-based,
 * upstream SoT for our committed snapshot at
 * `backend/src/nest/domains/data/freemail-domains.json`), diffs against the committed
 * copy, and prints an ADDED / REMOVED / UNCHANGED summary. **Never auto-commits.**
 * Run monthly: `pnpm run sync:freemail`. ADR-048 documents the rationale
 * (committed-JSON over npm wrapper — see FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md
 * §0.2.5 #12).
 *
 * WHY: `mailchecker` only covers disposable providers; freemail detection is our
 * responsibility (FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md §2.3 three-layer
 * validation). Committed JSON keeps diffs reviewable in Git, removes a supply-chain
 * surface, and is MIT-clean. Trade-off: we own the sync cadence — this script.
 *
 * EXIT CODES:
 *   0  — diff printed, human reviews + commits if desired (happy path for ALL cases,
 *         including identical / additions-only / removals-present). Script is
 *         informational by design; CI should NOT block on a diff.
 *   2  — upstream fetch failed (network, 404, JSON parse error). Human investigates.
 *   3  — committed file missing or malformed. Unexpected — indicates repo corruption.
 *
 * NOTE: Assixx-local additions (e.g. `mailbox.org`, `tutanota.com`, `tutanota.de`
 * added in v0.3.8 D34) will appear as "LOCAL-ONLY" entries until upstream PRs are
 * merged back to `Kikobeats/free-email-domains`. That's expected — not a bug.
 */
import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const UPSTREAM_URL =
  'https://raw.githubusercontent.com/Kikobeats/free-email-domains/master/domains.json';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMITTED_PATH = resolve(
  __dirname,
  '..',
  'backend',
  'src',
  'nest',
  'domains',
  'data',
  'freemail-domains.json',
);

interface DiffReport {
  readonly committedSize: number;
  readonly upstreamSize: number;
  readonly added: readonly string[]; // in upstream, not in committed → candidates for PR-in
  readonly removed: readonly string[]; // in committed, not in upstream → Assixx-local (or upstream dropped)
  readonly unchanged: number;
}

function readCommitted(): string[] {
  try {
    const raw = readFileSync(COMMITTED_PATH, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === 'string')) {
      throw new Error(`Malformed committed JSON: expected string[] at ${COMMITTED_PATH}`);
    }
    return parsed as string[];
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`FAIL reading committed list: ${msg}`);
    process.exit(3);
  }
}

async function fetchUpstream(): Promise<string[]> {
  try {
    const res = await fetch(UPSTREAM_URL, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      throw new Error(`upstream HTTP ${res.status} ${res.statusText}`);
    }
    const parsed: unknown = await res.json();
    if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === 'string')) {
      throw new Error('Malformed upstream JSON: expected string[]');
    }
    return parsed as string[];
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`FAIL fetching upstream: ${msg}`);
    process.exit(2);
  }
}

function diff(committed: readonly string[], upstream: readonly string[]): DiffReport {
  const committedSet = new Set(committed.map((d) => d.toLowerCase()));
  const upstreamSet = new Set(upstream.map((d) => d.toLowerCase()));
  const added: string[] = [];
  const removed: string[] = [];
  for (const d of upstreamSet) if (!committedSet.has(d)) added.push(d);
  for (const d of committedSet) if (!upstreamSet.has(d)) removed.push(d);
  added.sort();
  removed.sort();
  const unchanged = committed.length - removed.length;
  return {
    committedSize: committed.length,
    upstreamSize: upstream.length,
    added,
    removed,
    unchanged,
  };
}

function renderReport(report: DiffReport): void {
  const committedStat = statSync(COMMITTED_PATH);
  console.log('── Freemail-list sync (read-only) ──────────────────────────────────');
  console.log(`  Committed : ${COMMITTED_PATH}`);
  console.log(
    `            ${report.committedSize} domains (${committedStat.size} B, mtime ${committedStat.mtime.toISOString()})`,
  );
  console.log(`  Upstream  : ${UPSTREAM_URL}`);
  console.log(`            ${report.upstreamSize} domains (fetched ${new Date().toISOString()})`);
  console.log(`  Unchanged : ${report.unchanged}`);
  console.log(`  Added     : ${report.added.length} (upstream-only — candidates to merge IN)`);
  console.log(
    `  Removed   : ${report.removed.length} (committed-only — Assixx-local OR upstream dropped)`,
  );
  console.log('────────────────────────────────────────────────────────────────────');

  if (report.added.length > 0) {
    console.log('\n[ADDED — in upstream, missing in committed]');
    for (const d of report.added) console.log(`  + ${d}`);
  }
  if (report.removed.length > 0) {
    console.log('\n[REMOVED — in committed, missing in upstream]');
    for (const d of report.removed) console.log(`  - ${d}`);
    console.log(
      '\n  NOTE: Assixx-local additions (see LICENSE.freemail-domains.md "Assixx additions" table)',
    );
    console.log(
      '        show up here until upstream PRs land. This is expected — do NOT auto-remove them.',
    );
  }
  if (report.added.length === 0 && report.removed.length === 0) {
    console.log('\n  Lists are identical. No action needed.');
  }
  console.log(
    '\n  Next step (manual): review diff, decide per-domain add/remove, commit via Edit tool.',
  );
  console.log(
    '  NEVER run a blind `curl ... > freemail-domains.json` — it wipes Assixx additions.',
  );
}

async function main(): Promise<void> {
  const committed = readCommitted();
  const upstream = await fetchUpstream();
  const report = diff(committed, upstream);
  renderReport(report);
  process.exit(0);
}

void main();
