<script lang="ts">
  /**
   * TPM Kamishibai Board — Page Component
   * Renders the visual maintenance board for one asset's plan.
   * SSR data: plan + cards + colors. Filter is client-state only.
   */
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';

  import { MESSAGES } from '../../_lib/constants';

  import BoardFilter from './_lib/BoardFilter.svelte';
  import KamishibaiBoard from './_lib/KamishibaiBoard.svelte';

  import type { PageData } from './$types';
  import type { CardCategory, TpmCard } from '../../_lib/types';

  type FilterType = 'all' | 'operator' | 'maintenance' | 'open_only';
  type CategoryFilterType = 'all' | CardCategory;

  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
  }

  const { data }: { data: PageData } = $props();

  const plan = $derived(data.plan);
  const cards = $derived(data.cards);
  const colors = $derived(data.colors);
  const intervalColors = $derived(data.intervalColors);
  const categoryColors = $derived(data.categoryColors);

  /** Only root/admin can manage cards and locations */
  const canWrite = $derived(
    data.userRole === 'root' || data.userRole === 'admin',
  );

  /** Active board filters — client-side only */
  let activeFilter = $state<FilterType>('all');
  let activeCategoryFilter = $state<CategoryFilterType>('all');

  function filterCards(
    allCards: TpmCard[],
    roleFilter: FilterType,
    catFilter: CategoryFilterType,
  ): TpmCard[] {
    let result = allCards;

    switch (roleFilter) {
      case 'operator':
        result = result.filter((c: TpmCard) => c.cardRole === 'operator');
        break;
      case 'maintenance':
        result = result.filter((c: TpmCard) => c.cardRole === 'maintenance');
        break;
      case 'open_only':
        result = result.filter(
          (c: TpmCard) => c.status === 'red' || c.status === 'overdue',
        );
        break;
    }

    if (catFilter !== 'all') {
      result = result.filter((c: TpmCard) =>
        c.cardCategories.includes(catFilter),
      );
    }

    return result;
  }

  const filteredCards = $derived(
    filterCards(cards, activeFilter, activeCategoryFilter),
  );

  const pageTitle = $derived(
    plan !== null ?
      `${plan.assetName ?? plan.name} — Kamishibai Board`
    : 'Kamishibai Board',
  );

  const openCount = $derived(
    cards.filter((c: TpmCard) => c.status === 'red' || c.status === 'overdue')
      .length,
  );
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
              class="mt-2 flex items-center gap-3 text-(--color-text-secondary)"
            >
              {#if plan.departmentName}
                <span class="text-lg font-bold">{plan.departmentName}</span>
                <span class="text-(--color-text-muted)">/</span>
              {/if}
              <span class="inline-flex items-center gap-1 text-lg font-bold">
                <i class="fas fa-cog"></i>
                {plan.assetName ?? '—'}
              </span>
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
            class="btn btn-light"
            onclick={() => {
              void goto(
                resolvePath(`/lean-management/tpm/locations/${data.planUuid}`),
              );
            }}
          >
            <i class="fas fa-map-marker-alt mr-2"></i>{MESSAGES.BTN_LOCATIONS}
          </button>
          {#if canWrite}
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
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Filter Bar -->
  <div class="mt-4 flex flex-wrap items-center justify-between gap-4">
    <BoardFilter
      bind:filter={activeFilter}
      bind:categoryFilter={activeCategoryFilter}
    />
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
        allCards={cards}
        {filteredCards}
        {colors}
        {intervalColors}
        {categoryColors}
      />
    {/if}
  </div>
</div>
