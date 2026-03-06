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
  // DROPDOWN STATE
  // =========================================================================

  let statusDropdownOpen = $state(false);
  let intervalDropdownOpen = $state(false);
  let roleDropdownOpen = $state(false);

  function closeAllDropdowns(): void {
    statusDropdownOpen = false;
    intervalDropdownOpen = false;
    roleDropdownOpen = false;
  }

  $effect(() => {
    const anyOpen =
      statusDropdownOpen || intervalDropdownOpen || roleDropdownOpen;
    if (!anyOpen) return;

    function handleClickOutside(event: MouseEvent): void {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown')) {
        closeAllDropdowns();
      }
    }

    document.addEventListener('click', handleClickOutside, true);
    return () => {
      document.removeEventListener('click', handleClickOutside, true);
    };
  });

  // =========================================================================
  // DERIVED DISPLAY TEXT
  // =========================================================================

  const selectedStatusText = $derived(
    statusFilter === '' ?
      MESSAGES.FILTER_ALL_STATUS
    : CARD_STATUS_LABELS[statusFilter],
  );
  const selectedIntervalText = $derived(
    intervalFilter === '' ?
      MESSAGES.FILTER_ALL_INTERVALS
    : INTERVAL_LABELS[intervalFilter],
  );
  const selectedRoleText = $derived(
    roleFilter === '' ?
      MESSAGES.FILTER_ALL_ROLES
    : CARD_ROLE_LABELS[roleFilter],
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
    closeAllDropdowns();
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
  <div
    class="dropdown"
    style="min-width: 12rem"
  >
    <button
      type="button"
      class="dropdown__trigger"
      class:active={statusDropdownOpen}
      onclick={() => {
        const wasOpen = statusDropdownOpen;
        closeAllDropdowns();
        statusDropdownOpen = !wasOpen;
      }}
    >
      <span>{selectedStatusText}</span>
      <i class="fas fa-chevron-down"></i>
    </button>
    <div
      class="dropdown__menu"
      class:active={statusDropdownOpen}
    >
      <button
        type="button"
        class="dropdown__option"
        class:dropdown__option--selected={statusFilter === ''}
        onclick={() => {
          statusFilter = '';
          statusDropdownOpen = false;
        }}
      >
        {MESSAGES.FILTER_ALL_STATUS}
      </button>
      {#each STATUS_OPTIONS as status (status)}
        <button
          type="button"
          class="dropdown__option"
          class:dropdown__option--selected={statusFilter === status}
          onclick={() => {
            statusFilter = status;
            statusDropdownOpen = false;
          }}
        >
          {CARD_STATUS_LABELS[status]}
        </button>
      {/each}
    </div>
  </div>

  <div
    class="dropdown"
    style="min-width: 12rem"
  >
    <button
      type="button"
      class="dropdown__trigger"
      class:active={intervalDropdownOpen}
      onclick={() => {
        const wasOpen = intervalDropdownOpen;
        closeAllDropdowns();
        intervalDropdownOpen = !wasOpen;
      }}
    >
      <span>{selectedIntervalText}</span>
      <i class="fas fa-chevron-down"></i>
    </button>
    <div
      class="dropdown__menu dropdown__menu--scrollable"
      class:active={intervalDropdownOpen}
    >
      <button
        type="button"
        class="dropdown__option"
        class:dropdown__option--selected={intervalFilter === ''}
        onclick={() => {
          intervalFilter = '';
          intervalDropdownOpen = false;
        }}
      >
        {MESSAGES.FILTER_ALL_INTERVALS}
      </button>
      {#each INTERVAL_OPTIONS as intv (intv)}
        <button
          type="button"
          class="dropdown__option"
          class:dropdown__option--selected={intervalFilter === intv}
          onclick={() => {
            intervalFilter = intv;
            intervalDropdownOpen = false;
          }}
        >
          {INTERVAL_LABELS[intv]}
        </button>
      {/each}
    </div>
  </div>

  <div
    class="dropdown"
    style="min-width: 12rem"
  >
    <button
      type="button"
      class="dropdown__trigger"
      class:active={roleDropdownOpen}
      onclick={() => {
        const wasOpen = roleDropdownOpen;
        closeAllDropdowns();
        roleDropdownOpen = !wasOpen;
      }}
    >
      <span>{selectedRoleText}</span>
      <i class="fas fa-chevron-down"></i>
    </button>
    <div
      class="dropdown__menu"
      class:active={roleDropdownOpen}
    >
      <button
        type="button"
        class="dropdown__option"
        class:dropdown__option--selected={roleFilter === ''}
        onclick={() => {
          roleFilter = '';
          roleDropdownOpen = false;
        }}
      >
        {MESSAGES.FILTER_ALL_ROLES}
      </button>
      {#each ROLE_OPTIONS as role (role)}
        <button
          type="button"
          class="dropdown__option"
          class:dropdown__option--selected={roleFilter === role}
          onclick={() => {
            roleFilter = role;
            roleDropdownOpen = false;
          }}
        >
          {CARD_ROLE_LABELS[role]}
        </button>
      {/each}
    </div>
  </div>

  {#if hasActiveFilters}
    <button
      type="button"
      class="btn btn-primary"
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
          <th scope="col">{MESSAGES.TH_CARD_ESTIMATED_TIME}</th>
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
              {#if card.estimatedExecutionMinutes !== null}
                <span class="text-sm">{card.estimatedExecutionMinutes} min</span
                >
              {:else}
                <span class="text-(--color-text-muted)">—</span>
              {/if}
            </td>
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
              <div class="flex gap-2">
                <button
                  type="button"
                  class="action-icon action-icon--edit"
                  title={MESSAGES.BTN_EDIT}
                  aria-label={MESSAGES.BTN_EDIT}
                  onclick={() => {
                    onedit(card);
                  }}
                >
                  <i class="fas fa-pen"></i>
                </button>
                <button
                  type="button"
                  class="action-icon action-icon--delete"
                  title={MESSAGES.BTN_DELETE}
                  aria-label={MESSAGES.BTN_DELETE}
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
