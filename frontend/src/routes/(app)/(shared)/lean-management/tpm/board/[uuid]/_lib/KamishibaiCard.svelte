<script lang="ts">
  /**
   * KamishibaiCard — Individual maintenance card with 3D flip animation.
   * Front: status color + card code + title.
   * Back (on click): description, location, due date.
   * CardDetail (Step 5.6) will be triggered from the back face.
   */
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';

  import { CATEGORY_LABELS, DEFAULT_COLORS } from '../../../_lib/constants';

  import CardFlip from './CardFlip.svelte';

  import type {
    TpmCard,
    TpmColorConfigEntry,
    IntervalColorConfigEntry,
    CategoryColorConfigEntry,
    CardStatus,
  } from '../../../_lib/types';

  interface Props {
    card: TpmCard;
    colors: TpmColorConfigEntry[];
    intervalColors: IntervalColorConfigEntry[];
    categoryColors?: CategoryColorConfigEntry[];
    highlighted?: boolean;
    onFlipChange?: (uuid: string, isFlipped: boolean) => void;
  }

  const {
    card,
    colors,
    intervalColors,
    categoryColors = [],
    highlighted = false,
    onFlipChange,
  }: Props = $props();

  let isFlipped = $state(false);

  function getColor(status: CardStatus): string {
    const found = colors.find((c: TpmColorConfigEntry) => c.statusKey === status);
    return found !== undefined ? found.colorHex : DEFAULT_COLORS[status];
  }

  /** Find the first matching category color for this card's categories */
  function getCategoryColor(): string | null {
    if (categoryColors.length === 0 || card.cardCategories.length === 0) {
      return null;
    }
    for (const cat of card.cardCategories) {
      const entry = categoryColors.find(
        (cc: CategoryColorConfigEntry) => cc.categoryKey === cat && cc.colorHex !== null,
      );
      if (entry !== undefined) return entry.colorHex;
    }
    return null;
  }

  function getCardColor(status: CardStatus): string {
    if (status === 'green') {
      // Priority: category color > interval color > status color
      const catColor = getCategoryColor();
      if (catColor !== null) return catColor;

      const interval = intervalColors.find(
        (ic: IntervalColorConfigEntry) => ic.statusKey === card.intervalType && ic.includeInCard,
      );
      if (interval !== undefined) return interval.colorHex;
    }
    return getColor(status);
  }

  const categoryLabel = $derived(
    card.cardCategories.length > 0 ?
      card.cardCategories.map((c) => CATEGORY_LABELS[c]).join(', ')
    : null,
  );

  const statusColor = $derived(getCardColor(card.status));

  const intervalDotColor = $derived.by((): string | null => {
    if (card.status === 'green') return null;
    const interval = intervalColors.find(
      (ic: IntervalColorConfigEntry) => ic.statusKey === card.intervalType && ic.includeInCard,
    );
    return interval !== undefined ? interval.colorHex : null;
  });

  /** Category dot color — shown on non-green cards when a category color is set */
  const categoryDotColor = $derived.by((): string | null => {
    if (card.status === 'green') return null;
    return getCategoryColor();
  });

  function formatDate(dateStr: string | null): string {
    if (dateStr === null) return '—';
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  function toggle(): void {
    isFlipped = !isFlipped;
    onFlipChange?.(card.uuid, isFlipped);
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  }

  let cardEl: HTMLDivElement | undefined = $state();

  /** Scroll highlighted card into view after section expansion */
  $effect(() => {
    if (highlighted && cardEl !== undefined) {
      const el = cardEl;
      const timer = setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
      return () => {
        clearTimeout(timer);
      };
    }
  });
</script>

<div
  bind:this={cardEl}
  class="kamishibai-card"
  class:kamishibai-card--flipped={isFlipped}
  class:kamishibai-card--highlighted={highlighted}
  onclick={toggle}
  onkeydown={handleKeydown}
  role="button"
  tabindex="0"
  aria-label="{card.cardCode}: {card.title}"
  aria-pressed={isFlipped}
>
  <CardFlip {isFlipped}>
    {#snippet front()}
      <div
        class="kamishibai-card__front"
        style="background-color: {statusColor}"
      >
        <div class="kamishibai-card__header">
          {#if categoryDotColor !== null}
            <span
              class="kamishibai-card__interval-dot"
              style="background-color: {categoryDotColor}"
              title="Kategorie"
            ></span>
          {/if}
          {#if intervalDotColor !== null}
            <span
              class="kamishibai-card__interval-dot"
              style="background-color: {intervalDotColor}"
            ></span>
          {/if}
          <span class="kamishibai-card__code">{card.cardCode}</span>
          {#if categoryLabel !== null}
            <span class="kamishibai-card__category-label">
              {categoryLabel}
            </span>
          {/if}
          {#if card.requiresApproval}
            <span
              class="kamishibai-card__approval"
              title="Freigabe erforderlich"
            >
              <i class="fas fa-lock"></i>
            </span>
          {/if}
        </div>
        <div class="kamishibai-card__body">
          <div class="kamishibai-card__title">{card.title}</div>
        </div>
        <div class="kamishibai-card__footer">
          {#if card.estimatedExecutionMinutes !== null && card.estimatedExecutionMinutes > 0}
            <span class="kamishibai-card__time">
              <i class="fas fa-clock"></i>
              {card.estimatedExecutionMinutes} Min.
            </span>
          {/if}
          {#if card.status === 'overdue'}
            <span class="kamishibai-card__overdue-badge">
              <i class="fas fa-exclamation-triangle"></i> Überfällig
            </span>
          {:else if card.status === 'red'}
            <span class="kamishibai-card__overdue-badge">
              <i class="fas fa-exclamation-triangle"></i> Fällig
            </span>
          {/if}
        </div>
      </div>
    {/snippet}

    {#snippet back()}
      <div
        class="kamishibai-card__back"
        style="background: var(--color-gray-800, #424242)"
      >
        <div class="kamishibai-card__back-code">{card.cardCode}</div>
        {#if card.description !== null}
          <p class="kamishibai-card__desc">{card.description}</p>
        {:else}
          <p class="kamishibai-card__desc kamishibai-card__desc--empty">Keine Beschreibung</p>
        {/if}
        {#if card.locationDescription !== null}
          <div class="kamishibai-card__location">
            <i class="fas fa-map-marker-alt"></i>
            {card.locationDescription}
          </div>
        {/if}
        <div class="kamishibai-card__due">
          <i class="fas fa-calendar-alt"></i>
          Fällig: {formatDate(card.currentDueDate)}
        </div>
        {#if card.lastCompletedAt !== null}
          <div class="kamishibai-card__last">
            <i class="fas fa-check-circle"></i>
            Erledigt: {formatDate(card.lastCompletedAt)}
          </div>
        {/if}
        <button
          type="button"
          class="kamishibai-card__detail-btn"
          onclick={(e: MouseEvent) => {
            e.stopPropagation();
            void goto(resolve(`/lean-management/tpm/card/${card.uuid}`));
          }}
        >
          <i class="fas fa-expand-alt"></i>
          Details
        </button>
        <div class="kamishibai-card__flip-hint">
          <i class="fas fa-sync-alt"></i> Zurückdrehen
        </div>
      </div>
    {/snippet}
  </CardFlip>
</div>

<style>
  .kamishibai-card {
    --card-radius: var(--radius-sm, 6px);
    --card-edge: 4px;

    position: relative;
    isolation: isolate;
    width: 160px;
    height: 210px;
    border-radius: var(--card-radius);
    cursor: pointer;
    flex-shrink: 0;
    outline: none;

    /* 5-layer realistic shadow: contact → near → medium → ambient → far */
    box-shadow:
      0 1px 1px color-mix(in oklch, var(--color-black) 35%, transparent),
      0 2px 4px color-mix(in oklch, var(--color-black) 25%, transparent),
      0 4px 8px color-mix(in oklch, var(--color-black) 18%, transparent),
      0 8px 16px color-mix(in oklch, var(--color-black) 12%, transparent),
      0 16px 32px color-mix(in oklch, var(--color-black) 6%, transparent);
    transition:
      transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1),
      box-shadow 350ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .kamishibai-card:hover {
    box-shadow:
      0 4px 4px color-mix(in oklch, var(--color-black) 20%, transparent),
      0 8px 12px color-mix(in oklch, var(--color-black) 16%, transparent),
      0 16px 24px color-mix(in oklch, var(--color-black) 12%, transparent),
      0 24px 48px color-mix(in oklch, var(--color-black) 8%, transparent),
      0 36px 64px color-mix(in oklch, var(--color-black) 5%, transparent);
  }

  /* Lifted shadow when card is flipped */
  .kamishibai-card--flipped {
    box-shadow:
      0 4px 4px color-mix(in oklch, var(--color-black) 18%, transparent),
      0 8px 16px color-mix(in oklch, var(--color-black) 14%, transparent),
      0 16px 32px color-mix(in oklch, var(--color-black) 10%, transparent),
      0 24px 48px color-mix(in oklch, var(--color-black) 6%, transparent);
  }

  /* Locate pulse — draws the eye to the clicked card after section expansion */
  .kamishibai-card--highlighted {
    outline: 2px solid color-mix(in srgb, var(--color-text-primary) 60%, transparent);
    outline-offset: 3px;
    animation: card-locate 6.5s ease-out forwards;
  }

  @keyframes card-locate {
    0% {
      outline-color: color-mix(in srgb, var(--color-text-primary) 60%, transparent);
      transform: rotate(0deg);
    }

    3% {
      transform: rotate(-2.5deg);
    }

    6% {
      transform: rotate(2.5deg);
    }

    9% {
      transform: rotate(-2deg);
    }

    12% {
      transform: rotate(2deg);
    }

    15% {
      transform: rotate(-1.2deg);
    }

    18% {
      transform: rotate(1.2deg);
    }

    21% {
      transform: rotate(-0.5deg);
    }

    23% {
      transform: rotate(0deg);
    }

    40% {
      outline-color: color-mix(in srgb, var(--color-text-primary) 60%, transparent);
    }

    100% {
      outline-color: transparent;
      transform: rotate(0deg);
    }
  }

  .kamishibai-card:focus-visible {
    box-shadow:
      0 0 0 3px var(--color-primary),
      0 4px 8px color-mix(in oklch, var(--color-black) 18%, transparent),
      0 8px 16px color-mix(in oklch, var(--color-black) 12%, transparent);
  }

  /* Front face — 3-zone layout: header | body | footer */
  .kamishibai-card__front {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 0.625rem;
    color: var(--color-white);
    border-radius: var(--card-radius);

    /* Simulated card edges — light top/left, dark bottom/right */
    border-top: 1px solid color-mix(in oklch, var(--color-white) 22%, transparent);
    border-left: 1px solid color-mix(in oklch, var(--color-white) 10%, transparent);
    border-right: 1px solid color-mix(in oklch, var(--color-black) 10%, transparent);
    border-bottom: var(--card-edge) solid color-mix(in oklch, var(--color-black) 30%, transparent);

    /* Embossed inner edges for thickness illusion */
    box-shadow:
      inset 0 1px 0 color-mix(in oklch, var(--color-white) 25%, transparent),
      inset 0 -1px 0 color-mix(in oklch, var(--color-black) 15%, transparent),
      inset 1px 0 0 color-mix(in oklch, var(--color-white) 6%, transparent),
      inset -1px 0 0 color-mix(in oklch, var(--color-black) 6%, transparent);
  }

  /* Glossy lamination — specular hotspot + reflection line + ambient light */
  .kamishibai-card__front::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background:
      /* Soft specular hotspot — gentle top-left light reflection */
      radial-gradient(
        ellipse 80% 60% at 30% 25%,
        color-mix(in oklch, var(--color-white) 8%, transparent) 0%,
        transparent 60%
      ),
      /* Directional overhead ambient light */
      linear-gradient(
          155deg,
          color-mix(in oklch, var(--color-white) 6%, transparent) 0%,
          transparent 45%,
          color-mix(in oklch, var(--color-black) 8%, transparent) 100%
        );
    pointer-events: none;
    z-index: 1;
  }

  /* Zone 1: Header — code left, icons right */
  .kamishibai-card__header {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding-bottom: 0.375rem;
    border-bottom: 1px solid color-mix(in oklch, var(--color-black) 15%, transparent);
  }

  .kamishibai-card__code {
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .kamishibai-card__interval-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1.5px solid color-mix(in oklch, var(--color-white) 60%, transparent);
    flex-shrink: 0;
  }

  .kamishibai-card__approval {
    font-size: 0.7rem;
    opacity: 80%;
    margin-left: auto;
  }

  /* Zone 2: Body — title fills available space */
  .kamishibai-card__body {
    flex: 1;
    display: flex;
    align-items: center;
    padding: 0.5rem 0;
  }

  .kamishibai-card__title {
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.35;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    -webkit-box-orient: vertical;
  }

  /* Zone 3: Footer — time left, status right */
  .kamishibai-card__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.25rem;
    padding-top: 0.375rem;
    border-top: 1px solid color-mix(in oklch, var(--color-black) 15%, transparent);
  }

  .kamishibai-card__time {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.65rem;
    opacity: 80%;
  }

  .kamishibai-card__overdue-badge {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    margin-left: auto;
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background: color-mix(in oklch, var(--color-black) 25%, transparent);
    padding: 0.1rem 0.35rem;
    border-radius: var(--radius-xs, 4px);
  }

  .kamishibai-card__category-label {
    font-size: 0.625rem;
    font-weight: 600;
    margin-left: auto;
    background: color-mix(in oklch, var(--color-black) 20%, transparent);
    padding: 0.075rem 0.3rem;
    border-radius: var(--radius-xs, 4px);
    white-space: nowrap;
  }

  /* Back face — same physical edges as front */
  .kamishibai-card__back {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    height: 100%;
    padding: 0.75rem;
    background: var(--color-gray-800, #1f2937);
    border-radius: var(--card-radius);
    border-top: 1px solid color-mix(in oklch, var(--color-white) 10%, transparent);
    border-left: 1px solid color-mix(in oklch, var(--color-white) 5%, transparent);
    border-right: 1px solid color-mix(in oklch, var(--color-black) 10%, transparent);
    border-bottom: var(--card-edge) solid color-mix(in oklch, var(--color-black) 35%, transparent);
    box-shadow:
      inset 0 1px 0 color-mix(in oklch, var(--color-white) 10%, transparent),
      inset 0 -1px 0 color-mix(in oklch, var(--color-black) 20%, transparent);
    color: var(--color-gray-100, #f3f4f6);
    font-size: 0.75rem;
    overflow: hidden;
  }

  .kamishibai-card__back-code {
    font-size: 0.625rem;
    font-weight: 700;
    color: var(--color-gray-400, #9ca3af);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .kamishibai-card__desc {
    font-size: 0.75rem;
    line-height: 1.35;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    margin: 0;
    flex-shrink: 0;
  }

  .kamishibai-card__desc--empty {
    color: var(--color-gray-500, #6b7280);
    font-style: italic;
  }

  .kamishibai-card__location,
  .kamishibai-card__due,
  .kamishibai-card__last {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.688rem;
    color: var(--color-gray-300, #d1d5db);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .kamishibai-card__detail-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    width: 100%;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--color-gray-500, #6b7280);
    border-radius: var(--radius-sm, 6px);
    background: transparent;
    color: var(--color-gray-200, #e5e7eb);
    font-size: 0.688rem;
    font-weight: 500;
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease;
    margin-top: auto;
  }

  .kamishibai-card__detail-btn:hover {
    background: var(--color-gray-700, #374151);
    color: var(--color-white);
  }

  .kamishibai-card__detail-btn:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .kamishibai-card__flip-hint {
    font-size: 0.625rem;
    color: var(--color-gray-500, #6b7280);
    text-align: center;
  }

  @media (prefers-reduced-motion: reduce) {
    .kamishibai-card {
      transition: none;
    }

    .kamishibai-card--highlighted {
      animation: none;
    }
  }
</style>
