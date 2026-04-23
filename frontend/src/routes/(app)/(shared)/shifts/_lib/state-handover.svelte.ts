/**
 * Shift-handover page state (Plan §5.1).
 *
 * Extracted from `+page.svelte` so the main page's `<script>` block
 * stays under the 400-line Svelte/max-lines-per-block cap and the
 * 25-imports dependency cap. Colocates the entry-status map, modal
 * target, and the bulk-load helper so the page module only wires
 * callbacks.
 *
 * Uses `SvelteMap` (not `Map`) — `svelte/prefer-svelte-reactivity` rule:
 * a mutable `Map` inside `$state` fires change detection only on
 * reassignment, which would force the `refreshHandoverMap` helper to
 * rebuild the map wholesale just to trigger derived re-computation.
 * `SvelteMap` is reactive per-mutation and allows in-place updates if
 * ever needed later.
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §5.1
 * @see docs/infrastructure/adr/ADR-045-permission-visibility-design.md
 */
import { SvelteMap } from 'svelte/reactivity';

import { listEntries as listHandoverEntries, type ShiftHandoverEntry } from './api-shift-handover';

import type { HandoverButtonStatus, HandoverContext } from './shift-handover-types';

export interface HandoverStateOptions {
  getTeamId: () => number | null;
  getWeekRange: () => { from: string; to: string };
}

export function createHandoverState(options: HandoverStateOptions): {
  readonly entryMap: SvelteMap<string, ShiftHandoverEntry>;
  getModalTarget: () => HandoverContext | null;
  setModalTarget: (ctx: HandoverContext | null) => void;
  refresh: () => Promise<void>;
  getStatus: (dateKey: string, shiftKey: string) => HandoverButtonStatus;
  lookupEntryId: (dateKey: string, shiftKey: string) => string | null;
} {
  const entryMap = new SvelteMap<string, ShiftHandoverEntry>();
  let modalTarget: HandoverContext | null = $state(null);

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
      // Silent: buttons fall back to 'none' (grey). The modal's own error
      // handling surfaces any real failure when the user actually clicks.
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
    getModalTarget: () => modalTarget,
    setModalTarget: (ctx) => {
      modalTarget = ctx;
    },
    refresh,
    getStatus,
    lookupEntryId,
  };
}
