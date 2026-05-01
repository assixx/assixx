/**
 * Custom Changesets formatter — routes Conventional-Commits prefixes
 * to Keep-a-Changelog sections via a leading `[Section]` tag.
 *
 * Why a custom formatter (vs. `@changesets/cli/changelog` default):
 *   - Default formatter dumps the changeset body 1:1 — `feat:`/`chore:`
 *     prefixes leak into the user-facing changelog at `/versioninfo`.
 *   - Default formatter has no PR-link enrichment.
 *   - We want Keep-a-Changelog grouping (Added/Fixed/Changed/...) in the
 *     ROOT CHANGELOG.md, not the Changesets-default Patch/Minor/Major
 *     bump-type grouping. Changesets' bump-type headers are hardcoded
 *     in core, so we encode the KaC section as a leading `[Section]`
 *     tag in each bullet. `aggregate-changelog.mjs` then re-buckets by
 *     that tag when building root CHANGELOG.md.
 *
 *   Per-package CHANGELOG.md files (backend/, frontend/, shared/) keep
 *   the `[Section]` tag visible — minor visual cost, accepted because
 *   those files are dev-facing/historical.
 *
 * Why CommonJS (`.cjs`):
 *   Changesets v2.x uses `require()` for the changelog plugin. ESM
 *   formatters (.mjs) are unreliable across the version range. Default
 *   plugin (`@changesets/cli/changelog`) and `@changesets/changelog-github`
 *   are both CJS — we follow the same pattern.
 *
 * Why this file lives in `.changeset/` (and not `scripts/`) — 2026-05-01:
 *   `@changesets/cli` v2.31.0 (with `apply-release-plan` v7.1.1) passes its
 *   own `__dirname` (deep in `node_modules/.../@changesets/cli/dist`) as
 *   the `contextDir` to `applyReleasePlan`. The fallback resolver in
 *   `apply-release-plan` then anchors `config.changelog[0]` to that path —
 *   so any relative path outside `.changeset/` (e.g. `./scripts/…`) fails
 *   the second resolve and crashes `pnpm changeset:version` with
 *   `Cannot find module './scripts/changeset-formatter.cjs'`.
 *
 *   The first resolver tries `<cwd>/.changeset` — keeping the formatter
 *   here makes that first resolve succeed unconditionally. Do NOT move
 *   back to `scripts/` unless upstream regression is fixed (track via
 *   `applyReleasePlan(..., __dirname)` call site in changesets-cli source).
 *
 * @see .changeset/config.json — wires this formatter via tuple syntax
 * @see scripts/aggregate-changelog.mjs — strips the `[Section]` tag and
 *      re-sections root CHANGELOG.md into KaC headers
 * @see docs/how-to/HOW-TO-USE-CHANGESETS.md — contributor rules
 */

'use strict';

// Conventional-Commits prefix: optional scope `(scope)`, optional `!` for breaking, then `:`.
// Examples: `feat:`, `fix(auth):`, `refactor(kvp)!:`, `chore:`.
const PREFIX_RE = /^(feat|fix|refactor|perf|docs|chore|style|test|ci|build)(\([^)]+\))?(!)?:\s*/i;

// Match `(#NNN)` anywhere in the changeset text — added by GitHub when
// a PR title carries the Conv-Commits prefix, or written manually.
const PR_RE = /\(#(\d+)\)/;

// Conv-Commits → Keep-a-Changelog mapping.
// `style/test/ci/build` collapse into Maintenance (low signal for users).
// `chore` stays in Maintenance — dependency bumps + housekeeping live there.
// `BREAKING:` (`!:` syntax) overrides everything → top of release block.
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

// Imperative → past-tense lookup (claude-code-style action-verb-led bullets).
// Authors write `feat: add foo` (natural Conv-Commits imperative); the
// formatter converts to `Added foo` so the rendered bullet reads as a
// past-tense statement of what shipped, not an instruction. Verbs absent
// from the table fall through to simple first-letter capitalization
// (e.g. `feat: cross-origin escrow fix` → `Cross-origin escrow fix`).
//
// Keep this table in sync with scripts/backfill-legacy-tags.mjs — they
// must agree on the verb mapping or new vs. backfilled bullets diverge.
// Inlined (not shared module) because formatter is CJS and backfill is
// ESM — duplication is cheaper than a shared interop layer for ~25 verbs.
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

// Idempotency guard: if the first word is ALREADY a past-tense form from
// the table, leave it alone. Prevents `Added` → `Addeded` on second run.
const PAST_TENSE_VALUES = new Set(Object.values(VERB_PAST_TENSE));

/**
 * Converts the first word from imperative to past tense, or capitalizes
 * the first letter if the verb is not in the lookup table.
 *
 * Examples:
 *   "add foo bar"           → "Added foo bar"
 *   "Added foo bar"         → "Added foo bar"   (idempotent)
 *   "cross-origin fix"      → "Cross-origin fix" (capitalize fallback)
 *   "[VSCode] support"      → "[VSCode] support" (no ASCII letter, untouched)
 *   ""                      → ""
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

  // Idempotency — already past-tense.
  if (PAST_TENSE_VALUES.has(firstWord)) return text;

  // Imperative → past tense via lookup.
  const lower = firstWord.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(VERB_PAST_TENSE, lower)) {
    return VERB_PAST_TENSE[lower] + remainder;
  }

  // Fallback — capitalize first ASCII letter only. Skips brackets, digits,
  // backticks, and other punctuation to avoid mangling `[VSCode]`, `2026`, etc.
  if (/^[a-z]/.test(firstWord)) {
    return firstWord[0].toUpperCase() + firstWord.slice(1) + remainder;
  }

  return text;
}

/**
 * Classifies the first line of a changeset summary.
 * Returns the matching KaC section, the body without the prefix,
 * and a `breaking` flag (true if `!:` was used).
 *
 * Bullets without a recognized prefix get section "Other" — preserves
 * legacy entries (v0.1.0–v0.4.13 written before this convention) instead
 * of dropping them silently.
 *
 * @param {string} firstLine
 * @returns {{ section: string, stripped: string, breaking: boolean }}
 */
function classify(firstLine) {
  const match = PREFIX_RE.exec(firstLine);
  if (match === null) {
    return { section: 'Other', stripped: firstLine, breaking: false };
  }
  const breaking = match[3] === '!';
  const prefix = match[1].toLowerCase();
  return {
    section: breaking ? 'Breaking' : PREFIX_TO_SECTION[prefix],
    stripped: firstLine.slice(match[0].length),
    breaking,
  };
}

/**
 * Formats one changeset entry. Called by `changeset version` once per
 * `.changeset/*.md` consumed during the bump.
 *
 * Output contract — must match `aggregate-changelog.mjs` parser:
 *   `[<Section>] <body-line-1>` on the first line, optional indented
 *   continuation lines below. The aggregator's SECTION_TAG_RE picks up
 *   the leading `[<Section>] ` and re-buckets accordingly.
 *
 * @param {{ summary: string, releases: Array<{ name: string, type: string }> }} changeset
 * @param {string} _type — unused (we don't bucket by bump type)
 * @param {{ repo?: string }} options
 * @returns {Promise<string>}
 */
async function getReleaseLine(changeset, _type, options) {
  const repo =
    options !== undefined && options !== null && typeof options.repo === 'string' ?
      options.repo
    : 'assixx/assixx';

  const lines = changeset.summary.trim().split('\n');
  const firstLine = lines[0].trim();
  const rest = lines.slice(1).join('\n').trim();

  const { section, stripped } = classify(firstLine);

  // Verb-tense conversion: `add foo` → `Added foo` (claude-code action-verb
  // style). Authors keep writing imperative Conv-Commits; formatter polishes.
  const transformed = applyVerbTense(stripped);

  // PR-link enrichment: if `(#NNN)` appears anywhere in summary, replace
  // first occurrence in firstLine with a Markdown link, OR append it.
  const prMatch = PR_RE.exec(firstLine);
  let firstOut;
  if (prMatch !== null) {
    const link = `([#${prMatch[1]}](https://github.com/${repo}/pull/${prMatch[1]}))`;
    firstOut = transformed.replace(PR_RE, link);
  } else {
    const restPrMatch = PR_RE.exec(rest);
    if (restPrMatch !== null) {
      const link = ` ([#${restPrMatch[1]}](https://github.com/${repo}/pull/${restPrMatch[1]}))`;
      // Don't double-link if user manually wrote a markdown link in body.
      firstOut = transformed + link;
    } else {
      firstOut = transformed;
    }
  }

  // Multi-line body: indent continuation under the bullet so it renders
  // correctly in Markdown. Aggregator preserves this indentation.
  const body = rest === '' ? '' : '\n\n  ' + rest.replace(/\n/g, '\n  ');

  // Leading `- ` is OUR responsibility (not apply-release-plan's) since
  // v7.1.1. Earlier versions wrapped formatter output as `- <commit>: ${ret}`
  // automatically; v7.1.1 writes the formatter return verbatim. Default
  // plugin `@changesets/changelog-git` does the same — its return starts
  // with `- ${commit}: ${firstLine}`. Without `- `, the per-package
  // CHANGELOG entries render as paragraphs (not bullets), the aggregator's
  // SECTION_TAG_RE (`^- \[…\] `) skips them, and the version section ends
  // up empty in root CHANGELOG.md (visible regression in v0.4.14).
  return `- [${section}] ${firstOut}${body}`;
}

/**
 * Suppresses cross-package "Updated dependencies" bullets entirely.
 *
 * The Fixed-Group setup (all 3 workspace packages bump in lockstep) means
 * every release writes 3× "Updated dependencies [<hash>]" lines per file
 * — pure noise. The default formatter emits them, then the root
 * aggregator strips them. We short-circuit at the source: per-package
 * CHANGELOGs stay clean too.
 *
 * @returns {Promise<string>}
 */
async function getDependencyReleaseLine() {
  return '';
}

module.exports = {
  default: {
    getReleaseLine,
    getDependencyReleaseLine,
  },
  // Exported for unit tests / standalone verification.
  __test__: { classify, PREFIX_RE, PR_RE, PREFIX_TO_SECTION },
};
