<script lang="ts">
  /**
   * RequestCard — Displays a single own vacation request.
   * Shows status badge, dates, type, days. Actions: detail, edit, withdraw.
   */
  import {
    HALF_DAY_LABELS,
    STATUS_BADGE_CLASS,
    STATUS_LABELS,
    TYPE_LABELS,
  } from './constants';

  import type { VacationRequest } from './types';

  const {
    request,
    onDetail,
    onEdit,
    onWithdraw,
  }: {
    request: VacationRequest;
    onDetail: (req: VacationRequest) => void;
    onEdit: (req: VacationRequest) => void;
    onWithdraw: (req: VacationRequest) => void;
  } = $props();

  const isPending = $derived(request.status === 'pending');

  /** Format ISO date to German locale display */
  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  const halfDayInfo = $derived(() => {
    const parts: string[] = [];
    if (request.halfDayStart !== 'none') {
      parts.push(`Start: ${HALF_DAY_LABELS[request.halfDayStart]}`);
    }
    if (request.halfDayEnd !== 'none') {
      parts.push(`Ende: ${HALF_DAY_LABELS[request.halfDayEnd]}`);
    }
    return parts.join(' | ');
  });
</script>

<div class="card request-card">
  <div class="request-card__header">
    <div class="request-card__type">
      <i class="fas fa-umbrella-beach mr-1"></i>
      {TYPE_LABELS[request.vacationType]}
    </div>
    <span class="badge {STATUS_BADGE_CLASS[request.status]}">
      {STATUS_LABELS[request.status]}
    </span>
  </div>

  <div class="request-card__body">
    <div class="request-card__dates">
      <i class="fas fa-calendar mr-1"></i>
      {formatDate(request.startDate)} — {formatDate(request.endDate)}
    </div>

    <div class="request-card__meta">
      <span
        >{request.computedDays}
        {request.computedDays === 1 ? 'Tag' : 'Tage'}</span
      >
      {#if halfDayInfo()}
        <span class="text-muted">{halfDayInfo()}</span>
      {/if}
    </div>

    {#if request.requestNote !== null}
      <div class="request-card__note">
        <i class="fas fa-comment mr-1"></i>
        {request.requestNote}
      </div>
    {/if}

    {#if request.responseNote !== null}
      <div class="request-card__response">
        <i class="fas fa-reply mr-1"></i>
        {request.responseNote}
      </div>
    {/if}
  </div>

  <div class="request-card__actions">
    <button
      type="button"
      class="btn btn-secondary btn-sm"
      onclick={() => {
        onDetail(request);
      }}
    >
      <i class="fas fa-eye mr-1"></i>
      Details
    </button>

    {#if isPending}
      <button
        type="button"
        class="btn btn-secondary btn-sm"
        onclick={() => {
          onEdit(request);
        }}
      >
        <i class="fas fa-edit mr-1"></i>
        Bearbeiten
      </button>

      <button
        type="button"
        class="btn btn-danger btn-sm"
        onclick={() => {
          onWithdraw(request);
        }}
      >
        <i class="fas fa-undo mr-1"></i>
        Zurueckziehen
      </button>
    {/if}
  </div>
</div>

<style>
  .request-card {
    padding: 1rem;
    transition: transform 0.15s ease;
  }

  .request-card:hover {
    transform: translateY(-1px);
  }

  .request-card__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .request-card__type {
    font-weight: 600;
    font-size: 0.9375rem;
  }

  .request-card__body {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    margin-bottom: 0.75rem;
  }

  .request-card__dates {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .request-card__meta {
    display: flex;
    gap: 0.75rem;
    font-size: 0.8125rem;
    color: var(--text-muted);
  }

  .request-card__note,
  .request-card__response {
    font-size: 0.8125rem;
    color: var(--text-muted);
    padding: 0.375rem 0.5rem;
    border-radius: var(--radius-sm, 0.25rem);
    background: var(--glass-bg, hsl(0deg 0% 100% / 5%));
  }

  .request-card__actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
</style>
