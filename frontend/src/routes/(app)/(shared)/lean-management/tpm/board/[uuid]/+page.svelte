<script lang="ts">
  /**
   * TPM Kamishibai Board — Page Component
   * Renders the visual maintenance board for one machine's plan.
   * SSR data: plan + cards + colors. Filter is client-state only.
   */
  import { goto, invalidateAll } from '$app/navigation';
  import { resolve } from '$app/paths';

  import { MESSAGES } from '../../_lib/constants';

  import BoardFilter from './_lib/BoardFilter.svelte';
  import CardDetail from './_lib/CardDetail.svelte';
  import KamishibaiBoard from './_lib/KamishibaiBoard.svelte';

  import type { PageData } from './$types';
  import type { TpmCard } from '../../_lib/types';

  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
  }

  type FilterType = 'all' | 'operator' | 'maintenance' | 'open_only';

  const { data }: { data: PageData } = $props();

  const plan = $derived(data.plan);
  const cards = $derived(data.cards);
  const colors = $derived(data.colors);

  /** Active board filter — client-side only */
  let activeFilter = $state<FilterType>('all');

  /** Currently selected card — drives the CardDetail slide-over */
  let selectedCard = $state<TpmCard | null>(null);

  /**
   * planUuid for CardDetail's time-estimate fetch.
   * Empty string fallback is safe: plan === null means no cards exist,
   * so selectedCard will always be null in that case.
   */
  const planUuid = $derived(plan?.uuid ?? '');

  function filterCards(allCards: TpmCard[], filterType: FilterType): TpmCard[] {
    switch (filterType) {
      case 'operator':
        return allCards.filter((c: TpmCard) => c.cardRole === 'operator');
      case 'maintenance':
        return allCards.filter((c: TpmCard) => c.cardRole === 'maintenance');
      case 'open_only':
        return allCards.filter(
          (c: TpmCard) => c.status === 'red' || c.status === 'overdue',
        );
      default:
        return allCards;
    }
  }

  const filteredCards = $derived(filterCards(cards, activeFilter));

  const pageTitle = $derived(
    plan !== null ?
      `${plan.machineName ?? plan.name} — Kamishibai Board`
    : 'Kamishibai Board',
  );

  const openCount = $derived(
    cards.filter((c: TpmCard) => c.status === 'red' || c.status === 'overdue')
      .length,
  );

  function handleCardSelect(card: TpmCard): void {
    selectedCard = card;
  }

  function handleCardUpdated(): void {
    // Refresh board so the card flips to the new status.
    // Panel stays open — ExecutionForm shows its own success state.
    void invalidateAll();
  }

  function handleClose(): void {
    selectedCard = null;
  }
</script>

<svelte:head>
  <title>{pageTitle} — Assixx</title>
</svelte:head>

<div class="container">
  <!-- Page Header -->
  <div class="card">
    <div class="card__header">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 class="card__title">
            <i class="fas fa-columns mr-2"></i>
            Kamishibai Board
          </h2>
          {#if plan !== null}
            <p
              class="mt-2 flex items-center gap-3 text-sm text-(--color-text-secondary)"
            >
              <span class="inline-flex items-center gap-1 font-medium">
                <i class="fas fa-cog"></i>
                {plan.machineName ?? '—'}
              </span>
              <span>{plan.name}</span>
            </p>
          {/if}
        </div>

        <div class="flex items-center gap-3">
          {#if openCount > 0}
            <span class="badge badge--danger">
              <i class="fas fa-exclamation-circle"></i>
              {openCount} offen
            </span>
          {:else if cards.length > 0}
            <span class="badge badge--success">
              <i class="fas fa-check-circle"></i>
              Alles erledigt
            </span>
          {/if}
          <button
            type="button"
            class="btn btn-primary"
            onclick={() => {
              void goto(
                resolvePath(`/lean-management/tpm/cards/${data.planUuid}`),
              );
            }}
          >
            <i class="fas fa-th mr-2"></i>{MESSAGES.BTN_MANAGE_CARDS}
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Filter Bar -->
  <div class="mt-4 flex flex-wrap items-center justify-between gap-4">
    <BoardFilter bind:filter={activeFilter} />
    <span class="text-sm whitespace-nowrap text-(--color-text-muted)">
      {filteredCards.length} / {cards.length} Karten
    </span>
  </div>

  <!-- Board Content -->
  <div class="mt-4">
    {#if plan === null}
      <div class="empty-state">
        <div class="empty-state__icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h3 class="empty-state__title">Wartungsplan nicht gefunden</h3>
        <p class="empty-state__description">
          Der angeforderte Wartungsplan existiert nicht oder wurde gelöscht.
        </p>
      </div>
    {:else if cards.length === 0}
      <div class="empty-state">
        <div class="empty-state__icon">
          <i class="fas fa-th"></i>
        </div>
        <h3 class="empty-state__title">Keine Karten vorhanden</h3>
        <p class="empty-state__description">
          Für diesen Wartungsplan sind noch keine Karten erstellt.
        </p>
      </div>
    {:else}
      <KamishibaiBoard
        cards={filteredCards}
        {colors}
        onCardSelect={handleCardSelect}
      />
    {/if}
  </div>
</div>

<!-- Card Detail Slide-over — rendered outside .container so position:fixed works correctly -->
{#if selectedCard !== null}
  <CardDetail
    card={selectedCard}
    {planUuid}
    {colors}
    onClose={handleClose}
    onCardUpdated={handleCardUpdated}
  />
{/if}
