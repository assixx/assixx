<script lang="ts">
  /**
   * AdminWorkOrderTable — Data table for admin work order list.
   * Columns: title, status, priority, assignees, due date, source, actions.
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
  } from '../../_lib/constants';

  import type { WorkOrderListItem } from '../../_lib/types';

  interface Props {
    items: WorkOrderListItem[];
    onedit: (item: WorkOrderListItem) => void;
    onarchive: (item: WorkOrderListItem) => void;
    onrestore: (item: WorkOrderListItem) => void;
    onassign: (item: WorkOrderListItem) => void;
  }

  const { items, onedit, onarchive, onrestore, onassign }: Props = $props();

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
            {#if item.isActive === 3}
              <span class="badge badge--sm badge--secondary ml-2"
                >{MESSAGES.BADGE_ARCHIVED}</span
              >
            {:else if !item.isRead}
              <span class="badge badge--sm badge--success ml-2">Neu</span>
            {/if}
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
              <span class="text-muted">—</span>
            {/if}
          </td>
          <td>
            {#if item.dueDate !== null}
              <span class:text-danger={isOverdue(item)}>
                {formatDate(item.dueDate)}
              </span>
            {:else}
              <span class="text-muted">—</span>
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
              <button
                type="button"
                class="action-icon action-icon--edit"
                title={MESSAGES.BTN_EDIT}
                onclick={() => {
                  onedit(item);
                }}
              >
                <i class="fas fa-pen"></i>
              </button>
              <button
                type="button"
                class="action-icon action-icon--info"
                title={MESSAGES.BTN_ASSIGN}
                onclick={() => {
                  onassign(item);
                }}
              >
                <i class="fas fa-user-plus"></i>
              </button>
              {#if item.isActive === 3}
                <button
                  type="button"
                  class="action-icon action-icon--success"
                  title={MESSAGES.BTN_RESTORE}
                  onclick={() => {
                    onrestore(item);
                  }}
                >
                  <i class="fas fa-undo"></i>
                </button>
              {:else}
                <button
                  type="button"
                  class="action-icon action-icon--warning"
                  title={MESSAGES.BTN_ARCHIVE}
                  onclick={() => {
                    onarchive(item);
                  }}
                >
                  <i class="fas fa-archive"></i>
                </button>
              {/if}
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
    color: var(--color-danger, var(--color-crimson));
    font-weight: 600;
  }

  .row--overdue {
    border-left: 3px solid var(--color-danger, var(--color-crimson));
  }
</style>
