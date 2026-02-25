<script lang="ts">
  import { SvelteMap } from 'svelte/reactivity';

  import { resolve } from '$app/paths';

  import {
    INTERVAL_LABELS,
    WEEKDAY_LABELS,
    MESSAGES,
    DEFAULT_PAGE_SIZE,
  } from './constants';

  import type {
    TpmPlan,
    PlanStatusFilter,
    IntervalType,
    IntervalMatrixEntry,
  } from './types';

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
    intervalMatrix: IntervalMatrixEntry[];
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
    intervalMatrix,
    ondelete,
    onpagechange,
    onfilterchange,
    onsearch,
  }: Props = $props();

  const totalPages = $derived(
    Math.max(1, Math.ceil(totalPlans / DEFAULT_PAGE_SIZE)),
  );

  const filteredPlans = $derived(filterPlans(plans, statusFilter, searchQuery));

  /** Lookup: planUuid → intervalType → cardCount */
  const matrixLookup = $derived.by(() => {
    const map = new SvelteMap<string, SvelteMap<IntervalType, number>>();
    for (const entry of intervalMatrix) {
      let planMap = map.get(entry.planUuid);
      if (planMap === undefined) {
        planMap = new SvelteMap<IntervalType, number>();
        map.set(entry.planUuid, planMap);
      }
      planMap.set(entry.intervalType, entry.cardCount);
    }
    return map;
  });

  /** Interval columns to display */
  const intervalColumns: IntervalType[] = [
    'daily',
    'weekly',
    'monthly',
    'quarterly',
    'semi_annual',
    'annual',
  ];

  /** Single-letter short labels for compact columns */
  const shortLabels: Record<string, string> = {
    daily: 'T',
    weekly: 'W',
    monthly: 'M',
    quarterly: 'Q',
    semi_annual: 'H',
    annual: 'J',
  };

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

  function getCardCount(planUuid: string, interval: IntervalType): number {
    return matrixLookup.get(planUuid)?.get(interval) ?? 0;
  }

  function handleSearchInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    onsearch(input.value);
  }

  function getStatusBadge(isActive: number): { label: string; cls: string } {
    if (isActive === 1) return { label: 'Aktiv', cls: 'badge--success' };
    if (isActive === 3) return { label: 'Archiviert', cls: 'badge--info' };
    return { label: 'Inaktiv', cls: 'badge--error' };
  }
</script>

<!-- Filter bar -->
<div class="mb-4 flex flex-wrap items-center justify-between gap-4">
  <div class="toggle-group">
    <button
      type="button"
      class="toggle-group__btn"
      class:active={statusFilter === 'all'}
      onclick={() => {
        onfilterchange('all');
      }}
    >
      {MESSAGES.FILTER_ALL}
    </button>
    <button
      type="button"
      class="toggle-group__btn"
      class:active={statusFilter === 'active'}
      onclick={() => {
        onfilterchange('active');
      }}
    >
      {MESSAGES.FILTER_ACTIVE}
    </button>
    <button
      type="button"
      class="toggle-group__btn"
      class:active={statusFilter === 'archived'}
      onclick={() => {
        onfilterchange('archived');
      }}
    >
      {MESSAGES.FILTER_ARCHIVED}
    </button>
  </div>

  <div class="min-w-50">
    <input
      type="text"
      class="form-field__control"
      placeholder={MESSAGES.SEARCH_PLACEHOLDER}
      value={searchQuery}
      oninput={handleSearchInput}
    />
  </div>
</div>

<!-- Plan table -->
{#if loading}
  <div
    class="flex items-center justify-center gap-2 p-12 text-(--color-text-muted)"
  >
    <i class="fas fa-spinner fa-spin"></i>
    {MESSAGES.LOADING}
  </div>
{:else if filteredPlans.length === 0}
  <div class="empty-state">
    <div class="empty-state__icon">
      <i class="fas fa-clipboard-list"></i>
    </div>
    <h3 class="empty-state__title">{MESSAGES.EMPTY_TITLE}</h3>
    <p class="empty-state__description">
      {statusFilter === 'all' ?
        MESSAGES.EMPTY_DESCRIPTION
      : MESSAGES.EMPTY_FILTER_DESC}
    </p>
  </div>
{:else}
  <div class="table-responsive">
    <table class="data-table data-table--hover data-table--striped">
      <thead>
        <tr>
          <th scope="col">{MESSAGES.TH_MACHINE}</th>
          <th scope="col">{MESSAGES.TH_PLAN_NAME}</th>
          <th scope="col">{MESSAGES.TH_WEEKDAY}</th>
          <th scope="col">{MESSAGES.TH_STATUS}</th>
          {#each intervalColumns as col (col)}
            <th
              scope="col"
              class="text-center"
              style="width: 48px"
              title={INTERVAL_LABELS[col]}
            >
              {shortLabels[col] ?? col}
            </th>
          {/each}
          <th scope="col">{MESSAGES.TH_ACTIONS}</th>
        </tr>
      </thead>
      <tbody>
        {#each filteredPlans as plan (plan.uuid)}
          {@const badge = getStatusBadge(plan.isActive)}
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
            <td>{plan.name}</td>
            <td>{WEEKDAY_LABELS[plan.baseWeekday] ?? '—'}</td>
            <td>
              <span class="badge {badge.cls} badge--sm">{badge.label}</span>
            </td>
            {#each intervalColumns as col (col)}
              {@const count = getCardCount(plan.uuid, col)}
              <td class="text-center align-middle">
                {#if count > 0}
                  <span
                    class="badge badge--success badge--sm"
                    title="{INTERVAL_LABELS[col]}: {count} {count === 1 ?
                      'Karte'
                    : 'Karten'}"
                  >
                    {count}
                  </span>
                {:else}
                  <span
                    class="text-(--color-text-muted)"
                    title="{INTERVAL_LABELS[col]}: keine Karten">—</span
                  >
                {/if}
              </td>
            {/each}
            <td>
              <div class="flex gap-2">
                <a
                  href={resolvePath(`/lean-management/tpm/board/${plan.uuid}`)}
                  class="action-icon action-icon--primary"
                  title={MESSAGES.BTN_VIEW_BOARD}
                  aria-label={MESSAGES.BTN_VIEW_BOARD}
                >
                  <i class="fas fa-th-large"></i>
                </a>
                <a
                  href={resolvePath(
                    `/lean-management/tpm/locations/${plan.uuid}`,
                  )}
                  class="action-icon action-icon--warning"
                  title="Standorte"
                  aria-label="Standorte"
                >
                  <i class="fas fa-map-marker-alt"></i>
                </a>
                <a
                  href={resolvePath(`/lean-management/tpm/cards/${plan.uuid}`)}
                  class="action-icon action-icon--info"
                  title="Karten verwalten"
                  aria-label="Karten verwalten"
                >
                  <i class="fas fa-clone"></i>
                </a>
                <a
                  href={resolvePath(`/lean-management/tpm/plan/${plan.uuid}`)}
                  class="action-icon action-icon--edit"
                  title={MESSAGES.BTN_EDIT}
                  aria-label="Plan bearbeiten"
                >
                  <i class="fas fa-edit"></i>
                </a>
                <button
                  type="button"
                  class="action-icon action-icon--delete"
                  title={MESSAGES.BTN_DELETE}
                  aria-label="Plan löschen"
                  onclick={() => {
                    ondelete(plan);
                  }}
                >
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <!-- Legend -->
  <div class="matrix-legend">
    <span class="matrix-legend__item">
      <span class="badge badge--success badge--sm">3</span>
      Anzahl Karten
    </span>
    <span class="matrix-legend__item">
      <span class="text-(--color-text-muted)">—</span>
      Keine Karten
    </span>
  </div>

  <!-- Pagination -->
  {#if totalPages > 1}
    <div
      class="mt-4 flex items-center justify-center gap-4 border-t border-(--color-glass-border) pt-4"
    >
      <button
        type="button"
        class="btn btn-primary btn-icon"
        disabled={currentPage <= 1}
        onclick={() => {
          onpagechange(currentPage - 1);
        }}
        aria-label="Vorherige Seite"
      >
        <i class="fas fa-chevron-left"></i>
      </button>
      <span class="text-sm text-(--color-text-secondary)">
        Seite {currentPage} von {totalPages}
      </span>
      <button
        type="button"
        class="btn btn-primary btn-icon"
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
  .matrix-legend {
    display: flex;
    gap: 1.25rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--color-glass-border);
    margin-top: 0.75rem;
  }

  .matrix-legend__item {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
</style>
