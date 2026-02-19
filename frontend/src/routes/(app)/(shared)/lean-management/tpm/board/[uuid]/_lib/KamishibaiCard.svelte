<script lang="ts">
  /**
   * KamishibaiCard — Individual maintenance card with 3D flip animation.
   * Front: status color + card code + title.
   * Back (on click): description, location, due date.
   * CardDetail (Step 5.6) will be triggered from the back face.
   */
  import { CARD_STATUS_LABELS, DEFAULT_COLORS } from '../../../_lib/constants';

  import CardFlip from './CardFlip.svelte';

  import type {
    TpmCard,
    TpmColorConfigEntry,
    CardStatus,
  } from '../../../_lib/types';

  interface Props {
    card: TpmCard;
    colors: TpmColorConfigEntry[];
    onCardSelect?: (card: TpmCard) => void;
  }

  const { card, colors, onCardSelect }: Props = $props();

  let isFlipped = $state(false);

  function getColor(status: CardStatus): string {
    const found = colors.find(
      (c: TpmColorConfigEntry) => c.statusKey === status,
    );
    return found !== undefined ? found.colorHex : DEFAULT_COLORS[status];
  }

  const statusColor = $derived(getColor(card.status));
  const isUrgent = $derived(card.status === 'red' || card.status === 'overdue');

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
  <CardFlip {isFlipped}>
    {#snippet front()}
      <div
        class="kamishibai-card__front"
        style="background-color: {statusColor}"
      >
        {#if isUrgent}
          <span
            class="kamishibai-card__pulse"
            style="background-color: {statusColor}"
          ></span>
        {/if}
        <div class="kamishibai-card__code">{card.cardCode}</div>
        <div class="kamishibai-card__title">{card.title}</div>
        <div class="kamishibai-card__status-label">
          {CARD_STATUS_LABELS[card.status]}
        </div>
        {#if card.requiresApproval}
          <span
            class="kamishibai-card__approval"
            title="Freigabe erforderlich"
          >
            <i class="fas fa-lock"></i>
          </span>
        {/if}
      </div>
    {/snippet}

    {#snippet back()}
      <div class="kamishibai-card__back">
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
        {#if onCardSelect !== undefined}
          <button
            type="button"
            class="kamishibai-card__detail-btn"
            onclick={(e: MouseEvent) => {
              e.stopPropagation();
              onCardSelect(card);
            }}
          >
            <i class="fas fa-expand-alt"></i>
            Details
          </button>
        {/if}
        <div class="kamishibai-card__flip-hint">
          <i class="fas fa-sync-alt"></i> Zurückdrehen
        </div>
      </div>
    {/snippet}
  </CardFlip>
</div>

<style>
  .kamishibai-card {
    position: relative;
    width: 140px;
    height: 180px;
    border-radius: var(--radius-lg, 12px);
    cursor: pointer;
    flex-shrink: 0;
    outline: none;
  }

  .kamishibai-card:focus-visible {
    box-shadow: 0 0 0 3px var(--color-primary-400, #60a5fa);
  }

  /* Urgency pulse ring */
  .kamishibai-card__pulse {
    position: absolute;
    inset: -4px;
    border-radius: inherit;
    opacity: 35%;
    animation: pulse-ring 1.8s ease-out infinite;
    z-index: 0;
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

  /* Front face */
  .kamishibai-card__front {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 0.75rem;
    color: #fff;
    text-align: center;
    position: relative;
  }

  .kamishibai-card__code {
    font-size: 0.75rem;
    font-weight: 700;
    opacity: 85%;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    margin-bottom: 0.375rem;
  }

  .kamishibai-card__title {
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.3;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    margin-bottom: 0.5rem;
  }

  .kamishibai-card__status-label {
    font-size: 0.7rem;
    opacity: 80%;
    border: 1px solid rgb(255 255 255 / 40%);
    border-radius: var(--radius-full, 9999px);
    padding: 0.125rem 0.5rem;
    margin-top: auto;
  }

  .kamishibai-card__approval {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    font-size: 0.75rem;
    opacity: 85%;
  }

  /* Back face */
  .kamishibai-card__back {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    height: 100%;
    padding: 0.75rem;
    background: var(--color-gray-800, #1f2937);
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
    outline: 2px solid var(--color-primary-400, #60a5fa);
    outline-offset: 2px;
  }

  .kamishibai-card__flip-hint {
    font-size: 0.625rem;
    color: var(--color-gray-500, #6b7280);
    text-align: center;
  }
</style>
