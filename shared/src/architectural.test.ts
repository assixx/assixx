/**
 * Architectural Tests — Pattern Enforcement
 *
 * These tests enforce coding patterns via grep-based checks.
 * They run in CI and prevent regression of centralized patterns.
 *
 * If a test fails, it means someone re-introduced an anti-pattern.
 * Fix: Use the centralized utility instead of the local implementation.
 *
 * References:
 *   - docs/TYPESCRIPT-STANDARDS.md Section 7.3 (getErrorMessage)
 *   - docs/TYPESCRIPT-STANDARDS.md Section 7.4 (IS_ACTIVE constants)
 *   - docs/TYPESCRIPT-STANDARDS.md Section 7.5 (ID Param DTO Factory)
 *   - docs/CODE-OF-CONDUCT-SVELTE.md (Session-Expired Handling)
 *   - docs/CODE-OF-CONDUCT-SVELTE.md (Frontend catch-block typing)
 *   - docs/CODE-AUDIT-2026-02-25.md Maßnahme #12 (WebSocket Zod validation)
 *   - docs/CODE-AUDIT-2026-02-25.md Maßnahme #13 (Shared db-helpers utility)
 *   - docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §0.2 R1/R2/R14/R15
 *     (subdomain-routing invariants — Session 8 of the masterplan adds 5 assertions
 *      below under "Tenant Subdomain Routing (ADR-050)")
 */
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';

// Use `process.cwd()` (project root when vitest runs) instead of
// `new URL('../../../', import.meta.url)` — the latter resolves to `file:///`
// when the test lives at `<root>/shared/src/architectural.test.ts` because
// `../../../` from `shared/src/` walks past the project root; its `.pathname`
// is `/` → `.replace(/\/$/, '')` → empty string → ALL grepFiles() calls run
// against `/backend/src/...` (absolute path outside the project) → rg returns
// 0 matches → every architectural test passes as a false-negative. The bug
// was masked until Step 2.11's tenant-verification gate added a rule that
// SHOULD fail on the sanity-check allowlist flip but didn't — see 2026-04-18
// debug log. `process.cwd()` is `/app` in Docker, `/home/scs/projects/Assixx`
// on host — both point at the project root.
const ROOT = process.cwd();

/**
 * Pre-flight check: fail loud if `rg` is missing in the test environment.
 *
 * WHY: The previous `grepFiles()` swallowed exit 127 (rg-not-found) via
 * `2>/dev/null || true`, returning [] = "no violations" = green test. That
 * turned every grep-based architectural rule into a false-negative whenever
 * the runner had no ripgrep — exactly what happened in WSL/dash post-install
 * (rg was a Bash function from Claude Code, invisible to /bin/sh subprocesses).
 * The dedicated canary `_canary-rg-debug.test.ts` exposed it; this guard
 * folds that canary into every architectural run, so any future container or
 * CI image without ripgrep fails loudly at module load instead of silently
 * passing. Discovered 2026-04-25 — see also `findServiceFilesWithUserInsert()`
 * below, which sidesteps rg entirely via Node fs.
 *
 * Install: `apt-get install -y ripgrep` (Debian/Ubuntu) or `brew install ripgrep`.
 */
(function assertRgAvailable(): void {
  try {
    execSync('command -v rg', { stdio: 'ignore' });
  } catch {
    throw new Error(
      'ripgrep (`rg`) is not installed in this environment but architectural ' +
        'tests depend on it for pattern enforcement. Without it, every grep-based ' +
        'rule would silently pass as a false-negative. Install ripgrep:\n' +
        '  Debian/Ubuntu: apt-get install -y ripgrep\n' +
        '  macOS:         brew install ripgrep\n' +
        '  Cargo:         cargo install ripgrep',
    );
  }
})();

/**
 * Run ripgrep and return matching files (empty array = no matches = good).
 * Returns file paths relative to ROOT.
 *
 * Exit-code handling (no more `|| true`):
 *   - 0       → matches found, parse stdout
 *   - 1       → no matches (by design in rg) → return []
 *   - 127/2/… → real failure (rg missing, broken regex, bad path) → re-throw
 *
 * The `assertRgAvailable()` IIFE above guarantees `rg` exists, so 127 here
 * would mean rg disappeared mid-run — still a bug worth surfacing.
 */
function grepFiles(pattern: string, searchPath: string, glob?: string): string[] {
  const globArg = glob !== undefined ? `--glob '${glob}'` : '';
  const cmd = `rg --files-with-matches ${globArg} -e '${pattern}' '${ROOT}/${searchPath}'`;
  let result: string;
  try {
    result = execSync(cmd, { encoding: 'utf-8' }).trim();
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 1) return []; // rg convention: 1 = no matches
    throw new Error(
      `rg failed with exit ${String(status)} for pattern '${pattern}' in ` +
        `'${searchPath}'. Stderr: ${(err as { stderr?: Buffer }).stderr?.toString() ?? '(none)'}`,
      { cause: err }, // preserve-caught-error: keep original stack
    );
  }
  if (result === '') return [];
  return result.split('\n').map((f) => f.replace(`${ROOT}/`, ''));
}

/**
 * Like {@link grepFiles}, but discards matches that occur inside doc-comments
 * (` * `, `// `, `/* `) before deciding whether a file is a real violation.
 *
 * WHY: Architectural rules of the form "do not write `(error as Error)`" or
 * "use IS_ACTIVE constants instead of `is_active = 1`" are routinely violated
 * INSIDE doc-comments — files document the forbidden pattern as a negative
 * example, e.g. `* Standards §7.3, no \`(error as Error)\` casts`. The
 * `--files-with-matches` mode used by {@link grepFiles} cannot tell these
 * apart from real code matches, so the file gets flagged for nothing more
 * than its own self-documentation. Real code matches in production logic
 * still surface — the filter only drops lines whose trimmed content begins
 * with a comment marker.
 *
 * Limitation: heuristic-only. A line like `const x = '(error as Error)';`
 * (literal string, not a comment) is correctly NOT filtered out — it doesn't
 * start with a comment marker. Inside a multi-line JSDoc block, continuation
 * lines that begin with the asterisk leader are also dropped, which is the
 * desired behaviour.
 */
function grepFilesNonComment(pattern: string, searchPath: string, glob?: string): string[] {
  const globArg = glob !== undefined ? `--glob '${glob}'` : '';
  const cmd = `rg -n --no-heading ${globArg} -e '${pattern}' '${ROOT}/${searchPath}'`;
  const result = runRgOrEmpty(cmd, pattern, searchPath);
  if (result === '') return [];

  const files = new Set<string>();
  for (const rawLine of result.split('\n')) {
    const parsed = parseRgLine(rawLine);
    if (parsed === null || isCommentLine(parsed.content)) continue;
    files.add(parsed.absPath.replace(`${ROOT}/`, ''));
  }
  return [...files].sort();
}

/** Run an rg command, treating exit 1 (no matches) as empty result. Other
 *  non-zero exits are real failures (regex parse error, missing rg, etc.) and
 *  re-throw with the original error chained for stack-trace preservation. */
function runRgOrEmpty(cmd: string, pattern: string, searchPath: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8' }).trim();
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 1) return '';
    throw new Error(
      `rg failed with exit ${String(status)} for pattern '${pattern}' in ` +
        `'${searchPath}'. Stderr: ${(err as { stderr?: Buffer }).stderr?.toString() ?? '(none)'}`,
      { cause: err },
    );
  }
}

/** Parse one `rg -n --no-heading` output line of the form
 *  `<abs-path>:<lineNo>:<content>`. Returns null on unparseable lines. */
function parseRgLine(rawLine: string): { absPath: string; content: string } | null {
  const match = /^([^:]+):\d+:(.*)$/.exec(rawLine);
  if (match === null) return null;
  const [, absPath, content] = match;
  if (absPath === undefined || content === undefined) return null;
  return { absPath, content };
}

/** True if the line's trimmed code-portion begins with a comment marker
 *  (JSDoc continuation, line-comment, block-comment open). */
function isCommentLine(content: string): boolean {
  const trimmed = content.trim();
  return trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*');
}

// =============================================================================
// BACKEND PATTERNS
// =============================================================================

describe('Backend: Error Handling Patterns', () => {
  // grepFilesNonComment: doc-comments routinely document the forbidden pattern
  // as a negative example (e.g. `* Standards §7.3, no \`(error as Error)\` casts`)
  // and would otherwise self-flag the file.
  it('should not use unsafe (error as Error) casts in production code', () => {
    const violations = grepFilesNonComment('\\(error as Error\\)', 'backend/src', '*.ts').filter(
      (f) => !f.includes('.test.') && !f.includes('.spec.'),
    );

    expect(
      violations,
      `Found unsafe (error as Error) casts. Use getErrorMessage(error) from common/utils instead:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('should not use (err as Error) casts in production code', () => {
    const violations = grepFilesNonComment('\\(err as Error\\)', 'backend/src', '*.ts').filter(
      (f) => !f.includes('.test.') && !f.includes('.spec.'),
    );

    expect(
      violations,
      `Found unsafe (err as Error) casts. Use getErrorMessage(err) from common/utils instead:\n${violations.join('\n')}`,
    ).toEqual([]);
  });
});

// =============================================================================
// BACKEND + SHARED: is_active Magic Number Prevention
// =============================================================================

describe('Backend: is_active Magic Number Prevention', () => {
  // Pattern note: the original `[0134](?![0-9])` used a PCRE-only negative
  // lookahead to prevent `is_active = 12` from matching `is_active = 1`.
  // ripgrep's default Rust regex engine does not support look-around (rg
  // would error with "look-around not supported"); enabling --pcre2 is a
  // global flag we don't want to gate the helper on. Word-boundary `\b`
  // gives the same guarantee — between digit and digit there's no boundary,
  // so `is_active = 1` matches but `is_active = 12` does not match `1`.
  it('should not use hardcoded is_active = N in production .ts files (use IS_ACTIVE constants)', () => {
    const violations = grepFilesNonComment('is_active\\s*=\\s*[0134]\\b', 'backend/src', '*.ts')
      .filter((f) => !f.includes('.test.') && !f.includes('.spec.'))
      .filter((f) => !f.includes('/migrations/'));

    expect(
      violations,
      `Found hardcoded is_active magic numbers. Use IS_ACTIVE.ACTIVE/DELETED/ARCHIVED/INACTIVE from @assixx/shared/constants:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('should not use hardcoded is_active != N in production .ts files', () => {
    const violations = grepFilesNonComment('is_active\\s*!=\\s*[0134]\\b', 'backend/src', '*.ts')
      .filter((f) => !f.includes('.test.') && !f.includes('.spec.'))
      .filter((f) => !f.includes('/migrations/'));

    expect(
      violations,
      `Found hardcoded is_active != N. Use IS_ACTIVE constants from @assixx/shared/constants:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('should not use hardcoded is_active IN (N, ...) in production .ts files', () => {
    const violations = grepFilesNonComment('is_active\\s+IN\\s*\\([0134]', 'backend/src', '*.ts')
      .filter((f) => !f.includes('.test.') && !f.includes('.spec.'))
      .filter((f) => !f.includes('/migrations/'));

    expect(
      violations,
      `Found hardcoded is_active IN (...). Use IS_ACTIVE constants from @assixx/shared/constants:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('should not define local IS_ACTIVE constants (import from @assixx/shared/constants)', () => {
    const violations = grepFilesNonComment('const IS_ACTIVE\\s*=', 'backend/src', '*.ts').filter(
      (f) => !f.includes('.test.') && !f.includes('.spec.'),
    );

    expect(
      violations,
      `Found local IS_ACTIVE constant definition. Import from @assixx/shared/constants instead:\n${violations.join('\n')}`,
    ).toEqual([]);
  });
});

// =============================================================================
// BACKEND: Soft-Delete Policy on `users` (ADR-020 + ADR-045 + Audit 2026-04-26)
// =============================================================================
//
// Hard-delete on the `users` table is reserved for tenant erasure (DSGVO
// Art. 17 — Right to be Forgotten) inside `tenant-deletion-executor.service.ts`.
// Every other deletion path MUST soft-delete via
//   `UPDATE users SET is_active = ${IS_ACTIVE.DELETED}, updated_at = NOW()`
// This invariant rests on three load-bearing reasons:
//
//   1) Audit trail preservation — 32 CASCADE-FKs on users.id would wipe
//      permission history (admin_area_permissions, admin_department_permissions,
//      user_addon_permissions), read-status (notification/document/blackboard/
//      kvp), e2e keys, and refresh-token telemetry on a hard-delete.
//
//   2) FK integrity — 24 RESTRICT-FKs (inventory_items.created_by,
//      calendar_events.user_id, admin_logs.user_id, areas.created_by,
//      halls.created_by, kvp_votes.user_id, notifications.created_by,
//      oauth_tokens, password_reset_tokens, …) block hard-delete on any
//      user who has ever produced content. Hard-delete in production crashes
//      with PostgreSQL 23503 foreign_key_violation on every active user.
//
//   3) Reactivation — `is_active = 4 → 1` is a single UPDATE; row resurrection
//      after hard-delete is impossible.
//
// ADR-020 explicitly documents the assumption "Assixx uses soft-delete
// (is_active = 4), never hard-delete for users". The 2026-04-26 audit found
// `root-admin.service.deleteAdmin` and `root.service.deleteRootUser`
// violating this; both have been migrated to soft-delete. This guard
// prevents regression.

describe('Backend: Soft-Delete Policy on users (ADR-020 + ADR-045)', () => {
  it('should not hard-delete from users outside tenant-deletion (DSGVO Art. 17)', () => {
    // Allowed: tenant erasure path. tenant_id ON DELETE CASCADE makes the
    // multi-pass cleanup deterministic; this is the only legitimate hard
    // delete on `users` in the codebase.
    const ALLOWED_FILES = new Set<string>([
      'backend/src/nest/tenant-deletion/tenant-deletion-executor.service.ts',
    ]);

    const violations = grepFilesNonComment('DELETE\\s+FROM\\s+users\\b', 'backend/src', '*.ts')
      .filter((f) => !f.includes('.test.') && !f.includes('.spec.'))
      .filter((f) => !ALLOWED_FILES.has(f));

    expect(
      violations,
      `Found hard-delete on users table outside tenant-deletion module. Use \`UPDATE users SET is_active = \${IS_ACTIVE.DELETED}, updated_at = NOW()\` instead — see ADR-020 §"Why ON DELETE RESTRICT" + ADR-045 + the canonical pattern in users.service.ts:512. Hard-delete is reserved for tenant erasure (DSGVO Art. 17) in tenant-deletion-executor.service.ts:\n${violations.join('\n')}`,
    ).toEqual([]);
  });
});

// =============================================================================
// BACKEND: WebSocket Type Safety (Zod validation)
// =============================================================================

describe('Backend: WebSocket Type Safety', () => {
  it('should not use unsafe type assertions in websocket files (use Zod .parse() instead)', () => {
    const wsFiles = [
      `${ROOT}/backend/src/websocket.ts`,
      `${ROOT}/backend/src/websocket-message-handler.ts`,
    ];
    // No more `|| true` (per the grepFiles refactor 2026-04-25); rg returns
    // exit 1 for "no matches" which we let propagate as success below.
    const cmd = `rg -n -e ' as ' ${wsFiles.join(' ')}`;
    let output: string;
    try {
      output = execSync(cmd, { encoding: 'utf-8' }).trim();
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 1) return; // no matches → nothing to assert
      throw new Error(`rg failed with exit ${String(status)} for ws-files`, { cause: err });
    }
    if (output === '') return;

    // Filter chain — three classes of legitimate `as` usage we don't want
    // to flag (uncovered 2026-04-25 by the rg-canary expose):
    //   1. `import { X as Y }` / `import { type X as Y }` — TS import alias
    //   2. `as const` — TS literal-type assertion (safe by design)
    //   3. Doc-comment lines (` * `, `// `, `/* `) — text containing the
    //      word "as" but not a TS expression
    //   4. SQL alias inside template literals — `column as column_alias`
    //      under SELECT/UPDATE/INSERT/DELETE/FROM/JOIN/WHERE keywords
    const violations = output
      .split('\n')
      .filter((line) => !line.includes('import ') && !line.includes('as const'))
      .filter((line) => {
        const match = /^[^:]+:\d+:(.*)$/.exec(line);
        if (match === null) return false;
        const content = match[1]?.trim() ?? '';
        // Drop comment fragments
        if (content.startsWith('*') || content.startsWith('//') || content.startsWith('/*')) {
          return false;
        }
        // Drop SQL-context lines (template-literal aliasing)
        if (/\b(SELECT|UPDATE|INSERT|DELETE|FROM|JOIN|WHERE)\b/i.test(content)) {
          return false;
        }
        return true;
      });

    expect(
      violations,
      `Found unsafe type assertions in websocket files. Use Zod schemas for runtime validation instead of \`as\` casts:\n${violations.join('\n')}`,
    ).toEqual([]);
  });
});

// =============================================================================
// BACKEND: ID Param DTO Factory Enforcement
// =============================================================================

describe('Backend: ID Param DTO Factory', () => {
  // grepFilesNonComment: doc-comments in param DTOs commonly document the
  // alternative pattern verbatim (e.g. `* never inline \`z.coerce.number()\``)
  // — that self-flag was the source of the 2026-04-25 false-positive on
  // `template-id-param.dto.ts`.
  it('should not use inline z.coerce.number().int().positive() in param DTO files (use idField from common/dto)', () => {
    const violations = grepFilesNonComment(
      'z\\.coerce\\.number\\(\\)',
      'backend/src/nest',
      '*-param.dto.ts',
    );

    expect(
      violations,
      `Found inline z.coerce.number() in param DTOs. Use idField from common/dto/param.factory instead:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('should not import IdSchema from common.schema.ts in param DTO files (use idField from common/dto)', () => {
    const violations = grepFilesNonComment(
      'schemas/common\\.schema',
      'backend/src/nest',
      '*-param.dto.ts',
    );

    expect(
      violations,
      `Found import from schemas/common.schema in param DTOs. Use idField/createIdParamSchema from common/dto instead:\n${violations.join('\n')}`,
    ).toEqual([]);
  });
});

// =============================================================================
// FRONTEND PATTERNS
// =============================================================================

describe('Frontend: Catch-Block Typing', () => {
  it('should not have untyped catch (err) blocks — use catch (err: unknown)', () => {
    const violations = grepFiles('catch \\((err|error|e)\\) \\{', 'frontend/src');

    expect(
      violations,
      `Found untyped catch blocks. Use catch (err: unknown) instead:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('should not define local getErrorMessage functions — import from $lib/utils/error', () => {
    const ALLOWED_FILE = 'frontend/src/lib/utils/error.ts';
    const violations = grepFiles('function getErrorMessage', 'frontend/src').filter(
      (f) => f !== ALLOWED_FILE,
    );

    expect(
      violations,
      `Found local getErrorMessage definition. Import from $lib/utils/error instead:\n${violations.join('\n')}`,
    ).toEqual([]);
  });
});

describe('Frontend: Session-Expired Centralization', () => {
  // Note: ALLOWED_FILE constant removed together with the goto-literal check
  // (superseded by the Apex-Login Redirect Centralization block below).

  it('should not define local isSessionExpiredError functions in route files', () => {
    const violations = grepFiles('function isSessionExpiredError', 'frontend/src/routes');

    expect(
      violations,
      `Found local isSessionExpiredError definition. Import from $lib/utils/session-expired.js instead:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('should not define local handleSessionExpired functions in route files', () => {
    const violations = grepFiles('function handleSessionExpired', 'frontend/src/routes');

    expect(
      violations,
      `Found local handleSessionExpired definition. Import from $lib/utils/session-expired.js instead:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('should not define local handleUnauthorized functions in route files', () => {
    const violations = grepFiles('function handleUnauthorized', 'frontend/src/routes');

    expect(
      violations,
      `Found local handleUnauthorized definition. Use handleSessionExpired from $lib/utils/session-expired.js instead:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  // NOTE: The "goto('/login?session=expired') literal centralization" check
  // was superseded by the Apex-Login Redirect Centralization block below
  // (ADR-050 Amendment). All 3 login-redirect literals (logout=success,
  // session=expired, session=forbidden) are covered there, so the single-
  // literal check here would be redundant (and wrong — the owner moved
  // from session-expired.ts to build-apex-url.ts).
});

// =============================================================================
// APEX-LOGIN REDIRECT CENTRALIZATION (ADR-050 Amendment — Logout → Apex)
// =============================================================================
//
// Every post-logout / post-session-event redirect must land on the apex
// `/login` page (not the current tenant subdomain). The query-param
// namespace split (`logout=` active action vs `session=` passive event)
// is encoded in `build-apex-url.ts`'s `REASON_TO_QUERY` map. Callers use
// `buildLoginUrl(<reason>)` — NEVER hardcode the URL literal.
//
// If someone copy-pastes `/login?session=expired` into a new route, this
// test catches it on the next CI run — before the drift compounds into
// `?session=logout` vs `?session=ended` vs `?logout=ended` inconsistency.
//
// @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md
//      §"Amendment — Logout → Apex"
describe('Frontend: Apex-Login Redirect Centralization (ADR-050 Amendment)', () => {
  /**
   * Authoritative source + its test file for the `/login?<reason>=<value>`
   * literal strings. The helper file defines the `REASON_TO_QUERY` map; the
   * test file asserts the map's values. Every other caller must use
   * `buildLoginUrl(reason)` — the lookup stays in one place so the namespace
   * decision (logout= vs session=) cannot drift.
   *
   * `session-expired.test.ts` is an exception: it black-box-tests the central
   * util's redirect URL by asserting the literal it should produce
   * (`https://www.assixx.com/login?session=expired`). Without this allowance
   * the test would have to mock `buildLoginUrl` (defeating the point of an
   * end-to-end check) or live in the same file as `build-apex-url.test.ts`
   * (mixing concerns). Discovered 2026-04-25 by the rg-canary refactor.
   */
  const ALLOWED_FILES = new Set<string>([
    'frontend/src/lib/utils/build-apex-url.ts',
    'frontend/src/lib/utils/build-apex-url.test.ts',
    'frontend/src/lib/utils/session-expired.test.ts',
  ]);

  /**
   * The three discriminable reasons encoded in `LoginRedirectReason`.
   * Extending this array is a codebase-wide refactor signal — the new
   * reason must also appear in `REASON_TO_QUERY`, the login page's
   * `checkForMessages()`, and this test.
   */
  const LOGIN_QUERY_LITERALS: { grepPattern: string; queryString: string }[] = [
    { grepPattern: 'login\\?logout=success', queryString: 'logout=success' },
    { grepPattern: 'login\\?session=expired', queryString: 'session=expired' },
    { grepPattern: 'login\\?session=forbidden', queryString: 'session=forbidden' },
  ];

  for (const { grepPattern, queryString } of LOGIN_QUERY_LITERALS) {
    it(`only build-apex-url.ts owns '/login?${queryString}' literal — use buildLoginUrl() elsewhere`, () => {
      const tsMatches = grepFilesNonComment(grepPattern, 'frontend/src', '*.ts');
      const svelteMatches = grepFilesNonComment(grepPattern, 'frontend/src', '*.svelte');
      const violations = [...tsMatches, ...svelteMatches].filter((f) => !ALLOWED_FILES.has(f));

      expect(
        violations,
        `Found hardcoded '/login?${queryString}' outside build-apex-url.ts. Use buildLoginUrl() with the appropriate LoginRedirectReason so the REASON_TO_QUERY map stays the single source of truth (ADR-050 Amendment — prevents namespace drift like ?session=logout vs ?logout=success):\n${violations.join('\n')}`,
      ).toEqual([]);
    });
  }

  /**
   * Phase 2 ban (2026-04-25): the *bare* `redirect(302, '/login')` SSR
   * pattern is now forbidden. It used to litter ~71 `+page.server.ts` files
   * as a defense-in-depth no-token guard — but the relative URL kept the
   * user on the tenant subdomain, defeating the cross-origin apex-login
   * design from the ADR-050 Amendment 2026-04-22. Mass-refactored to
   * `redirect(302, buildLoginUrl('session-expired', undefined, url))` —
   * this guard prevents regression.
   *
   * Allowlist mirrors the per-reason checks above (the helper file owns
   * the literal; its test file asserts the literal-to-URL mapping). No
   * other file should construct a `/login` redirect by hand.
   */
  it("SSR: only build-apex-url.ts owns bare `redirect(302, '/login')` — use buildLoginUrl() elsewhere", () => {
    // Match `redirect(302, '/login')` exactly — no query, no params.
    // The query-bearing variants are caught by the loop above; this guard
    // closes the gap left by the bare form (the original bug class that
    // ADR-050 Phase 2 cleaned up).
    const pattern = "redirect\\(302, '/login'\\)";
    const tsMatches = grepFiles(pattern, 'frontend/src', '*.ts');
    const svelteMatches = grepFiles(pattern, 'frontend/src', '*.svelte');
    const violations = [...tsMatches, ...svelteMatches].filter((f) => !ALLOWED_FILES.has(f));

    expect(
      violations,
      `Found bare \`redirect(302, '/login')\` SSR redirect outside build-apex-url.ts. Per ADR-050 Amendment 2026-04-22, every SSR redirect to login MUST go through buildLoginUrl(reason, undefined, url) so the response Location: header points at the apex origin (cross-origin hard-nav out of the tenant subdomain), NOT a relative path that keeps the browser stuck on \`<slug>.assixx.com\`. Replace with: redirect(302, buildLoginUrl('session-expired', undefined, url))\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  /**
   * Phase 3 ban (2026-04-25): client-side navigation to `/login` via
   * SvelteKit's `goto()` is forbidden. `goto()` is bound to the SvelteKit
   * client router and CANNOT leave the current origin — a logout from a
   * tenant subdomain ends up back on the same subdomain `/login`, not the
   * apex. The smoking gun: the user observed token-timeout redirects
   * landing on `testfirma.localhost:5173/login?session=expired` instead of
   * the apex even after Phase 2 fixed every SSR `redirect(302, '/login')`,
   * because token-manager.ts and ~10 other client-side sites used `goto()`
   * or relative `window.location` instead.
   *
   * Replacement: `window.location.href = buildLoginUrl(reason)` — full
   * cross-origin hard-nav. The browser's Location resolution applies the
   * absolute apex URL the helper returns.
   */
  it('Client: no `goto(...)` to /login — use window.location.href = buildLoginUrl() (apex hop)', () => {
    // Match `goto(` followed (with possibly nested helpers like resolve())
    // by a string literal beginning with `/login`. Catches `goto('/login')`,
    // `goto('/login?...')`, `goto(resolve('/login'))`, `goto(resolve('/login?...'))`.
    // The pattern is intentionally loose to defend against whatever wrapper
    // someone reaches for next.
    // `\x27` = hex escape for `'` — avoids breaking the single-quoted shell
    // arg that `grepFiles` builds. Prettier enforces single-quoted JS string
    // literals project-wide so this catches every production caller.
    const pattern = 'goto\\([^)]*\\x27/login';
    const tsMatches = grepFiles(pattern, 'frontend/src', '*.ts');
    const svelteMatches = grepFiles(pattern, 'frontend/src', '*.svelte');
    const violations = [...tsMatches, ...svelteMatches].filter((f) => !ALLOWED_FILES.has(f));

    expect(
      violations,
      `Found client-side \`goto(.../login...)\` outside build-apex-url.ts. Per ADR-050 Amendment 2026-04-22, SvelteKit's \`goto()\` is client-router-bound and cannot cross origins — the user stays on the tenant subdomain instead of the apex. Replace with:\n  window.location.href = buildLoginUrl('session-expired')   // auth-error context\n  window.location.href = buildLoginUrl('logout-success')    // post-action context\n  window.location.href = buildLoginUrl()                    // neutral entry\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  /**
   * Phase 3 ban (2026-04-25): direct relative-path assignments to
   * `window.location.href` / `window.location.replace()` are forbidden.
   * The token-manager was the canonical bug (built `/login?session=expired`
   * via URLSearchParams + relative window.location.replace) — relative
   * URLs resolve against the current origin, so a session-timeout on a
   * tenant subdomain redirected back to the SAME subdomain. This guard
   * catches that pattern even when a future caller programmatically
   * constructs the URL string and assigns it.
   */
  it('Client: no relative `window.location.{href,replace}` to /login — use buildLoginUrl() (absolute apex URL)', () => {
    // Match `window.location.href = '/login...'` or `.replace('/login...')`.
    // Allowed: `window.location.href = buildLoginUrl(...)` (absolute apex
    // URL). The literal `/login` slash is the giveaway that the URL is
    // relative — buildLoginUrl always returns `http(s)://<apex>/login...`.
    // `\x27` = hex escape for `'` (same shell-quoting rationale as the
    // goto-ban above). Prettier-enforced single quotes cover all callers.
    const pattern = 'window\\.location\\.(href\\s*=\\s*|replace\\s*\\()\\x27/login';
    const tsMatches = grepFiles(pattern, 'frontend/src', '*.ts');
    const svelteMatches = grepFiles(pattern, 'frontend/src', '*.svelte');
    const violations = [...tsMatches, ...svelteMatches].filter((f) => !ALLOWED_FILES.has(f));

    expect(
      violations,
      `Found client-side \`window.location.{href,replace}\` with a relative \`/login\` URL outside build-apex-url.ts. Per ADR-050 Amendment 2026-04-22, the URL must be the absolute apex form returned by \`buildLoginUrl(reason)\` — relative paths keep the user on the tenant subdomain. Replace with:\n  window.location.href = buildLoginUrl('session-expired')\n${violations.join('\n')}`,
    ).toEqual([]);
  });
});

describe('Backend: Shared db-helpers (Maßnahme #13)', () => {
  it('should not define local toIsoString functions in helper files', () => {
    const matches = grepFiles('function toIsoString', 'backend/src/nest', '*.helpers.ts');

    expect(
      matches,
      `Found local toIsoString definition. Import from utils/db-helpers.js instead:\n${matches.join('\n')}`,
    ).toEqual([]);
  });

  it('should not define local toIsoStringOrNull functions in helper files', () => {
    const matches = grepFiles('function toIsoStringOrNull', 'backend/src/nest', '*.helpers.ts');

    expect(
      matches,
      `Found local toIsoStringOrNull definition. Import from utils/db-helpers.js instead:\n${matches.join('\n')}`,
    ).toEqual([]);
  });

  it('should not define local parseIds/parseNames STRING_AGG parsers in helper files', () => {
    const matches = grepFiles(
      'function parseIds|function parseNames',
      'backend/src/nest',
      '*.helpers.ts',
    );

    expect(
      matches,
      `Found local STRING_AGG parser. Import parseStringAgg/parseStringAggNumbers from utils/db-helpers.js instead:\n${matches.join('\n')}`,
    ).toEqual([]);
  });
});

// =============================================================================
// BACKEND: Tenant-Verification Gate (Plan 2 §2.9 + §2.11, ADR-048 pending)
// =============================================================================
//
// Every `INSERT INTO users` in a `backend/src/nest/**/*.service.ts` file MUST
// sit inside a method body that also calls `assertVerified(`, OR the method
// must be on the bootstrap allowlist (signup paths that CREATE the first
// `tenant_domains` row and therefore cannot be gated by it — gating would
// deadlock every new tenant).
//
// Detection uses the TypeScript compiler AST (ts.createSourceFile) to resolve
// the IMMEDIATE enclosing function of each INSERT literal — NOT the public
// wrapper that indirectly calls it. Rationale: v0.3.5 D32 + v0.3.6 D33 —
// pre-v0.3.6 plan listed public `createUser` / `createRootUser` etc. as gate
// sites, but AST visitor-based resolution finds the PRIVATE helpers where
// the SQL literal physically lives. Allowlisting the wrappers would silently
// match nothing and the test would green-on-main while the gate had holes.
//
// Allowlist = two signup-bootstrap helpers only:
//   - `signup.service.ts::createRootUser`        (password flow, seeds pending)
//   - `signup.service.ts::createOAuthRootUser`   (OAuth flow, seeds verified)
// All other matches MUST contain `assertVerified(` in their body.

const USER_INSERT_ALLOWLIST = new Set<string>([
  // Password signup bootstrap — seeds tenant_domains(status='pending') per §2.8.
  'backend/src/nest/signup/signup.service.ts::createRootUser',
  // OAuth signup bootstrap — seeds tenant_domains(status='verified') per §2.8b + §0.2.5 #17.
  'backend/src/nest/signup/signup.service.ts::createOAuthRootUser',
]);

/**
 * Extract the method/function name from an AST node, or null if the node
 * is not a named method/function or has no name token (e.g. anonymous
 * FunctionExpression in an arrow — those are not valid gate sites anyway
 * because they can't hold an `INSERT INTO users` SQL literal by convention).
 */
function getMethodName(node: ts.Node, sf: ts.SourceFile): string | null {
  if (!ts.isMethodDeclaration(node) && !ts.isFunctionDeclaration(node)) return null;
  if (node.name === undefined) return null;
  return node.name.getText(sf);
}

/**
 * Inspect a single AST node: if it's a named method/function whose body
 * contains `INSERT INTO users`, check that the body ALSO contains
 * `assertVerified(` OR that the method is on the bootstrap allowlist.
 * Pushes a violation string into `out` if neither condition is met.
 */
function checkMethodForGate(
  relFile: string,
  sf: ts.SourceFile,
  node: ts.Node,
  out: string[],
): void {
  if (
    !(ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node)) ||
    node.body === undefined
  ) {
    return;
  }
  const methodName = getMethodName(node, sf);
  if (methodName === null) return;
  const bodyText = node.body.getText(sf);
  // Per-iteration regexes — avoid /g lastIndex leaking across calls.
  if (!/INSERT\s+INTO\s+users\b/is.test(bodyText)) return;
  const key = `${relFile}::${methodName}`;
  if (USER_INSERT_ALLOWLIST.has(key)) return;
  if (/\bassertVerified\(/.test(bodyText)) return;
  out.push(
    `${key} inserts into \`users\` but never calls \`assertVerified(...)\` in its body.\n` +
      `  Fix: inject TenantVerificationService and call ` +
      `\`await this.tenantVerification.assertVerified(tenantId)\` ` +
      `before any DB write. See ADR-048 §2.9.`,
  );
}

/**
 * Find all `*.service.ts` files under `backend/src/nest/` that contain the
 * literal `INSERT INTO users` (case-insensitive, whitespace-tolerant). Uses
 * Node's `fs.readdirSync({ recursive: true })` + in-memory regex scan —
 * does NOT depend on ripgrep being installed in the container (the shared
 * `grepFiles()` helper silently returns `[]` when `rg` is missing, which
 * would turn this test into a false-negative; discovered 2026-04-18 during
 * Step 2.11 sanity-check).
 */
function findServiceFilesWithUserInsert(): string[] {
  const root = `${ROOT}/backend/src/nest`;
  const entries = readdirSync(root, { recursive: true, withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.service.ts')) continue;
    const abs = `${entry.parentPath}/${entry.name}`;
    const text = readFileSync(abs, 'utf-8');
    if (/INSERT\s+INTO\s+users\b/is.test(text)) {
      // Normalize to project-relative path for the allowlist key format.
      out.push(abs.replace(`${ROOT}/`, ''));
    }
  }
  return out;
}

describe('Backend: Tenant-Verification Gate (ADR-048 §2.9)', () => {
  it('every INSERT INTO users in a service must be gated by assertVerified() OR allowlisted', () => {
    const files = findServiceFilesWithUserInsert();
    const violations: string[] = [];

    for (const relFile of files) {
      const source = readFileSync(`${ROOT}/${relFile}`, 'utf-8');
      const sf = ts.createSourceFile(relFile, source, ts.ScriptTarget.Latest, true);
      const walk = (node: ts.Node): void => {
        checkMethodForGate(relFile, sf, node, violations);
        ts.forEachChild(node, walk);
      };
      walk(sf);
    }

    expect(
      violations,
      `Tenant-verification gate violations (Plan 2 §2.11):\n${violations.join('\n\n')}`,
    ).toEqual([]);
  });
});

// =============================================================================
// Tenant Subdomain Routing (ADR-050, masterplan Session 8 / Step 2.6)
// =============================================================================
//
// Six invariants that ADR-050's host-cross-check security model rests on.
// Each one, if broken silently, re-opens a specific risk:
//
//   R1:  `cookies.set(..., { domain: ... })`  →  cross-tenant cookie leak.
//   R2:  `@UseGuards(JwtAuthGuard)` without middleware pre-mount  →  JWT
//        becomes cross-tenant skeleton key.
//   SSR: slug-parsing duplicated outside `extract-slug.ts`  →  policy drift
//        (one parser says subdomain-X is valid, the other says invalid).
//   R14: `docker-compose.prod.yml` forgets `ports: !reset []`  →  backend:3000
//        publicly reachable, bypasses Nginx, bypasses host-cross-check.
//   R15: `OAuthHandoffService.consume()` DELs before host-check  →  attacker
//        can DoS the legitimate user's OAuth-in-flight token by intercepting
//        the redirect to a wrong subdomain.
//   D17: bare `req.hostTenantId` / `request.hostTenantId` outside the
//        middleware  →  silent `undefined` in FastifyRequest context
//        (NestJS class-middleware under @fastify/middie writes to the raw
//        IncomingMessage, guards/controllers MUST read via `.raw.`).
//
// Detection uses readFileSync + JS regex / string indexOf — no AST for the
// checks that do not need it (consistent with `findServiceFilesWithUserInsert`
// pattern earlier in this file; avoids ripgrep-missing false negatives that
// the 2026-04-18 debug log called out).

/**
 * Files that are ALLOWED to contain a regex-escape sequence `\.assixx\.com`.
 * Everything else is a slug-parser duplication and MUST fail the test.
 *
 * Known/accepted duplications (tech-debt flagged for later extraction):
 *   - `backend/src/nest/main.ts` — `PROD_SUBDOMAIN_ORIGIN_REGEX` mirrors the
 *     shape of `extract-slug.ts` for CORS origin matching. Two callers, two
 *     regexes. The masterplan tracks "extract shared regex helper" as a
 *     post-Phase-6 refactor; for now the comment on line 180-186 of main.ts
 *     documents the intentional mirror. If a THIRD caller grows such a
 *     regex, this allowlist should be replaced by a proper helper.
 *   - `frontend/src/lib/utils/extract-slug.ts` — frontend twin of the backend
 *     parser (D5: duplicated not shared, justified by build-graph friction).
 *     File does not exist yet (Session 11) — listing it here is forward-
 *     compat; adding it when that session lands is a one-liner delta.
 */
const SLUG_PARSER_ALLOWLIST = new Set<string>([
  'backend/src/nest/common/utils/extract-slug.ts',
  'backend/src/nest/main.ts',
  'frontend/src/lib/utils/extract-slug.ts',
  'shared/src/architectural.test.ts',
]);

/**
 * Files that are ALLOWED to contain a bare `req.hostTenantId` /
 * `request.hostTenantId` PropertyAccess node (D17).
 *
 * Writer context: NestJS class-middleware mounted via
 * `MiddlewareConsumer.apply()` runs under `@fastify/middie` which passes the
 * RAW `IncomingMessage` as the first arg of `use(req, res, next)` — NOT the
 * Fastify-wrapped `FastifyRequest`. Inside the middleware, a write via
 * `hostAware.hostTenantId = X` (where `hostAware = req as IncomingMessage
 * & HostAwareRaw`) is semantically correct.
 *
 * Every OTHER file in `backend/src/**` operates in FastifyRequest context
 * (controllers, guards, interceptors, services). A bare `request.hostTenantId`
 * read in those contexts silently returns `undefined` because the field
 * lives on `request.raw`, not `request` — the single load-bearing line of
 * ADR-050 was defeated in production until the Session 10 API tests caught
 * it (see masterplan D17 + Changelog 0.9.0).
 *
 * The middleware uses `hostAware.hostTenantId` (variable name `hostAware`,
 * not `req`/`request`), so it doesn't trigger the AST check anyway — but the
 * allowlist is preserved as an explicit "this file is the writer" statement
 * for future refactor safety.
 */
const BARE_HOST_TENANT_ID_WRITER_ALLOWLIST = new Set<string>([
  'backend/src/nest/common/middleware/tenant-host-resolver.middleware.ts',
]);

/**
 * Walk a subtree, collecting absolute paths of `.ts` / `.svelte` files.
 * Used by both the cookie-domain scan (R1) and the slug-parser scan (SSR).
 * Skips obvious non-source dirs (`node_modules`, `dist`, `build`,
 * `.svelte-kit`, `.vite`) so the vitest run stays under 1 s.
 */
function collectSourceFiles(searchDir: string): string[] {
  const root = `${ROOT}/${searchDir}`;
  const entries = readdirSync(root, { recursive: true, withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!(entry.name.endsWith('.ts') || entry.name.endsWith('.svelte'))) continue;
    const parent = entry.parentPath;
    if (
      parent.includes('/node_modules/') ||
      parent.includes('/dist/') ||
      parent.includes('/build/') ||
      parent.includes('/.svelte-kit/') ||
      parent.includes('/.vite/')
    ) {
      continue;
    }
    out.push(`${parent}/${entry.name}`);
  }
  return out;
}

/**
 * Find every `cookies.set(...)` call whose options-object literal contains
 * a `domain:` property. Multi-line-aware (negated-char-class handles newlines
 * natively in JS regex). One level of nested parens permitted (enough for
 * `cookies.set('k', 'v', { domain: getFoo() })` — deeper nesting in cookie
 * options is unheard of).
 *
 * R1 rationale: SvelteKit's `cookies.set()` defaults to scoping the cookie
 * to the current request origin (`<slug>.assixx.com`). ADDING `domain:` with
 * ANY value expands the scope — `.assixx.com` is the catastrophic case
 * (sends cookies to every tenant), but even `domain: 'www.assixx.com'`
 * breaks the Modus-A cookie-isolation property. The plan's explicit rule:
 * ANY `domain:` property on `cookies.set` is a violation. No allowlist.
 *
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §R1
 * @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md Step 2.6 rule #1
 */
function findCookiesSetWithDomainOption(files: string[]): string[] {
  // Match `cookies.set(...)` with non-greedy arg body; allow one level of
  // nested parens. Char class `[^()]` matches newlines natively in JS.
  const CALL_RE = /cookies\.set\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g;
  const DOMAIN_RE = /\bdomain\s*:/;
  const violations: string[] = [];

  for (const abs of files) {
    const text = readFileSync(abs, 'utf-8');
    if (!text.includes('cookies.set')) continue;
    CALL_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CALL_RE.exec(text)) !== null) {
      if (DOMAIN_RE.test(m[1] ?? '')) {
        violations.push(abs.replace(`${ROOT}/`, ''));
        break;
      }
    }
  }
  return violations;
}

describe('Backend+Frontend: Tenant Subdomain Routing Invariants (ADR-050)', () => {
  // ---------------------------------------------------------------------------
  // R1 — cookies.set must never receive a `domain:` option.
  // ---------------------------------------------------------------------------
  it('R1: no cookies.set call carries a `domain:` option (would break origin-scoping)', () => {
    const files = [...collectSourceFiles('backend/src'), ...collectSourceFiles('frontend/src')];
    const violations = findCookiesSetWithDomainOption(files);

    expect(
      violations,
      `Found cookies.set(...) calls with a domain: option — ADR-050 §R1 violation. SvelteKit default origin-scoping is the cookie-isolation mechanism; setting domain: widens the scope and defeats cross-tenant isolation:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // R2 — TenantHostResolverMiddleware must be mounted globally in AppModule.
  //
  // Structural single-source check: the middleware is mounted via
  // `consumer.apply(TenantHostResolverMiddleware).forRoutes('{*path}')` which
  // covers every controller — including all `@UseGuards(JwtAuthGuard)` ones —
  // by design. Rather than AST-walk every controller (expensive, brittle
  // against refactors), assert the one load-bearing line still exists.
  // If someone removes the mount, the guard's cross-check silently degrades
  // to `req.hostTenantId === undefined` everywhere (skip-branch), and
  // cross-tenant JWT replay becomes trivial.
  // ---------------------------------------------------------------------------
  it('R2: AppModule mounts TenantHostResolverMiddleware on every route', () => {
    const appModulePath = `${ROOT}/backend/src/nest/app.module.ts`;
    const text = readFileSync(appModulePath, 'utf-8');

    const importsMiddleware =
      /import\s*\{[^}]*\bTenantHostResolverMiddleware\b[^}]*\}\s*from\s*['"][^'"]+tenant-host-resolver\.middleware/.test(
        text,
      );
    const mountsGlobally =
      /consumer\s*\.\s*apply\s*\(\s*TenantHostResolverMiddleware\s*\)\s*\.\s*forRoutes\s*\(\s*['"`]\{\*path\}['"`]\s*\)/.test(
        text,
      );

    expect(
      importsMiddleware,
      'AppModule must import TenantHostResolverMiddleware (ADR-050 §R2)',
    ).toBe(true);
    expect(
      mountsGlobally,
      `AppModule must mount TenantHostResolverMiddleware with forRoutes('{*path}') — removing this mount silently disables the cross-tenant JWT replay defence. See ADR-050 §Decision "Backend: Pre-Auth Host Resolver" and masterplan Step 2.2.`,
    ).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Slug-parser single-source — ban regex-escaped `.assixx.com` outside the
  // canonical parser(s). Hunts for the exact bytes `\.assixx\.com` which only
  // appear inside a JS regex literal. Template-literal URL *construction*
  // (`${slug}.assixx.com`) is unaffected — that's slug-embedding, not parsing.
  // ---------------------------------------------------------------------------
  it('slug-parser SSR: only allowlisted files contain the `\\.assixx\\.com` regex literal', () => {
    const files = [
      ...collectSourceFiles('backend/src'),
      ...collectSourceFiles('frontend/src'),
      ...collectSourceFiles('shared/src'),
    ];
    // Match the regex-escape sequence `\.assixx\.com` as it would appear in
    // JS source (two literal characters: backslash + dot). Template literals
    // and plain-dot strings like `.assixx.com` (no backslash) do NOT match.
    const ESCAPED_DOT_RE = /\\\.assixx\\\.com/;
    const violations: string[] = [];

    for (const abs of files) {
      const rel = abs.replace(`${ROOT}/`, '');
      if (SLUG_PARSER_ALLOWLIST.has(rel)) continue;
      const text = readFileSync(abs, 'utf-8');
      if (ESCAPED_DOT_RE.test(text)) {
        violations.push(rel);
      }
    }

    expect(
      violations,
      `Slug-parser duplication detected (ADR-050 §Step 2.6 rule #3). The regex literal \`\\.assixx\\.com\` must only live in the canonical extract-slug parser. Import extractSlug() instead of writing a second parser:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // R14 — docker-compose.prod.yml MUST drop public port publish for backend
  // AND frontend via the `ports: !reset []` override. Without this, the prod
  // host exposes :3000 and :3001 directly and an attacker bypasses Nginx +
  // the host-cross-check entirely. Valid JWT → cross-tenant skeleton key.
  // ---------------------------------------------------------------------------
  it('R14: docker-compose.prod.yml drops public port publish for backend + frontend', () => {
    const composePath = `${ROOT}/docker/docker-compose.prod.yml`;
    const text = readFileSync(composePath, 'utf-8');

    // Slice out the lines belonging to a given 2-space-indented service block.
    // Stops at the next sibling service header (2-space indent) OR any
    // top-level key (`volumes:`, `networks:`) OR end-of-file. This prevents
    // the previous regex from matching a `!reset []` that lives in a different
    // service's block (the lesson from the Session 8 sanity-regression run).
    const extractServiceBlock = (yaml: string, service: string): string | null => {
      const lines = yaml.split('\n');
      const headerRe = new RegExp(`^ {2}${service}:\\s*$`);
      const startIdx = lines.findIndex((l) => headerRe.test(l));
      if (startIdx === -1) return null;
      const SIBLING_RE = /^ {2}[a-zA-Z][\w-]*:\s*$/; // 2-space-indent service header
      const TOP_LEVEL_RE = /^[a-zA-Z][\w-]*:/; // 0-indent key like `volumes:`
      let endIdx = lines.length;
      for (let i = startIdx + 1; i < lines.length; i++) {
        const line = lines[i] ?? '';
        if (SIBLING_RE.test(line) || TOP_LEVEL_RE.test(line)) {
          endIdx = i;
          break;
        }
      }
      return lines.slice(startIdx, endIdx).join('\n');
    };

    const RESET_RE = /ports:\s*!reset\s*\[\s*\]/;
    const backendBlock = extractServiceBlock(text, 'backend');
    const frontendBlock = extractServiceBlock(text, 'frontend');

    expect(
      backendBlock !== null && RESET_RE.test(backendBlock),
      `docker-compose.prod.yml must set \`backend.ports: !reset []\` — removing this re-exposes backend:3000 publicly and defeats the Nginx-enforced host-cross-check (ADR-050 §R14, masterplan Step 1.6).`,
    ).toBe(true);
    expect(
      frontendBlock !== null && RESET_RE.test(frontendBlock),
      `docker-compose.prod.yml must set \`frontend.ports: !reset []\` — removing this re-exposes frontend:3001 publicly and defeats the Nginx-enforced host-cross-check (ADR-050 §R14, masterplan Step 1.6).`,
    ).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // R15 — OAuthHandoffService.consume() must perform `redis.get` → host-check
  // → `redis.del` in that exact order. A refactor that deletes first (or
  // before the host-check) turns the endpoint into a DoS primitive against
  // legit users: an attacker intercepting the 302 to the wrong subdomain can
  // burn the token without ever completing the flow.
  //
  // The architectural test enforces STRING-LEVEL ordering on the service file
  // because the three operations each appear exactly once in the file and
  // only inside consume() (mint() uses `redis.set`, parseOrThrow does
  // neither). Index comparisons are sufficient and do not require AST.
  // ---------------------------------------------------------------------------
  it('R15: OAuthHandoffService.consume() performs redis.get → host-check → redis.del in order', () => {
    const servicePath = `${ROOT}/backend/src/nest/auth/oauth/oauth-handoff.service.ts`;
    const text = readFileSync(servicePath, 'utf-8');

    const getIdx = text.indexOf('redis.get(');
    const checkIdx = text.indexOf('hostTenantId !== payload.tenantId');
    const delIdx = text.indexOf('redis.del(');

    expect(getIdx, 'OAuthHandoffService must call `redis.get(...)` in consume()').toBeGreaterThan(
      -1,
    );
    expect(
      checkIdx,
      'OAuthHandoffService must check `hostTenantId !== payload.tenantId` before DEL (R15)',
    ).toBeGreaterThan(-1);
    expect(
      delIdx,
      'OAuthHandoffService must call `redis.del(...)` after the host-check (R15)',
    ).toBeGreaterThan(-1);

    expect(
      getIdx < checkIdx && checkIdx < delIdx,
      `OAuthHandoffService.consume() ordering broken. Expected: redis.get → host-check → redis.del. Got positions: get=${getIdx}, check=${checkIdx}, del=${delIdx}. Deleting before the host-check burns legitimate users' tokens on tampered redirects (ADR-050 §R15, masterplan Step 2.5f).`,
    ).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // D17 — bare `req.hostTenantId` / `request.hostTenantId` outside the
  // middleware silently return `undefined` in FastifyRequest context and
  // defeat the cross-tenant-replay defence.
  //
  // Session 10 runtime discovery: NestJS class-middleware mounted via
  // `MiddlewareConsumer.apply()` runs through `@fastify/middie` which passes
  // the raw `IncomingMessage` (NOT the wrapped `FastifyRequest`) as the first
  // arg of `use(req, res, next)`. The middleware writes
  // `req.hostTenantId = X` to the IncomingMessage; guards/controllers
  // reading `request.hostTenantId` from the Fastify wrapper get `undefined`.
  // In production the cross-check became a silent no-op — the 919-test API
  // suite's first cross-tenant assertion caught it (see masterplan Changelog
  // 0.9.0 for the full bug post-mortem).
  //
  // Fix (shipped Session 10): guards/controllers read
  // `(request as HostAwareRequest).raw.hostTenantId`. This guard prevents
  // regression by rejecting any bare `req.hostTenantId` /
  // `request.hostTenantId` PropertyAccess outside the middleware writer
  // allowlist.
  //
  // Detection: TypeScript AST walk (ts.createSourceFile) — comment mentions
  // and JSDoc (`@see req.hostTenantId`) are correctly ignored because they
  // are trivia, not PropertyAccessExpression nodes. A raw regex would
  // false-positive on every ADR/code-comment in the file (verified during
  // rule design).
  //
  // Test files are excluded globally — unit tests legitimately mock both
  // `req.hostTenantId` and `req.raw.hostTenantId` patterns; the guard test
  // in particular was updated in Session 10 to write into `raw` (matching
  // production reality). Enforcing the rule on test files would break
  // regression coverage.
  //
  // @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §Backend
  // @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md Changelog 0.9.0 / D17
  // ---------------------------------------------------------------------------
  it('D17: no bare `req.hostTenantId` / `request.hostTenantId` outside the middleware', () => {
    const files = collectSourceFiles('backend/src').filter(
      (abs) => !abs.includes('.test.') && !abs.includes('.spec.') && abs.endsWith('.ts'),
    );
    const violations: string[] = [];

    for (const abs of files) {
      const rel = abs.replace(`${ROOT}/`, '');
      if (BARE_HOST_TENANT_ID_WRITER_ALLOWLIST.has(rel)) continue;

      const source = readFileSync(abs, 'utf-8');
      // Cheap pre-filter — AST-parse only files that even mention the field.
      // Keeps the full-repo scan fast (~30 files pass the filter today).
      if (!source.includes('hostTenantId')) continue;

      const sf = ts.createSourceFile(rel, source, ts.ScriptTarget.Latest, true);
      const walk = (node: ts.Node): void => {
        if (
          ts.isPropertyAccessExpression(node) &&
          node.name.getText(sf) === 'hostTenantId' &&
          ts.isIdentifier(node.expression)
        ) {
          const objText = node.expression.text;
          if (objText === 'req' || objText === 'request') {
            const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
            violations.push(`${rel}:${line + 1}  →  ${node.getText(sf)}`);
          }
        }
        ts.forEachChild(node, walk);
      };
      walk(sf);
    }

    expect(
      violations,
      `Bare \`req.hostTenantId\` / \`request.hostTenantId\` PropertyAccess found outside the middleware (ADR-050 §D17). In FastifyRequest context this silently returns \`undefined\` — the cross-tenant JWT-replay defence becomes a no-op. Read via \`(request as HostAwareRequest).raw.hostTenantId\` instead. See masterplan Changelog 0.9.0 for the production-impact analysis:\n${violations.join('\n')}`,
    ).toEqual([]);
  });
});
