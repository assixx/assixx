<script lang="ts">
  /**
   * TPM Plan Table - Machine x Interval Matrix
   * @module lean-management/tpm/_lib/PlanTable
   *
   * Shows a visual matrix of machines and which intervals
   * are covered by their maintenance plans and cards.
   */
  import { resolve } from '$app/paths';

  import { INTERVAL_LABELS, MESSAGES } from './constants';

  import type { TpmPlan, IntervalType } from './types';

  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
  }

  interface Props {
    plans: TpmPlan[];
  }

  const { plans }: Props = $props();

  /** Active plans only */
  const activePlans = $derived(plans.filter((p: TpmPlan) => p.isActive === 1));

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

<div class="card">
  <div class="card__header">
    <h2 class="card__title">
      <i class="fas fa-th mr-2"></i>
      {MESSAGES.PLAN_TABLE_TITLE}
    </h2>
  </div>
  <div class="card__body">
    {#if activePlans.length === 0}
      <div class="empty-state">
        <div class="empty-state__icon">
          <i class="fas fa-th"></i>
        </div>
        <h3 class="empty-state__title">{MESSAGES.PLAN_TABLE_EMPTY}</h3>
      </div>
    {:else}
      <div class="table-responsive">
        <table class="data-table data-table--hover">
          <thead>
            <tr>
              <th
                scope="col"
                class="text-left"
              >
                {MESSAGES.PLAN_TABLE_MACHINE_COL}
              </th>
              {#each intervalColumns as col (col)}
                <th
                  scope="col"
                  class="text-center"
                  title={INTERVAL_LABELS[col]}
                  style="width: 48px"
                >
                  {shortLabels[col] ?? col}
                </th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each activePlans as plan (plan.uuid)}
              <tr>
                <td>
                  <a
                    href={resolvePath(`/lean-management/tpm/plan/${plan.uuid}`)}
                    class="inline-flex items-center gap-2 font-medium text-(--color-text-primary) no-underline hover:text-(--color-primary)"
                  >
                    <i class="fas fa-cog"></i>
                    {plan.machineName ?? '—'}
                  </a>
                </td>
                {#each intervalColumns as col (col)}
                  <td class="text-center align-middle">
                    <span
                      class="matrix-dot matrix-dot--active"
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
</div>

<style>
  .matrix-dot {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--glass-bg-active);
  }

  .matrix-dot--active {
    background: var(--color-success);
  }
</style>
