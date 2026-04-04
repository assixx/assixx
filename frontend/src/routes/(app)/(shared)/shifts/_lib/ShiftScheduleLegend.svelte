<!--
  ShiftScheduleLegend.svelte
  Legend bar for asset availability statuses.
  Extracted from ShiftScheduleGrid.svelte for maintainability.
-->
<script lang="ts">
  import {
    MACHINE_AVAILABILITY_LABELS,
    type AssetAvailabilityStatus,
  } from '$lib/asset-availability/constants';

  import type { HierarchyLabels } from '$lib/types/hierarchy-labels';

  interface Props {
    /** Dynamic hierarchy labels from layout */
    labels: HierarchyLabels;
  }

  const { labels }: Props = $props();

  /** Asset availability statuses shown in the legend */
  const LEGEND_STATUSES: AssetAvailabilityStatus[] = [
    'maintenance',
    'repair',
    'standby',
    'cleaning',
    'other',
  ];
</script>

<div class="legend-bar">
  <!-- Row 1: Asset availability -->
  <div class="legend-row">
    <span class="legend-row__title">
      <i class="fas fa-cogs"></i> Verfügbarkeit {labels.asset}
    </span>
    {#each LEGEND_STATUSES as status (status)}
      <div class="legend-item">
        <div class="legend-swatch legend-{status}"></div>
        <span class="legend-label">{MACHINE_AVAILABILITY_LABELS[status]}</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .legend-bar {
    padding: var(--spacing-3) var(--spacing-4);
  }

  .legend-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--spacing-4);
  }

  .legend-row__title {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);

    color: var(--text-secondary);
    font-weight: 600;
    font-size: 13px;
    letter-spacing: 0.3px;
    text-transform: uppercase;
  }

  .legend-row__title i {
    color: var(--text-tertiary);
    font-size: 16px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;

    font-size: 14px;
  }

  .legend-swatch {
    border-radius: 50%;
    width: 14px;
    height: 14px;

    box-shadow: 0 0 4px color-mix(in oklch, var(--color-black) 20%, transparent);
  }

  .legend-swatch.legend-maintenance {
    background: var(--color-amber);
  }

  .legend-swatch.legend-repair {
    background: var(--color-crimson);
  }

  .legend-swatch.legend-standby {
    background: var(--color-sky);
  }

  .legend-swatch.legend-cleaning {
    background: var(--color-seafoam);
  }

  .legend-swatch.legend-other {
    background: var(--color-violet);
  }

  .legend-label {
    color: var(--text-secondary);
    font-weight: 500;
  }
</style>
