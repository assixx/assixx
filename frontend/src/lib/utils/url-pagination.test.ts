/**
 * Unit tests for the URL ↔ paginated-state mapping helpers.
 *
 * Pure functions, no mocking required. Covers all three public read helpers
 * + buildPaginatedHref across default-skip, value-emission, and
 * non-emittable-skip paths so the R5 mitigation invariant
 * ("default state renders /manage-X with zero query params") is locked in.
 *
 * @see docs/FEAT_SERVER_DRIVEN_PAGINATION_MASTERPLAN.md §2.2
 */
import { describe, expect, it } from 'vitest';

import {
  buildPaginatedHref,
  readFilterFromUrl,
  readPageFromUrl,
  readSearchFromUrl,
} from './url-pagination';

/** Helper — strict-TS-friendly URL builder. Origin/path are irrelevant for these helpers; only `searchParams` is read. */
function url(qs = ''): URL {
  return new URL(`https://test.local/manage-x${qs}`);
}

// ─── readPageFromUrl ────────────────────────────────────────────────────────

describe('readPageFromUrl', () => {
  it('returns 1 when ?page is missing', () => {
    expect(readPageFromUrl(url())).toBe(1);
  });

  it('returns 1 when ?page is empty string', () => {
    expect(readPageFromUrl(url('?page='))).toBe(1);
  });

  it('returns parsed integer for valid ?page=N', () => {
    expect(readPageFromUrl(url('?page=2'))).toBe(2);
    expect(readPageFromUrl(url('?page=42'))).toBe(42);
  });

  it('returns 1 for non-numeric ?page', () => {
    expect(readPageFromUrl(url('?page=abc'))).toBe(1);
  });

  it('returns 1 for ?page=0', () => {
    expect(readPageFromUrl(url('?page=0'))).toBe(1);
  });

  it('returns 1 for negative ?page', () => {
    expect(readPageFromUrl(url('?page=-5'))).toBe(1);
  });

  it('truncates decimals via parseInt (?page=2.7 → 2)', () => {
    expect(readPageFromUrl(url('?page=2.7'))).toBe(2);
  });

  it('does not enforce upper bound (backend PaginationSchema validates)', () => {
    expect(readPageFromUrl(url('?page=999999'))).toBe(999999);
  });
});

// ─── readSearchFromUrl ──────────────────────────────────────────────────────

describe('readSearchFromUrl', () => {
  it("returns '' when ?search is missing", () => {
    expect(readSearchFromUrl(url())).toBe('');
  });

  it("returns '' when ?search is empty string", () => {
    expect(readSearchFromUrl(url('?search='))).toBe('');
  });

  it('returns the raw value when present', () => {
    expect(readSearchFromUrl(url('?search=foo'))).toBe('foo');
  });

  it('trims leading/trailing whitespace', () => {
    expect(readSearchFromUrl(url('?search=%20%20foo%20%20'))).toBe('foo');
  });

  it("returns '' for whitespace-only value", () => {
    expect(readSearchFromUrl(url('?search=%20%20%20'))).toBe('');
  });

  it('does not enforce length cap (backend D3 .trim().max(100) validates)', () => {
    const long = 'a'.repeat(500);
    expect(readSearchFromUrl(url(`?search=${long}`))).toBe(long);
  });

  it('preserves internal whitespace', () => {
    expect(readSearchFromUrl(url('?search=foo%20bar'))).toBe('foo bar');
  });
});

// ─── readFilterFromUrl ──────────────────────────────────────────────────────

describe('readFilterFromUrl', () => {
  const allowed = ['active', 'inactive', 'archived'] as const;

  it('returns the parsed value when in allowlist', () => {
    expect(readFilterFromUrl(url('?status=active'), 'status', allowed, 'active')).toBe('active');
    expect(readFilterFromUrl(url('?status=archived'), 'status', allowed, 'active')).toBe(
      'archived',
    );
  });

  it('returns defaultValue when param is missing', () => {
    expect(readFilterFromUrl(url(), 'status', allowed, 'active')).toBe('active');
  });

  it('returns defaultValue for value not in allowlist', () => {
    expect(readFilterFromUrl(url('?status=bogus'), 'status', allowed, 'active')).toBe('active');
  });

  it('returns defaultValue for empty string param', () => {
    expect(readFilterFromUrl(url('?status='), 'status', allowed, 'active')).toBe('active');
  });

  it('is case-sensitive (rejects ACTIVE when allowlist has only "active")', () => {
    expect(readFilterFromUrl(url('?status=ACTIVE'), 'status', allowed, 'active')).toBe('active');
  });

  // Compile-time check — if the helper signature degraded to `string`, this
  // assignment would TS-fail under noImplicitAny + strict. The runtime
  // expectation is incidental; the real assertion is that the line type-checks.
  it("preserves caller's literal-union return type", () => {
    type Status = 'active' | 'inactive';
    const allow: readonly Status[] = ['active', 'inactive'];
    const result: Status = readFilterFromUrl(url('?status=active'), 'status', allow, 'active');
    expect(result).toBe('active');
  });
});

// ─── buildPaginatedHref – defaults are skipped ─────────────────────────────

describe('buildPaginatedHref – default values are skipped', () => {
  it('returns base path with no query when params are empty', () => {
    expect(buildPaginatedHref('/manage-x', {})).toBe('/manage-x');
  });

  it('skips page when page === 1 (default)', () => {
    expect(buildPaginatedHref('/manage-x', { page: 1 })).toBe('/manage-x');
  });

  it("skips search when search === '' (default)", () => {
    expect(buildPaginatedHref('/manage-x', { search: '' })).toBe('/manage-x');
  });

  it('skips both defaults together (canonical zero-param URL — R5 mitigation)', () => {
    expect(buildPaginatedHref('/manage-x', { page: 1, search: '' })).toBe('/manage-x');
  });
});

// ─── buildPaginatedHref – emitting non-default values ──────────────────────

describe('buildPaginatedHref – emitting non-default values', () => {
  it('emits page when > 1', () => {
    expect(buildPaginatedHref('/manage-x', { page: 2 })).toBe('/manage-x?page=2');
  });

  it('emits search when non-empty', () => {
    expect(buildPaginatedHref('/manage-x', { search: 'foo' })).toBe('/manage-x?search=foo');
  });

  it('emits both page and search', () => {
    expect(buildPaginatedHref('/manage-x', { page: 3, search: 'foo' })).toBe(
      '/manage-x?page=3&search=foo',
    );
  });

  it('emits extra string params', () => {
    expect(buildPaginatedHref('/manage-x', { status: 'active' })).toBe('/manage-x?status=active');
  });

  it('emits extra number params', () => {
    expect(buildPaginatedHref('/manage-x', { teamId: 42 })).toBe('/manage-x?teamId=42');
  });

  it('emits boolean false (meaningful — distinct from omission)', () => {
    expect(buildPaginatedHref('/manage-x', { archived: false })).toBe('/manage-x?archived=false');
  });

  it('emits boolean true', () => {
    expect(buildPaginatedHref('/manage-x', { archived: true })).toBe('/manage-x?archived=true');
  });

  it('URL-encodes spaces in search via URLSearchParams', () => {
    expect(buildPaginatedHref('/manage-x', { search: 'foo bar' })).toBe('/manage-x?search=foo+bar');
  });

  it('URL-encodes ampersand and equals in search', () => {
    expect(buildPaginatedHref('/manage-x', { search: 'a&b=c' })).toBe('/manage-x?search=a%26b%3Dc');
  });
});

// ─── buildPaginatedHref – non-emittable values are skipped ─────────────────

describe('buildPaginatedHref – non-emittable values are skipped', () => {
  it('skips null', () => {
    expect(buildPaginatedHref('/manage-x', { team: null })).toBe('/manage-x');
  });

  it('skips undefined', () => {
    expect(buildPaginatedHref('/manage-x', { team: undefined })).toBe('/manage-x');
  });

  it("skips '' (filter-inactive sentinel)", () => {
    expect(buildPaginatedHref('/manage-x', { team: '' })).toBe('/manage-x');
  });

  it('skips objects (avoids silent [object Object] URLs)', () => {
    expect(buildPaginatedHref('/manage-x', { team: { id: 1 } })).toBe('/manage-x');
  });

  it('skips arrays', () => {
    expect(buildPaginatedHref('/manage-x', { ids: [1, 2, 3] })).toBe('/manage-x');
  });

  it('mixes emittable and non-emittable correctly', () => {
    expect(
      buildPaginatedHref('/manage-x', {
        page: 2,
        search: 'foo',
        team: null,
        status: 'active',
        nested: { x: 1 },
      }),
    ).toBe('/manage-x?page=2&search=foo&status=active');
  });
});
