<script lang="ts">
  /**
   * Gesamtansicht Grouped View Component
   * @module gesamtansicht/_lib/OverallViewGrouped
   *
   * Grouped layout: each machine is a block of 3 sub-rows
   * (schedule dates, time estimates, assigned employees)
   * with the machine name shown once via rowspan.
   */
  import { MESSAGES } from '../../_lib/constants';

  import {
    INTERVAL_COLUMNS,
    buildAssignmentLookup,
    buildDateIndex,
    formatDate,
    formatTimeRange,
    isFullDay,
  } from './overall-view-utils';

  import type { MatrixRow } from './overall-view-utils';
  import type {
    IntervalType,
    TpmShiftAssignment,
    TpmTimeEstimate,
  } from '../../_lib/types';

  interface Props {
    matrixRows: MatrixRow[];
    maxDates: number;
    estColSpans: number[];
    estimatesByPlan: Map<string, TpmTimeEstimate[]>;
    assignments: TpmShiftAssignment[];
  }

  const {
    matrixRows,
    maxDates,
    estColSpans,
    estimatesByPlan,
    assignments,
  }: Props = $props();

  // =========================================================================
  // ESTIMATE LOOKUP
  // =========================================================================

  function getEstimate(
    planUuid: string,
    intv: IntervalType,
  ): TpmTimeEstimate | undefined {
    const list = estimatesByPlan.get(planUuid);
    return list?.find((e: TpmTimeEstimate) => e.intervalType === intv);
  }

  // =========================================================================
  // ASSIGNMENT CROSS-REFERENCE
  // =========================================================================

  const dateIndex = $derived(buildDateIndex(matrixRows));
  const assignmentMap = $derived(buildAssignmentLookup(assignments, dateIndex));

  function getNames(planUuid: string, interval: IntervalType): string[] {
    return assignmentMap.get(planUuid)?.get(interval) ?? [];
  }
</script>

<tbody>
  {#each matrixRows as row, rowIdx (row.plan.uuid)}
    <!-- Row 1: Schedule dates -->
    <tr
      class="gvg-row"
      class:gvg-row--first={rowIdx === 0}
    >
      <td
        class="gvg-cell gvg-cell--machine"
        rowspan={3}
      >
        {row.plan.machineName ?? '\u2014'}
      </td>
      <td class="gvg-cell gvg-cell--label">
        {#if isFullDay(row.plan.baseTime)}
          <span
            class="gvg-full-day"
            title="Ganztägig"
          ></span>
        {:else}
          {formatTimeRange(row.plan.baseTime, row.plan.bufferHours)}
        {/if}
      </td>
      {#each INTERVAL_COLUMNS as col (col)}
        {#each { length: maxDates } as _, i (i)}
          <td class="gvg-cell gvg-cell--date">
            {#if i < row.cells[col].length}
              {formatDate(row.cells[col][i])}
            {/if}
          </td>
        {/each}
      {/each}
    </tr>

    <!-- Row 2: Time estimates -->
    <tr class="gvg-row gvg-row--estimate">
      <td class="gvg-cell gvg-cell--label gvg-cell--sub-label">
        {MESSAGES.TIME_HEADING}
      </td>
      {#each INTERVAL_COLUMNS as col (col)}
        {@const est = getEstimate(row.plan.uuid, col)}
        {#if est !== undefined && est.totalMinutes > 0}
          <td
            class="gvg-cell gvg-cell--est"
            colspan={estColSpans[0]}
            title={MESSAGES.GESAMTANSICHT_TH_STAFF}>{est.staffCount}</td
          >
          <td
            class="gvg-cell gvg-cell--est"
            colspan={estColSpans[1]}
            title={MESSAGES.GESAMTANSICHT_TH_PREP}>{est.preparationMinutes}</td
          >
          <td
            class="gvg-cell gvg-cell--est"
            colspan={estColSpans[2]}
            title={MESSAGES.GESAMTANSICHT_TH_EXEC}>{est.executionMinutes}</td
          >
          <td
            class="gvg-cell gvg-cell--est"
            colspan={estColSpans[3]}
            title={MESSAGES.GESAMTANSICHT_TH_FOLLOW}>{est.followupMinutes}</td
          >
        {:else}
          <td
            class="gvg-cell"
            colspan={estColSpans[0]}
          ></td>
          <td
            class="gvg-cell"
            colspan={estColSpans[1]}
          ></td>
          <td
            class="gvg-cell"
            colspan={estColSpans[2]}
          ></td>
          <td
            class="gvg-cell"
            colspan={estColSpans[3]}
          ></td>
        {/if}
      {/each}
    </tr>

    <!-- Row 3: Assigned employees -->
    <tr class="gvg-row gvg-row--assign">
      <td class="gvg-cell gvg-cell--label gvg-cell--sub-label">
        {MESSAGES.GESAMTANSICHT_LABEL_ASSIGNED}
      </td>
      {#each INTERVAL_COLUMNS as col (col)}
        {@const names = getNames(row.plan.uuid, col)}
        {#each { length: maxDates } as _, i (i)}
          <td class="gvg-cell gvg-cell--assign">
            {#if i === 0}
              {#if names.length > 0}
                <div class="gvg-assign-badges">
                  {#each names as name (name)}
                    <span class="badge badge--sm badge--info">{name}</span>
                  {/each}
                </div>
              {:else}
                <span class="gvg-assign-empty">&mdash;</span>
              {/if}
            {/if}
          </td>
        {/each}
      {/each}
    </tr>
  {/each}
</tbody>

<style>
  /* ---- Machine block separator ---- */
  .gvg-row--assign td {
    border-bottom: 3px solid var(--color-glass-border);
    padding-bottom: 1rem;
  }

  .gvg-row--first td {
    border-top: none;
    border-bottom: 3px solid var(--color-glass-border);
  }

  /* ---- Machine name (rowspan=3) ---- */
  .gvg-cell--machine {
    font-weight: 700;
    font-size: 0.85rem;
    color: var(--color-text-primary);
    position: sticky;
    left: 0;
    min-width: 8rem;
    background: var(--color-surface);
    z-index: 1;
    vertical-align: middle;
    border-bottom: 3px solid var(--color-glass-border);
    border-right: 1px solid var(--color-glass-border);
    padding: 0.375rem 0.5rem;
  }

  /* ---- Second column: time / labels ---- */
  .gvg-cell--label {
    position: sticky;
    left: 8rem;
    background: var(--color-surface);
    z-index: 1;
    white-space: nowrap;
    padding: 0.375rem 0.5rem;
    color: var(--color-text-secondary);
    font-size: 0.8rem;
    border-bottom: 1px solid var(--color-glass-border);
    border-right: 1px solid var(--color-glass-border);
    text-align: center;
  }

  .gvg-cell--sub-label {
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--color-text-muted);
    text-align: left;
  }

  /* ---- Data cells ---- */
  .gvg-cell {
    padding: 0.25rem 0.375rem;
    border-bottom: 1px solid var(--color-glass-border);
    border-right: 1px solid var(--color-glass-border);
    vertical-align: middle;
  }

  .gvg-cell--date {
    text-align: center;
    font-variant-numeric: tabular-nums;
    font-size: 0.8rem;
    white-space: nowrap;
  }

  .gvg-cell--est {
    text-align: center;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    font-size: 0.75rem;
  }

  .gvg-cell--assign {
    vertical-align: middle;
    text-align: center;
  }

  .gvg-assign-badges {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .gvg-assign-empty {
    color: var(--color-text-muted);
    font-size: 0.7rem;
  }

  .gvg-full-day {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #fff;
    border: 1px solid var(--color-glass-border);
  }
</style>
