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
          <th scope="col">{MESSAGES.TH_INTERVAL}</th>
          <th scope="col">{MESSAGES.TH_WEEKDAY}</th>
          <th scope="col">{MESSAGES.TH_STATUS}</th>
          <th scope="col">{MESSAGES.TH_CREATED}</th>
          <th scope="col">{MESSAGES.TH_ACTIONS}</th>
        </tr>
      </thead>
      <tbody>
        {#each filteredPlans as plan (plan.uuid)}
          {@const badge = getStatusBadge(plan.isActive)}
          <tr>
            <td>
              <span class="inline-flex items-center gap-2 font-medium">
                <i class="fas fa-cog"></i>
                {plan.machineName ?? '—'}
              </span>
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

  <!-- Pagination -->
  {#if totalPages > 1}
    <div
      class="mt-4 flex items-center justify-center gap-4 border-t border-(--color-glass-border) pt-4"
    >
      <button
        type="button"
        class="btn btn-primary btn-sm btn-icon"
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
        class="btn btn-primary btn-sm btn-icon"
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
