<script lang="ts">
  /**
   * KamishibaiSection — One interval group on the Kamishibai board.
   * Shows operator and maintenance cards in separate rows.
   * Displays open-card count badge in section header.
   */
  import { CARD_ROLE_LABELS } from '../../../_lib/constants';

  import KamishibaiCard from './KamishibaiCard.svelte';

  import type {
    TpmCard,
    TpmColorConfigEntry,
    IntervalColorConfigEntry,
    CategoryColorConfigEntry,
  } from '../../../_lib/types';

  interface Props {
    label: string;
    operatorCards: TpmCard[];
    maintenanceCards: TpmCard[];
    totalOpen: number;
    colors: TpmColorConfigEntry[];
    intervalColors: IntervalColorConfigEntry[];
    categoryColors?: CategoryColorConfigEntry[];
    sectionIndex?: number;
    isLast?: boolean;
    isCollapsed?: boolean;
    isSectionExpanded?: boolean;
    isPreviousExpanded?: boolean;
    overlapFactor?: number;
    dimmed?: boolean;
    highlightedUuids?: ReadonlySet<string>;
    onCardFlip?: (uuid: string, isFlipped: boolean) => void;
    onStackedCardHover?: (hovering: boolean) => void;
    onHeaderClick?: () => void;
  }

  const {
    label,
    operatorCards,
    maintenanceCards,
    totalOpen,
    colors,
    intervalColors,
    categoryColors = [],
    sectionIndex = 0,
    isLast = false,
    isCollapsed = false,
    isSectionExpanded = false,
    isPreviousExpanded = false,
    overlapFactor = -0.7,
    dimmed = false,
    highlightedUuids = new Set<string>(),
    onCardFlip,
    onStackedCardHover,
    onHeaderClick,
  }: Props = $props();

  const hasOperator = $derived(operatorCards.length > 0);
  const hasMaintenance = $derived(maintenanceCards.length > 0);
  const isEmpty = $derived(!hasOperator && !hasMaintenance);

  /** Clipped = collapsed + not individually expanded + not last */
  const isClipped = $derived(isCollapsed && !isSectionExpanded && !isLast);

  /** Stacked = collapsed + not first + previous not expanded */
  const isStacked = $derived(
    isCollapsed && sectionIndex > 0 && !isPreviousExpanded,
  );
</script>

<section
  class="kamishibai-section"
  class:kamishibai-section--clipped={isClipped}
  class:kamishibai-section--stacked={isStacked}
  style:--section-z={isCollapsed ? sectionIndex + 1 : 0}
  style:filter={dimmed ? 'var(--section-dim-filter)' : undefined}
  style:margin-top={isStacked ?
    `calc(${overlapFactor} * var(--section-overlap))`
  : undefined}
>
  <button
    type="button"
    class="kamishibai-section__header"
    aria-expanded={isSectionExpanded}
    onclick={onHeaderClick}
  >
    <h3 class="kamishibai-section__label">
      <i class="fas fa-layer-group"></i>
      {label}
    </h3>
    {#if totalOpen > 0}
      <span class="kamishibai-section__badge kamishibai-section__badge--open">
        {totalOpen} offen
      </span>
    {:else}
      <span class="kamishibai-section__badge kamishibai-section__badge--ok">
        <i class="fas fa-check"></i> Alles erledigt
      </span>
    {/if}
    <i
      class="fas fa-chevron-down kamishibai-section__chevron"
      class:kamishibai-section__chevron--expanded={isSectionExpanded}
    ></i>
  </button>

  {#if isEmpty}
    <div class="kamishibai-section__empty">
      <i class="fas fa-filter"></i>
      <span>Keine Karten für diesen Filter</span>
    </div>
  {:else if isCollapsed && !isSectionExpanded}
    <div class="kamishibai-section__role-group">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="kamishibai-section__cards kamishibai-section__cards--stacked"
        onmouseover={(e: MouseEvent) => {
          const card = (e.target as HTMLElement).closest('.kamishibai-card');
          onStackedCardHover?.(card !== null);
        }}
        onmouseleave={() => onStackedCardHover?.(false)}
        onfocus={() => onStackedCardHover?.(true)}
        onblur={() => onStackedCardHover?.(false)}
      >
        {#each [...operatorCards, ...maintenanceCards] as card (card.uuid)}
          <KamishibaiCard
            {card}
            {colors}
            {intervalColors}
            {categoryColors}
            highlighted={highlightedUuids.has(card.uuid)}
            onFlipChange={onCardFlip}
          />
        {/each}
      </div>
    </div>
  {:else}
    {#if hasOperator}
      <div class="kamishibai-section__role-group">
        <div class="kamishibai-section__role-label">
          <i class="fas fa-user"></i>
          {CARD_ROLE_LABELS.operator}
          <span class="kamishibai-section__count">{operatorCards.length}</span>
        </div>
        <div class="kamishibai-section__cards">
          {#each operatorCards as card (card.uuid)}
            <KamishibaiCard
              {card}
              {colors}
              {intervalColors}
              {categoryColors}
              highlighted={highlightedUuids.has(card.uuid)}
              onFlipChange={onCardFlip}
            />
          {/each}
        </div>
      </div>
    {/if}

    {#if hasMaintenance}
      <div class="kamishibai-section__role-group">
        <div class="kamishibai-section__role-label">
          <i class="fas fa-wrench"></i>
          {CARD_ROLE_LABELS.maintenance}
          <span class="kamishibai-section__count"
            >{maintenanceCards.length}</span
          >
        </div>
        <div class="kamishibai-section__cards">
          {#each maintenanceCards as card (card.uuid)}
            <KamishibaiCard
              {card}
              {colors}
              {intervalColors}
              {categoryColors}
              highlighted={highlightedUuids.has(card.uuid)}
              onFlipChange={onCardFlip}
            />
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</section>

<style>
  .kamishibai-section {
    --section-max-height: 320px;
    --section-overlap: 200px;

    position: relative;
    z-index: var(--section-z, auto);
    border: var(--glass-border);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
    transition:
      max-height 150ms ease-out,
      box-shadow 200ms ease-out,
      filter 200ms ease-out;
  }

  /* Collapsed sections (clipped OR stacked) → opaque, no shadow */
  .kamishibai-section--clipped,
  .kamishibai-section--stacked {
    background: var(--color-section-stacked-bg);
    box-shadow: none;
  }

  .kamishibai-section--stacked {
    border: var(--glass-border);
    border-radius: 12px 12px 0 0;
    overflow: visible;
  }

  /* Any section with stacked cards: pop above all others on card hover */
  .kamishibai-section:has(
    .kamishibai-section__cards--stacked :global(.kamishibai-card:hover)
  ) {
    z-index: 100;
    overflow: visible;
  }

  :is(.kamishibai-section--clipped, .kamishibai-section--stacked)
    .kamishibai-section__role-group {
    background: var(--color-section-stacked-bg);
  }

  /* Clipped: collapsed + not last → height limit + fade overlay */
  .kamishibai-section--clipped {
    max-height: var(--section-max-height);
    border: var(--glass-border);
    border-radius: var(--radius-xl);
  }

  .kamishibai-section::after {
    content: '';
    position: absolute;
    inset: auto 0 0;
    height: 60px;
    background: linear-gradient(
      to bottom,
      transparent,
      var(--color-section-stacked-bg)
    );
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
    pointer-events: none;
    opacity: 0%;
    transition: opacity 200ms ease-out;
  }

  .kamishibai-section--clipped::after {
    display: none;
  }

  .kamishibai-section__header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.875rem 1.25rem;
    border: none;
    border-bottom: 1px solid var(--color-glass-border);
    border-radius: 12px 12px 0 0;
    background: var(--color-section-header-bg);
    cursor: pointer;
    font-family: inherit;
    transition: background 150ms ease;
  }

  .kamishibai-section__header:hover {
    background: var(--color-section-header-bg);
    filter: brightness(1.03);
  }

  .kamishibai-section__chevron {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    will-change: transform;
    transition: transform 400ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .kamishibai-section__chevron--expanded {
    transform: rotate(180deg);
  }

  .kamishibai-section__label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.938rem;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
  }

  .kamishibai-section__label i {
    color: var(--color-text-muted);
    font-size: 0.875rem;
  }

  .kamishibai-section__badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    margin-left: auto;
    padding: 0.475rem 1rem;
    border-radius: var(--radius-full, 9999px);
    font-size: 0.9rem;
    font-weight: 600;
  }

  .kamishibai-section__badge--open {
    background: color-mix(in srgb, var(--color-danger) 12%, transparent);
    color: var(--color-danger);
    animation: badge-pulse 3s ease-in-out infinite;
  }

  @keyframes badge-pulse {
    0%,
    100% {
      box-shadow: 0 0 0 0
        color-mix(in srgb, var(--color-danger) 30%, transparent);
    }

    50% {
      box-shadow: 0 0 0 6px
        color-mix(in srgb, var(--color-danger) 0%, transparent);
    }
  }

  .kamishibai-section__badge--ok {
    background: color-mix(in srgb, var(--color-success) 12%, transparent);
    color: var(--color-success);
  }

  .kamishibai-section__role-group {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--color-glass-border);
  }

  .kamishibai-section__role-group:last-child {
    border-bottom: none;
    background: var(--color-section-stacked-bg);
  }

  .kamishibai-section__role-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.813rem;
    font-weight: 500;
    color: var(--color-text-muted);
    margin-bottom: 0.75rem;
  }

  .kamishibai-section__count {
    margin-left: auto;
    background: var(--glass-bg-active);
    color: var(--color-text-secondary);
    border-radius: var(--radius-full, 9999px);
    padding: 0.125rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .kamishibai-section__cards {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    min-height: 180px;
    align-items: flex-start;
    transition: gap 500ms ease-out;
  }

  .kamishibai-section__cards :global(.kamishibai-card) {
    transition:
      margin-right 200ms ease-out,
      margin-top 200ms ease-out;
  }

  /* Stacked cards — 2D overlap: horizontal (-100px) + vertical (-160px) */
  .kamishibai-section__cards--stacked {
    flex-wrap: wrap;
    gap: 0;
    min-height: auto;
    padding-top: 170px;
    padding-right: 100px;
  }

  .kamishibai-section__cards--stacked :global(.kamishibai-card) {
    margin-right: -100px;
    margin-top: -160px;
    transition:
      transform 250ms ease-out,
      z-index 0ms,
      margin-right 200ms ease-out,
      margin-top 200ms ease-out;
  }

  .kamishibai-section__cards--stacked :global(.kamishibai-card:last-child) {
    margin-right: 0;
  }

  .kamishibai-section__cards--stacked :global(.kamishibai-card:hover) {
    transform: translateY(-20px) scale(1.08);
    z-index: 50;
    box-shadow: 0 12px 32px rgb(0 0 0 / 50%);
  }

  .kamishibai-section__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1.5rem 1.25rem;
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }

  .kamishibai-section__empty i {
    font-size: 0.875rem;
    opacity: 60%;
  }

  @media (prefers-reduced-motion: reduce) {
    .kamishibai-section,
    .kamishibai-section__header,
    .kamishibai-section__chevron,
    .kamishibai-section__cards,
    .kamishibai-section__cards :global(.kamishibai-card) {
      transition: none;
    }
  }

  @media (width <= 768px) {
    .kamishibai-section {
      --section-max-height: 260px;
      --section-overlap: 160px;
    }
  }
</style>
