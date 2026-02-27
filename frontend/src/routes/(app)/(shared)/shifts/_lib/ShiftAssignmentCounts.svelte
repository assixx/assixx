<!--
  ShiftAssignmentCounts.svelte
  Compact display of per-employee shift assignment counts (week/month/year).
  Admin-only. Reactive to team selection and week navigation.
-->
<script lang="ts">
  import type { AssignmentCount } from './types';

  interface Props {
    counts: AssignmentCount[];
  }

  const { counts }: Props = $props();

  const hasData = $derived(counts.length > 0);
</script>

{#if hasData}
  <div class="counts-wrapper">
    <h4 class="counts-title">
      <i class="fas fa-chart-bar"></i>
      Schichtzuweisungen
    </h4>
    <div class="counts-table">
      <div class="counts-header">
        <span class="col-name">Mitarbeiter</span>
        <span
          class="col-num"
          title="Diese Woche">W</span
        >
        <span
          class="col-num"
          title="Dieser Monat">M</span
        >
        <span
          class="col-num"
          title="Dieses Jahr">J</span
        >
      </div>
      {#each counts as entry (entry.employeeId)}
        <div class="counts-row">
          <span class="col-name">{entry.lastName}, {entry.firstName}</span>
          <span
            class="col-num"
            class:highlight={entry.weekCount > 0}
          >
            {entry.weekCount}
          </span>
          <span
            class="col-num"
            class:highlight={entry.monthCount > 0}
          >
            {entry.monthCount}
          </span>
          <span
            class="col-num"
            class:highlight={entry.yearCount > 0}
          >
            {entry.yearCount}
          </span>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .counts-wrapper {
    border: var(--glass-border);
    border-radius: var(--radius-xl);
    background: var(--glass-bg);
    padding: var(--spacing-4) var(--spacing-5);
    margin-top: var(--spacing-4);
  }

  .counts-title {
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

  .counts-title i {
    font-size: 12px;
    opacity: 70%;
  }

  .counts-table {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .counts-header,
  .counts-row {
    display: grid;
    grid-template-columns: 1fr 36px 36px 36px;
    align-items: center;
    gap: var(--spacing-1);
  }

  .counts-header {
    padding-bottom: var(--spacing-2);
    border-bottom: 1px solid var(--color-glass-border);
    margin-bottom: var(--spacing-1);
  }

  .counts-header .col-num {
    color: var(--color-text-secondary);
    font-size: 11px;
    font-weight: 700;
    text-align: center;
    text-transform: uppercase;
  }

  .counts-header .col-name {
    color: var(--color-text-secondary);
    font-size: 11px;
    font-weight: 600;
  }

  .counts-row {
    padding: 3px 0;
    border-radius: var(--radius-sm);
  }

  .counts-row:hover {
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
</style>
