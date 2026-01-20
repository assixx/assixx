/**
 * Performance Logger Utility
 *
 * Provides detailed timing information for debugging page load and API performance.
 * Uses high-resolution timing (performance.now()) for accurate measurements.
 *
 * Usage:
 *   import { perf, perfMark, perfMeasure } from '$lib/utils/perf-logger';
 *
 *   // Simple timing
 *   const end = perf.start('api-fetch-users');
 *   await fetchUsers();
 *   end(); // Logs: [PERF] api-fetch-users: 123.45ms
 *
 *   // Manual marks
 *   perfMark('layout-mount-start');
 *   // ... work ...
 *   perfMeasure('layout-mount', 'layout-mount-start');
 *
 * @module perf-logger
 */

import { browser } from '$app/environment';

import { createLogger, isDev } from './logger';

const log = createLogger('PERF');

/** Performance entry with timing data */
interface PerfEntry {
  name: string;
  startTime: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

/** Active timers waiting to be ended */
const activeTimers = new Map<string, { start: number; metadata?: Record<string, unknown> }>();

/** Completed performance entries for analysis */
const completedEntries: PerfEntry[] = [];

/** Max entries to keep in memory */
const MAX_ENTRIES = 500;

/**
 * Get current high-resolution timestamp
 */
function now(): number {
  if (browser && typeof performance !== 'undefined') {
    return performance.now();
  }
  // SSR fallback - use process.hrtime if available
  if (typeof process !== 'undefined' && typeof process.hrtime === 'function') {
    const [sec, nano] = process.hrtime();
    return sec * 1000 + nano / 1_000_000;
  }
  return Date.now();
}

/**
 * Format duration for logging
 */
function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Store completed entry
 */
function storeEntry(entry: PerfEntry): void {
  completedEntries.push(entry);
  if (completedEntries.length > MAX_ENTRIES) {
    completedEntries.shift();
  }
}

/**
 * Log performance entry
 */
function logEntry(entry: PerfEntry): void {
  if (!isDev) return; // Only log in development

  const duration = formatDuration(entry.duration ?? 0);
  const meta = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';

  if ((entry.duration ?? 0) > 1000) {
    log.warn(
      { name: entry.name, duration: entry.duration, ...entry.metadata },
      `⚠️ SLOW: ${entry.name}: ${duration}${meta}`,
    );
  } else if ((entry.duration ?? 0) > 500) {
    log.info(
      { name: entry.name, duration: entry.duration, ...entry.metadata },
      `⏱️ ${entry.name}: ${duration}${meta}`,
    );
  } else {
    log.debug(
      { name: entry.name, duration: entry.duration, ...entry.metadata },
      `⏱️ ${entry.name}: ${duration}${meta}`,
    );
  }
}

/**
 * Performance timing API
 */
export const perf = {
  /**
   * Start a named timer
   * @param name - Unique identifier for this timing
   * @param metadata - Optional context data
   * @returns Function to call when operation completes
   *
   * @example
   * const end = perf.start('fetch-users', { count: 10 });
   * await fetchUsers();
   * end(); // Logs timing with metadata
   */
  start(name: string, metadata?: Record<string, unknown>): () => number {
    const start = now();
    activeTimers.set(name, { start, metadata });

    return () => {
      const timer = activeTimers.get(name);
      if (!timer) {
        log.warn({ name }, `Timer "${name}" not found or already ended`);
        return 0;
      }

      const duration = now() - timer.start;
      activeTimers.delete(name);

      const entry: PerfEntry = {
        name,
        startTime: timer.start,
        duration,
        metadata: timer.metadata,
      };

      storeEntry(entry);
      logEntry(entry);

      return duration;
    };
  },

  /**
   * Time an async operation
   * @param name - Unique identifier for this timing
   * @param fn - Async function to time
   * @param metadata - Optional context data
   * @returns Result of the async function
   *
   * @example
   * const users = await perf.time('fetch-users', () => api.get('/users'));
   */
  async time<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>,
  ): Promise<T> {
    const end = this.start(name, metadata);
    try {
      return await fn();
    } finally {
      end();
    }
  },

  /**
   * Time a sync operation
   * @param name - Unique identifier for this timing
   * @param fn - Sync function to time
   * @param metadata - Optional context data
   * @returns Result of the function
   *
   * @example
   * const result = perf.timeSync('parse-json', () => JSON.parse(data));
   */
  timeSync<T>(name: string, fn: () => T, metadata?: Record<string, unknown>): T {
    const end = this.start(name, metadata);
    try {
      return fn();
    } finally {
      end();
    }
  },

  /**
   * Get all completed entries
   */
  getEntries(): readonly PerfEntry[] {
    return completedEntries;
  },

  /**
   * Get entries matching a pattern
   */
  getEntriesByName(pattern: string | RegExp): PerfEntry[] {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    return completedEntries.filter((e) => regex.test(e.name));
  },

  /**
   * Clear all entries
   */
  clear(): void {
    completedEntries.length = 0;
    activeTimers.clear();
  },

  /**
   * Get summary statistics
   */
  getSummary(): { total: number; slow: number; avgDuration: number; entries: PerfEntry[] } {
    const entries = [...completedEntries];
    const total = entries.length;
    const slow = entries.filter((e) => (e.duration ?? 0) > 500).length;
    const avgDuration =
      total > 0 ? entries.reduce((sum, e) => sum + (e.duration ?? 0), 0) / total : 0;

    return { total, slow, avgDuration, entries };
  },

  /**
   * Log summary to console (dev only)
   */
  logSummary(): void {
    if (!isDev) return;

    const summary = this.getSummary();
    console.group('📊 Performance Summary');
    console.log(`Total operations: ${summary.total}`);
    console.log(`Slow operations (>500ms): ${summary.slow}`);
    console.log(`Average duration: ${formatDuration(summary.avgDuration)}`);

    if (summary.slow > 0) {
      console.group('⚠️ Slow Operations');
      summary.entries
        .filter((e) => (e.duration ?? 0) > 500)
        .sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0))
        .forEach((e) => {
          console.log(`${e.name}: ${formatDuration(e.duration ?? 0)}`, e.metadata ?? '');
        });
      console.groupEnd();
    }

    console.groupEnd();
  },
};

/**
 * Create a performance mark (browser Performance API wrapper)
 */
export function perfMark(name: string): void {
  if (browser && typeof performance !== 'undefined') {
    performance.mark(name);
  }
  if (isDev) {
    log.debug({ mark: name }, `📍 Mark: ${name}`);
  }
}

/**
 * Measure time between two marks
 */
export function perfMeasure(name: string, startMark: string, endMark?: string): number {
  if (browser && typeof performance !== 'undefined') {
    try {
      const measure = performance.measure(name, startMark, endMark);
      const duration = measure.duration;

      const entry: PerfEntry = { name, startTime: measure.startTime, duration };
      storeEntry(entry);
      logEntry(entry);

      return duration;
    } catch {
      log.warn({ name, startMark, endMark }, `Failed to measure "${name}"`);
      return 0;
    }
  }
  return 0;
}

/**
 * Page load timing helper - tracks navigation and resource timing
 * Uses Navigation Timing API Level 2 (PerformanceNavigationTiming)
 */
export function logPageLoadTiming(): void {
  if (!browser || !isDev) return;

  // Wait for page to fully load
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

  // Use modern Navigation Timing API Level 2
  const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  if (navEntries.length === 0) return;
  const nav = navEntries[0];

  const pageLoad = nav.loadEventEnd - nav.startTime;
  const domReady = nav.domContentLoadedEventEnd - nav.startTime;
  const ttfb = nav.responseStart - nav.startTime;
  const domParsing = nav.domInteractive - nav.responseEnd;

  console.group('📄 Page Load Timing');
  console.log(`TTFB (Time to First Byte): ${formatDuration(ttfb)}`);
  console.log(`DOM Parsing: ${formatDuration(domParsing)}`);
  console.log(`DOM Ready: ${formatDuration(domReady)}`);
  console.log(`Page Load Complete: ${formatDuration(pageLoad)}`);
  console.groupEnd();

  // Log to perf entries
  storeEntry({ name: 'page-ttfb', startTime: 0, duration: ttfb });
  storeEntry({ name: 'page-dom-parsing', startTime: 0, duration: domParsing });
  storeEntry({ name: 'page-dom-ready', startTime: 0, duration: domReady });
  storeEntry({ name: 'page-load-complete', startTime: 0, duration: pageLoad });
}

/**
 * Resource timing helper - shows what's loading and how long
 */
export function logResourceTiming(filter?: string | RegExp): void {
  if (!browser || !isDev) return;

  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const filtered =
    filter !== undefined
      ? resources.filter((r) =>
          typeof filter === 'string' ? r.name.includes(filter) : filter.test(r.name),
        )
      : resources;

  console.group(`📦 Resource Timing (${filtered.length} resources)`);

  // Group by type
  const byType = new Map<string, PerformanceResourceTiming[]>();
  filtered.forEach((r) => {
    const type = r.initiatorType !== '' ? r.initiatorType : 'other';
    const existing = byType.get(type);
    if (existing !== undefined) {
      existing.push(r);
    } else {
      byType.set(type, [r]);
    }
  });

  byType.forEach((items, type) => {
    console.group(`${type} (${items.length})`);
    items
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10)
      .forEach((r) => {
        const url = new URL(r.name, window.location.origin);
        console.log(`${formatDuration(r.duration)} - ${url.pathname}`);
      });
    console.groupEnd();
  });

  console.groupEnd();
}

// Expose for debugging in browser console
if (browser && isDev) {
  (window as unknown as Record<string, unknown>).__perf = {
    perf,
    perfMark,
    perfMeasure,
    logPageLoadTiming,
    logResourceTiming,
  };
}
