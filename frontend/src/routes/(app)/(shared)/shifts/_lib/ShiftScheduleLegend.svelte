<!--
  ShiftScheduleLegend.svelte
  Legend bar for machine availability statuses and TPM maintenance interval badges.
  Extracted from ShiftScheduleGrid.svelte for maintainability.
-->
<script lang="ts">
  import {
    MACHINE_AVAILABILITY_LABELS,
    type MachineAvailabilityStatus,
  } from '$lib/machine-availability/constants';

  import { INTERVAL_LABELS, type TpmIntervalType } from './constants';

  /** Machine availability statuses shown in the legend */
  const LEGEND_STATUSES: MachineAvailabilityStatus[] = [
    'maintenance',
    'repair',
    'standby',
    'cleaning',
    'other',
  ];

  /** Interval keys for legend iteration (type-safe) */
  const TPM_LEGEND_KEYS = Object.keys(INTERVAL_LABELS) as TpmIntervalType[];

  interface Props {
    colorMap: Record<string, string>;
    showTpmEvents: boolean;
  }

  const { colorMap, showTpmEvents }: Props = $props();
</script>

<div class="legend-bar">
  <!-- Row 1: Maschinenverfügbarkeit -->
  <div class="legend-row">
    <span class="legend-row__title">
      <i class="fas fa-cogs"></i> Maschinenverfügbarkeit
    </span>
    {#each LEGEND_STATUSES as status (status)}
      <div class="legend-item">
        <div class="legend-swatch legend-{status}"></div>
        <span class="legend-label"
          >{MACHINE_AVAILABILITY_LABELS[status]}</span
        >
      </div>
    {/each}
  </div>

  <!-- Row 2: TPM Intervall-Legende (nur sichtbar wenn TPM-Modus aktiv) -->
  {#if showTpmEvents}
    <div class="legend-row">
      <span class="legend-row__title">
        <i class="fas fa-wrench"></i> TPM-Intervalle
      </span>
      {#each TPM_LEGEND_KEYS as key (key)}
        <span
          class="tpm-legend-item"
          title={INTERVAL_LABELS[key]}
        >
          <span
            class="tpm-legend-dot"
            style="background: {colorMap[key]}"
          ></span>
          {INTERVAL_LABELS[key]}
        </span>
      {/each}
    </div>
  {/if}
</div>

<style>
  .legend-bar {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
    backdrop-filter: blur(10px);

    margin-bottom: var(--spacing-4);
    border: var(--glass-border);
    border-radius: var(--radius-xl);

    background: var(--glass-bg);
    padding: var(--spacing-3) var(--spacing-4);
  }

  .legend-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--spacing-4);
  }

  .legend-row + .legend-row {
    border-top: 1px solid var(--color-glass-border);
    padding-top: var(--spacing-3);
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

    box-shadow: 0 0 4px rgb(0 0 0 / 20%);
  }

  .legend-swatch.legend-maintenance {
    background: #ffc107;
  }

  .legend-swatch.legend-repair {
    background: #dc3545;
  }

  .legend-swatch.legend-standby {
    background: #3498db;
  }

  .legend-swatch.legend-cleaning {
    background: #20c997;
  }

  .legend-swatch.legend-other {
    background: #6f42c1;
  }

  .legend-label {
    color: var(--text-secondary);
    font-weight: 500;
  }

  .tpm-legend-item {
    display: flex;
    align-items: center;
    gap: 4px;

    color: var(--color-text-secondary);
    font-weight: 500;
    font-size: 12px;
  }

  .tpm-legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }
</style>
