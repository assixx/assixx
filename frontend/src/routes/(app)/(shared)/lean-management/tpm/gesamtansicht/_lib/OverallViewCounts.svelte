<!--
  OverallViewCounts.svelte
  Per-employee TPM assignment counts by interval type.
  Standalone widget below the Gesamtansicht table.
-->
<script lang="ts">
  import { INTERVAL_LABELS } from '../../_lib/constants';

  import { INTERVAL_COLUMNS } from './overall-view-utils';

  import type { TpmAssignmentCount } from './overall-view-utils';
  import type { IntervalType } from '../../_lib/types';

  interface Props {
    counts: TpmAssignmentCount[];
  }

  const { counts }: Props = $props();

  const hasData = $derived(counts.length > 0);

  /** Short column headers for interval types */
  const SHORT_LABELS: Record<IntervalType, string> = {
    daily: 'T',
    weekly: 'W',
    monthly: 'M',
    quarterly: 'Q',
    semi_annual: 'H',
    annual: 'J',
    custom: 'B',
  };
</script>

{#if hasData}
  <div class="tpm-counts">
    <h4 class="tpm-counts__title">
      <i class="fas fa-chart-bar"></i>
      TPM-Zuweisungen
    </h4>
    <div class="tpm-counts__grid">
      <div class="tpm-counts__header">
        <span class="col-name">Mitarbeiter</span>
        {#each INTERVAL_COLUMNS as col (col)}
          <span
            class="col-num"
            title={INTERVAL_LABELS[col]}
          >
            {SHORT_LABELS[col]}
          </span>
        {/each}
        <span
          class="col-num col-total"
          title="Gesamt"
        >
          &Sigma;
        </span>
      </div>
      {#each counts as entry (entry.userId)}
        <div class="tpm-counts__row">
          <span class="col-name">{entry.lastName}, {entry.firstName}</span>
          {#each INTERVAL_COLUMNS as col (col)}
            {@const val = entry.counts[col] ?? 0}
            <span
              class="col-num"
              class:highlight={val > 0}
            >
              {val}
            </span>
          {/each}
          <span
            class="col-num col-total"
            class:highlight={entry.total > 0}
          >
            {entry.total}
          </span>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .tpm-counts {
    border: var(--glass-border);
    border-radius: var(--radius-xl);
    background: var(--glass-bg);
    padding: var(--spacing-4) var(--spacing-5);
    margin-top: var(--spacing-4);
    max-width: 480px;
  }

  .tpm-counts__title {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-3);
    color: var(--color-text-secondary);
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .tpm-counts__title i {
    font-size: 12px;
    opacity: 70%;
  }

  .tpm-counts__grid {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .tpm-counts__header,
  .tpm-counts__row {
    display: grid;
    grid-template-columns: 1fr repeat(5, 32px) 36px;
    align-items: center;
    gap: var(--spacing-1);
  }

  .tpm-counts__header {
    padding-bottom: var(--spacing-2);
    border-bottom: 1px solid var(--color-glass-border);
    margin-bottom: var(--spacing-1);
  }

  .tpm-counts__header .col-num {
    color: var(--color-text-secondary);
    font-size: 11px;
    font-weight: 700;
    text-align: center;
    text-transform: uppercase;
  }

  .tpm-counts__header .col-name {
    color: var(--color-text-secondary);
    font-size: 11px;
    font-weight: 600;
  }

  .tpm-counts__row {
    padding: 3px 0;
    border-radius: var(--radius-sm);
  }

  .tpm-counts__row:hover {
    background: var(--glass-bg-active);
  }

  .col-name {
    color: var(--color-text-primary);
    font-size: 13px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .col-num {
    color: var(--color-text-secondary);
    font-size: 13px;
    font-weight: 600;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .col-num.highlight {
    color: var(--color-text-primary);
  }

  .col-total {
    border-left: 1px solid var(--color-glass-border);
  }
</style>
