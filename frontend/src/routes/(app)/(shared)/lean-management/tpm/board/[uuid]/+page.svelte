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
  import type {
    CardCategory,
    TpmCard,
    IntervalColorConfigEntry,
    CategoryColorConfigEntry,
  } from '../../_lib/types';

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

  /** Legend: interval colors that are included on cards */
  const legendIntervalColors = $derived(
    intervalColors.filter((ic: IntervalColorConfigEntry) => ic.includeInCard),
  );

  /** Legend: category colors that are configured (non-null) */
  const legendCategoryColors = $derived(
    categoryColors.filter(
      (cc: CategoryColorConfigEntry) => cc.colorHex !== null,
    ),
  );
</script>

<svelte:head>
  <title>{pageTitle} — Assixx</title>
</svelte:head>

<div class="container">
  <!-- Back Navigation -->
  <div class="mb-4">
    <button
      type="button"
      class="btn btn-light"
      onclick={() => {
        void goto(resolvePath('/lean-management/tpm'));
      }}
    >
      <i class="fas fa-arrow-left mr-2"></i>
      {MESSAGES.BTN_BACK_TO_OVERVIEW}
    </button>
  </div>

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
            class="btn btn-primary"
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

  <!-- Legend -->
  <div class="board-legend">
    <span class="board-legend__group-label">Status</span>
    {#each colors as c (c.statusKey)}
      <span class="board-legend__item">
        <span
          class="board-legend__dot"
          style="background-color: {c.colorHex}"
        ></span>
        {c.label}
      </span>
    {/each}
    {#if legendIntervalColors.length > 0}
      <span class="board-legend__divider"></span>
      <span class="board-legend__group-label">Intervall</span>
      {#each legendIntervalColors as ic (ic.statusKey)}
        <span class="board-legend__item">
          <span
            class="board-legend__dot"
            style="background-color: {ic.colorHex}"
          ></span>
          {ic.label}
        </span>
      {/each}
    {/if}
    {#if legendCategoryColors.length > 0}
      <span class="board-legend__divider"></span>
      <span class="board-legend__group-label">Kategorie</span>
      {#each legendCategoryColors as cc (cc.categoryKey)}
        <span class="board-legend__item">
          <span
            class="board-legend__dot"
            style="background-color: {cc.colorHex}"
          ></span>
          {cc.label}
        </span>
      {/each}
    {/if}
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

<style>
  .board-legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1rem;
    margin-top: 1rem;
    padding: 0.625rem 1rem;
    background: var(--glass-bg);
    border: var(--glass-border);
    border-radius: var(--radius-lg);
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .board-legend__group-label {
    font-weight: 600;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-tertiary);
  }

  .board-legend__item {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    white-space: nowrap;
  }

  .board-legend__dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: 0 1px 2px rgb(0 0 0 / 20%);
  }

  .board-legend__divider {
    width: 1px;
    height: 1rem;
    background: var(--color-glass-border);
  }
</style>
