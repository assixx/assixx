// =============================================================================
// CALENDAR - SHIFT INDICATORS MODULE
// DOM-based shift indicator rendering for the calendar grid
// =============================================================================

import { browser } from '$app/environment';

import { createLogger } from '$lib/utils/logger';

import { loadUserShifts } from './api';

const log = createLogger('ShiftIndicators');

// State
let showShiftsState = $state(
  browser ? localStorage.getItem('showShiftsInCalendar') === 'true' : false,
);
const shiftsCache = $state<Map<string, { type: 'F' | 'S' | 'N' }>>(new Map());

/**
 * Render shift indicators in calendar cells (Legacy approach)
 * EventCalendar uses: .ec-day > .ec-day-head > time[datetime="YYYY-MM-DD"]
 * Indicator goes INSIDE .ec-day-head, next to the day number
 */
function renderShiftIndicators(): void {
  // Remove existing indicators first
  document.querySelectorAll('.shift-indicator').forEach((el) => {
    el.remove();
  });

  if (!showShiftsState || shiftsCache.size === 0) return;

  // Find all day head containers (EventCalendar structure)
  const dayHeads = document.querySelectorAll('.ec-day .ec-day-head');

  let renderedCount = 0;
  dayHeads.forEach((dayHead) => {
    const timeEl = dayHead.querySelector('time[datetime]');
    if (!timeEl) return;

    const dateAttr = timeEl.getAttribute('datetime');
    if (dateAttr === null) return;

    const shift = shiftsCache.get(dateAttr);
    if (!shift) return;

    // Create shift indicator
    const indicator = document.createElement('div');
    indicator.className = `shift-indicator shift-${shift.type}`;
    indicator.textContent = shift.type;
    indicator.setAttribute(
      'aria-label',
      `Schicht: ${
        shift.type === 'F' ? 'Frühschicht'
        : shift.type === 'S' ? 'Spätschicht'
        : 'Nachtschicht'
      }`,
    );

    // Insert AFTER time - library uses row-reverse, so visually indicator appears LEFT
    dayHead.appendChild(indicator);
    renderedCount++;
  });

  log.debug({ renderedCount, cachedCount: shiftsCache.size }, 'Rendered shift indicators');
}

/**
 * Fetch and cache shifts, then render indicators
 */
async function fetchAndRenderShifts(startStr: string, endStr: string): Promise<void> {
  if (!showShiftsState) {
    shiftsCache.clear();
    return;
  }

  log.debug({ startStr, endStr }, 'Fetching shifts');
  const shifts = await loadUserShifts(startStr, endStr);

  // Build cache
  shiftsCache.clear();
  for (const shift of shifts) {
    // Extract date part (YYYY-MM-DD)
    const dateOnly = shift.date.split('T')[0] ?? '';
    shiftsCache.set(dateOnly, { type: shift.type });
  }

  log.debug({ size: shiftsCache.size }, 'Cached shifts');

  // Small delay to ensure DOM is rendered, then add indicators
  setTimeout(renderShiftIndicators, 100);
}

/**
 * Toggle shift visibility. Returns new state (true=active).
 * Caller should trigger refetchCalendarEvents() when result is true.
 */
function toggle(): boolean {
  showShiftsState = !showShiftsState;
  log.debug({ showShifts: showShiftsState }, 'Shifts toggle');

  // Persist to localStorage
  if (browser) {
    localStorage.setItem('showShiftsInCalendar', String(showShiftsState));
  }

  // If turned off, clean up DOM and cache
  if (!showShiftsState) {
    document.querySelectorAll('.shift-indicator').forEach((el) => {
      el.remove();
    });
    shiftsCache.clear();
  }

  return showShiftsState;
}

export const shiftIndicators = {
  get showShifts() {
    return showShiftsState;
  },
  fetchAndRenderShifts,
  toggle,
};
