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
 *   - docs/CODE-OF-CONDUCT-SVELTE.md (Session-Expired Handling)
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
// FRONTEND PATTERNS
// =============================================================================

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
