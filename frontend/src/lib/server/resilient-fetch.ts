/**
 * resilient-fetch — server-only SSR fetch wrapper with retry on transient
 * network errors.
 *
 * WHY: The Node process behind `:3000` (NestJS + Fastify) restarts during
 * dev on file-save (`nest start --watch`) and in prod during rolling
 * deployments / OOM recovery / Kubernetes pod replacement. Bootstrap takes
 * ~3–4 s (see `backend/src/nest/main.ts::bootstrap`). SSR fetches landing
 * in that window fail with `ECONNRESET`, bubble up to `hooks.server.ts` /
 * `+page.server.ts`, and log the user out with an
 * `ERROR: Error checking auth status` followed by a `302 /login` — the
 * visible dev-UX bug.
 *
 * Keep-alive hygiene is in the stack too: Fastify `keepAliveTimeout`
 * defaults to 72 s, while undici's Agent pool may hold a socket longer
 * under load, creating a narrow race where the server has already sent
 * FIN but the client reuses the socket and receives RST. One retry with
 * a short cooldown eliminates that race without inflating latency.
 *
 * HARD CONSTRAINTS:
 * - Only retries idempotent methods (GET / HEAD / OPTIONS) by default.
 *   POST / PUT / DELETE / PATCH never retry unless the caller opts in via
 *   `allowPostRetry` AND guarantees effective idempotency (e.g. a POST
 *   that mints a fresh short-lived ticket — never a POST that creates a
 *   user or charges a card).
 * - Only retries on transient network errors surfaced by undici — never
 *   on HTTP 5xx. A 5xx response body may already reflect real backend
 *   work; retrying duplicates side-effects and masks Sentry alerts. If
 *   the backend is dead at the socket level, `fetch()` throws a
 *   `TypeError` whose `.cause` carries `ECONNRESET` / `ECONNREFUSED` /
 *   `ETIMEDOUT`. Detection walks the cause chain, not just `err.message`.
 * - Respects `AbortSignal`. Caller aborts ⇒ no retry.
 * - Server-only (`$lib/server/…`). Browser fetch uses a different agent
 *   and has its own natural retry surface (page reload / SPA navigation);
 *   a browser retry wrapper is a separate concern.
 *
 * @see backend/src/nest/main.ts::gracefulShutdown — the graceful drain
 *   that leaves the ~3–4 s bootstrap window we compensate for here.
 * @see docs/plans/GRACEFUL-SHUTDOWN-FIX-PLAN.md
 */

import { createLogger } from '$lib/utils/logger';

const log = createLogger('resilient-fetch');

/**
 * Transient network error codes that warrant a retry.
 *
 * - `ECONNRESET`    — peer sent RST (keep-alive race, graceful shutdown)
 * - `ECONNREFUSED`  — target port not listening yet (restart window)
 * - `ETIMEDOUT`     — SYN/ACK timeout (network hiccup)
 * - `ENOTFOUND`     — DNS transient (docker-compose service churn)
 * - `UND_ERR_SOCKET`— undici internal socket failure wrapper
 * - `EAI_AGAIN`     — temporary DNS lookup failure
 */
const TRANSIENT_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'UND_ERR_SOCKET',
  'EAI_AGAIN',
]);

/** HTTP methods safe to retry per RFC 9110 §9.2.2. */
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Fallback regex when the error chain has no `.code` — surfaces message-only failures. */
const TRANSIENT_MESSAGE_REGEX =
  /ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|fetch failed|socket hang up/i;

export interface ResilientFetchOptions {
  /**
   * Opt-in to retry non-idempotent methods. Caller MUST guarantee the
   * operation is effectively idempotent (e.g. rotating a short-lived
   * ticket). Defaults to `false` — safe-by-default.
   */
  allowPostRetry?: boolean;
  /** Base backoff in ms (default 150). Subsequent delays: base × 3^(n-1). */
  backoffMs?: number;
  /** Max total attempts including the first (default 3 ⇒ 2 retries). */
  maxAttempts?: number;
}

/** Extract the `code` property from an error-like value, if it is a string. */
function getErrorCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null || !('code' in err)) return undefined;
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

/**
 * Walk the `.cause` chain (max 5 levels — guards against cyclic causes)
 * and return the first `code` property found. undici wraps the raw socket
 * error in a `TypeError('fetch failed')` whose `.cause` is the inner
 * `Error` carrying the actual `code`. Returns `undefined` when no level
 * of the chain exposes a code.
 */
function resolveErrorCode(err: unknown): string | undefined {
  let current: unknown = err;
  for (let depth = 0; depth < 5 && current !== undefined && current !== null; depth++) {
    const code = getErrorCode(current);
    if (code !== undefined) return code;
    if (typeof current !== 'object' || !('cause' in current)) return undefined;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

/**
 * Detect a transient network error.
 *
 * Authority order:
 *  1. If any level of the `.cause` chain exposes a `code`, that code is
 *     the authoritative signal — membership in `TRANSIENT_CODES` decides.
 *     A non-transient code (e.g. `EACCES`) must NOT be upgraded to
 *     transient just because undici's outer message says "fetch failed".
 *  2. Only when no code is available anywhere in the chain do we fall
 *     back to message matching — defense against runtimes that surface
 *     the failure purely textually.
 */
export function isTransientNetworkError(err: unknown): boolean {
  const code = resolveErrorCode(err);
  if (code !== undefined) return TRANSIENT_CODES.has(code);
  return err instanceof Error && TRANSIENT_MESSAGE_REGEX.test(err.message);
}

/** Cancellable sleep — honours an `AbortSignal` so cancellation propagates. */
function sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(signal.reason as Error);
      return;
    }
    const timer = setTimeout(() => {
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(signal?.reason as Error);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Outcome of a single fetch attempt — a discriminated union keeps the retry loop linear. */
type AttemptOutcome = { kind: 'success'; response: Response } | { kind: 'error'; error: unknown };

/** Run one fetch attempt and wrap the outcome — never throws. */
async function runAttempt(input: string | URL, init?: RequestInit): Promise<AttemptOutcome> {
  try {
    const response = await fetch(input, init);
    return { kind: 'success', response };
  } catch (error: unknown) {
    return { kind: 'error', error };
  }
}

/**
 * Decide whether a failed attempt warrants another try. Returns false when:
 *  - The signal is already aborted (propagate cancellation).
 *  - The method is not retryable (non-idempotent without opt-in).
 *  - The error is not transient.
 *  - The attempt budget is exhausted.
 */
function shouldRetry(
  err: unknown,
  attempt: number,
  maxAttempts: number,
  retryable: boolean,
  signal: AbortSignal | null | undefined,
): boolean {
  if (signal?.aborted === true) return false;
  if (!retryable) return false;
  if (!isTransientNetworkError(err)) return false;
  return attempt < maxAttempts;
}

/**
 * Drop-in replacement for `fetch()` in SvelteKit `+page.server.ts` and
 * `hooks.server.ts`. Retries on transient network errors so the user is
 * not logged out every time the backend restarts.
 *
 * @example
 *   const response = await resilientFetch(`${API_BASE}/users/me`, {
 *     headers: { Authorization: `Bearer ${token}` },
 *   });
 */
/** Exponential backoff: attempt 1 → base, attempt 2 → base × 3, attempt 3 → base × 9, … */
function backoffDelay(attempt: number, baseMs: number): number {
  return baseMs * 3 ** (attempt - 1);
}

/** Decide whether the given method is retry-eligible by default (GET/HEAD/OPTIONS) or via opt-in. */
function isMethodRetryable(method: string, allowPostRetry: boolean): boolean {
  return allowPostRetry || IDEMPOTENT_METHODS.has(method);
}

/** Per-call retry parameters, bundled so the loop stays readable and lint-clean. */
interface RetryContext {
  retryable: boolean;
  maxAttempts: number;
  backoffMs: number;
  signal: AbortSignal | null;
  method: string;
}

/**
 * Runs the retry loop. Extracted from `resilientFetch` so the public entry
 * point stays below the Power-of-Ten cyclomatic-complexity ceiling (10).
 */
async function runAttemptLoop(
  input: string | URL,
  init: RequestInit | undefined,
  ctx: RetryContext,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= ctx.maxAttempts; attempt++) {
    const outcome = await runAttempt(input, init);
    if (outcome.kind === 'success') return outcome.response;

    lastError = outcome.error;
    if (!shouldRetry(outcome.error, attempt, ctx.maxAttempts, ctx.retryable, ctx.signal)) {
      throw outcome.error;
    }

    const delay = backoffDelay(attempt, ctx.backoffMs);
    log.debug(
      { url: String(input), method: ctx.method, attempt, delay, err: outcome.error },
      'Transient network error — retrying SSR fetch',
    );
    await sleep(delay, ctx.signal);
  }
  throw lastError;
}

export async function resilientFetch(
  input: string | URL,
  init?: RequestInit,
  options: ResilientFetchOptions = {},
): Promise<Response> {
  const { allowPostRetry = false, backoffMs = 150, maxAttempts = 3 } = options;
  const signal = init?.signal ?? null;
  const method = (init?.method ?? 'GET').toUpperCase();
  const ctx: RetryContext = {
    retryable: isMethodRetryable(method, allowPostRetry),
    maxAttempts,
    backoffMs,
    signal,
    method,
  };
  return await runAttemptLoop(input, init, ctx);
}
