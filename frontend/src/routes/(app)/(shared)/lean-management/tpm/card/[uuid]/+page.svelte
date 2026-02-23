<script lang="ts">
  /**
   * TPM Card Detail — Full Page View
   *
   * Replaces the old slide-over overlay. Shows card info, time estimates,
   * execution form (red/overdue), approval panel (yellow), and links
   * to history page.
   */
  import { goto, invalidateAll } from '$app/navigation';
  import { resolve } from '$app/paths';

  import {
    MESSAGES,
    CARD_STATUS_LABELS,
    CARD_STATUS_BADGE_CLASSES,
    CARD_ROLE_LABELS,
    INTERVAL_LABELS,
    DEFAULT_COLORS,
  } from '../../_lib/constants';
  import ApprovalPanel from '../../board/[uuid]/_lib/ApprovalPanel.svelte';
  import ExecutionForm from '../../board/[uuid]/_lib/ExecutionForm.svelte';
  import TimeEstimateForm from '../../board/[uuid]/_lib/TimeEstimateForm.svelte';

  import type { PageData } from './$types';
  import type {
    TpmColorConfigEntry,
    TpmExecution,
    CardStatus,
  } from '../../_lib/types';

  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
  }

  const { data }: { data: PageData } = $props();

  const card = $derived(data.card);
  const colors = $derived(data.colors);
  const timeEstimates = $derived(data.timeEstimates);

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

  const statusColor = $derived(card !== null ? getColor(card.status) : '');
  const canExecute = $derived(
    card !== null && (card.status === 'red' || card.status === 'overdue'),
  );
  const isPendingApproval = $derived(card !== null && card.status === 'yellow');

  function handleExecutionCreated(_execution: TpmExecution): void {
    void invalidateAll();
  }

  function handleApprovalDone(_execution: TpmExecution): void {
    void invalidateAll();
  }

  function navigateToBoard(): void {
    if (card?.planUuid !== undefined) {
      void goto(resolvePath(`/lean-management/tpm/board/${card.planUuid}`));
    } else {
      void goto(resolvePath('/lean-management/tpm/overview'));
    }
  }

  function navigateToHistory(): void {
    if (card !== null) {
      void goto(resolvePath(`/lean-management/tpm/card/${card.uuid}/history`));
    }
  }
</script>

<svelte:head>
  <title>
    {card !== null ? `${card.cardCode}: ${card.title}` : 'Kartendetails'} — Assixx
  </title>
</svelte:head>

<div class="container">
  <!-- Back Navigation -->
  <div class="mb-4">
    <button
      type="button"
      class="btn btn-light"
      onclick={navigateToBoard}
    >
      <i class="fas fa-arrow-left mr-2"></i>
      Zurück zum Board
    </button>
  </div>

  {#if data.error !== null || card === null}
    <div class="empty-state">
      <div class="empty-state__icon">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <h3 class="empty-state__title">Karte nicht gefunden</h3>
      <p class="empty-state__description">
        Die angeforderte Karte existiert nicht oder wurde gelöscht.
      </p>
    </div>
  {:else}
    <!-- Page Header -->
    <div class="card">
      <div class="card__header">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <span
              class="card-detail__status-dot"
              style="background-color: {statusColor}"
            ></span>
            <div>
              <h2 class="card__title m-0">{card.title}</h2>
              <div class="mt-1 flex items-center gap-2">
                <span
                  class="text-xs font-bold tracking-wider text-(--color-text-muted) uppercase"
                >
                  {card.cardCode}
                </span>
                <span class="badge {CARD_STATUS_BADGE_CLASSES[card.status]}">
                  {CARD_STATUS_LABELS[card.status]}
                </span>
                {#if card.requiresApproval}
                  <span
                    class="text-xs text-(--color-warning)"
                    title={MESSAGES.DETAIL_APPROVAL_REQUIRED}
                  >
                    <i class="fas fa-lock"></i>
                  </span>
                {/if}
              </div>
            </div>
          </div>
          <button
            type="button"
            class="btn btn-primary"
            onclick={navigateToHistory}
          >
            <i class="fas fa-history mr-2"></i>
            {MESSAGES.HISTORY_HEADING}
          </button>
        </div>
      </div>
    </div>

    <!-- Detail Grid: Main (content) + Sidebar (metadata) -->
    <div class="card-detail-grid mt-4">
      <!-- Main: What to do + Where -->
      <div class="flex flex-col gap-4">
        <!-- Description -->
        <div class="card">
          <div class="card__body">
            <h3 class="card-detail__section-title mb-2">
              <i class="fas fa-align-left"></i>
              {MESSAGES.DETAIL_DESCRIPTION}
            </h3>
            {#if card.description !== null}
              <p class="card-detail__description">{card.description}</p>
            {:else}
              <p
                class="card-detail__description card-detail__description--empty"
              >
                {MESSAGES.DETAIL_NO_DESCRIPTION}
              </p>
            {/if}
          </div>
        </div>

        <!-- Location -->
        {#if card.locationDescription !== null}
          <div class="card">
            <div class="card__body">
              <h3 class="card-detail__section-title mb-2">
                <i class="fas fa-map-marker-alt"></i>
                {MESSAGES.DETAIL_LOCATION}
              </h3>
              <p class="card-detail__location">{card.locationDescription}</p>
            </div>
          </div>
        {/if}
      </div>

      <!-- Sidebar: Card metadata + Time estimate -->
      <div class="flex flex-col gap-4">
        <!-- Card Info -->
        <div class="card">
          <div class="card__body">
            <h3 class="card-detail__section-title mb-3">
              <i class="fas fa-info-circle"></i>
              {MESSAGES.DETAIL_HEADING}
            </h3>
            <div class="card-detail__info">
              <div class="card-detail__row">
                <span class="card-detail__label">{MESSAGES.DETAIL_CODE}</span>
                <span class="card-detail__value">{card.cardCode}</span>
              </div>
              <div class="card-detail__row">
                <span class="card-detail__label">{MESSAGES.DETAIL_ROLE}</span>
                <span class="card-detail__value">
                  {CARD_ROLE_LABELS[card.cardRole] ?? card.cardRole}
                </span>
              </div>
              <div class="card-detail__row">
                <span class="card-detail__label"
                  >{MESSAGES.DETAIL_INTERVAL}</span
                >
                <span class="card-detail__value">
                  {INTERVAL_LABELS[card.intervalType]}
                </span>
              </div>
              <div class="card-detail__row">
                <span class="card-detail__label">{MESSAGES.DETAIL_STATUS}</span>
                <span class="card-detail__value">
                  {CARD_STATUS_LABELS[card.status]}
                </span>
              </div>
              <div class="card-detail__row">
                <span class="card-detail__label"
                  >{MESSAGES.DETAIL_DUE_DATE}</span
                >
                <span class="card-detail__value">
                  {formatDate(card.currentDueDate)}
                </span>
              </div>
              {#if card.lastCompletedAt !== null}
                <div class="card-detail__row">
                  <span class="card-detail__label">
                    {MESSAGES.DETAIL_LAST_COMPLETED}
                  </span>
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
                  <span class="card-detail__label">
                    {MESSAGES.DETAIL_APPROVAL_REQUIRED}
                  </span>
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
          </div>
        </div>

        <!-- Time Estimate -->
        <div class="card">
          <div class="card__body">
            <TimeEstimateForm
              estimates={timeEstimates}
              intervalType={card.intervalType}
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Action Section (full width, own row) -->
    <div class="mt-4">
      {#if canExecute}
        <div class="card">
          <div class="card__body">
            <ExecutionForm
              {card}
              onExecutionCreated={handleExecutionCreated}
            />
          </div>
        </div>
      {/if}

      {#if isPendingApproval}
        <div class="card">
          <div class="card__body">
            <ApprovalPanel
              {card}
              onApprovalDone={handleApprovalDone}
            />
          </div>
        </div>
      {/if}

      {#if !canExecute && !isPendingApproval}
        <div class="card">
          <div class="card__body">
            <div class="py-4 text-center">
              <i
                class="fas fa-check-circle mb-2 text-2xl"
                style="color: var(--color-success)"
              ></i>
              <p class="text-sm text-(--color-text-muted)">
                Diese Karte ist aktuell erledigt. Keine Aktion erforderlich.
              </p>
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .card-detail-grid {
    display: grid;
    grid-template-columns: 1fr 475px;
    gap: 1rem;
    align-items: start;
  }

  @media (width <= 768px) {
    .card-detail-grid {
      grid-template-columns: 1fr;
    }
  }

  .card-detail__status-dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .card-detail__section-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .card-detail__info {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .card-detail__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.25rem 0;
    border-bottom: 1px solid var(--color-glass-border);
  }

  .card-detail__row:last-child {
    border-bottom: none;
  }

  .card-detail__label {
    font-size: 0.813rem;
    color: var(--color-text-muted);
  }

  .card-detail__value {
    font-size: 0.813rem;
    font-weight: 500;
    color: var(--color-text-primary);
    text-align: right;
  }

  .card-detail__description {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    line-height: 1.6;
    margin: 0;
    white-space: pre-wrap;
  }

  .card-detail__description--empty {
    color: var(--color-text-muted);
    font-style: italic;
  }

  .card-detail__location {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    margin: 0;
  }
</style>
