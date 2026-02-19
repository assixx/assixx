<script lang="ts">
  /**
   * TPM Plan Table - Machine × Interval Matrix
   * @module lean-management/tpm/_lib/PlanTable
   *
   * Shows a visual matrix of machines and which intervals
   * are covered by their maintenance plans and cards.
   */
  import { resolve } from '$app/paths';

  import {
    INTERVAL_LABELS,
    MESSAGES,
  } from './constants';

  import type { TpmPlan, IntervalType } from './types';

  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
  }

  interface Props {
    plans: TpmPlan[];
  }

  const { plans }: Props = $props();

  /** Active plans only */
  const activePlans = $derived(
    plans.filter((p: TpmPlan) => p.isActive === 1),
  );

  /** Interval columns to display */
  const intervalColumns: IntervalType[] = [
    'daily',
    'weekly',
    'monthly',
    'quarterly',
    'semi_annual',
    'annual',
  ];

  /** Short labels for compact display */
  const shortLabels: Record<string, string> = {
    daily: 'T',
    weekly: 'W',
    monthly: 'M',
    quarterly: 'Q',
    semi_annual: 'H',
    annual: 'J',
  };
</script>

<div class="plan-table">
  <div class="plan-table__header">
    <h3 class="plan-table__title">
      <i class="fas fa-th"></i>
      {MESSAGES.PLAN_TABLE_TITLE}
    </h3>
  </div>

  {#if activePlans.length === 0}
    <div class="plan-table__empty">
      <p>{MESSAGES.PLAN_TABLE_EMPTY}</p>
    </div>
  {:else}
    <div class="table-responsive">
      <table class="matrix-table">
        <thead>
          <tr>
            <th class="matrix-table__machine-col">
              {MESSAGES.PLAN_TABLE_MACHINE_COL}
            </th>
            {#each intervalColumns as col (col)}
              <th
                class="matrix-table__interval-col"
                title={INTERVAL_LABELS[col]}
              >
                {shortLabels[col] ?? col}
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each activePlans as plan (plan.uuid)}
            <tr>
              <td class="matrix-table__machine-cell">
                <a
                  href={resolvePath(`/lean-management/tpm/plan/${plan.uuid}`)}
                  class="matrix-table__link"
                >
                  <i class="fas fa-cog"></i>
                  {plan.machineName ?? '—'}
                </a>
              </td>
              {#each intervalColumns as col (col)}
                <td class="matrix-table__cell">
                  <span
                    class="matrix-dot"
                    class:matrix-dot--active={true}
                    title="{INTERVAL_LABELS[col]}: aktiv"
                  ></span>
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .plan-table {
    background: var(--color-white, #fff);
    border-radius: var(--radius-lg, 12px);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  .plan-table__header {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--color-gray-200);
  }

  .plan-table__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-gray-800);
  }

  .plan-table__empty {
    padding: 2rem;
    text-align: center;
    color: var(--color-gray-500);
    font-size: 0.875rem;
  }

  .table-responsive {
    overflow-x: auto;
  }

  /* Matrix table */
  .matrix-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
  }

  .matrix-table th,
  .matrix-table td {
    padding: 0.75rem 0.5rem;
    text-align: center;
    border-bottom: 1px solid var(--color-gray-100);
  }

  .matrix-table thead th {
    font-weight: 600;
    color: var(--color-gray-600);
    background: var(--color-gray-50);
    font-size: 0.75rem;
    text-transform: uppercase;
  }

  .matrix-table__machine-col {
    text-align: left;
    min-width: 160px;
  }

  .matrix-table__interval-col {
    width: 48px;
  }

  .matrix-table__machine-cell {
    text-align: left;
  }

  .matrix-table__link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-gray-700);
    text-decoration: none;
    font-weight: 500;
    transition: color 0.15s;
  }

  .matrix-table__link:hover {
    color: var(--color-blue-600);
  }

  .matrix-table__cell {
    vertical-align: middle;
  }

  /* Matrix dot */
  .matrix-dot {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--color-gray-200);
  }

  .matrix-dot--active {
    background: var(--color-green-500, #10b981);
  }
</style>
