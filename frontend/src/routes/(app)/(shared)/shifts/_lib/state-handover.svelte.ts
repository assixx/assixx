/**
 * Shift-handover page state (Plan §5.1 + Session 15 modal → page).
 *
 * After Session 15 replaced the in-grid modal with a dedicated
 * `/shift-handover/[uuid]` page, this helper only caches the button
 * status map (colour + href) for the visible week. The prior
 * `modalTarget` state was removed — the page handler navigates directly.
 *
 * Uses `SvelteMap` (not `Map`) — `svelte/prefer-svelte-reactivity` rule:
 * a mutable `Map` inside `$state` fires change detection only on
 * reassignment, which would force the `refresh` helper to rebuild the
 * map wholesale just to trigger derived re-computation.
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §5.1 + Session 15
 * @see docs/infrastructure/adr/ADR-045-permission-visibility-design.md
 * @see docs/infrastructure/adr/ADR-052-shift-handover-protocol.md
 */
import { SvelteMap } from 'svelte/reactivity';

import { listEntries as listHandoverEntries, type ShiftHandoverEntry } from './api-shift-handover';

import type { HandoverButtonStatus } from './shift-handover-types';

export interface HandoverStateOptions {
  getTeamId: () => number | null;
  getWeekRange: () => { from: string; to: string };
}

export function createHandoverState(options: HandoverStateOptions): {
  readonly entryMap: SvelteMap<string, ShiftHandoverEntry>;
  refresh: () => Promise<void>;
  getStatus: (dateKey: string, shiftKey: string) => HandoverButtonStatus;
  lookupEntryId: (dateKey: string, shiftKey: string) => string | null;
} {
  const entryMap = new SvelteMap<string, ShiftHandoverEntry>();

  /** Bulk-load entries for (current team × current week). */
  async function refresh(): Promise<void> {
    const teamId = options.getTeamId();
    if (teamId === null) {
      entryMap.clear();
      return;
    }
    const range = options.getWeekRange();
    try {
      const result = await listHandoverEntries({
        teamId,
        dateFrom: range.from,
        dateTo: range.to,
        limit: 100,
      });
      entryMap.clear();
      for (const item of result.items) {
        // Backend returns ISO timestamp — slice to YYYY-MM-DD to match grid keys.
        const dateKey = item.shift_date.slice(0, 10);
        const slot: string = item.shift_key;
        entryMap.set(`${dateKey}__${slot}`, item);
      }
    } catch {
      // Silent: buttons fall back to 'none' (grey). The detail page's
      // SSR loader surfaces any real failure when the user navigates in.
      entryMap.clear();
    }
  }

  function getStatus(dateKey: string, shiftKey: string): HandoverButtonStatus {
    const entry = entryMap.get(`${dateKey}__${shiftKey}`);
    if (entry === undefined) return 'none';
    if (entry.status === 'submitted') return 'submitted';
    return 'draft';
  }

  function lookupEntryId(dateKey: string, shiftKey: string): string | null {
    return entryMap.get(`${dateKey}__${shiftKey}`)?.id ?? null;
  }

  return {
    entryMap,
    refresh,
    getStatus,
    lookupEntryId,
  };
}
