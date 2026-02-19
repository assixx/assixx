<script lang="ts">
  import { resolve } from '$app/paths';

  import {
    INTERVAL_LABELS,
    WEEKDAY_LABELS,
    MESSAGES,
    DEFAULT_PAGE_SIZE,
  } from './constants';

  import type { TpmPlan, PlanStatusFilter } from './types';

  /** Resolve a path with base prefix (cast for dynamic runtime paths) */
  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
  }

  interface Props {
    plans: TpmPlan[];
    totalPlans: number;
    currentPage: number;
    statusFilter: PlanStatusFilter;
    searchQuery: string;
    loading: boolean;
    ondelete: (plan: TpmPlan) => void;
    onpagechange: (page: number) => void;
    onfilterchange: (filter: PlanStatusFilter) => void;
    onsearch: (query: string) => void;
  }

  const {
    plans,
    totalPlans,
    currentPage,
    statusFilter,
    searchQuery,
    loading,
    ondelete,
    onpagechange,
    onfilterchange,
    onsearch,
  }: Props = $props();

  const totalPages = $derived(
    Math.max(1, Math.ceil(totalPlans / DEFAULT_PAGE_SIZE)),
  );

  const filteredPlans = $derived(filterPlans(plans, statusFilter, searchQuery));

  function filterPlans(
    items: TpmPlan[],
    status: PlanStatusFilter,
    query: string,
  ): TpmPlan[] {
    let result = items;

    if (status === 'active') {
      result = result.filter((p: TpmPlan) => p.isActive === 1);
    } else if (status === 'archived') {
      result = result.filter((p: TpmPlan) => p.isActive === 3);
    }

    if (query.trim().length > 0) {
      const lower = query.toLowerCase();
      result = result.filter(
        (p: TpmPlan) =>
          p.name.toLowerCase().includes(lower) ||
          (p.machineName?.toLowerCase().includes(lower) ?? false),
      );
    }

    return result;
  }

  function handleSearchInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    onsearch(input.value);
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  function getStatusBadge(isActive: number): { label: string; cls: string } {
    if (isActive === 1) return { label: 'Aktiv', cls: 'badge--success' };
    if (isActive === 3) return { label: 'Archiviert', cls: 'badge--info' };
    return { label: 'Inaktiv', cls: 'badge--error' };
  }
</script>

<!-- Filter bar -->
<div class="plan-overview__controls">
  <div class="plan-overview__filters">
    <button
      type="button"
      class="btn btn--sm {statusFilter === 'all' ? 'btn--primary' : (
        'btn--ghost'
      )}"
      onclick={() => {
        onfilterchange('all');
      }}
    >
      {MESSAGES.FILTER_ALL}
    </button>
    <button
      type="button"
      class="btn btn--sm {statusFilter === 'active' ? 'btn--primary' : (
        'btn--ghost'
      )}"
      onclick={() => {
        onfilterchange('active');
      }}
    >
      {MESSAGES.FILTER_ACTIVE}
    </button>
    <button
      type="button"
      class="btn btn--sm {statusFilter === 'archived' ? 'btn--primary' : (
        'btn--ghost'
      )}"
      onclick={() => {
        onfilterchange('archived');
      }}
    >
      {MESSAGES.FILTER_ARCHIVED}
    </button>
  </div>

  <div class="plan-overview__search">
    <input
      type="text"
      class="input input--sm"
      placeholder={MESSAGES.SEARCH_PLACEHOLDER}
      value={searchQuery}
      oninput={handleSearchInput}
    />
  </div>
</div>

<!-- Plan table -->
{#if loading}
  <div class="plan-overview__loading">
    <i class="fas fa-spinner fa-spin"></i>
    {MESSAGES.LOADING}
  </div>
{:else if filteredPlans.length === 0}
  <div class="plan-overview__empty">
    <i class="fas fa-clipboard-list fa-3x"></i>
    <h3>{MESSAGES.EMPTY_TITLE}</h3>
    <p>
      {statusFilter === 'all' ?
        MESSAGES.EMPTY_DESCRIPTION
      : MESSAGES.EMPTY_FILTER_DESC}
    </p>
  </div>
{:else}
  <div class="table-responsive">
    <table class="table">
      <thead>
        <tr>
          <th>{MESSAGES.TH_MACHINE}</th>
          <th>{MESSAGES.TH_PLAN_NAME}</th>
          <th>{MESSAGES.TH_INTERVAL}</th>
          <th>{MESSAGES.TH_WEEKDAY}</th>
          <th>{MESSAGES.TH_STATUS}</th>
          <th>{MESSAGES.TH_CREATED}</th>
          <th>{MESSAGES.TH_ACTIONS}</th>
        </tr>
      </thead>
      <tbody>
        {#each filteredPlans as plan (plan.uuid)}
          {@const badge = getStatusBadge(plan.isActive)}
          <tr>
            <td class="plan-overview__cell--machine">
              <i class="fas fa-cog"></i>
              {plan.machineName ?? '—'}
            </td>
            <td>{plan.name}</td>
            <td>
              <span class="badge badge--info badge--sm">
                {INTERVAL_LABELS.weekly}
                {plan.baseRepeatEvery > 1 ?
                  `(alle ${plan.baseRepeatEvery})`
                : ''}
              </span>
            </td>
            <td>{WEEKDAY_LABELS[plan.baseWeekday] ?? '—'}</td>
            <td>
              <span class="badge {badge.cls} badge--sm">{badge.label}</span>
            </td>
            <td>{formatDate(plan.createdAt)}</td>
            <td class="plan-overview__actions">
              <a
                href={resolvePath(`/lean-management/tpm/plan/${plan.uuid}`)}
                class="btn btn--ghost btn--sm"
                title={MESSAGES.BTN_EDIT}
              >
                <i class="fas fa-edit"></i>
              </a>
              <button
                type="button"
                class="btn btn--ghost btn--sm btn--danger"
                title={MESSAGES.BTN_DELETE}
                onclick={() => {
                  ondelete(plan);
                }}
              >
                <i class="fas fa-trash"></i>
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <!-- Pagination -->
  {#if totalPages > 1}
    <div class="plan-overview__pagination">
      <button
        type="button"
        class="btn btn--ghost btn--sm"
        disabled={currentPage <= 1}
        onclick={() => {
          onpagechange(currentPage - 1);
        }}
        aria-label="Vorherige Seite"
      >
        <i class="fas fa-chevron-left"></i>
      </button>
      <span class="plan-overview__page-info">
        Seite {currentPage} von {totalPages}
      </span>
      <button
        type="button"
        class="btn btn--ghost btn--sm"
        disabled={currentPage >= totalPages}
        onclick={() => {
          onpagechange(currentPage + 1);
        }}
        aria-label="Nächste Seite"
      >
        <i class="fas fa-chevron-right"></i>
      </button>
    </div>
  {/if}
{/if}

<style>
  .plan-overview__controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .plan-overview__filters {
    display: flex;
    gap: 0.5rem;
  }

  .plan-overview__search {
    min-width: 200px;
  }

  .plan-overview__loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 3rem;
    color: var(--color-gray-500);
  }

  .plan-overview__empty {
    text-align: center;
    padding: 3rem;
    color: var(--color-gray-500);
  }

  .plan-overview__empty h3 {
    margin-top: 1rem;
    color: var(--color-gray-700);
  }

  .plan-overview__empty p {
    margin-top: 0.5rem;
  }

  .plan-overview__cell--machine {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 500;
  }

  .plan-overview__actions {
    display: flex;
    gap: 0.25rem;
  }

  .plan-overview__pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-gray-200);
  }

  .plan-overview__page-info {
    font-size: 0.875rem;
    color: var(--color-gray-600);
  }
</style>
