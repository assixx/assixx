<script lang="ts">
  /**
   * Gesamtansicht Assignments Section
   * @module gesamtansicht/_lib/OverallViewAssignments
   *
   * Shows which employees are assigned to TPM maintenance shifts.
   * One row per machine, one cell per interval with employee names.
   *
   * The backend returns shift assignments WITHOUT interval_type — it only
   * knows "employee X works on date Y for machine Z". This component
   * cross-references those dates against the projected schedule (matrixRows)
   * to determine which interval each employee covers.
   */
  import { MESSAGES } from '../../_lib/constants';

  import {
    INTERVAL_COLUMNS,
    buildDateIndex,
    buildAssignmentLookup,
  } from './overall-view-utils';

  import type { MatrixRow } from './overall-view-utils';
  import type { TpmShiftAssignment, IntervalType } from '../../_lib/types';

  interface Props {
    matrixRows: MatrixRow[];
    assignments: TpmShiftAssignment[];
    maxDates: number;
  }

  const { matrixRows, assignments, maxDates }: Props = $props();

  const dateIndex = $derived(buildDateIndex(matrixRows));
  const assignmentMap = $derived(buildAssignmentLookup(assignments, dateIndex));

  function getNames(planUuid: string, interval: IntervalType): string[] {
    return assignmentMap.get(planUuid)?.get(interval) ?? [];
  }
</script>

<tbody class="gv-assign-body">
  <!-- Sub-header -->
  <tr class="gv-assign-header">
    <th
      class="gv-th gv-th--sticky"
      colspan={2}
    >
      {MESSAGES.GESAMTANSICHT_TH_ASSIGNMENTS}
    </th>
    {#each INTERVAL_COLUMNS as _ (_)}
      {#each { length: maxDates } as __, i (i)}
        <th class="gv-th gv-th--sub"></th>
      {/each}
    {/each}
  </tr>

  <!-- Data rows -->
  {#each matrixRows as row (row.plan.uuid)}
    <tr>
      <td
        class="gv-assign-cell gv-assign-cell--machine"
        colspan={2}
      >
        {row.plan.machineName ?? '—'}
      </td>
      {#each INTERVAL_COLUMNS as col (col)}
        {@const names = getNames(row.plan.uuid, col)}
        {#each { length: maxDates } as _, i (i)}
          <td class="gv-assign-cell">
            {#if i === 0}
              {#if names.length > 0}
                {#each names as name (name)}
                  <span class="gv-assign-name">{name}</span>
                {/each}
              {:else}
                <span class="gv-assign-empty">—</span>
              {/if}
            {/if}
          </td>
        {/each}
      {/each}
    </tr>
  {/each}
</tbody>

<style>
  .gv-assign-body {
    border-top: 3px solid var(--color-glass-border);
  }

  .gv-assign-body tr:last-child td {
    padding-bottom: 1rem;
  }

  .gv-assign-header {
    background: var(--glass-bg-hover);
  }

  .gv-assign-header .gv-th--sticky {
    background: var(--glass-bg-hover);
  }

  .gv-assign-cell {
    padding: 0.25rem 0.375rem;
    border-bottom: 1px solid var(--color-glass-border);
    border-right: 1px solid var(--color-glass-border);
    vertical-align: top;
  }

  .gv-assign-cell--machine {
    font-weight: 600;
    font-size: 0.85rem;
    position: sticky;
    left: 0;
    background: var(--color-surface);
    color: var(--color-text-primary);
    z-index: 1;
  }

  .gv-assign-name {
    display: block;
    white-space: nowrap;
    font-weight: 500;
    font-size: 0.85rem;
    line-height: 1.4;
  }

  .gv-assign-empty {
    color: var(--color-text-muted);
  }
</style>
