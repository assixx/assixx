/**
 * One-shot backfill: prepends Keep-a-Changelog `[Section]` tags to legacy
 * bullets in per-package CHANGELOG.md files (v0.1.0 → v0.4.13).
 *
 * Why this exists:
 *   .changeset/changeset-formatter.cjs (added 2026-04-28) tags every NEW
 *   changeset bullet with `[Section]`. Legacy bullets predate the
 *   formatter, so they bucket under `### Other` in the root CHANGELOG —
 *   visually inconsistent against the post-v0.4.14 KaC-grouped releases.
 *
 *   This script does ONE pass: parses each bullet's Conventional-Commits
 *   prefix, prepends the matching `[Section]` tag, strips the original
 *   prefix from the body so output matches the formatter's contract.
 *   Idempotent — bullets already tagged are skipped.
 *
 *   Run ONCE: `node scripts/backfill-legacy-tags.mjs`
 *   After successful run, `node scripts/aggregate-changelog.mjs` produces
 *   a uniformly-grouped root CHANGELOG.md.
 *
 *   This is a backfill, not ongoing infrastructure. Keep the script for
 *   reproducibility (forks, replays after rebase) — it is harmless to run
 *   multiple times thanks to the idempotency guard.
 *
 * Phase B (manual): the v0.4.13 `chore(docker)` 600-char run-on bullet
 * needs to be split into atomic facts AFTER this script runs. The script
 * cannot decide where to split a sentence — that's human judgment.
 *
 * @see .changeset/changeset-formatter.cjs — same prefix → KaC mapping
 * @see scripts/aggregate-changelog.mjs — consumes the tagged bullets
 * @see docs/how-to/HOW-TO-USE-CHANGESETS.md
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { stdout } from 'node:process';

const FILES = ['backend/CHANGELOG.md', 'frontend/CHANGELOG.md', 'shared/CHANGELOG.md'];

// Mirrors .changeset/changeset-formatter.cjs PREFIX_TO_SECTION exactly.
// Keep in sync with the formatter — divergence would route legacy and new
// entries differently for the same prefix.
const PREFIX_TO_SECTION = Object.freeze({
  feat: 'Added',
  fix: 'Fixed',
  refactor: 'Changed',
  perf: 'Performance',
  docs: 'Docs',
  chore: 'Maintenance',
  style: 'Maintenance',
  test: 'Maintenance',
  ci: 'Maintenance',
  build: 'Maintenance',
});

// Imperative → past-tense lookup. Mirrors .changeset/changeset-formatter.cjs
// VERB_PAST_TENSE — must stay in sync (formatter is CJS, this script is
// ESM, so the table is duplicated rather than imported).
const VERB_PAST_TENSE = Object.freeze({
  add: 'Added',
  bump: 'Bumped',
  cache: 'Cached',
  cleanup: 'Cleaned up',
  clarify: 'Clarified',
  deprecate: 'Deprecated',
  disable: 'Disabled',
  document: 'Documented',
  drop: 'Dropped',
  enable: 'Enabled',
  extract: 'Extracted',
  fix: 'Fixed',
  improve: 'Improved',
  introduce: 'Introduced',
  move: 'Moved',
  pin: 'Pinned',
  refactor: 'Refactored',
  refresh: 'Refreshed',
  remove: 'Removed',
  rename: 'Renamed',
  replace: 'Replaced',
  revert: 'Reverted',
  switch: 'Switched',
  update: 'Updated',
  use: 'Used',
});

const PAST_TENSE_VALUES = new Set(Object.values(VERB_PAST_TENSE));

/**
 * Idempotent verb-tense + capitalization. Same algorithm as the formatter's
 * applyVerbTense — duplicated for ESM/CJS interop reasons.
 *
 * @param {string} text
 * @returns {string}
 */
function applyVerbTense(text) {
  if (text.length === 0) return text;
  const firstWordMatch = /^(\S+)(\s|$)/.exec(text);
  if (firstWordMatch === null) return text;
  const firstWord = firstWordMatch[1];
  const remainder = text.slice(firstWord.length);
  if (PAST_TENSE_VALUES.has(firstWord)) return text;
  const lower = firstWord.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(VERB_PAST_TENSE, lower)) {
    return VERB_PAST_TENSE[lower] + remainder;
  }
  if (/^[a-z]/.test(firstWord)) {
    return firstWord[0].toUpperCase() + firstWord.slice(1) + remainder;
  }
  return text;
}

const VALID_SECTIONS = 'Breaking|Added|Changed|Fixed|Performance|Docs|Maintenance|Other';

// Top-level bullet, optionally with a 7+ char hash prefix
// (Changesets writes `- 1031d27: <body>` for committed changesets).
const BULLET_RE = /^- (?:([a-f0-9]{7,}): )?(.*)$/;

// Conventional-Commits prefix in the body — same regex as the formatter,
// case-insensitive to absorb the few `Refactor:` / `Feature:` typos in
// the historical data.
const CONV_PREFIX_RE =
  /^(feat(?:ure)?|fix|refactor|perf|docs|chore|style|test|ci|build)(\([^)]+\))?(!)?:\s*(.*)$/i;

// Already-tagged bullet (idempotency guard).
const ALREADY_TAGGED_RE = new RegExp(`^- (?:[a-f0-9]{7,}: )?\\[(${VALID_SECTIONS})\\] `);

// "Updated dependencies" lines must remain UN-TAGGED — the aggregator's
// normalize() filters them via `^- Updated dependencies` pattern. If we
// tag them, they'd leak as `[Other] Updated dependencies` into the root
// CHANGELOG. The first iteration of this script (2026-04-28) made that
// mistake; the un-tag branch below is the self-healing fix.
const DEP_LINE_RE =
  /^- (?:([a-f0-9]{7,}): )?(?:\[Other\] )?Updated dependencies(\s*\[[a-f0-9]+\])?$/;

// Same self-heal for `- @assixx/shared@0.4.0`-style top-level lines
// (workspace-package version markers Changesets emits at the bottom of
// release blocks). Aggregator filters un-tagged variant; tagged variant
// would leak as `[Other] @assixx/shared@0.4.0`.
const PKG_NOISE_RE =
  /^- (?:\[Other\] )?(@assixx\/(?:shared|backend|frontend)|assixx-(?:backend|frontend))@[\d.]+$/;

/**
 * @param {string} bullet The full first line (e.g. `- 1031d27: feat: add foo`)
 * @returns {string} Re-tagged first line, or original if already tagged.
 */
function retagBulletFirstLine(bullet) {
  if (ALREADY_TAGGED_RE.test(bullet)) return bullet;

  const match = BULLET_RE.exec(bullet);
  if (match === null) return bullet;
  const [, hash, body] = match;

  const conv = CONV_PREFIX_RE.exec(body);
  let section;
  let remainder;
  if (conv === null) {
    // No recognized prefix — bucket as Other, leave body untouched.
    section = 'Other';
    remainder = body;
  } else {
    const rawType = conv[1].toLowerCase();
    // Normalize `feature` typo to `feat`. Anything else maps directly.
    const type = rawType === 'feature' ? 'feat' : rawType;
    const breaking = conv[3] === '!';
    section = breaking ? 'Breaking' : (PREFIX_TO_SECTION[type] ?? 'Other');
    remainder = conv[4];
  }

  // Apply verb-tense + capitalization (matches formatter behavior).
  const polished = applyVerbTense(remainder);
  const hashPrefix = hash !== undefined ? `${hash}: ` : '';
  return `- ${hashPrefix}[${section}] ${polished}`;
}

/**
 * Re-processes a bullet that already has a `[Section]` tag. Applies
 * verb-tense to the body so legacy entries get the same polish as new
 * entries from the formatter. Idempotent — applyVerbTense skips already-
 * past-tense words.
 *
 * @param {string} bullet
 * @returns {string}
 */
function repolishTaggedBullet(bullet) {
  // Match: `- [<hash>: ]?[<section>] <body>`
  const match = /^(- (?:[a-f0-9]{7,}: )?\[[^\]]+\] )(.*)$/.exec(bullet);
  if (match === null) return bullet;
  const [, prefix, body] = match;
  const polished = applyVerbTense(body);
  return prefix + polished;
}

/**
 * @param {string} content Full CHANGELOG.md content.
 * @returns {{ updated: string, changed: number, skipped: number }}
 */
function backfill(content) {
  const lines = content.split('\n');
  let changed = 0;
  let skipped = 0;
  const out = lines.map((line) => {
    if (!/^- /.test(line)) return line; // not a top-level bullet

    // Self-heal: "Updated dependencies" lines must stay un-tagged so the
    // aggregator's normalize() can filter them out as Fixed-Group noise.
    // If a previous run mistakenly tagged them as `[Other] Updated…`,
    // strip the tag here. Branch checked BEFORE the idempotency guard.
    const depMatch = DEP_LINE_RE.exec(line);
    if (depMatch !== null) {
      const [, hash, hashSuffix] = depMatch;
      const hashPrefix = hash !== undefined ? `${hash}: ` : '';
      const suffix = hashSuffix ?? '';
      const restored = `- ${hashPrefix}Updated dependencies${suffix}`;
      if (restored !== line) {
        changed += 1;
        return restored;
      }
      skipped += 1;
      return line;
    }

    // Same self-heal for workspace-package version-marker lines.
    const pkgMatch = PKG_NOISE_RE.exec(line);
    if (pkgMatch !== null) {
      const restored = `- ${pkgMatch[1]}@${line.split('@').pop()}`;
      if (restored !== line) {
        changed += 1;
        return restored;
      }
      skipped += 1;
      return line;
    }

    if (ALREADY_TAGGED_RE.test(line)) {
      // Already tagged — but still re-polish the body for verb-tense /
      // capitalization. applyVerbTense is idempotent so repeated runs
      // converge. Captures legacy entries tagged before verb-tense logic
      // existed (initial backfill on 2026-04-28).
      const repolished = repolishTaggedBullet(line);
      if (repolished !== line) {
        changed += 1;
        return repolished;
      }
      skipped += 1;
      return line;
    }
    const retagged = retagBulletFirstLine(line);
    if (retagged !== line) {
      changed += 1;
      return retagged;
    }
    return line;
  });
  return { updated: out.join('\n'), changed, skipped };
}

// --- Main ---
let totalChanged = 0;
let totalSkipped = 0;
for (const file of FILES) {
  const raw = readFileSync(file, 'utf8');
  const { updated, changed, skipped } = backfill(raw);
  if (changed > 0) writeFileSync(file, updated);
  stdout.write(`${file}: ${changed} bullet(s) tagged, ${skipped} already-tagged\n`);
  totalChanged += changed;
  totalSkipped += skipped;
}
stdout.write(`\nDone: ${totalChanged} tagged, ${totalSkipped} skipped (idempotent)\n`);
stdout.write('Next: run `node scripts/aggregate-changelog.mjs` to regenerate root CHANGELOG.md\n');
