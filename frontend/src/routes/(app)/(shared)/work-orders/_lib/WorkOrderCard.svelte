<script lang="ts">
  /**
   * WorkOrderCard — Single work order card for list views.
   * Displays title, status/priority badges, assignees, due date,
   * and counts. Links to detail page.
   */
  import { resolve } from '$app/paths';

  import {
    STATUS_LABELS,
    STATUS_BADGE_CLASSES,
    STATUS_ICONS,
    PRIORITY_LABELS,
    PRIORITY_BADGE_CLASSES,
    PRIORITY_ICONS,
    SOURCE_TYPE_LABELS,
    MESSAGES,
  } from './constants';

  import type { WorkOrderListItem } from './types';

  interface Props {
    workOrder: WorkOrderListItem;
  }

  const { workOrder }: Props = $props();

  const statusLabel = $derived(STATUS_LABELS[workOrder.status]);
  const statusBadge = $derived(STATUS_BADGE_CLASSES[workOrder.status]);
  const statusIcon = $derived(STATUS_ICONS[workOrder.status]);

  const priorityLabel = $derived(PRIORITY_LABELS[workOrder.priority]);
  const priorityBadge = $derived(PRIORITY_BADGE_CLASSES[workOrder.priority]);
  const priorityIcon = $derived(PRIORITY_ICONS[workOrder.priority]);

  const sourceLabel = $derived(SOURCE_TYPE_LABELS[workOrder.sourceType]);

  const dueDateFormatted = $derived(
    new Date(workOrder.dueDate).toLocaleDateString('de-DE'),
  );

  const isOverdue = $derived(
    workOrder.status !== 'completed' &&
      workOrder.status !== 'verified' &&
      new Date(workOrder.dueDate) < new Date(),
  );

  const detailUrl = $derived(resolve(`/work-orders/${workOrder.uuid}`));
</script>

<a
  href={detailUrl}
  class="work-order-card"
  class:work-order-card--overdue={isOverdue}
>
  <div class="work-order-card__header">
    <h4 class="work-order-card__title">{workOrder.title}</h4>
    <div class="work-order-card__badges">
      <span class="badge {statusBadge}">
        <i class="fas {statusIcon}"></i>
        {statusLabel}
      </span>
      <span class="badge {priorityBadge}">
        <i class="fas {priorityIcon}"></i>
        {priorityLabel}
      </span>
    </div>
  </div>

  <div class="work-order-card__meta">
    <span
      class="work-order-card__meta-item"
      title={MESSAGES.LIST_COL_ASSIGNEES}
    >
      <i class="fas fa-users"></i>
      {workOrder.assigneeNames !== '' ?
        workOrder.assigneeNames
      : MESSAGES.ASSIGNEES_EMPTY}
    </span>

    <span
      class="work-order-card__meta-item"
      class:work-order-card__meta-item--overdue={isOverdue}
      title={MESSAGES.LIST_COL_DUE_DATE}
    >
      <i class="fas fa-calendar-alt"></i>
      {dueDateFormatted}
    </span>

    <span
      class="work-order-card__meta-item"
      title={MESSAGES.LIST_COL_SOURCE}
    >
      <i class="fas fa-tag"></i>
      {sourceLabel}
    </span>

    {#if workOrder.commentCount > 0}
      <span
        class="work-order-card__meta-item"
        title={MESSAGES.COMMENTS_HEADING}
      >
        <i class="fas fa-comment"></i>
        {workOrder.commentCount}
      </span>
    {/if}

    {#if workOrder.photoCount > 0}
      <span
        class="work-order-card__meta-item"
        title={MESSAGES.PHOTOS_HEADING}
      >
        <i class="fas fa-camera"></i>
        {workOrder.photoCount}
      </span>
    {/if}
  </div>
</a>

<style>
  .work-order-card {
    display: block;
    padding: 1rem 1.25rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 0.5rem);
    background: var(--color-bg-primary);
    text-decoration: none;
    color: inherit;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .work-order-card:hover {
    border-color: var(--color-primary);
    box-shadow: 0 2px 8px
      color-mix(in oklch, var(--color-black) 8%, transparent);
  }

  .work-order-card--overdue {
    border-left: 3px solid var(--color-danger, #ef4444);
  }

  .work-order-card__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .work-order-card__title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.4;
  }

  .work-order-card__badges {
    display: flex;
    flex-shrink: 0;
    gap: 0.375rem;
  }

  .work-order-card__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    font-size: 0.813rem;
    color: var(--color-text-secondary);
  }

  .work-order-card__meta-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    white-space: nowrap;
  }

  .work-order-card__meta-item--overdue {
    color: var(--color-danger, #ef4444);
    font-weight: 600;
  }

  @media (width <= 640px) {
    .work-order-card__header {
      flex-direction: column;
    }

    .work-order-card__badges {
      align-self: flex-start;
    }
  }
</style>
