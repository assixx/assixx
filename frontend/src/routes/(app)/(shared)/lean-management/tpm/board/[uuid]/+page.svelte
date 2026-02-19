<script lang="ts">
  /**
   * TPM Kamishibai Board — Page Component
   * Renders the visual maintenance board for one machine's plan.
   * SSR data: plan + cards + colors. Filter is client-state only.
   */
  import BoardFilter from './_lib/BoardFilter.svelte';
  import KamishibaiBoard from './_lib/KamishibaiBoard.svelte';

  import type { PageData } from './$types';
  import type { TpmCard } from '../../_lib/types';

  type FilterType = 'all' | 'operator' | 'maintenance' | 'open_only';

  const { data }: { data: PageData } = $props();

  const plan = $derived(data.plan);
  const cards = $derived(data.cards);
  const colors = $derived(data.colors);

  /** Active board filter — client-side only */
  let activeFilter = $state<FilterType>('all');

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
    cards.filter((c: TpmCard) => c.status === 'red' || c.status === 'overdue').length,
  );
</script>

<svelte:head>
  <title>{pageTitle} — Assixx</title>
</svelte:head>

<div class="board-page">
  <!-- Page Header -->
  <div class="board-page__header">
    <div class="board-page__title-wrap">
      <h1 class="board-page__heading">
        <i class="fas fa-columns"></i>
        Kamishibai Board
      </h1>
      {#if plan !== null}
        <div class="board-page__meta">
          <span class="board-page__machine">
            <i class="fas fa-cog"></i>
            {plan.machineName ?? '—'}
          </span>
          <span class="board-page__plan-name">{plan.name}</span>
        </div>
      {/if}
    </div>

    {#if openCount > 0}
      <div class="board-page__open-badge">
        <i class="fas fa-exclamation-circle"></i>
        {openCount} offen
      </div>
    {:else if cards.length > 0}
      <div class="board-page__ok-badge">
        <i class="fas fa-check-circle"></i>
        Alles erledigt
      </div>
    {/if}
  </div>

  <!-- Filter Bar -->
  <div class="board-page__filters">
    <BoardFilter bind:filter={activeFilter} />
    <span class="board-page__card-count">
      {filteredCards.length} / {cards.length} Karten
    </span>
  </div>

  <!-- Board Content -->
  {#if plan === null}
    <div class="board-page__error">
      <i class="fas fa-exclamation-triangle"></i>
      <h3>Wartungsplan nicht gefunden</h3>
      <p>Der angeforderte Wartungsplan existiert nicht oder wurde gelöscht.</p>
    </div>
  {:else if cards.length === 0}
    <div class="board-page__empty">
      <i class="fas fa-th board-page__empty-icon"></i>
      <h3>Keine Karten vorhanden</h3>
      <p>Für diesen Wartungsplan sind noch keine Karten erstellt.</p>
    </div>
  {:else}
    <KamishibaiBoard cards={filteredCards} {colors} />
  {/if}
</div>

<style>
  .board-page {
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  /* Header */
  .board-page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .board-page__heading {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-gray-900);
    margin: 0 0 0.375rem;
  }

  .board-page__meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.875rem;
    color: var(--color-gray-500);
  }

  .board-page__machine {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-weight: 500;
  }

  .board-page__open-badge,
  .board-page__ok-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: var(--radius-md, 8px);
    font-size: 0.875rem;
    font-weight: 600;
    flex-shrink: 0;
    align-self: flex-start;
  }

  .board-page__open-badge {
    background: color-mix(in srgb, var(--color-danger, #ef4444) 12%, transparent);
    color: var(--color-danger, #ef4444);
  }

  .board-page__ok-badge {
    background: color-mix(in srgb, var(--color-success, #10b981) 12%, transparent);
    color: var(--color-success, #10b981);
  }

  /* Filter bar */
  .board-page__filters {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .board-page__card-count {
    font-size: 0.8125rem;
    color: var(--color-gray-500);
    white-space: nowrap;
  }

  /* Error / Empty states */
  .board-page__error,
  .board-page__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 4rem 2rem;
    background: var(--color-white, #fff);
    border-radius: var(--radius-lg, 12px);
    box-shadow: var(--shadow-sm);
    color: var(--color-gray-600);
  }

  .board-page__error i,
  .board-page__empty-icon {
    font-size: 2.5rem;
    color: var(--color-gray-300);
    margin-bottom: 1rem;
  }

  .board-page__error h3,
  .board-page__empty h3 {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0 0 0.5rem;
  }

  .board-page__error p,
  .board-page__empty p {
    font-size: 0.875rem;
    color: var(--color-gray-500);
    margin: 0;
  }

  /* Responsive */
  @media (width <= 640px) {
    .board-page {
      padding: 1rem;
    }

    .board-page__heading {
      font-size: 1.25rem;
    }
  }
</style>
