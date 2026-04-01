<script lang="ts">
  import { SvelteMap } from 'svelte/reactivity';

  import { resolve } from '$app/paths';

  import {
    INTERVAL_LABELS,
    WEEKDAY_LABELS,
    CARD_STATUS_LABELS,
    CARD_STATUS_BADGE_CLASSES,
    APPROVAL_STATUS_LABELS,
    APPROVAL_STATUS_BADGE,
    DEFAULT_PAGE_SIZE,
    type TpmMessages,
  } from './constants';

  import type {
    TpmPlan,
    PlanStatusFilter,
    IntervalType,
    IntervalMatrixEntry,
    CardStatus,
  } from './types';

  interface Props {
    messages: TpmMessages;
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
    messages,
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

  const totalPages = $derived(Math.max(1, Math.ceil(totalPlans / DEFAULT_PAGE_SIZE)));

  const filteredPlans = $derived(filterPlans(plans, statusFilter, searchQuery));

  /** Lookup: planUuid → intervalType → full matrix entry */
  const matrixLookup = $derived.by(() => {
    const map = new SvelteMap<string, SvelteMap<IntervalType, IntervalMatrixEntry>>();
    for (const entry of intervalMatrix) {
      let planMap = map.get(entry.planUuid);
      if (planMap === undefined) {
        planMap = new SvelteMap<IntervalType, IntervalMatrixEntry>();
        map.set(entry.planUuid, planMap);
      }
      planMap.set(entry.intervalType, entry);
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

  function formatShortDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  }

  function filterPlans(items: TpmPlan[], status: PlanStatusFilter, query: string): TpmPlan[] {
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
          (p.assetName?.toLowerCase().includes(lower) ?? false),
      );
    }

    return result;
  }

  function getMatrixEntry(planUuid: string, interval: IntervalType): IntervalMatrixEntry | null {
    return matrixLookup.get(planUuid)?.get(interval) ?? null;
  }

  /** Determine worst card status: overdue > red > yellow > green */
  function getWorstStatus(entry: IntervalMatrixEntry): CardStatus {
    if (entry.overdueCount > 0) return 'overdue';
    if (entry.redCount > 0) return 'red';
    if (entry.yellowCount > 0) return 'yellow';
    return 'green';
  }

  /** Build tooltip with status breakdown */
  function getStatusTooltip(entry: IntervalMatrixEntry, intervalLabel: string): string {
    const parts: string[] = [];
    if (entry.greenCount > 0) parts.push(`${String(entry.greenCount)} ${CARD_STATUS_LABELS.green}`);
    if (entry.redCount > 0) parts.push(`${String(entry.redCount)} ${CARD_STATUS_LABELS.red}`);
    if (entry.yellowCount > 0)
      parts.push(`${String(entry.yellowCount)} ${CARD_STATUS_LABELS.yellow}`);
    if (entry.overdueCount > 0)
      parts.push(`${String(entry.overdueCount)} ${CARD_STATUS_LABELS.overdue}`);
    return `${intervalLabel}: ${parts.join(', ')}`;
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
      {messages.FILTER_ALL}
    </button>
    <button
      type="button"
      class="toggle-group__btn"
      class:active={statusFilter === 'active'}
      onclick={() => {
        onfilterchange('active');
      }}
    >
      {messages.FILTER_ACTIVE}
    </button>
    <button
      type="button"
      class="toggle-group__btn"
      class:active={statusFilter === 'archived'}
      onclick={() => {
        onfilterchange('archived');
      }}
    >
      {messages.FILTER_ARCHIVED}
    </button>
  </div>

  <div class="min-w-50">
    <input
      type="text"
      class="form-field__control"
      placeholder={messages.SEARCH_PLACEHOLDER}
      value={searchQuery}
      oninput={handleSearchInput}
    />
  </div>
</div>

<!-- Plan table -->
{#if loading}
  <div class="flex items-center justify-center gap-2 p-12 text-(--color-text-muted)">
    <i class="fas fa-spinner fa-spin"></i>
    {messages.LOADING}
  </div>
{:else if filteredPlans.length === 0}
  <div class="empty-state">
    <div class="empty-state__icon">
      <i class="fas fa-clipboard-list"></i>
    </div>
    <h3 class="empty-state__title">{messages.EMPTY_TITLE}</h3>
    <p class="empty-state__description">
      {statusFilter === 'all' ? messages.EMPTY_DESCRIPTION : messages.EMPTY_FILTER_DESC}
    </p>
  </div>
{:else}
  <div class="table-responsive">
    <table class="data-table data-table--hover data-table--striped">
      <thead>
        <tr>
          <th scope="col">{messages.TH_MACHINE}</th>
          <th scope="col">{messages.TH_PLAN_NAME}</th>
          <th scope="col">{messages.TH_WEEKDAY}</th>
          <th scope="col">{messages.TH_STATUS}</th>
          <th scope="col">Version</th>
          <th scope="col">Freigabe</th>
          <th scope="col">Geändert</th>
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
          <th scope="col">{messages.TH_ACTIONS}</th>
        </tr>
      </thead>
      <tbody>
        {#each filteredPlans as plan (plan.uuid)}
          {@const badge = getStatusBadge(plan.isActive)}
          <tr>
            <td>
              <a
                href={resolve(`/lean-management/tpm/plan/${plan.uuid}`)}
                class="inline-flex items-center gap-2 font-medium text-(--color-text-primary) no-underline hover:text-(--color-primary)"
              >
                <i class="fas fa-cog"></i>
                {plan.assetName ?? '—'}
              </a>
            </td>
            <td>{plan.name}</td>
            <td>{WEEKDAY_LABELS[plan.baseWeekday] ?? '—'}</td>
            <td>
              <span class="badge {badge.cls}">{badge.label}</span>
            </td>
            <td>
              <span class="badge badge--primary">v{plan.approvalVersion}.{plan.revisionMinor}</span>
            </td>
            <td>
              {#if plan.approvalStatus !== null}
                <span
                  class="badge {APPROVAL_STATUS_BADGE[plan.approvalStatus] ?? 'badge--outline'}"
                >
                  {APPROVAL_STATUS_LABELS[plan.approvalStatus] ?? plan.approvalStatus}
                </span>
                {#if plan.approvalDecisionNote !== null}
                  <span
                    class="decision-note-icon"
                    title="{plan.approvalDecidedByName ?? ''}: {plan.approvalDecisionNote}"
                  >
                    <i class="fas fa-comment"></i>
                  </span>
                {/if}
              {:else}
                <span class="text-muted">—</span>
              {/if}
            </td>
            <td class="text-nowrap">
              {formatShortDate(plan.updatedAt)}
            </td>
            {#each intervalColumns as col (col)}
              {@const entry = getMatrixEntry(plan.uuid, col)}
              <td class="text-center align-middle">
                {#if entry !== null}
                  {@const worstStatus = getWorstStatus(entry)}
                  <span
                    class="badge {CARD_STATUS_BADGE_CLASSES[worstStatus]} badge--sm"
                    title={getStatusTooltip(entry, INTERVAL_LABELS[col])}
                  >
                    {entry.cardCount}
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
                  href={resolve(`/lean-management/tpm/board/${plan.uuid}`)}
                  class="action-icon action-icon--primary"
                  title={messages.BTN_VIEW_BOARD}
                  aria-label={messages.BTN_VIEW_BOARD}
                >
                  <i class="fas fa-th-large"></i>
                </a>
                <a
                  href={resolve(`/lean-management/tpm/locations/${plan.uuid}`)}
                  class="action-icon action-icon--warning"
                  title="Standorte"
                  aria-label="Standorte"
                >
                  <i class="fas fa-map-marker-alt"></i>
                </a>
                <a
                  href={resolve(`/lean-management/tpm/cards/${plan.uuid}`)}
                  class="action-icon action-icon--info"
                  title="Karten verwalten"
                  aria-label="Karten verwalten"
                >
                  <i class="fas fa-clone"></i>
                </a>
                <a
                  href={resolve(`/lean-management/tpm/board/${plan.uuid}/defects`)}
                  class="action-icon action-icon--danger"
                  title="Gesamtmängelliste"
                  aria-label="Gesamtmängelliste"
                >
                  <i class="fas fa-exclamation-triangle"></i>
                </a>
                <a
                  href={resolve(`/lean-management/tpm/plan/${plan.uuid}/revisions`)}
                  class="action-icon"
                  title="Versionshistorie"
                  aria-label="Versionshistorie"
                >
                  <i class="fas fa-history"></i>
                </a>
                <a
                  href={resolve(`/lean-management/tpm/plan/${plan.uuid}`)}
                  class="action-icon action-icon--edit"
                  title={messages.BTN_EDIT}
                  aria-label="Plan bearbeiten"
                >
                  <i class="fas fa-edit"></i>
                </a>
                <button
                  type="button"
                  class="action-icon action-icon--delete"
                  title={messages.BTN_DELETE}
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
      {CARD_STATUS_LABELS.green}
    </span>
    <span class="matrix-legend__item">
      <span class="badge badge--danger badge--sm">2</span>
      {CARD_STATUS_LABELS.red}
    </span>
    <span class="matrix-legend__item">
      <span class="badge badge--warning badge--sm">1</span>
      {CARD_STATUS_LABELS.yellow}
    </span>
    <span class="matrix-legend__item">
      <span class="badge badge--error badge--sm">1</span>
      {CARD_STATUS_LABELS.overdue}
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

  .decision-note-icon {
    margin-left: 0.375rem;
    color: var(--color-text-muted);
    cursor: help;
    font-size: 0.8rem;
  }
</style>
