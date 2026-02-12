<script lang="ts">
  /**
   * IncomingRequestCard — Shows a request pending approval.
   * Displays requester name, dates, type. Actions: approve, deny, view capacity.
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
    onApprove,
    onDeny,
    onDetail,
  }: {
    request: VacationRequest;
    onApprove: (req: VacationRequest) => void;
    onDeny: (req: VacationRequest) => void;
    onDetail: (req: VacationRequest) => void;
  } = $props();

  const isPending = $derived(request.status === 'pending');

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

<div class="card incoming-card">
  <div class="incoming-card__header">
    <div class="incoming-card__requester">
      <i class="fas fa-user mr-1"></i>
      {request.requesterName ?? 'Unbekannt'}
    </div>
    <span class="badge {STATUS_BADGE_CLASS[request.status]}">
      {STATUS_LABELS[request.status]}
    </span>
  </div>

  <div class="incoming-card__body">
    <div class="incoming-card__type">
      {TYPE_LABELS[request.vacationType]}
    </div>

    <div class="incoming-card__dates">
      <i class="fas fa-calendar mr-1"></i>
      {formatDate(request.startDate)} — {formatDate(request.endDate)}
      <span class="ml-2">
        ({request.computedDays}
        {request.computedDays === 1 ? 'Tag' : 'Tage'})
      </span>
    </div>

    {#if halfDayInfo()}
      <div class="incoming-card__meta text-muted">{halfDayInfo()}</div>
    {/if}

    {#if request.requestNote !== null}
      <div class="incoming-card__note">
        <i class="fas fa-comment mr-1"></i>
        {request.requestNote}
      </div>
    {/if}
  </div>

  <div class="incoming-card__actions">
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
        class="btn btn-primary btn-sm"
        onclick={() => {
          onApprove(request);
        }}
      >
        <i class="fas fa-check mr-1"></i>
        Genehmigen
      </button>

      <button
        type="button"
        class="btn btn-danger btn-sm"
        onclick={() => {
          onDeny(request);
        }}
      >
        <i class="fas fa-times mr-1"></i>
        Ablehnen
      </button>
    {/if}
  </div>
</div>

<style>
  .incoming-card {
    padding: 1rem;
    transition: transform 0.15s ease;
  }

  .incoming-card:hover {
    transform: translateY(-1px);
  }

  .incoming-card__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .incoming-card__requester {
    font-weight: 600;
    font-size: 0.9375rem;
  }

  .incoming-card__body {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    margin-bottom: 0.75rem;
  }

  .incoming-card__type {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .incoming-card__dates {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .incoming-card__meta {
    font-size: 0.8125rem;
  }

  .incoming-card__note {
    font-size: 0.8125rem;
    color: var(--text-muted);
    padding: 0.375rem 0.5rem;
    border-radius: var(--radius-sm, 0.25rem);
    background: var(--glass-bg, hsl(0deg 0% 100% / 5%));
  }

  .incoming-card__actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
</style>
