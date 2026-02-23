<script lang="ts">
  /**
   * CardDetail — Full detail panel for a Kamishibai card.
   * Rendered as a slide-over overlay from the right.
   * Orchestrates: card info, time estimate, execution form, approval panel.
   */
  import { resolve } from '$app/paths';

  import { fetchTimeEstimates, logApiError } from '../../../_lib/api';
  import {
    MESSAGES,
    CARD_STATUS_LABELS,
    CARD_ROLE_LABELS,
    INTERVAL_LABELS,
    DEFAULT_COLORS,
  } from '../../../_lib/constants';

  import ApprovalPanel from './ApprovalPanel.svelte';
  import ExecutionForm from './ExecutionForm.svelte';
  import TimeEstimateForm from './TimeEstimateForm.svelte';

  import type {
    TpmCard,
    TpmColorConfigEntry,
    TpmExecution,
    TpmTimeEstimate,
    CardStatus,
  } from '../../../_lib/types';

  interface Props {
    card: TpmCard;
    planUuid: string;
    colors: TpmColorConfigEntry[];
    onClose: () => void;
    onCardUpdated: () => void;
  }

  const { card, planUuid, colors, onClose, onCardUpdated }: Props = $props();

  let timeEstimates = $state<TpmTimeEstimate[]>([]);
  let estimatesLoading = $state(true);

  function getColor(status: CardStatus): string {
    const found = colors.find(
      (c: TpmColorConfigEntry) => c.statusKey === status,
    );
    return found !== undefined ? found.colorHex : DEFAULT_COLORS[status];
  }

  function formatDate(dateStr: string | null): string {
    if (dateStr === null) return '—';
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  const canExecute = $derived(
    card.status === 'red' || card.status === 'overdue',
  );
  const isPendingApproval = $derived(card.status === 'yellow');
  const statusColor = $derived(getColor(card.status));

  /** Load time estimates on mount */
  async function loadTimeEstimates(): Promise<void> {
    estimatesLoading = true;
    try {
      timeEstimates = await fetchTimeEstimates(planUuid);
    } catch (err: unknown) {
      logApiError('fetchTimeEstimates', err);
    } finally {
      estimatesLoading = false;
    }
  }

  function handleExecutionCreated(_execution: TpmExecution): void {
    onCardUpdated();
  }

  function handleApprovalDone(_execution: TpmExecution): void {
    onCardUpdated();
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') onClose();
  }

  function handleOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onClose();
  }

  // Load on mount
  $effect(() => {
    void loadTimeEstimates();
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="card-detail-overlay"
  onclick={handleOverlayClick}
  onkeydown={handleKeydown}
>
  <div
    class="card-detail"
    role="dialog"
    aria-label="{card.cardCode}: {card.title}"
  >
    <!-- Header -->
    <div class="card-detail__header">
      <div class="flex items-center gap-2">
        <span
          class="card-detail__status-dot"
          style="background-color: {statusColor}"
        ></span>
        <span
          class="text-xs font-bold tracking-wider text-(--color-text-muted) uppercase"
        >
          {card.cardCode}
        </span>
        <span class="text-xs text-(--color-text-muted)">
          {CARD_STATUS_LABELS[card.status]}
        </span>
      </div>
      <button
        type="button"
        class="card-detail__close"
        onclick={onClose}
        aria-label={MESSAGES.DETAIL_CLOSE}
      >
        <i class="fas fa-times"></i>
      </button>
    </div>

    <!-- Card title -->
    <h3 class="card-detail__title">{card.title}</h3>

    <!-- Scrollable content -->
    <div class="card-detail__body">
      <!-- Info grid -->
      <div class="card-detail__info">
        <div class="card-detail__row">
          <span class="card-detail__label">{MESSAGES.DETAIL_ROLE}</span>
          <span class="card-detail__value">
            {CARD_ROLE_LABELS[card.cardRole] ?? card.cardRole}
          </span>
        </div>
        <div class="card-detail__row">
          <span class="card-detail__label">{MESSAGES.DETAIL_INTERVAL}</span>
          <span class="card-detail__value">
            {INTERVAL_LABELS[card.intervalType]}
          </span>
        </div>
        <div class="card-detail__row">
          <span class="card-detail__label">{MESSAGES.DETAIL_DUE_DATE}</span>
          <span class="card-detail__value"
            >{formatDate(card.currentDueDate)}</span
          >
        </div>
        {#if card.lastCompletedAt !== null}
          <div class="card-detail__row">
            <span class="card-detail__label"
              >{MESSAGES.DETAIL_LAST_COMPLETED}</span
            >
            <span class="card-detail__value">
              {formatDate(card.lastCompletedAt)}
              {#if card.lastCompletedByName !== undefined}
                ({card.lastCompletedByName})
              {/if}
            </span>
          </div>
        {/if}
        {#if card.requiresApproval}
          <div class="card-detail__row">
            <span class="card-detail__label"
              >{MESSAGES.DETAIL_APPROVAL_REQUIRED}</span
            >
            <span class="card-detail__value">
              <i
                class="fas fa-lock"
                style="color: var(--color-warning)"
              ></i>
              Ja
            </span>
          </div>
        {/if}
      </div>

      <!-- History link -->
      <a
        href={(resolve as (p: string) => string)(
          `/lean-management/tpm/card/${card.uuid}/history`,
        )}
        class="card-detail__history-link"
      >
        <i class="fas fa-history"></i>
        {MESSAGES.HISTORY_HEADING}
      </a>

      <!-- Description -->
      <div class="card-detail__section">
        <h4 class="card-detail__section-title">
          {MESSAGES.DETAIL_DESCRIPTION}
        </h4>
        {#if card.description !== null}
          <p class="card-detail__description">{card.description}</p>
        {:else}
          <p class="card-detail__description card-detail__description--empty">
            {MESSAGES.DETAIL_NO_DESCRIPTION}
          </p>
        {/if}
      </div>

      <!-- Location -->
      {#if card.locationDescription !== null}
        <div class="card-detail__section">
          <h4 class="card-detail__section-title">
            <i class="fas fa-map-marker-alt"></i>
            {MESSAGES.DETAIL_LOCATION}
          </h4>
          <p class="card-detail__location">{card.locationDescription}</p>
        </div>
      {/if}

      <!-- Time Estimate -->
      {#if !estimatesLoading}
        <div class="card-detail__section">
          <TimeEstimateForm
            estimates={timeEstimates}
            intervalType={card.intervalType}
          />
        </div>
      {/if}

      <!-- Execution Form (red/overdue cards) -->
      {#if canExecute}
        <div class="card-detail__section card-detail__section--action">
          <ExecutionForm
            {card}
            {timeEstimates}
            onExecutionCreated={handleExecutionCreated}
          />
        </div>
      {/if}

      <!-- Approval Panel (yellow cards) -->
      {#if isPendingApproval}
        <div class="card-detail__section card-detail__section--action">
          <ApprovalPanel
            {card}
            onApprovalDone={handleApprovalDone}
          />
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  /* Scroll lock while panel is open */
  :global(body:has(.card-detail-overlay)) {
    overflow: hidden;
  }

  /* Overlay — matches .modal-overlay from design system */
  .card-detail-overlay {
    position: fixed;
    inset: 0;
    z-index: 2000;
    background: rgb(0 0 0 / 60%);
    backdrop-filter: blur(8px);
    display: flex;
    justify-content: flex-end;
    animation: overlay-fade-in 0.2s ease;
  }

  /* Panel — matches .ds-modal from design system */
  .card-detail {
    width: 100%;
    max-width: 420px;
    height: 100%;
    background: rgb(255 255 255 / 95%);
    border-left: var(--glass-border);
    box-shadow: var(--shadow-xl);
    display: flex;
    flex-direction: column;
    animation: panel-slide-in 0.25s ease;
  }

  :global(html.dark) .card-detail {
    background: rgb(15 15 15 / 95%);
  }

  /* Header — matches .ds-modal__header from design system */
  .card-detail__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    background: var(--glass-bg);
    border-bottom: 1px solid var(--color-glass-border);
    flex-shrink: 0;
  }

  :global(html.dark) .card-detail__header {
    background: rgb(0 0 0 / 20%);
  }

  .card-detail__status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .card-detail__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    color: var(--color-text-muted);
    transition: background 0.15s ease;
  }

  .card-detail__close:hover {
    background: var(--glass-bg-active);
    color: var(--color-text-secondary);
  }

  .card-detail__close:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  /* Title */
  .card-detail__title {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--color-text-primary);
    padding: 0.75rem 1.25rem 0;
    margin: 0;
    flex-shrink: 0;
  }

  /* Scrollable body */
  .card-detail__body {
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem 1.25rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* Info grid */
  .card-detail__info {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    background: var(--glass-bg-hover);
    border-radius: var(--radius-md);
    padding: 0.75rem;
  }

  .card-detail__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .card-detail__label {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .card-detail__value {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-text-primary);
    text-align: right;
  }

  /* Sections */
  .card-detail__section {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .card-detail__section--action {
    border-top: 1px solid var(--color-glass-border);
    padding-top: 1rem;
  }

  .card-detail__section-title {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.813rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .card-detail__description {
    font-size: 0.813rem;
    color: var(--color-text-secondary);
    line-height: 1.5;
    margin: 0;
    white-space: pre-wrap;
  }

  .card-detail__description--empty {
    color: var(--color-text-muted);
    font-style: italic;
  }

  .card-detail__location {
    font-size: 0.813rem;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .card-detail__history-link {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.813rem;
    font-weight: 500;
    color: var(--color-primary);
    text-decoration: none;
    padding: 0.375rem 0;
    transition: opacity 0.15s ease;
  }

  .card-detail__history-link:hover {
    opacity: 80%;
    text-decoration: underline;
  }

  @media (prefers-reduced-motion: reduce) {
    .card-detail-overlay {
      animation: none;
    }

    .card-detail {
      animation: none;
    }
  }

  @media (width <= 640px) {
    .card-detail {
      max-width: 100%;
    }
  }

  @keyframes overlay-fade-in {
    from {
      opacity: 0%;
    }

    to {
      opacity: 100%;
    }
  }

  @keyframes panel-slide-in {
    from {
      transform: translateX(100%);
    }

    to {
      transform: translateX(0);
    }
  }
</style>
