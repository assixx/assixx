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
    formatTime,
  } from './overall-view-utils';

  import type { MatrixRow } from './overall-view-utils';

  interface Props {
    row: MatrixRow;
    maxDates: number;
  }

  const { row, maxDates }: Props = $props();
</script>

<tr>
  <td class="gv-cell gv-cell--machine">
    {row.plan.machineName ?? '—'}
  </td>
  <td class="gv-cell gv-cell--time">
    {formatTime(row.plan.baseTime)}
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

  .gv-cell--machine {
    font-weight: 600;
    font-size: 0.85rem;
    color: var(--color-text-primary);
    position: sticky;
    left: 0;
    min-width: 8rem;
    background: var(--color-gray-900, #1a1a2e);
    z-index: 1;
  }

  .gv-cell--time {
    color: var(--color-text-secondary);
    text-align: center;
    position: sticky;
    left: 8rem;
    background: var(--color-gray-900, #1a1a2e);
    z-index: 1;
  }

  .gv-cell--date {
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
</style>
