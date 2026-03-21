// =============================================================================
// CALENDAR - VACATION INDICATORS MODULE
// DOM-based vacation indicator rendering for the calendar grid
// Mirrors shift-indicators.svelte.ts pattern
// =============================================================================

import { browser } from '$app/environment';

import { createLogger } from '$lib/utils/logger';

import { loadUserVacations } from './api';

import type { CalendarVacationEntry } from './api';

const log = createLogger('VacationIndicators');

// State
let showVacationsState = $state(
  browser ? localStorage.getItem('showVacationsInCalendar') === 'true' : false,
);
const vacationsCache = $state<Map<string, { vacationType: string }>>(new Map());

/**
 * Expand date ranges into individual days (YYYY-MM-DD keys).
 * Skips weekends (Sat=6, Sun=0) since vacation indicators
 * are only meaningful on workdays.
 */
function expandRangesToDays(
  entries: CalendarVacationEntry[],
): Map<string, { vacationType: string }> {
  const result = new Map<string, { vacationType: string }>();

  for (const entry of entries) {
    const start = new Date(entry.startDate + 'T00:00:00Z');
    const end = new Date(entry.endDate + 'T00:00:00Z');
    const cursor = new Date(start);

    while (cursor <= end) {
      const dayOfWeek = cursor.getUTCDay();
      // Skip weekends
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const dateStr = cursor.toISOString().slice(0, 10);
        result.set(dateStr, { vacationType: entry.vacationType });
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return result;
}

/**
 * Render vacation indicators in calendar cells (Legacy approach)
 * EventCalendar uses: .ec-day > .ec-day-head > time[datetime="YYYY-MM-DD"]
 * Indicator goes INSIDE .ec-day-head, next to the day number
 */
function renderVacationIndicators(): void {
  // Remove existing indicators first
  document.querySelectorAll('.vacation-indicator').forEach((el) => {
    el.remove();
  });

  if (!showVacationsState || vacationsCache.size === 0) return;

  // Find all day head containers (EventCalendar structure)
  const dayHeads = document.querySelectorAll('.ec-day .ec-day-head');

  let renderedCount = 0;
  dayHeads.forEach((dayHead) => {
    const timeEl = dayHead.querySelector('time[datetime]');
    if (!timeEl) return;

    const dateAttr = timeEl.getAttribute('datetime');
    if (dateAttr === null) return;

    const vacation = vacationsCache.get(dateAttr);
    if (!vacation) return;

    // Create vacation indicator
    const indicator = document.createElement('div');
    indicator.className = 'vacation-indicator';
    indicator.textContent = 'U';
    indicator.setAttribute('aria-label', 'Urlaub');

    // Insert AFTER time - library uses row-reverse, so visually indicator appears LEFT
    dayHead.appendChild(indicator);
    renderedCount++;
  });

  log.debug({ renderedCount, cachedCount: vacationsCache.size }, 'Rendered vacation indicators');
}

/**
 * Fetch and cache vacations, then render indicators
 */
async function fetchAndRenderVacations(startStr: string, endStr: string): Promise<void> {
  if (!showVacationsState) {
    vacationsCache.clear();
    return;
  }

  log.debug({ startStr, endStr }, 'Fetching vacations');
  const entries = await loadUserVacations(startStr, endStr);

  // Expand date ranges into individual days and build cache
  vacationsCache.clear();
  const expanded = expandRangesToDays(entries);
  for (const [date, value] of expanded) {
    vacationsCache.set(date, value);
  }

  log.debug({ size: vacationsCache.size }, 'Cached vacation days');

  // Small delay to ensure DOM is rendered, then add indicators
  setTimeout(renderVacationIndicators, 100);
}

/**
 * Toggle vacation visibility. Returns new state (true=active).
 * Caller should trigger refetchCalendarEvents() when result is true.
 */
function toggle(): boolean {
  showVacationsState = !showVacationsState;
  log.debug({ showVacations: showVacationsState }, 'Vacations toggle');

  // Persist to localStorage
  if (browser) {
    localStorage.setItem('showVacationsInCalendar', String(showVacationsState));
  }

  // If turned off, clean up DOM and cache
  if (!showVacationsState) {
    document.querySelectorAll('.vacation-indicator').forEach((el) => {
      el.remove();
    });
    vacationsCache.clear();
  }

  return showVacationsState;
}

export const vacationIndicators = {
  get showVacations() {
    return showVacationsState;
  },
  fetchAndRenderVacations,
  toggle,
};
