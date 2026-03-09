<script lang="ts">
  /**
   * WorkOrderInfo — Header info card with metadata fields.
   * Displays title, priority, source, dates, creator in a data-list layout.
   */
  import {
    PRIORITY_LABELS,
    PRIORITY_BADGE_CLASSES,
    PRIORITY_ICONS,
    SOURCE_TYPE_LABELS,
    MESSAGES,
  } from '../../_lib/constants';

  import type { WorkOrder } from '../../_lib/types';

  interface Props {
    workOrder: WorkOrder;
  }

  const { workOrder }: Props = $props();

  const priorityLabel = $derived(PRIORITY_LABELS[workOrder.priority]);
  const priorityBadge = $derived(PRIORITY_BADGE_CLASSES[workOrder.priority]);
  const priorityIcon = $derived(PRIORITY_ICONS[workOrder.priority]);
  const sourceLabel = $derived(SOURCE_TYPE_LABELS[workOrder.sourceType]);

  /** URL to the original source entity (only for linked source types with known URL pattern) */
  const sourceUrl = $derived.by((): string | null => {
    if (workOrder.sourceUuid === null) return null;
    if (workOrder.sourceType === 'kvp_proposal')
      return `/kvp-detail?uuid=${workOrder.sourceUuid}`;
    return null;
  });

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
</script>

<div class="data-list">
  <!-- Priorität -->
  <div class="data-list__item">
    <span class="data-list__label">{MESSAGES.DETAIL_PRIORITY}</span>
    <span class="data-list__value">
      <span class="badge {priorityBadge}">
        <i class="fas {priorityIcon}"></i>
        {priorityLabel}
      </span>
    </span>
  </div>

  <!-- Quelle -->
  <div class="data-list__item">
    <span class="data-list__label">{MESSAGES.DETAIL_SOURCE}</span>
    <span class="data-list__value">
      {sourceLabel}
      {#if sourceUrl !== null}
        <a
          href={sourceUrl}
          class="source-link"
        >
          <i class="fas fa-external-link-alt"></i>
          Original anzeigen
        </a>
      {/if}
    </span>
  </div>

  <!-- Fälligkeitsdatum -->
  <div class="data-list__item">
    <span class="data-list__label">{MESSAGES.DETAIL_DUE_DATE}</span>
    <span class="data-list__value">
      {formatDate(workOrder.dueDate)}
    </span>
  </div>

  <!-- Erstellt von -->
  <div class="data-list__item">
    <span class="data-list__label">{MESSAGES.DETAIL_CREATED_BY}</span>
    <span class="data-list__value">{workOrder.createdByName}</span>
  </div>

  <!-- Erstellt am -->
  <div class="data-list__item">
    <span class="data-list__label">{MESSAGES.DETAIL_CREATED_AT}</span>
    <span class="data-list__value">{formatDateTime(workOrder.createdAt)}</span>
  </div>

  <!-- Abgeschlossen am -->
  {#if workOrder.completedAt !== null}
    <div class="data-list__item">
      <span class="data-list__label">{MESSAGES.DETAIL_COMPLETED_AT}</span>
      <span class="data-list__value">
        {formatDateTime(workOrder.completedAt)}
      </span>
    </div>
  {/if}

  <!-- Verifiziert -->
  {#if workOrder.verifiedAt !== null}
    <div class="data-list__item">
      <span class="data-list__label">{MESSAGES.DETAIL_VERIFIED_AT}</span>
      <span class="data-list__value">
        {formatDateTime(workOrder.verifiedAt)}
        {#if workOrder.verifiedByName !== null}
          ({MESSAGES.DETAIL_VERIFIED_BY}: {workOrder.verifiedByName})
        {/if}
      </span>
    </div>
  {/if}
</div>

<style>
  .source-link {
    display: inline-flex;
    gap: 0.375rem;
    align-items: center;
    margin-left: 0.75rem;
    font-size: 0.85rem;
    color: var(--primary-color);
    text-decoration: none;
  }

  .source-link:hover {
    text-decoration: underline;
  }
</style>
