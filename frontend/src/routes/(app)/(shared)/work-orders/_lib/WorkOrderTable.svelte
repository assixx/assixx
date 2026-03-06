<script lang="ts">
  /**
   * WorkOrderTable — Data table for employee work order list.
   * Same columns as AdminWorkOrderTable minus the actions column.
   * Columns: title (link), status, priority, assignees, due date, source, created.
   */
  import { resolve } from '$app/paths';

  import {
    MESSAGES,
    STATUS_LABELS,
    STATUS_BADGE_CLASSES,
    STATUS_ICONS,
    PRIORITY_LABELS,
    PRIORITY_BADGE_CLASSES,
    PRIORITY_ICONS,
    SOURCE_TYPE_LABELS,
  } from './constants';

  import type { WorkOrderListItem } from './types';

  interface Props {
    items: WorkOrderListItem[];
  }

  const { items }: Props = $props();

  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  function isOverdue(item: WorkOrderListItem): boolean {
    if (item.dueDate === null) return false;
    if (item.status === 'completed' || item.status === 'verified') return false;
    return new Date(item.dueDate) < new Date();
  }
</script>

<div class="table-responsive">
  <table class="data-table data-table--hover data-table--striped">
    <thead>
      <tr>
        <th>{MESSAGES.LIST_COL_TITLE}</th>
        <th>{MESSAGES.LIST_COL_STATUS}</th>
        <th>{MESSAGES.LIST_COL_PRIORITY}</th>
        <th>{MESSAGES.LIST_COL_ASSIGNEES}</th>
        <th>{MESSAGES.LIST_COL_DUE_DATE}</th>
        <th>{MESSAGES.LIST_COL_SOURCE}</th>
        <th>{MESSAGES.LIST_COL_CREATED}</th>
        <th>{MESSAGES.LIST_COL_ACTIONS}</th>
      </tr>
    </thead>
    <tbody>
      {#each items as item (item.uuid)}
        <tr class:row--overdue={isOverdue(item)}>
          <td>
            <a
              href={resolvePath(`/work-orders/${item.uuid}`)}
              class="table-link"
            >
              {item.title}
            </a>
          </td>
          <td>
            <span class="badge {STATUS_BADGE_CLASSES[item.status]}">
              <i class="fas {STATUS_ICONS[item.status]}"></i>
              {STATUS_LABELS[item.status]}
            </span>
          </td>
          <td>
            <span class="badge {PRIORITY_BADGE_CLASSES[item.priority]}">
              <i class="fas {PRIORITY_ICONS[item.priority]}"></i>
              {PRIORITY_LABELS[item.priority]}
            </span>
          </td>
          <td>
            {#if item.assigneeCount > 0}
              <span title={item.assigneeNames}>
                {item.assigneeNames}
                {#if item.assigneeCount > 1}
                  <span class="badge badge--secondary ml-1">
                    {item.assigneeCount}
                  </span>
                {/if}
              </span>
            {:else}
              <span class="text-muted">&mdash;</span>
            {/if}
          </td>
          <td>
            {#if item.dueDate !== null}
              <span class:text-danger={isOverdue(item)}>
                {formatDate(item.dueDate)}
              </span>
            {:else}
              <span class="text-muted">&mdash;</span>
            {/if}
          </td>
          <td>{SOURCE_TYPE_LABELS[item.sourceType]}</td>
          <td>{formatDate(item.createdAt)}</td>
          <td>
            <div class="action-icons">
              <a
                href={resolvePath(`/work-orders/${item.uuid}`)}
                class="action-icon action-icon--info"
                title={MESSAGES.BTN_VIEW_DETAIL}
              >
                <i class="fas fa-eye"></i>
              </a>
            </div>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .action-icons {
    display: flex;
    gap: 0.25rem;
    align-items: center;
  }

  .table-link {
    color: var(--color-primary);
    text-decoration: none;
    font-weight: 500;
  }

  .table-link:hover {
    text-decoration: underline;
  }

  .text-muted {
    color: var(--color-text-muted);
  }

  .text-danger {
    color: var(--color-danger, #dc3545);
    font-weight: 600;
  }

  .row--overdue {
    border-left: 3px solid var(--color-danger, #dc3545);
  }
</style>
