<script lang="ts">
  /**
   * CardDetail — Full detail panel for a Kamishibai card.
   * Rendered as a slide-over overlay from the right.
   * Orchestrates: card info, time estimate, execution form, approval panel.
   */
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
      <div class="card-detail__header-info">
        <span
          class="card-detail__status-dot"
          style="background-color: {statusColor}"
        ></span>
        <span class="card-detail__code">{card.cardCode}</span>
        <span class="card-detail__status-label">
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
                style="color: var(--color-warning, #f59e0b)"
              ></i>
              Ja
            </span>
          </div>
        {/if}
      </div>

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
  /* Overlay */
  .card-detail-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgb(0 0 0 / 40%);
    display: flex;
    justify-content: flex-end;
    animation: overlay-fade-in 0.2s ease;
  }

  @keyframes overlay-fade-in {
    from {
      opacity: 0%;
    }

    to {
      opacity: 100%;
    }
  }

  /* Panel */
  .card-detail {
    width: 100%;
    max-width: 420px;
    height: 100%;
    background: var(--color-white, #fff);
    box-shadow: var(--shadow-xl, -4px 0 20px rgb(0 0 0 / 15%));
    display: flex;
    flex-direction: column;
    animation: panel-slide-in 0.25s ease;
  }

  @keyframes panel-slide-in {
    from {
      transform: translateX(100%);
    }

    to {
      transform: translateX(0);
    }
  }

  /* Header */
  .card-detail__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--color-gray-200);
    flex-shrink: 0;
  }

  .card-detail__header-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .card-detail__status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .card-detail__code {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--color-gray-500);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .card-detail__status-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-gray-500);
  }

  .card-detail__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: none;
    border-radius: var(--radius-md, 8px);
    cursor: pointer;
    color: var(--color-gray-400);
    transition: background 0.15s ease;
  }

  .card-detail__close:hover {
    background: var(--color-gray-100);
    color: var(--color-gray-600);
  }

  .card-detail__close:focus-visible {
    outline: 2px solid var(--color-primary-400);
    outline-offset: 2px;
  }

  /* Title */
  .card-detail__title {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--color-gray-900);
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
    background: var(--color-gray-50, #f9fafb);
    border-radius: var(--radius-md, 8px);
    padding: 0.75rem;
  }

  .card-detail__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .card-detail__label {
    font-size: 0.75rem;
    color: var(--color-gray-500);
  }

  .card-detail__value {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-gray-800);
    text-align: right;
  }

  /* Sections */
  .card-detail__section {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .card-detail__section--action {
    border-top: 1px solid var(--color-gray-200);
    padding-top: 1rem;
  }

  .card-detail__section-title {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.813rem;
    font-weight: 600;
    color: var(--color-gray-700);
    margin: 0;
  }

  .card-detail__description {
    font-size: 0.813rem;
    color: var(--color-gray-700);
    line-height: 1.5;
    margin: 0;
    white-space: pre-wrap;
  }

  .card-detail__description--empty {
    color: var(--color-gray-400);
    font-style: italic;
  }

  .card-detail__location {
    font-size: 0.813rem;
    color: var(--color-gray-600);
    margin: 0;
  }

  /* Responsive: full width on mobile */
  @media (width <= 640px) {
    .card-detail {
      max-width: 100%;
    }
  }
</style>
