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
 */
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('../../../', import.meta.url).pathname.replace(/\/$/, '');

/**
 * Run ripgrep and return matching files (empty array = no matches = good).
 * Returns file paths relative to ROOT.
 */
function grepFiles(
  pattern: string,
  searchPath: string,
  glob?: string,
): string[] {
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
    const violations = grepFiles(
      '\\(error as Error\\)',
      'backend/src',
      '*.ts',
    ).filter((f) => !f.includes('.test.') && !f.includes('.spec.'));

    expect(
      violations,
      `Found unsafe (error as Error) casts. Use getErrorMessage(error) from common/utils instead:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('should not use (err as Error) casts in production code', () => {
    const violations = grepFiles(
      '\\(err as Error\\)',
      'backend/src',
      '*.ts',
    ).filter((f) => !f.includes('.test.') && !f.includes('.spec.'));

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
    const violations = grepFiles(
      'is_active\\s*=\\s*[0134](?![0-9])',
      'backend/src',
      '*.ts',
    )
      .filter((f) => !f.includes('.test.') && !f.includes('.spec.'))
      .filter((f) => !f.includes('/migrations/'));

    expect(
      violations,
      `Found hardcoded is_active magic numbers. Use IS_ACTIVE.ACTIVE/DELETED/ARCHIVED/INACTIVE from @assixx/shared/constants:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('should not use hardcoded is_active != N in production .ts files', () => {
    const violations = grepFiles(
      'is_active\\s*!=\\s*[0134](?![0-9])',
      'backend/src',
      '*.ts',
    )
      .filter((f) => !f.includes('.test.') && !f.includes('.spec.'))
      .filter((f) => !f.includes('/migrations/'));

    expect(
      violations,
      `Found hardcoded is_active != N. Use IS_ACTIVE constants from @assixx/shared/constants:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('should not use hardcoded is_active IN (N, ...) in production .ts files', () => {
    const violations = grepFiles(
      'is_active\\s+IN\\s*\\([0134]',
      'backend/src',
      '*.ts',
    )
      .filter((f) => !f.includes('.test.') && !f.includes('.spec.'))
      .filter((f) => !f.includes('/migrations/'));

    expect(
      violations,
      `Found hardcoded is_active IN (...). Use IS_ACTIVE constants from @assixx/shared/constants:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('should not define local IS_ACTIVE constants (import from @assixx/shared/constants)', () => {
    const violations = grepFiles(
      'const IS_ACTIVE\\s*=',
      'backend/src',
      '*.ts',
    ).filter((f) => !f.includes('.test.') && !f.includes('.spec.'));

    expect(
      violations,
      `Found local IS_ACTIVE constant definition. Import from @assixx/shared/constants instead:\n${violations.join('\n')}`,
    ).toEqual([]);
  });
});

// =============================================================================
// BACKEND: ID Param DTO Factory Enforcement
// =============================================================================

describe('Backend: ID Param DTO Factory', () => {
  it('should not use inline z.coerce.number().int().positive() in param DTO files (use idField from common/dto)', () => {
    const violations = grepFiles(
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
    const violations = grepFiles(
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
    const violations = grepFiles(
      'catch \\((err|error|e)\\) \\{',
      'frontend/src',
    );

    expect(
      violations,
      `Found untyped catch blocks. Use catch (err: unknown) instead:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('should not define local getErrorMessage functions — import from $lib/utils/error', () => {
    const ALLOWED_FILE = 'frontend/src/lib/utils/error.ts';
    const violations = grepFiles(
      'function getErrorMessage',
      'frontend/src',
    ).filter((f) => f !== ALLOWED_FILE);

    expect(
      violations,
      `Found local getErrorMessage definition. Import from $lib/utils/error instead:\n${violations.join('\n')}`,
    ).toEqual([]);
  });
});

describe('Frontend: Session-Expired Centralization', () => {
  const ALLOWED_FILE = 'frontend/src/lib/utils/session-expired.ts';

  it('should not define local isSessionExpiredError functions in route files', () => {
    const violations = grepFiles(
      'function isSessionExpiredError',
      'frontend/src/routes',
    );

    expect(
      violations,
      `Found local isSessionExpiredError definition. Import from $lib/utils/session-expired.js instead:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('should not define local handleSessionExpired functions in route files', () => {
    const violations = grepFiles(
      'function handleSessionExpired',
      'frontend/src/routes',
    );

    expect(
      violations,
      `Found local handleSessionExpired definition. Import from $lib/utils/session-expired.js instead:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('should not define local handleUnauthorized functions in route files', () => {
    const violations = grepFiles(
      'function handleUnauthorized',
      'frontend/src/routes',
    );

    expect(
      violations,
      `Found local handleUnauthorized definition. Use handleSessionExpired from $lib/utils/session-expired.js instead:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('should only use goto("/login?session=expired") in the centralized utility', () => {
    const matches = grepFiles(
      'login\\?session=expired',
      'frontend/src',
      '*.ts',
    );

    const violations = matches.filter((f) => f !== ALLOWED_FILE);

    expect(
      violations,
      `Found direct goto('/login?session=expired') outside centralized utility. Use handleSessionExpired() from $lib/utils/session-expired.js instead:\n${violations.join('\n')}`,
    ).toEqual([]);
  });
});
