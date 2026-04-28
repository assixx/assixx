/**
 * Validates `.changeset/*.md` quality before merge.
 *
 * Why this exists (Kaizen — 2026-04-28):
 *   v0.4.13 shipped a `chore(docker): …` bullet that crammed 6 distinct
 *   facts (image-size cut, pnpm-deploy adoption, devDep-moves, script
 *   wrapping, ESLint cleanup, ARCHITECTURE drift fix) into a single
 *   ~600-character first line. Even with the new custom changelog
 *   formatter (scripts/changeset-formatter.cjs), the formatter cannot
 *   un-jam such a body — it routes the prefix to `[Maintenance]` and
 *   passes the run-on through verbatim. The forcing function has to
 *   sit BEFORE the body lands in `.changeset/*.md`, not after.
 *
 *   This script is that forcing function. CI runs it on every PR that
 *   touches `.changeset/**`. Violations block the merge.
 *
 * Rules (one violation = one error line, exit 1):
 *   1. Front-matter present (`---\n…\n---`) with ≥1 package + valid bump
 *   2. Body's first non-empty line starts with a Conventional-Commits
 *      prefix: `<type>(<scope>)?(!)?: ` where type ∈ {feat, fix,
 *      refactor, perf, docs, chore, style, test, ci, build}
 *   3. First line total length ≤ 100 chars (forces atomic descriptions)
 *   4. Body has at least one non-empty line
 *   5. ≤ 3 top-level bullets (`- ` at column 0) in the body — split
 *      bigger PRs into multiple changesets instead of cramming
 *
 * Exclusions: `README.md`, `config.json` (not changeset entries).
 *
 * CLI:
 *   node scripts/lint-changesets.mjs               # default: ./.changeset
 *   node scripts/lint-changesets.mjs --dir /tmp/x  # custom dir (tests)
 *
 * @see scripts/changeset-formatter.cjs — consumes the validated bodies
 * @see docs/how-to/HOW-TO-USE-CHANGESETS.md — contributor rules
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { argv, exit, stderr, stdout } from 'node:process';

// Conventional-Commits prefix: lowercase type, optional `(scope)`, optional
// `!` for breaking, exactly one space after the colon. Strict on purpose —
// the formatter is permissive against legacy data, the lint enforces
// FUTURE discipline. Mismatch with formatter is intentional.
const PREFIX_RE = /^(feat|fix|refactor|perf|docs|chore|style|test|ci|build)(\([^)]+\))?(!)?: /;

// Front-matter validity check — Changesets writes one or more lines like
// `'assixx-backend': patch` between `---` fences. We don't full-parse YAML
// (avoid dep), just confirm at least one well-formed package+bump pair.
const FRONTMATTER_RE = /^---\n([\s\S]+?)\n---\n([\s\S]*)$/;
const PACKAGE_BUMP_RE = /^['"]?[\w@/-]+['"]?:\s*(patch|minor|major)\s*$/m;

const MAX_FIRST_LINE = 100;
const MAX_BULLETS = 3;
const VALID_PREFIXES = 'feat, fix, refactor, perf, docs, chore, style, test, ci, build';

/**
 * @param {string[]} args
 * @returns {string}
 */
function resolveDir(args) {
  const dirIdx = args.indexOf('--dir');
  if (dirIdx !== -1 && dirIdx + 1 < args.length) {
    return args[dirIdx + 1];
  }
  return '.changeset';
}

/**
 * @param {string} dir
 * @returns {string[]} Absolute paths of `.changeset/*.md` (excluding README).
 */
function findChangesetFiles(dir) {
  const entries = readdirSync(dir);
  return entries.filter((f) => f.endsWith('.md') && f !== 'README.md').map((f) => join(dir, f));
}

/**
 * @param {string} path
 * @param {string} raw
 * @returns {string[]} Error messages for this file (empty if valid).
 */
function lintFile(path, raw) {
  const errors = [];
  const fmMatch = FRONTMATTER_RE.exec(raw);
  if (fmMatch === null) {
    errors.push(`${path}: missing front-matter (must start with --- and end with ---)`);
    return errors;
  }
  const [, frontMatter, body] = fmMatch;

  if (!PACKAGE_BUMP_RE.test(frontMatter)) {
    errors.push(
      `${path}: front-matter must declare ≥1 package + bump type (e.g. \`'assixx-backend': patch\`)`,
    );
  }

  const firstLine = body.split('\n').find((l) => l.trim() !== '') ?? '';
  if (firstLine === '') {
    errors.push(`${path}: body is empty (write a Conventional-Commits-style description)`);
    return errors;
  }

  if (!PREFIX_RE.test(firstLine)) {
    errors.push(
      `${path}: first line must start with a Conventional-Commits prefix (one of: ${VALID_PREFIXES}; append \`!\` for breaking). Got: "${firstLine.slice(0, 60)}…"`,
    );
  }

  if (firstLine.length > MAX_FIRST_LINE) {
    errors.push(
      `${path}: first line is ${firstLine.length} chars (max ${MAX_FIRST_LINE}). Atomic descriptions only — move detail into the body or split into multiple changesets.`,
    );
  }

  const bullets = body.split('\n').filter((l) => /^- /.test(l));
  if (bullets.length > MAX_BULLETS) {
    errors.push(
      `${path}: ${bullets.length} top-level bullets (max ${MAX_BULLETS}). Split into separate changeset files — one concern per changeset.`,
    );
  }

  return errors;
}

// --- Main ---
const dir = resolveDir(argv.slice(2));
const files = findChangesetFiles(dir);

const allErrors = [];
for (const path of files) {
  const raw = readFileSync(path, 'utf8');
  allErrors.push(...lintFile(path, raw));
}

if (allErrors.length > 0) {
  stderr.write(allErrors.join('\n') + '\n\n');
  stderr.write(
    `${allErrors.length} violation(s) in ${files.length} changeset file(s). See docs/how-to/HOW-TO-USE-CHANGESETS.md\n`,
  );
  exit(1);
}

stdout.write(`OK: ${files.length} changeset file(s) validated\n`);
