/**
 * Unit tests for resilientFetch — the SSR fetch wrapper that retries on
 * transient network errors (ECONNRESET, ECONNREFUSED, …) so users aren't
 * logged out during backend restarts.
 *
 * Behavioural contract covered here:
 * 1. Happy path (first attempt succeeds, zero extra overhead)
 * 2. Retries on transient network errors surfaced via `.cause.code`
 * 3. Retries on legacy message-only errors (socket hang up)
 * 4. Does NOT retry on HTTP 5xx responses (those are backend decisions)
 * 5. Does NOT retry non-idempotent methods (POST) by default
 * 6. Retries POST when `allowPostRetry` is explicit opt-in
 * 7. Honours AbortSignal — cancellation propagates without retry
 * 8. Gives up after `maxAttempts` and rethrows the last error
 *
 * @see ./resilient-fetch.ts for the WHY.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isTransientNetworkError, resilientFetch } from './resilient-fetch';

/** Dummy endpoint — never resolves anywhere; fetch is always mocked. */
const TEST_URL = 'http://api/users/me';

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

/** Build a fake TypeError('fetch failed') with a `.cause.code` — mirrors undici. */
function undiciNetworkError(code: string): TypeError {
  const cause = new Error('socket error') as Error & { code: string };
  cause.code = code;
  const err = new TypeError('fetch failed');
  (err as TypeError & { cause: Error }).cause = cause;
  return err;
}

let fetchMock: FetchMock;

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchMock);
  // Fake timers so exponential backoff doesn't slow the suite down.
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ─── isTransientNetworkError ────────────────────────────────────────────────

describe('isTransientNetworkError', () => {
  it('detects ECONNRESET via .cause.code', () => {
    expect(isTransientNetworkError(undiciNetworkError('ECONNRESET'))).toBe(true);
  });

  it('detects ECONNREFUSED via .cause.code', () => {
    expect(isTransientNetworkError(undiciNetworkError('ECONNREFUSED'))).toBe(true);
  });

  it('detects ETIMEDOUT via .cause.code', () => {
    expect(isTransientNetworkError(undiciNetworkError('ETIMEDOUT'))).toBe(true);
  });

  it('detects ECONNRESET via fallback message regex', () => {
    expect(isTransientNetworkError(new Error('read ECONNRESET'))).toBe(true);
  });

  it('detects "socket hang up" via fallback message regex', () => {
    expect(isTransientNetworkError(new Error('socket hang up'))).toBe(true);
  });

  it('rejects plain Error without code or matching message', () => {
    expect(isTransientNetworkError(new Error('Something broke'))).toBe(false);
  });

  it('rejects non-transient code (EACCES)', () => {
    expect(isTransientNetworkError(undiciNetworkError('EACCES'))).toBe(false);
  });

  it('rejects null / undefined / plain strings defensively', () => {
    expect(isTransientNetworkError(null)).toBe(false);
    expect(isTransientNetworkError(undefined)).toBe(false);
    expect(isTransientNetworkError('not an error')).toBe(false);
  });
});

// ─── resilientFetch — happy path ────────────────────────────────────────────

describe('resilientFetch — happy path', () => {
  it('returns response on first success without retrying', async () => {
    const ok = new Response('ok', { status: 200 });
    fetchMock.mockResolvedValueOnce(ok);

    const result = await resilientFetch(TEST_URL);

    expect(result).toBe(ok);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on 500 — 5xx is a backend decision, not a network error', async () => {
    const serverError = new Response('boom', { status: 500 });
    fetchMock.mockResolvedValueOnce(serverError);

    const result = await resilientFetch(TEST_URL);

    expect(result).toBe(serverError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on 503 — caller decides, not this wrapper', async () => {
    const unavailable = new Response('maintenance', { status: 503 });
    fetchMock.mockResolvedValueOnce(unavailable);

    const result = await resilientFetch(TEST_URL);

    expect(result).toBe(unavailable);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// ─── resilientFetch — retry behaviour ──────────────────────────────────────

describe('resilientFetch — retry on transient errors', () => {
  it('retries once on ECONNRESET and succeeds on attempt #2', async () => {
    fetchMock.mockRejectedValueOnce(undiciNetworkError('ECONNRESET'));
    fetchMock.mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const promise = resilientFetch(TEST_URL);
    await vi.advanceTimersByTimeAsync(150);
    const result = await promise;

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries twice on sustained ECONNREFUSED then succeeds', async () => {
    fetchMock.mockRejectedValueOnce(undiciNetworkError('ECONNREFUSED'));
    fetchMock.mockRejectedValueOnce(undiciNetworkError('ECONNREFUSED'));
    fetchMock.mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const promise = resilientFetch(TEST_URL);
    await vi.advanceTimersByTimeAsync(150); // 1st backoff
    await vi.advanceTimersByTimeAsync(450); // 2nd backoff (150 × 3)
    const result = await promise;

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('gives up after maxAttempts and rethrows the last error', async () => {
    const finalErr = undiciNetworkError('ECONNRESET');
    fetchMock.mockRejectedValue(finalErr);

    const promise = resilientFetch(TEST_URL).catch((err: unknown) => err);
    await vi.advanceTimersByTimeAsync(150);
    await vi.advanceTimersByTimeAsync(450);
    const caught = await promise;

    expect(caught).toBe(finalErr);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry when error is non-transient (EACCES)', async () => {
    const fatal = undiciNetworkError('EACCES');
    fetchMock.mockRejectedValueOnce(fatal);

    await expect(resilientFetch(TEST_URL)).rejects.toBe(fatal);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// ─── resilientFetch — method safety ────────────────────────────────────────

describe('resilientFetch — method-level retry safety', () => {
  it('does NOT retry POST by default — protects against duplicate writes', async () => {
    const transient = undiciNetworkError('ECONNRESET');
    fetchMock.mockRejectedValueOnce(transient);

    await expect(resilientFetch('http://api/users', { method: 'POST' })).rejects.toBe(transient);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries POST when caller opts in via allowPostRetry', async () => {
    fetchMock.mockRejectedValueOnce(undiciNetworkError('ECONNRESET'));
    fetchMock.mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const promise = resilientFetch(
      'http://api/ticket',
      { method: 'POST' },
      { allowPostRetry: true },
    );
    await vi.advanceTimersByTimeAsync(150);
    const result = await promise;

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries HEAD by default (idempotent per RFC 9110)', async () => {
    fetchMock.mockRejectedValueOnce(undiciNetworkError('ECONNRESET'));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

    const promise = resilientFetch('http://api/ping', { method: 'HEAD' });
    await vi.advanceTimersByTimeAsync(150);
    const result = await promise;

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

// ─── resilientFetch — AbortSignal ──────────────────────────────────────────

describe('resilientFetch — AbortSignal', () => {
  it('propagates cancellation without retry when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort(new Error('user navigated away'));

    fetchMock.mockImplementation((_url: Request | string | URL, init?: RequestInit) => {
      // Simulate native fetch rejection on aborted signal
      return Promise.reject(init?.signal?.reason as Error);
    });

    await expect(resilientFetch(TEST_URL, { signal: controller.signal })).rejects.toThrow(
      'user navigated away',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
