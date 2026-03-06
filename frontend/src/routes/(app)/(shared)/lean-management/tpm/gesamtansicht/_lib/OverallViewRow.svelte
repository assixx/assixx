<script lang="ts">
  /**
   * Gesamtansicht Row Component
   * @module gesamtansicht/_lib/GesamtansichtRow
   *
   * One schedule row: Anlage | Uhrzeit | date cells per interval.
   * Each date in its own <td>, padded to maxDates.
   */
  import {
    INTERVAL_COLUMNS,
    formatDate,
    formatTimeRange,
    isFullDay,
  } from './overall-view-utils';

  import type { MatrixRow } from './overall-view-utils';

  interface Props {
    row: MatrixRow;
    maxDates: number;
  }

  const { row, maxDates }: Props = $props();
</script>

<tr>
  <td class="gv-cell gv-cell--asset">
    {row.plan.assetName ?? '—'}
  </td>
  <td class="gv-cell gv-cell--time">
    {#if isFullDay(row.plan.baseTime)}
      <span
        class="gv-full-day"
        title="Ganztägig"
      ></span>
    {:else}
      {formatTimeRange(row.plan.baseTime, row.plan.bufferHours)}
    {/if}
  </td>
  {#each INTERVAL_COLUMNS as col (col)}
    {@const dates = row.cells[col]}
    {#each { length: maxDates } as _, i (i)}
      <td class="gv-cell gv-cell--date">
        {#if i < dates.length}
          {formatDate(dates[i])}
        {/if}
      </td>
    {/each}
  {/each}
</tr>

<style>
  .gv-cell {
    padding: 0.375rem 0.5rem;
    font-size: 0.8rem;
    white-space: nowrap;
    vertical-align: middle;
    border-bottom: 1px solid var(--color-glass-border);
    border-right: 1px solid var(--color-glass-border);
  }

  .gv-cell--asset {
    font-weight: 600;
    font-size: 0.85rem;
    color: var(--color-text-primary);
    position: sticky;
    left: 0;
    min-width: 8rem;
    background: var(--color-surface);
    z-index: 1;
  }

  .gv-cell--time {
    color: var(--color-text-secondary);
    text-align: center;
    position: sticky;
    left: 8rem;
    background: var(--color-surface);
    z-index: 1;
  }

  .gv-cell--date {
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .gv-full-day {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #fff;
    border: 1px solid var(--color-glass-border);
  }
</style>
