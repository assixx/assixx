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
 * Run ripgrep and return matching files (empty array = no matches = good).
 * Returns file paths relative to ROOT.
 */
function grepFiles(pattern: string, searchPath: string, glob?: string): string[] {
  const globArg = glob !== undefined ? `--glob '${glob}'` : '';
  const cmd = `rg --files-with-matches ${globArg} -e '${pattern}' '${ROOT}/${searchPath}' 2>/dev/null || true`;
  const result = execSync(cmd, { encoding: 'utf-8' }).trim();
  if (result === '') return [];
  return result.split('\n').map((f) => f.replace(`${ROOT}/`, ''));
}

// =============================================================================
// BACKEND PATTERNS
// =============================================================================

describe('Backend: Error Handling Patterns', () => {
  it('should not use unsafe (error as Error) casts in production code', () => {
    const violations = grepFiles('\\(error as Error\\)', 'backend/src', '*.ts').filter(
      (f) => !f.includes('.test.') && !f.includes('.spec.'),
    );

    expect(
      violations,
      `Found unsafe (error as Error) casts. Use getErrorMessage(error) from common/utils instead:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('should not use (err as Error) casts in production code', () => {
    const violations = grepFiles('\\(err as Error\\)', 'backend/src', '*.ts').filter(
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
  it('should not use hardcoded is_active = N in production .ts files (use IS_ACTIVE constants)', () => {
    const violations = grepFiles('is_active\\s*=\\s*[0134](?![0-9])', 'backend/src', '*.ts')
      .filter((f) => !f.includes('.test.') && !f.includes('.spec.'))
      .filter((f) => !f.includes('/migrations/'));

    expect(
      violations,
      `Found hardcoded is_active magic numbers. Use IS_ACTIVE.ACTIVE/DELETED/ARCHIVED/INACTIVE from @assixx/shared/constants:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('should not use hardcoded is_active != N in production .ts files', () => {
    const violations = grepFiles('is_active\\s*!=\\s*[0134](?![0-9])', 'backend/src', '*.ts')
      .filter((f) => !f.includes('.test.') && !f.includes('.spec.'))
      .filter((f) => !f.includes('/migrations/'));

    expect(
      violations,
      `Found hardcoded is_active != N. Use IS_ACTIVE constants from @assixx/shared/constants:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('should not use hardcoded is_active IN (N, ...) in production .ts files', () => {
    const violations = grepFiles('is_active\\s+IN\\s*\\([0134]', 'backend/src', '*.ts')
      .filter((f) => !f.includes('.test.') && !f.includes('.spec.'))
      .filter((f) => !f.includes('/migrations/'));

    expect(
      violations,
      `Found hardcoded is_active IN (...). Use IS_ACTIVE constants from @assixx/shared/constants:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('should not define local IS_ACTIVE constants (import from @assixx/shared/constants)', () => {
    const violations = grepFiles('const IS_ACTIVE\\s*=', 'backend/src', '*.ts').filter(
      (f) => !f.includes('.test.') && !f.includes('.spec.'),
    );

    expect(
      violations,
      `Found local IS_ACTIVE constant definition. Import from @assixx/shared/constants instead:\n${violations.join('\n')}`,
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
    const cmd = `rg -n -e ' as ' ${wsFiles.join(' ')} 2>/dev/null || true`;
    const output = execSync(cmd, { encoding: 'utf-8' }).trim();
    if (output === '') return;

    const violations = output
      .split('\n')
      .filter((line) => !line.includes('import ') && !line.includes('as const'));

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
  it('should not use inline z.coerce.number().int().positive() in param DTO files (use idField from common/dto)', () => {
    const violations = grepFiles('z\\.coerce\\.number\\(\\)', 'backend/src/nest', '*-param.dto.ts');

    expect(
      violations,
      `Found inline z.coerce.number() in param DTOs. Use idField from common/dto/param.factory instead:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('should not import IdSchema from common.schema.ts in param DTO files (use idField from common/dto)', () => {
    const violations = grepFiles('schemas/common\\.schema', 'backend/src/nest', '*-param.dto.ts');

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
  const ALLOWED_FILE = 'frontend/src/lib/utils/session-expired.ts';

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

  it('should only use goto("/login?session=expired") in the centralized utility', () => {
    const matches = grepFiles('login\\?session=expired', 'frontend/src', '*.ts');

    const violations = matches.filter((f) => f !== ALLOWED_FILE);

    expect(
      violations,
      `Found direct goto('/login?session=expired') outside centralized utility. Use handleSessionExpired() from $lib/utils/session-expired.js instead:\n${violations.join('\n')}`,
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
