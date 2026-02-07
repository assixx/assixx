/**
 * Performance Logger Utility (Opt-In)
 *
 * OFF by default. Enable via Browser Console:
 *
 *   localStorage.setItem('PERF_LOG', 'true');
 *   location.reload();
 *
 * Disable:
 *   localStorage.removeItem('PERF_LOG');
 *   location.reload();
 *
 * @module perf-logger
 */
import { browser } from '$app/environment';

/** Check if perf logging is enabled */
function isEnabled(): boolean {
  if (!browser) return false;
  return localStorage.getItem('PERF_LOG') === 'true';
}

/** Format duration for logging */
function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/** Get current high-resolution timestamp */
function now(): number {
  if (browser && typeof performance !== 'undefined') {
    return performance.now();
  }
  return Date.now();
}

/**
 * Performance timing API (opt-in via localStorage PERF_LOG=true)
 */
export const perf = {
  /**
   * Start a named timer. Returns end() function.
   * When disabled: returns a no-op that returns 0.
   */
  start(name: string, metadata?: Record<string, unknown>): () => number {
    if (!isEnabled()) return () => 0;

    const start = now();
    return () => {
      const duration = now() - start;
      const meta = metadata ? ` ${JSON.stringify(metadata)}` : '';
      const label = `[PERF] ${name}: ${formatDuration(duration)}${meta}`;

      if (duration > 1000) {
        console.warn(`⚠️ SLOW ${label}`);
      } else if (duration > 500) {
        console.info(`⏱️ ${label}`);
      } else {
        console.debug(`⏱️ ${label}`);
      }
      return duration;
    };
  },

  /**
   * Time an async operation. When disabled: just executes fn.
   */
  async time<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>,
  ): Promise<T> {
    if (!isEnabled()) return await fn();

    const end = this.start(name, metadata);
    try {
      return await fn();
    } finally {
      end();
    }
  },

  /**
   * Time a sync operation. When disabled: just executes fn.
   */
  timeSync<T>(
    name: string,
    fn: () => T,
    metadata?: Record<string, unknown>,
  ): T {
    if (!isEnabled()) return fn();

    const end = this.start(name, metadata);
    try {
      return fn();
    } finally {
      end();
    }
  },
};

/**
 * Log page load timing (Navigation Timing API Level 2).
 * Only outputs when PERF_LOG is enabled.
 */
export function logPageLoadTiming(): void {
  if (!browser || !isEnabled()) return;

  if (document.readyState !== 'complete') {
    window.addEventListener(
      'load',
      () => {
        logPageLoadTiming();
      },
      { once: true },
    );
    return;
  }

  const navEntries = performance.getEntriesByType(
    'navigation',
  ) as PerformanceNavigationTiming[];
  if (navEntries.length === 0) return;
  const nav = navEntries[0];

  console.group('📄 Page Load Timing');
  console.log(`TTFB: ${formatDuration(nav.responseStart - nav.startTime)}`);
  console.log(
    `DOM Parsing: ${formatDuration(nav.domInteractive - nav.responseEnd)}`,
  );
  console.log(
    `DOM Ready: ${formatDuration(nav.domContentLoadedEventEnd - nav.startTime)}`,
  );
  console.log(`Page Load: ${formatDuration(nav.loadEventEnd - nav.startTime)}`);
  console.groupEnd();
}

/**
 * Log resource timing. Only outputs when PERF_LOG is enabled.
 */
export function logResourceTiming(filter?: string | RegExp): void {
  if (!browser || !isEnabled()) return;

  const resources = performance.getEntriesByType(
    'resource',
  ) as PerformanceResourceTiming[];
  const filtered =
    filter !== undefined ?
      resources.filter((r) =>
        typeof filter === 'string' ?
          r.name.includes(filter)
        : filter.test(r.name),
      )
    : resources;

  console.group(`📦 Resource Timing (${filtered.length} resources)`);
  filtered
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 10)
    .forEach((r) => {
      const url = new URL(r.name, window.location.origin);
      console.log(`${formatDuration(r.duration)} - ${url.pathname}`);
    });
  console.groupEnd();
}

// Expose enable/disable helpers on window for convenience
if (browser) {
  (window as unknown as Record<string, unknown>).__perf = {
    enable(): void {
      localStorage.setItem('PERF_LOG', 'true');
      console.log('✅ Perf logging enabled. Reload to activate.');
    },
    disable(): void {
      localStorage.removeItem('PERF_LOG');
      console.log('🔇 Perf logging disabled. Reload to deactivate.');
    },
    status(): void {
      console.log(isEnabled() ? '✅ PERF_LOG is ON' : '🔇 PERF_LOG is OFF');
    },
  };
}
