<script lang="ts">
  /**
   * KamishibaiCard — Individual maintenance card with 3D flip animation.
   * Front: status color + card code + title.
   * Back (on click): description, location, due date.
   * CardDetail (Step 5.6) will be triggered from the back face.
   */
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';

  import { CARD_STATUS_LABELS, DEFAULT_COLORS } from '../../../_lib/constants';

  import CardFlip from './CardFlip.svelte';

  import type {
    TpmCard,
    TpmColorConfigEntry,
    IntervalColorConfigEntry,
    CardStatus,
  } from '../../../_lib/types';

  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
  }

  interface Props {
    card: TpmCard;
    colors: TpmColorConfigEntry[];
    intervalColors: IntervalColorConfigEntry[];
  }

  const { card, colors, intervalColors }: Props = $props();

  let isFlipped = $state(false);

  function getColor(status: CardStatus): string {
    const found = colors.find(
      (c: TpmColorConfigEntry) => c.statusKey === status,
    );
    return found !== undefined ? found.colorHex : DEFAULT_COLORS[status];
  }

  function getCardColor(status: CardStatus): string {
    if (status === 'green') {
      const interval = intervalColors.find(
        (ic: IntervalColorConfigEntry) =>
          ic.statusKey === card.intervalType && ic.includeInCard,
      );
      if (interval !== undefined) return interval.colorHex;
    }
    return getColor(status);
  }

  const statusColor = $derived(getCardColor(card.status));
  const isUrgent = $derived(card.status === 'red' || card.status === 'overdue');

  const intervalDotColor = $derived.by((): string | null => {
    if (card.status === 'green') return null;
    const interval = intervalColors.find(
      (ic: IntervalColorConfigEntry) =>
        ic.statusKey === card.intervalType && ic.includeInCard,
    );
    return interval !== undefined ? interval.colorHex : null;
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
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  }
</script>

<div
  class="kamishibai-card"
  class:kamishibai-card--urgent={isUrgent}
  onclick={toggle}
  onkeydown={handleKeydown}
  role="button"
  tabindex="0"
  aria-label="{card.cardCode}: {card.title}"
  aria-pressed={isFlipped}
>
  {#if isUrgent}
    <span
      class="kamishibai-card__pulse"
      style="background-color: {statusColor}"
    ></span>
  {/if}
  <CardFlip {isFlipped}>
    {#snippet front()}
      <div
        class="kamishibai-card__front"
        style="background-color: {statusColor}"
      >
        <div class="kamishibai-card__header">
          {#if intervalDotColor !== null}
            <span
              class="kamishibai-card__interval-dot"
              style="background-color: {intervalDotColor}"
            ></span>
          {/if}
          <span class="kamishibai-card__code">{card.cardCode}</span>
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
          <span class="kamishibai-card__status-label">
            {CARD_STATUS_LABELS[card.status]}
          </span>
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
          <p class="kamishibai-card__desc kamishibai-card__desc--empty">
            Keine Beschreibung
          </p>
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
            void goto(resolvePath(`/lean-management/tpm/card/${card.uuid}`));
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
    --card-radius: var(--radius-xs);

    position: relative;
    isolation: isolate;
    width: 160px;
    height: 210px;
    border-radius: var(--card-radius);
    cursor: pointer;
    flex-shrink: 0;
    outline: none;
  }

  .kamishibai-card:focus-visible {
    box-shadow: 0 0 0 3px var(--color-primary);
  }

  /* Urgency pulse ring — direct child of .kamishibai-card (no overflow:hidden parent)
     z-index: -1 puts it behind CardFlip content within the isolate stacking context */
  .kamishibai-card__pulse {
    position: absolute;
    inset: -4px;
    border-radius: inherit;
    opacity: 35%;
    animation: pulse-ring 3s ease-out infinite;
    z-index: -1;
    pointer-events: none;
  }

  @keyframes pulse-ring {
    0% {
      transform: scale(1);
      opacity: 35%;
    }

    70% {
      transform: scale(1.06);
      opacity: 0%;
    }

    100% {
      transform: scale(1.06);
      opacity: 0%;
    }
  }

  /* Front face — 3-zone layout: header | body | footer */
  .kamishibai-card__front {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 0.625rem;
    color: #fff;
    border-radius: var(--card-radius);
  }

  /* Zone 1: Header — code left, icons right */
  .kamishibai-card__header {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding-bottom: 0.375rem;
    border-bottom: 1px solid rgb(0 0 0 / 15%);
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
    border: 1.5px solid rgb(255 255 255 / 60%);
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
    border-top: 1px solid rgb(0 0 0 / 15%);
  }

  .kamishibai-card__time {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.65rem;
    opacity: 80%;
  }

  .kamishibai-card__status-label {
    font-size: 0.65rem;
    opacity: 85%;
    margin-left: auto;
  }

  /* Back face */
  .kamishibai-card__back {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    height: 100%;
    padding: 0.75rem;
    background: var(--color-gray-800, #1f2937);
    border-radius: var(--card-radius);
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
    color: #fff;
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
</style>
