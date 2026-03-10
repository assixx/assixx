<script lang="ts">
  /**
   * TPM Timeline Day View
   * @module plan/[uuid]/_lib/TimelineDayView
   *
   * Horizontal timeline (06:00–22:00) for a single day.
   * Shows positioned TPM plan blocks and free time gaps.
   * Hidden on mobile via `hidden md:block` on container.
   */
  import { INTERVAL_LABELS, MESSAGES } from '../../../_lib/constants';

  import type { ProjectedSlot, IntervalType } from '../../../_lib/types';

  interface Props {
    date: string;
    slots: ProjectedSlot[];
    onclose: () => void;
  }

  const { date, slots, onclose }: Props = $props();

  // =========================================================================
  // CONSTANTS
  // =========================================================================

  const START_HOUR = 6;
  const END_HOUR = 22;
  const TOTAL_MIN = (END_HOUR - START_HOUR) * 60;
  const HOUR_MARKERS = [6, 8, 10, 12, 14, 16, 18, 20, 22];
  const PALETTE = [
    '#3b82f6',
    '#8b5cf6',
    '#f59e0b',
    '#ec4899',
    '#06b6d4',
    '#84cc16',
  ];

  // =========================================================================
  // DERIVED
  // =========================================================================

  const formattedDate = $derived(
    new Date(date).toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
  );

  // =========================================================================
  // HELPERS
  // =========================================================================

  function parseTime(time: string): number {
    const parts = time.split(':');
    return Number(parts[0]) * 60 + Number(parts[1]);
  }

  function fmtMin(totalMin: number): string {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function hourPct(hour: number): number {
    return ((hour - START_HOUR) / (END_HOUR - START_HOUR)) * 100;
  }

  function toPct(minutes: number): number {
    return (Math.max(minutes - START_HOUR * 60, 0) / TOTAL_MIN) * 100;
  }

  function spanPct(startMin: number, endMin: number): number {
    const s = Math.max(startMin - START_HOUR * 60, 0);
    const e = Math.min(endMin - START_HOUR * 60, TOTAL_MIN);
    return (Math.max(e - s, 15) / TOTAL_MIN) * 100;
  }

  function intervalLabel(types: IntervalType[]): string {
    return types.map((t: IntervalType) => INTERVAL_LABELS[t]).join(', ');
  }

  function blockColor(index: number): string {
    return PALETTE[index % PALETTE.length];
  }

  // =========================================================================
  // COMPUTED: PLAN BLOCKS
  // =========================================================================

  interface Block {
    slot: ProjectedSlot;
    leftPct: number;
    widthPct: number;
    timeLabel: string;
  }

  const blocks = $derived.by((): Block[] =>
    slots.map((slot: ProjectedSlot): Block => {
      if (slot.isFullDay || slot.startTime === null || slot.endTime === null) {
        return {
          slot,
          leftPct: 0,
          widthPct: 100,
          timeLabel: MESSAGES.TIMELINE_FULL_DAY,
        };
      }
      const s = parseTime(slot.startTime);
      const e = parseTime(slot.endTime);
      return {
        slot,
        leftPct: toPct(s),
        widthPct: spanPct(s, e),
        timeLabel: `${slot.startTime} – ${slot.endTime}`,
      };
    }),
  );

  // =========================================================================
  // COMPUTED: FREE GAPS
  // =========================================================================

  interface Gap {
    leftPct: number;
    widthPct: number;
    label: string;
  }

  /** Merge overlapping minute-offset ranges into non-overlapping set */
  function mergeRanges(
    ranges: { start: number; end: number }[],
  ): { start: number; end: number }[] {
    if (ranges.length === 0) return [];
    const sorted = [...ranges].sort((a, b) => a.start - b.start);
    const [first, ...rest] = sorted;
    const result: { start: number; end: number }[] = [
      { start: first.start, end: first.end },
    ];
    let last = result[0];
    for (const current of rest) {
      if (current.start <= last.end) {
        last.end = Math.max(last.end, current.end);
      } else {
        const entry = { start: current.start, end: current.end };
        result.push(entry);
        last = entry;
      }
    }
    return result;
  }

  const freeGaps = $derived.by((): Gap[] => {
    if (slots.some((s: ProjectedSlot) => s.isFullDay)) return [];

    if (slots.length === 0) {
      return [
        {
          leftPct: 0,
          widthPct: 100,
          label: `${fmtMin(START_HOUR * 60)} – ${fmtMin(END_HOUR * 60)}`,
        },
      ];
    }

    const occupied: { start: number; end: number }[] = [];
    for (const s of slots) {
      if (s.startTime !== null && s.endTime !== null && !s.isFullDay) {
        occupied.push({
          start: Math.max(parseTime(s.startTime) - START_HOUR * 60, 0),
          end: Math.min(parseTime(s.endTime) - START_HOUR * 60, TOTAL_MIN),
        });
      }
    }

    const merged = mergeRanges(occupied);
    const gaps: Gap[] = [];
    let cursor = 0;

    for (const r of merged) {
      if (r.start > cursor) {
        gaps.push({
          leftPct: (cursor / TOTAL_MIN) * 100,
          widthPct: ((r.start - cursor) / TOTAL_MIN) * 100,
          label: `${fmtMin(cursor + START_HOUR * 60)} – ${fmtMin(r.start + START_HOUR * 60)}`,
        });
      }
      cursor = Math.max(cursor, r.end);
    }

    if (cursor < TOTAL_MIN) {
      gaps.push({
        leftPct: (cursor / TOTAL_MIN) * 100,
        widthPct: ((TOTAL_MIN - cursor) / TOTAL_MIN) * 100,
        label: `${fmtMin(cursor + START_HOUR * 60)} – ${fmtMin(END_HOUR * 60)}`,
      });
    }

    return gaps;
  });
</script>

<!-- Hidden on mobile: "Mobile: vereinfachte Ansicht, kein Timeline" -->
<div class="tl hidden md:block">
  <!-- Header -->
  <div class="tl-header">
    <div class="flex items-center gap-2">
      <i class="fas fa-clock text-(--color-info, #3b82f6)"></i>
      <h3 class="text-sm font-semibold">
        {MESSAGES.TIMELINE_TITLE}: {formattedDate}
      </h3>
    </div>
    <button
      class="tl-close"
      type="button"
      onclick={onclose}
    >
      <i class="fas fa-times"></i>
      <span>{MESSAGES.TIMELINE_CLOSE}</span>
    </button>
  </div>

  <!-- Hour axis -->
  <div class="tl-axis">
    {#each HOUR_MARKERS as hour (hour)}
      <span
        class="tl-axis__label"
        style="left: {hourPct(hour)}%"
      >
        {String(hour).padStart(2, '0')}
      </span>
    {/each}
  </div>

  <!-- Tracks container (gridlines span all tracks) -->
  <div class="tl-tracks">
    {#each HOUR_MARKERS as hour (hour)}
      <div
        class="tl-gridline"
        style="left: {hourPct(hour)}%"
      ></div>
    {/each}

    {#if blocks.length > 0}
      {#each blocks as block, i (block.slot.planUuid + '-' + String(i))}
        <div class="tl-track">
          <div
            class="tl-block"
            style="left: {block.leftPct}%; width: {block.widthPct}%; background: {blockColor(
              i,
            )}"
            title="{block.slot.planName} ({block.slot
              .assetName}) — {intervalLabel(
              block.slot.intervalTypes,
            )} — {block.timeLabel}"
          >
            <span class="tl-block__name">
              {block.slot.planName} ({block.slot.assetName})
            </span>
            <span class="tl-block__detail">
              {intervalLabel(block.slot.intervalTypes)} &middot; {block.timeLabel}
            </span>
          </div>
        </div>
      {/each}
    {:else}
      <div class="tl-empty">
        {MESSAGES.TIMELINE_NO_DATA}
      </div>
    {/if}

    <!-- Free gaps row -->
    {#if freeGaps.length > 0}
      <div class="tl-track tl-track--free">
        {#each freeGaps as gap, i (i)}
          <div
            class="tl-gap"
            style="left: {gap.leftPct}%; width: {gap.widthPct}%"
            title="{MESSAGES.TIMELINE_FREE}: {gap.label}"
          >
            <span class="tl-gap__label">{MESSAGES.TIMELINE_FREE}</span>
            <span class="tl-gap__time">{gap.label}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .tl {
    margin-top: 1rem;
    padding: 0.75rem;
    border-radius: var(--radius-md, 0.5rem);
    background: var(--color-surface-secondary, #f9fafb);
    border: 1px solid var(--color-border, #e5e7eb);
  }

  .tl-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .tl-close {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-sm, 0.25rem);
    border: 1px solid var(--color-border, #e5e7eb);
    background: var(--color-surface, #fff);
    font-size: 0.75rem;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: background 0.15s;
  }

  .tl-close:hover {
    background: var(--color-surface-hover, #f3f4f6);
  }

  /* Hour axis */

  .tl-axis {
    position: relative;
    height: 18px;
    margin-bottom: 4px;
  }

  .tl-axis__label {
    position: absolute;
    transform: translateX(-50%);
    font-size: 0.625rem;
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }

  /* Tracks container */

  .tl-tracks {
    position: relative;
  }

  .tl-gridline {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--color-border, #e5e7eb);
    opacity: 30%;
    z-index: 0;
    pointer-events: none;
  }

  .tl-track {
    position: relative;
    height: 42px;
    margin-bottom: 3px;
    z-index: 1;
  }

  .tl-track--free {
    height: 34px;
    margin-top: 2px;
  }

  .tl-empty {
    padding: 0.75rem;
    text-align: center;
    font-size: 0.75rem;
    color: var(--color-text-muted);
    z-index: 1;
    position: relative;
  }

  /* Plan blocks */

  .tl-block {
    position: absolute;
    top: 2px;
    bottom: 2px;
    border-radius: var(--radius-sm, 0.25rem);
    padding: 2px 8px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    overflow: hidden;
    color: var(--color-white);
    cursor: default;
    box-shadow: 0 1px 2px
      color-mix(in oklch, var(--color-black) 10%, transparent);
  }

  .tl-block__name {
    font-size: 0.688rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }

  .tl-block__detail {
    font-size: 0.563rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 85%;
    line-height: 1.3;
  }

  /* Free gaps */

  .tl-gap {
    position: absolute;
    top: 2px;
    bottom: 2px;
    border-radius: var(--radius-sm, 0.25rem);
    background: color-mix(in srgb, var(--color-success) 12%, transparent);
    border: 1px dashed color-mix(in srgb, var(--color-success) 35%, transparent);
    padding: 2px 8px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    overflow: hidden;
    cursor: default;
  }

  .tl-gap__label {
    font-size: 0.688rem;
    font-weight: 600;
    color: var(--color-success);
    white-space: nowrap;
    line-height: 1.3;
  }

  .tl-gap__time {
    font-size: 0.563rem;
    color: var(--color-success);
    opacity: 80%;
    white-space: nowrap;
    line-height: 1.3;
  }
</style>
