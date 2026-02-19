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
<div class="mb-4 flex flex-wrap items-center gap-3">
  <select
    class="form-select"
    bind:value={statusFilter}
    aria-label="Status-Filter"
  >
    <option value="">{MESSAGES.FILTER_ALL_STATUS}</option>
    {#each STATUS_OPTIONS as status (status)}
      <option value={status}>{CARD_STATUS_LABELS[status]}</option>
    {/each}
  </select>

  <select
    class="form-select"
    bind:value={intervalFilter}
    aria-label="Intervall-Filter"
  >
    <option value="">{MESSAGES.FILTER_ALL_INTERVALS}</option>
    {#each INTERVAL_OPTIONS as intv (intv)}
      <option value={intv}>{INTERVAL_LABELS[intv]}</option>
    {/each}
  </select>

  <select
    class="form-select"
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
      class="btn btn-primary btn-sm"
      onclick={clearFilters}
    >
      <i class="fas fa-times"></i>
      Filter zurücksetzen
    </button>
  {/if}

  <span class="ml-auto text-sm text-(--color-text-muted)">
    {filteredCards.length} / {totalCards} Karten
  </span>
</div>

<!-- Table -->
{#if loading}
  <div
    class="flex items-center justify-center gap-2 p-12 text-(--color-text-muted)"
  >
    <i class="fas fa-spinner fa-spin"></i>
    {MESSAGES.LOADING}
  </div>
{:else if filteredCards.length === 0}
  <div class="empty-state">
    <div class="empty-state__icon">
      <i class="fas fa-clipboard"></i>
    </div>
    <h3 class="empty-state__title">
      {hasActiveFilters ?
        MESSAGES.CARD_LIST_EMPTY_FILTER
      : MESSAGES.CARD_LIST_EMPTY}
    </h3>
  </div>
{:else}
  <div class="table-responsive">
    <table class="data-table data-table--hover data-table--striped">
      <thead>
        <tr>
          <th scope="col">{MESSAGES.TH_CARD_CODE}</th>
          <th scope="col">{MESSAGES.TH_CARD_TITLE}</th>
          <th scope="col">{MESSAGES.TH_CARD_ROLE}</th>
          <th scope="col">{MESSAGES.TH_INTERVAL}</th>
          <th scope="col">{MESSAGES.TH_STATUS}</th>
          <th scope="col">{MESSAGES.TH_CARD_DUE}</th>
          <th scope="col">{MESSAGES.TH_CARD_APPROVAL}</th>
          <th scope="col">{MESSAGES.TH_ACTIONS}</th>
        </tr>
      </thead>
      <tbody>
        {#each filteredCards as card (card.uuid)}
          <tr>
            <td>
              <code class="text-sm font-semibold text-(--color-text-secondary)">
                {card.cardCode}
              </code>
            </td>
            <td>
              <span class="font-medium text-(--color-text-primary)"
                >{card.title}</span
              >
              {#if card.locationDescription !== null}
                <span class="mt-0.5 block text-xs text-(--color-text-muted)">
                  <i class="fas fa-map-marker-alt mr-1"></i>
                  {card.locationDescription}
                </span>
              {/if}
            </td>
            <td>
              <span
                class="badge badge--sm {card.cardRole === 'operator' ?
                  'badge--info'
                : 'badge--danger'}"
              >
                {CARD_ROLE_LABELS[card.cardRole]}
              </span>
            </td>
            <td>{INTERVAL_LABELS[card.intervalType]}</td>
            <td>
              <span
                class="badge badge--sm {CARD_STATUS_BADGE_CLASSES[card.status]}"
              >
                {CARD_STATUS_LABELS[card.status]}
              </span>
            </td>
            <td>{formatDate(card.currentDueDate)}</td>
            <td>
              {#if card.requiresApproval}
                <i
                  class="fas fa-check-circle text-(--color-primary)"
                  title="Freigabe erforderlich"
                ></i>
              {:else}
                <span class="text-(--color-text-muted)">—</span>
              {/if}
            </td>
            <td>
              <div class="flex gap-1">
                <button
                  type="button"
                  class="btn btn-primary btn-sm btn-icon"
                  title={MESSAGES.BTN_EDIT}
                  onclick={() => {
                    onedit(card);
                  }}
                >
                  <i class="fas fa-pen"></i>
                </button>
                <button
                  type="button"
                  class="btn btn-danger btn-sm btn-icon"
                  title={MESSAGES.BTN_DELETE}
                  onclick={() => {
                    ondelete(card);
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
{/if}
