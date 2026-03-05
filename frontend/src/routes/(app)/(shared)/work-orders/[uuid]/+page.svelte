<script lang="ts">
  /**
   * Work Order Detail — Page Component
   * @module shared/work-orders/[uuid]/+page
   *
   * Level 3 SSR: Two-column layout with main content + sidebar.
   * Main: info, description, comments.
   * Sidebar: status badge, transitions, assignees, photos.
   */
  import { onMount } from 'svelte';

  import { resolve } from '$app/paths';

  import { notificationStore } from '$lib/stores/notification.store.svelte';

  import { MESSAGES, STATUS_LABELS } from '../_lib/constants';

  import AssigneeList from './_lib/AssigneeList.svelte';
  import CommentSection from './_lib/CommentSection.svelte';
  import PhotoGallery from './_lib/PhotoGallery.svelte';
  import StatusBadge from './_lib/StatusBadge.svelte';
  import StatusTransition from './_lib/StatusTransition.svelte';
  import WorkOrderInfo from './_lib/WorkOrderInfo.svelte';

  import type { PageData } from './$types';
  import type { WorkOrderComment } from '../_lib/types';

  // =============================================================================
  // HELPERS
  // =============================================================================

  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
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

  function statusChangeText(c: WorkOrderComment): string {
    const from = c.oldStatus !== null ? STATUS_LABELS[c.oldStatus] : '?';
    const to = c.newStatus !== null ? STATUS_LABELS[c.newStatus] : '?';
    return `${from} → ${to}`;
  }

  // =============================================================================
  // SSR DATA
  // =============================================================================

  const { data }: { data: PageData } = $props();

  const workOrder = $derived(data.workOrder);
  const comments = $derived(data.comments);
  const photos = $derived(data.photos);
  const userRole = $derived(data.userRole);
  const userId = $derived(data.userId);

  onMount(() => {
    void notificationStore.markEntityAsRead('work_orders', workOrder.uuid);
  });

  const statusLogs = $derived(
    comments.comments.filter((c: WorkOrderComment) => c.isStatusChange),
  );
  const regularComments = $derived(
    comments.comments.filter((c: WorkOrderComment) => !c.isStatusChange),
  );
</script>

<svelte:head>
  <title>{workOrder.title} — {MESSAGES.PAGE_TITLE_DETAIL}</title>
</svelte:head>

<div class="container">
  <!-- Back button -->
  <div class="mb-4">
    <a
      href={resolvePath('/work-orders')}
      class="btn btn-light"
    >
      <i class="fas fa-arrow-left mr-2"></i>
      {MESSAGES.BTN_BACK}
    </a>
  </div>

  <!-- Header -->
  <div class="card mb-6">
    <div class="card__header">
      <div class="detail-header">
        <h2 class="card__title">{workOrder.title}</h2>
        <div class="detail-header__badges">
          <StatusBadge status={workOrder.status} />
        </div>
      </div>
    </div>
    {#if statusLogs.length > 0}
      <div class="card__body status-log-list">
        {#each statusLogs as log (log.id)}
          <div class="alert alert--info status-log-entry">
            <i class="alert__icon fas fa-exchange-alt"></i>
            <span class="status-log-entry__text">
              <strong>{log.firstName} {log.lastName}</strong>
              — {MESSAGES.COMMENTS_STATUS_CHANGE}: {statusChangeText(log)}
            </span>
            <span class="status-log-entry__date">
              {formatDateTime(log.createdAt)}
            </span>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Two-column layout -->
  <div class="detail-layout">
    <!-- Main content -->
    <div class="detail-main">
      <!-- Description -->
      <div class="card mb-6">
        <div class="card__header">
          <h3 class="card__title">
            <i class="fas fa-align-left mr-2"></i>
            {MESSAGES.DETAIL_DESCRIPTION}
          </h3>
        </div>
        <div class="card__body">
          {#if workOrder.description !== null && workOrder.description !== ''}
            <p class="description-text">{workOrder.description}</p>
          {:else}
            <p class="description-empty">{MESSAGES.DETAIL_NO_DESCRIPTION}</p>
          {/if}
        </div>
      </div>

      <!-- Info fields -->
      <div class="card mb-6">
        <div class="card__header">
          <h3 class="card__title">
            <i class="fas fa-info-circle mr-2"></i>
            {MESSAGES.HEADING_DETAIL}
          </h3>
        </div>
        <div class="card__body">
          <WorkOrderInfo {workOrder} />
        </div>
      </div>

      <!-- Comments -->
      <div class="card">
        <div class="card__body">
          <CommentSection
            comments={regularComments}
            total={comments.total - statusLogs.length}
            hasMore={comments.hasMore}
            uuid={workOrder.uuid}
          />
        </div>
      </div>
    </div>

    <!-- Sidebar -->
    <div class="detail-sidebar">
      <!-- Status transitions -->
      <div class="card">
        <div class="card__body">
          <StatusTransition
            uuid={workOrder.uuid}
            currentStatus={workOrder.status}
            {userRole}
          />
        </div>
      </div>

      <!-- Assignees -->
      <div class="card">
        <div class="card__body">
          <AssigneeList assignees={workOrder.assignees} />
        </div>
      </div>

      <!-- Photos -->
      <div class="card">
        <div class="card__body">
          <PhotoGallery
            {photos}
            uuid={workOrder.uuid}
            {userRole}
            {userId}
            workOrderStatus={workOrder.status}
          />
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .detail-layout {
    display: grid;
    grid-template-columns: 1fr 380px;
    gap: 1.5rem;
  }

  .detail-main {
    min-width: 0;
  }

  .detail-sidebar {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .detail-header__badges {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .description-text {
    margin: 0;
    line-height: 1.6;
    white-space: pre-wrap;
    overflow-wrap: break-word;
  }

  .description-empty {
    margin: 0;
    color: var(--color-text-muted);
    font-style: italic;
  }

  /* ─── Status Log in Header Card ──────── */

  .status-log-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .status-log-entry {
    padding: 0.375rem 0.75rem;
    font-size: 0.813rem;
    width: fit-content;
  }

  .status-log-entry__text {
    flex: 1;
  }

  .status-log-entry__date {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    white-space: nowrap;
    margin-left: auto;
  }

  @media (width <= 900px) {
    .detail-layout {
      grid-template-columns: 1fr;
    }
  }
</style>
