/**
 * URL ↔ paginated-state mapping for FEAT_SERVER_DRIVEN_PAGINATION (Phase 2).
 * @module lib/utils/url-pagination
 *
 * Single source of truth for reading pagination / search / filter state from
 * the URL and for building hrefs back. Only non-default values land in the
 * URL — clean canonical state per R5 mitigation in the masterplan
 * (default state renders `/manage-X` with zero query params).
 *
 * Used by every Phase-4 page migration and by the Phase-3 reference
 * implementation (`manage-dummies`).
 *
 * @see docs/FEAT_SERVER_DRIVEN_PAGINATION_MASTERPLAN.md §2.2
 */

/** Page param default — matches `PaginationSchema` (`backend/src/schemas/common.schema.ts`). */
const PAGE_DEFAULT = 1;

/** Search param default — empty string means "no filter". */
const SEARCH_DEFAULT = '';

/**
 * Parse the `?page=N` query param defensively.
 *
 * Returns `1` when the param is missing, non-numeric, ≤ 0, or NaN. Decimals
 * are truncated by `parseInt` (`?page=2.5` → `2`) — caller never has to
 * guard. No upper bound is enforced here: backend `PaginationSchema`
 * validates the effective range; FE only guarantees a usable positive
 * integer so consumer UI never crashes on tampered URLs.
 */
export function readPageFromUrl(url: URL): number {
  const raw = url.searchParams.get('page');
  if (raw === null) return PAGE_DEFAULT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return PAGE_DEFAULT;
  return parsed;
}

/**
 * Parse the `?search=` query param.
 *
 * Returns the trimmed string or '' when missing. No length cap on the FE
 * side — backend D3 convention (`.trim().max(100)`) rejects oversize
 * values. The helper only normalises whitespace so `?search=%20foo%20` and
 * `?search=foo` produce identical state.
 */
export function readSearchFromUrl(url: URL): string {
  const raw = url.searchParams.get('search');
  if (raw === null) return SEARCH_DEFAULT;
  return raw.trim();
}

/**
 * Parse a string-enum query param against an explicit allowlist.
 *
 * Anything not in `allowed` (typos, missing param, URL tampering, casing
 * drift) falls back to `defaultValue`. The generic `T` lets callers pass a
 * literal union and get the same type back without an `as` cast at the
 * call site.
 */
export function readFilterFromUrl<T extends string>(
  url: URL,
  key: string,
  allowed: readonly T[],
  defaultValue: T,
): T {
  const raw = url.searchParams.get(key);
  if (raw === null) return defaultValue;
  // `Array.includes` on `readonly T[]` rejects `string`; widen for the
  // runtime check, then narrow back via the explicit cast on success.
  if ((allowed as readonly string[]).includes(raw)) {
    return raw as T;
  }
  return defaultValue;
}

/**
 * Type-narrow helper: a value is URL-emittable iff it is a non-empty
 * primitive (string/number/boolean). null/undefined/'' encode "filter
 * inactive" and are skipped. Objects/arrays are skipped to avoid silent
 * `[object Object]` URLs.
 */
function isEmittable(value: unknown): value is string | number | boolean {
  if (value === undefined || value === null || value === '') return false;
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

/**
 * Append every non-page/non-search param from `params` to `search` if it is
 * emittable. Factored out of `buildPaginatedHref` to keep the main body
 * under the sonarjs cognitive-complexity-10 budget — same rationale as
 * `logHttpFailure` in api-fetch.ts.
 */
function appendExtraParams(search: URLSearchParams, params: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(params)) {
    if (key === 'page' || key === 'search') continue;
    if (!isEmittable(value)) continue;
    search.set(key, String(value));
  }
}

/**
 * Build a paginated href back into the URL — only non-default values are
 * emitted, so the canonical "first page, no search, no filters" state
 * renders as plain `/manage-X` with zero query params.
 *
 * `base` is expected to be a clean path (e.g. `/manage-employees`); the
 * helper does not parse or merge an existing query string on `base`.
 *
 * Page === 1 and search === '' are the documented defaults and never emit.
 * Any other key in `params` is emitted iff its value is a non-empty
 * primitive (string/number/boolean); objects, arrays, null, undefined, and
 * '' are silently skipped.
 */
export function buildPaginatedHref(
  base: string,
  params: { page?: number; search?: string; [k: string]: unknown },
): string {
  const search = new URLSearchParams();

  if (params.page !== undefined && params.page !== PAGE_DEFAULT) {
    search.set('page', String(params.page));
  }
  if (params.search !== undefined && params.search !== SEARCH_DEFAULT) {
    search.set('search', params.search);
  }

  appendExtraParams(search, params);

  const query = search.toString();
  return query === '' ? base : `${base}?${query}`;
}
