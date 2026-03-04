<script lang="ts">
  /**
   * Work Order Detail — Page Component
   * @module shared/work-orders/[uuid]/+page
   *
   * Level 3 SSR: Two-column layout with main content + sidebar.
   * Main: info, description, comments.
   * Sidebar: status badge, transitions, assignees, photos.
   */
  import { resolve } from '$app/paths';

  import { MESSAGES } from '../_lib/constants';

  import AssigneeList from './_lib/AssigneeList.svelte';
  import CommentSection from './_lib/CommentSection.svelte';
  import PhotoGallery from './_lib/PhotoGallery.svelte';
  import StatusBadge from './_lib/StatusBadge.svelte';
  import StatusTransition from './_lib/StatusTransition.svelte';
  import WorkOrderInfo from './_lib/WorkOrderInfo.svelte';

  import type { PageData } from './$types';

  // =============================================================================
  // HELPERS
  // =============================================================================

  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
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
            comments={comments.comments}
            total={comments.total}
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

  @media (width <= 900px) {
    .detail-layout {
      grid-template-columns: 1fr;
    }
  }
</style>
