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
    ontoggleTpmEvents: (show: boolean) => void;
  }

  const { colorMap, showTpmEvents, ontoggleTpmEvents }: Props = $props();
</script>

<div class="machine-avail-legend">
  <span class="machine-avail-legend-title">
    <i class="fas fa-cogs"></i> Maschinenverfügbarkeit
  </span>
  <div class="machine-avail-legend-items">
    {#each LEGEND_STATUSES as status (status)}
      <div class="machine-avail-legend-item">
        <div class="machine-avail-legend-swatch legend-{status}"></div>
        <span class="machine-avail-legend-label"
          >{MACHINE_AVAILABILITY_LABELS[status]}</span
        >
      </div>
    {/each}

    <!-- TPM Toggle -->
    <label class="choice-card tpm-toggle">
      <input
        type="checkbox"
        class="choice-card__input"
        checked={showTpmEvents}
        onchange={(e: Event) => {
          ontoggleTpmEvents((e.target as HTMLInputElement).checked);
        }}
      />
      <span class="choice-card__text">&#9881; Wartungstermine</span>
    </label>

    <!-- TPM Interval Legend (visible when toggle active) -->
    {#if showTpmEvents}
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
    {/if}
  </div>
</div>

<style>
  .machine-avail-legend {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
    backdrop-filter: blur(10px);

    margin-bottom: var(--spacing-4);
    border: var(--glass-border);
    border-radius: var(--radius-xl);

    background: var(--glass-bg);
    padding: var(--spacing-3) var(--spacing-4);
  }

  .machine-avail-legend-title {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);

    color: var(--text-secondary);
    font-weight: 600;
    font-size: 13px;
    letter-spacing: 0.3px;
    text-transform: uppercase;
  }

  .machine-avail-legend-title i {
    color: var(--text-tertiary);
    font-size: 16px;
  }

  .machine-avail-legend-items {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--spacing-4);
  }

  .machine-avail-legend-item {
    display: flex;
    align-items: center;
    gap: 8px;

    font-size: 14px;
  }

  .machine-avail-legend-swatch {
    border-radius: 50%;
    width: 14px;
    height: 14px;

    box-shadow: 0 0 4px rgb(0 0 0 / 20%);
  }

  .machine-avail-legend-swatch.legend-maintenance {
    background: #ffc107;
  }

  .machine-avail-legend-swatch.legend-repair {
    background: #dc3545;
  }

  .machine-avail-legend-swatch.legend-standby {
    background: #3498db;
  }

  .machine-avail-legend-swatch.legend-cleaning {
    background: #20c997;
  }

  .machine-avail-legend-swatch.legend-other {
    background: #6f42c1;
  }

  .machine-avail-legend-label {
    color: var(--text-secondary);
    font-weight: 500;
  }

  /* TPM Toggle — compact sizing + separator from legend */
  .tpm-toggle {
    margin-left: var(--spacing-4);
    padding: 0.375rem 0.75rem;
    border-radius: var(--radius-md);
    border-left: 1px solid var(--color-glass-border);
  }

  /* TPM Legend dots (visible when toggle active) */
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
