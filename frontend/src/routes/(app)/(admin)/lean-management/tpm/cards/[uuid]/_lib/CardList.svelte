<script lang="ts">
  /**
   * TPM Card List Component
   * @module cards/[uuid]/_lib/CardList
   *
   * Displays a filterable, paginated table of TPM cards for a plan.
   * Filters: status, intervalType, cardRole.
   * Each row has edit/delete actions.
   */
  import {
    INTERVAL_LABELS,
    CARD_STATUS_LABELS,
    CARD_STATUS_BADGE_CLASSES,
    CARD_ROLE_LABELS,
    MESSAGES,
  } from '../../../_lib/constants';

  import type {
    TpmCard,
    CardStatus,
    IntervalType,
    CardRole,
  } from '../../../_lib/types';

  interface Props {
    cards: TpmCard[];
    totalCards: number;
    loading: boolean;
    onedit: (card: TpmCard) => void;
    ondelete: (card: TpmCard) => void;
  }

  const { cards, totalCards, loading, onedit, ondelete }: Props = $props();

  // =========================================================================
  // FILTER STATE
  // =========================================================================

  let statusFilter = $state<CardStatus | ''>('');
  let intervalFilter = $state<IntervalType | ''>('');
  let roleFilter = $state<CardRole | ''>('');

  // =========================================================================
  // DERIVED
  // =========================================================================

  const filteredCards = $derived(
    cards.filter((card: TpmCard) => {
      if (statusFilter !== '' && card.status !== statusFilter) return false;
      if (intervalFilter !== '' && card.intervalType !== intervalFilter)
        return false;
      if (roleFilter !== '' && card.cardRole !== roleFilter) return false;
      return true;
    }),
  );

  const hasActiveFilters = $derived(
    statusFilter !== '' || intervalFilter !== '' || roleFilter !== '',
  );

  // =========================================================================
  // CONSTANTS
  // =========================================================================

  const STATUS_OPTIONS: CardStatus[] = ['green', 'red', 'yellow', 'overdue'];
  const INTERVAL_OPTIONS: IntervalType[] = [
    'daily',
    'weekly',
    'monthly',
    'quarterly',
    'semi_annual',
    'annual',
    'long_runner',
    'custom',
  ];
  const ROLE_OPTIONS: CardRole[] = ['operator', 'maintenance'];

  // =========================================================================
  // HANDLERS
  // =========================================================================

  function clearFilters(): void {
    statusFilter = '';
    intervalFilter = '';
    roleFilter = '';
  }

  function formatDate(dateStr: string | null): string {
    if (dateStr === null) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  }
</script>

<!-- Filters -->
<div class="card-list__filters">
  <select
    class="filter-select"
    bind:value={statusFilter}
    aria-label="Status-Filter"
  >
    <option value="">{MESSAGES.FILTER_ALL_STATUS}</option>
    {#each STATUS_OPTIONS as status (status)}
      <option value={status}>{CARD_STATUS_LABELS[status]}</option>
    {/each}
  </select>

  <select
    class="filter-select"
    bind:value={intervalFilter}
    aria-label="Intervall-Filter"
  >
    <option value="">{MESSAGES.FILTER_ALL_INTERVALS}</option>
    {#each INTERVAL_OPTIONS as intv (intv)}
      <option value={intv}>{INTERVAL_LABELS[intv]}</option>
    {/each}
  </select>

  <select
    class="filter-select"
    bind:value={roleFilter}
    aria-label="Typ-Filter"
  >
    <option value="">{MESSAGES.FILTER_ALL_ROLES}</option>
    {#each ROLE_OPTIONS as role (role)}
      <option value={role}>{CARD_ROLE_LABELS[role]}</option>
    {/each}
  </select>

  {#if hasActiveFilters}
    <button
      type="button"
      class="btn btn--ghost btn--sm"
      onclick={clearFilters}
    >
      <i class="fas fa-times"></i>
      Filter zurücksetzen
    </button>
  {/if}

  <span class="card-list__count">
    {filteredCards.length} / {totalCards} Karten
  </span>
</div>

<!-- Table -->
{#if loading}
  <div class="card-list__loading">
    <i class="fas fa-spinner fa-spin"></i>
    {MESSAGES.LOADING}
  </div>
{:else if filteredCards.length === 0}
  <div class="card-list__empty">
    <i class="fas fa-clipboard"></i>
    <p>
      {hasActiveFilters ?
        MESSAGES.CARD_LIST_EMPTY_FILTER
      : MESSAGES.CARD_LIST_EMPTY}
    </p>
  </div>
{:else}
  <div class="card-list__table-wrap">
    <table class="card-list__table">
      <thead>
        <tr>
          <th>{MESSAGES.TH_CARD_CODE}</th>
          <th>{MESSAGES.TH_CARD_TITLE}</th>
          <th>{MESSAGES.TH_CARD_ROLE}</th>
          <th>{MESSAGES.TH_INTERVAL}</th>
          <th>{MESSAGES.TH_STATUS}</th>
          <th>{MESSAGES.TH_CARD_DUE}</th>
          <th>{MESSAGES.TH_CARD_APPROVAL}</th>
          <th>{MESSAGES.TH_ACTIONS}</th>
        </tr>
      </thead>
      <tbody>
        {#each filteredCards as card (card.uuid)}
          <tr>
            <td class="cell-code">
              <span class="card-code">{card.cardCode}</span>
            </td>
            <td class="cell-title">
              <span class="card-title-text">{card.title}</span>
              {#if card.locationDescription !== null}
                <span class="card-location">
                  <i class="fas fa-map-marker-alt"></i>
                  {card.locationDescription}
                </span>
              {/if}
            </td>
            <td>
              <span class="role-badge role-badge--{card.cardRole}">
                {CARD_ROLE_LABELS[card.cardRole]}
              </span>
            </td>
            <td>{INTERVAL_LABELS[card.intervalType]}</td>
            <td>
              <span class="badge {CARD_STATUS_BADGE_CLASSES[card.status]}">
                {CARD_STATUS_LABELS[card.status]}
              </span>
            </td>
            <td>{formatDate(card.currentDueDate)}</td>
            <td>
              {#if card.requiresApproval}
                <i
                  class="fas fa-check-circle approval-icon"
                  title="Freigabe erforderlich"
                ></i>
              {:else}
                <span class="text-muted">—</span>
              {/if}
            </td>
            <td class="cell-actions">
              <button
                type="button"
                class="btn-icon"
                title={MESSAGES.BTN_EDIT}
                onclick={() => {
                  onedit(card);
                }}
              >
                <i class="fas fa-pen"></i>
              </button>
              <button
                type="button"
                class="btn-icon btn-icon--danger"
                title={MESSAGES.BTN_DELETE}
                onclick={() => {
                  ondelete(card);
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
{/if}

<style>
  /* Filters */
  .card-list__filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .filter-select {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-gray-300);
    border-radius: var(--radius-md, 8px);
    font-size: 0.813rem;
    color: var(--color-gray-700);
    background: var(--color-white, #fff);
  }

  .filter-select:focus {
    outline: none;
    border-color: var(--color-blue-500);
  }

  .card-list__count {
    margin-left: auto;
    font-size: 0.813rem;
    color: var(--color-gray-500);
  }

  /* Loading & Empty */
  .card-list__loading,
  .card-list__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 3rem 1.5rem;
    color: var(--color-gray-400);
    font-size: 0.875rem;
  }

  .card-list__empty i {
    font-size: 2rem;
  }

  /* Table */
  .card-list__table-wrap {
    overflow-x: auto;
  }

  .card-list__table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .card-list__table th {
    padding: 0.75rem;
    text-align: left;
    font-weight: 600;
    color: var(--color-gray-600);
    border-bottom: 2px solid var(--color-gray-200);
    white-space: nowrap;
    font-size: 0.813rem;
  }

  .card-list__table td {
    padding: 0.75rem;
    border-bottom: 1px solid var(--color-gray-100);
    vertical-align: middle;
  }

  .card-list__table tr:hover td {
    background: var(--color-gray-50);
  }

  /* Cell styles */
  .cell-code {
    width: 80px;
  }

  .card-code {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    background: var(--color-gray-100);
    border-radius: var(--radius-sm, 4px);
    font-family: var(--font-mono, monospace);
    font-size: 0.813rem;
    font-weight: 600;
    color: var(--color-gray-700);
  }

  .cell-title {
    max-width: 280px;
  }

  .card-title-text {
    display: block;
    font-weight: 500;
    color: var(--color-gray-900);
  }

  .card-location {
    display: block;
    font-size: 0.75rem;
    color: var(--color-gray-500);
    margin-top: 0.125rem;
  }

  .card-location i {
    margin-right: 0.25rem;
    font-size: 0.625rem;
  }

  /* Role badge */
  .role-badge {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-sm, 4px);
    font-size: 0.75rem;
    font-weight: 500;
  }

  .role-badge--operator {
    background: rgb(219 234 254);
    color: rgb(29 78 216);
  }

  .role-badge--maintenance {
    background: rgb(254 226 226);
    color: rgb(185 28 28);
  }

  /* Status badge */
  .badge {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-sm, 4px);
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .badge--success {
    background: rgb(209 250 229);
    color: rgb(6 95 70);
  }

  .badge--danger {
    background: rgb(254 226 226);
    color: rgb(153 27 27);
  }

  .badge--warning {
    background: rgb(254 243 199);
    color: rgb(146 64 14);
  }

  .badge--error {
    background: rgb(237 233 254);
    color: rgb(91 33 182);
  }

  /* Approval icon */
  .approval-icon {
    color: var(--color-blue-500);
  }

  .text-muted {
    color: var(--color-gray-400);
  }

  /* Action buttons */
  .cell-actions {
    display: flex;
    gap: 0.375rem;
    white-space: nowrap;
  }

  .btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: var(--radius-md, 8px);
    background: transparent;
    color: var(--color-gray-500);
    cursor: pointer;
    transition:
      background 0.15s,
      color 0.15s;
  }

  .btn-icon:hover {
    background: var(--color-gray-100);
    color: var(--color-gray-700);
  }

  .btn-icon--danger:hover {
    background: rgb(254 226 226);
    color: rgb(185 28 28);
  }

  /* Responsive */
  @media (width <= 768px) {
    .card-list__filters {
      flex-direction: column;
      align-items: stretch;
    }

    .card-list__count {
      margin-left: 0;
    }
  }
</style>
