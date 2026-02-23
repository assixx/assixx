<script lang="ts">
  /**
   * DetailModal — Read-only view of a vacation request.
   * Shows all request details in a structured grid layout.
   */
  import {
    HALF_DAY_LABELS,
    STATUS_BADGE_CLASS,
    STATUS_LABELS,
    TYPE_LABELS,
  } from './constants';

  import type { VacationRequest } from './types';

  interface Props {
    request: VacationRequest;
    canApprove: boolean;
    onclose: () => void;
  }

  const { request, canApprove, onclose }: Props = $props();

  /** Format ISO date to German locale display */
  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  /** Build half-day info string for detail view */
  function getHalfDayInfo(req: VacationRequest): string {
    const parts: string[] = [];
    if (req.halfDayStart !== 'none') {
      parts.push(`Start: ${HALF_DAY_LABELS[req.halfDayStart]}`);
    }
    if (req.halfDayEnd !== 'none') {
      parts.push(`Ende: ${HALF_DAY_LABELS[req.halfDayEnd]}`);
    }
    return parts.join(' | ');
  }
</script>

<div
  id="vacation-detail-modal"
  class="modal-overlay modal-overlay--active"
  role="dialog"
  aria-modal="true"
  tabindex="-1"
  onclick={onclose}
  onkeydown={(e) => {
    if (e.key === 'Escape') onclose();
  }}
>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="ds-modal"
    role="document"
    onclick={(e) => {
      e.stopPropagation();
    }}
    onkeydown={(e) => {
      e.stopPropagation();
    }}
  >
    <div class="ds-modal__header">
      <h3 class="ds-modal__title">
        <i class="fas fa-eye mr-2"></i>
        Antragsdetails
      </h3>
      <button
        type="button"
        class="ds-modal__close"
        aria-label="Schließen"
        onclick={onclose}
      >
        <i class="fas fa-times"></i>
      </button>
    </div>

    <div class="ds-modal__body">
      <div class="detail-grid">
        <div class="detail-grid__row">
          <span class="detail-grid__label">Status</span>
          <span class="badge {STATUS_BADGE_CLASS[request.status]}">
            {STATUS_LABELS[request.status]}
          </span>
        </div>

        <div class="detail-grid__row">
          <span class="detail-grid__label">Urlaubsart</span>
          <span>{TYPE_LABELS[request.vacationType]}</span>
        </div>

        <div class="detail-grid__row">
          <span class="detail-grid__label">Zeitraum</span>
          <span>
            {formatDate(request.startDate)} — {formatDate(request.endDate)}
          </span>
        </div>

        <div class="detail-grid__row">
          <span class="detail-grid__label">Tage</span>
          <span>
            {request.computedDays}
            {request.computedDays === 1 ? 'Tag' : 'Tage'}
          </span>
        </div>

        {#if getHalfDayInfo(request) !== ''}
          <div class="detail-grid__row">
            <span class="detail-grid__label">Halbe Tage</span>
            <span>{getHalfDayInfo(request)}</span>
          </div>
        {/if}

        {#if request.requesterName}
          <div class="detail-grid__row">
            <span class="detail-grid__label">Antragsteller</span>
            <span>{request.requesterName}</span>
          </div>
        {/if}

        {#if request.requestNote !== null}
          <div class="detail-grid__row">
            <span class="detail-grid__label">Bemerkung</span>
            <span>{request.requestNote}</span>
          </div>
        {/if}

        {#if request.responseNote !== null}
          <div class="detail-grid__row">
            <span class="detail-grid__label">
              {request.status === 'cancelled' ? 'Stornierungsgrund'
              : request.status === 'denied' ? 'Ablehnungsgrund'
              : 'Antwort'}
            </span>
            <span>{request.responseNote}</span>
          </div>
        {/if}

        {#if request.approverName}
          <div class="detail-grid__row">
            <span class="detail-grid__label">Bearbeitet von</span>
            <span>{request.approverName}</span>
          </div>
        {/if}

        {#if request.respondedAt !== null}
          <div class="detail-grid__row">
            <span class="detail-grid__label">Bearbeitet am</span>
            <span>{formatDate(request.respondedAt)}</span>
          </div>
        {/if}

        <div class="detail-grid__row">
          <span class="detail-grid__label">Erstellt am</span>
          <span>{formatDate(request.createdAt)}</span>
        </div>
      </div>

      {#if request.status === 'pending' && canApprove}
        <div class="alert alert--warning mb-4">
          <div class="alert__icon">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          <div class="alert__content">
            <div class="alert__title">Schichtplan-Hinweis</div>
            <div class="alert__message">
              Der Mitarbeiter könnte in diesem Zeitraum im Schichtplan
              eingeplant sein. Bitte Schichtplan manuell überprüfen!
            </div>
          </div>
        </div>
      {/if}
    </div>

    <div class="ds-modal__footer">
      <button
        type="button"
        class="btn btn-cancel"
        onclick={onclose}
      >
        Schließen
      </button>
    </div>
  </div>
</div>

<style>
  .detail-grid {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .detail-grid__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-2) 0;
    border-bottom: 1px solid var(--color-glass-border);
  }

  .detail-grid__row:last-child {
    border-bottom: none;
  }

  .detail-grid__label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-muted);
    flex-shrink: 0;
    margin-right: var(--spacing-4);
  }
</style>
