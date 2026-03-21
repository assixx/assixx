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

  import PermissionDenied from '$lib/components/PermissionDenied.svelte';
  import { notificationStore } from '$lib/stores/notification.store.svelte';

  import { markWorkOrderAsRead } from '../_lib/api';
  import { MESSAGES, STATUS_LABELS } from '../_lib/constants';

  import AssigneeList from './_lib/AssigneeList.svelte';
  import CommentSection from './_lib/CommentSection.svelte';
  import PhotoGallery from './_lib/PhotoGallery.svelte';
  import StatusBadge from './_lib/StatusBadge.svelte';
  import StatusTransition from './_lib/StatusTransition.svelte';
  import WorkOrderInfo from './_lib/WorkOrderInfo.svelte';

  import type { PageData } from './$types';
  import type { SourcePhoto, WorkOrderComment } from '../_lib/types';

  // =============================================================================
  // HELPERS
  // =============================================================================

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

  const permissionDenied = $derived<boolean>(data.permissionDenied);

  const workOrder = $derived(data.workOrder);
  const comments = $derived(data.comments);
  const photos = $derived(data.photos);
  const sourcePhotos = $derived(data.sourcePhotos);
  const userRole = $derived(data.userRole);
  const userId = $derived(data.userId);

  let showSourcePreview = $state(false);
  let sourcePreviewIndex = $state(0);

  const currentSourcePhoto: SourcePhoto | null = $derived(
    showSourcePreview && sourcePhotos.length > 0 ?
      (sourcePhotos[sourcePreviewIndex] ?? null)
    : null,
  );

  function openSourcePreview(index: number): void {
    sourcePreviewIndex = index;
    showSourcePreview = true;
  }

  function closeSourcePreview(): void {
    showSourcePreview = false;
  }

  function handleSourceKeydown(event: KeyboardEvent): void {
    if (!showSourcePreview) return;
    if (event.key === 'ArrowLeft' && sourcePreviewIndex > 0) sourcePreviewIndex--;
    if (event.key === 'ArrowRight' && sourcePreviewIndex < sourcePhotos.length - 1)
      sourcePreviewIndex++;
  }

  onMount(() => {
    if (permissionDenied || workOrder === null) return;
    void notificationStore.markEntityAsRead('work_orders', workOrder.uuid);
    void markWorkOrderAsRead(workOrder.uuid);
  });

  const statusLogs = $derived(comments.comments.filter((c: WorkOrderComment) => c.isStatusChange));
  const regularComments = $derived(
    comments.comments.filter((c: WorkOrderComment) => !c.isStatusChange),
  );
</script>

<svelte:head>
  <title>
    {permissionDenied ?
      MESSAGES.PAGE_TITLE_DETAIL
    : `${workOrder?.title ?? ''} — ${MESSAGES.PAGE_TITLE_DETAIL}`}
  </title>
</svelte:head>

<svelte:window onkeydown={handleSourceKeydown} />

{#if permissionDenied}
  <PermissionDenied addonName="die Arbeitsaufträge" />
{:else if workOrder !== null}
  <div class="container">
    <!-- Back button -->
    <div class="mb-4">
      <a
        href={resolve('/work-orders')}
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
            {#if workOrder.isActive === 3}
              <span class="badge badge--secondary">
                <i class="fas fa-archive"></i>
                {MESSAGES.BADGE_ARCHIVED}
              </span>
            {/if}
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

        <!-- Expected Benefit (KVP) -->
        {#if workOrder.sourceExpectedBenefit !== null && workOrder.sourceExpectedBenefit !== ''}
          <div class="card mb-6">
            <div class="card__header">
              <h3 class="card__title">
                <i class="fas fa-lightbulb mr-2"></i>
                Erwarteter Nutzen
              </h3>
            </div>
            <div class="card__body">
              <p class="description-text">{workOrder.sourceExpectedBenefit}</p>
            </div>
          </div>
        {/if}

        <!-- Source Photos / Attachments -->
        {#if sourcePhotos.length > 0}
          <div class="card mb-6">
            <div class="card__header">
              <h3 class="card__title">
                <i class="fas fa-camera mr-2"></i>
                {workOrder.sourceType === 'kvp_proposal' ?
                  'Quell-Anhänge (KVP-Vorschlag)'
                : 'Quell-Fotos (TPM-Mangel)'}
                <span class="badge badge--count ml-2">{sourcePhotos.length}</span>
              </h3>
            </div>
            <div class="card__body">
              <div class="source-photo-grid">
                {#each sourcePhotos as photo, index (photo.uuid)}
                  <div
                    class="source-photo-thumb"
                    role="button"
                    tabindex="0"
                    onclick={() => {
                      openSourcePreview(index);
                    }}
                    onkeydown={(e: KeyboardEvent) => {
                      if (e.key === 'Enter') openSourcePreview(index);
                    }}
                  >
                    <img
                      src="/{photo.filePath}"
                      alt={photo.fileName}
                      loading="lazy"
                    />
                  </div>
                {/each}
              </div>
            </div>
          </div>
        {/if}

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

  <!-- Source Photo Preview Modal -->
  {#if showSourcePreview && currentSourcePhoto !== null}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="modal-overlay modal-overlay--active"
      onclick={closeSourcePreview}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div
        class="ds-modal ds-modal--lg"
        style="max-height: 95vh;"
        onclick={(e: MouseEvent) => {
          e.stopPropagation();
        }}
        onkeydown={(e: KeyboardEvent) => {
          e.stopPropagation();
        }}
        role="document"
      >
        <div class="ds-modal__header">
          <h3 class="ds-modal__title">
            <i class="fas fa-image text-success-500 mr-2"></i>
            {currentSourcePhoto.fileName}
          </h3>
          <button
            type="button"
            class="ds-modal__close"
            onclick={closeSourcePreview}
            aria-label="Schließen"><i class="fas fa-times"></i></button
          >
        </div>
        <div class="ds-modal__body p-0">
          <div
            class="flex h-[80vh] min-h-[600px] w-full items-center justify-center bg-(--surface-1)"
          >
            <img
              src="/{currentSourcePhoto.filePath}"
              alt={currentSourcePhoto.fileName}
              class="max-h-full max-w-full object-contain"
            />
          </div>
        </div>
        <div class="ds-modal__footer">
          <button
            type="button"
            class="btn btn-cancel"
            onclick={closeSourcePreview}
          >
            <i class="fas fa-times mr-2"></i>Schließen
          </button>
        </div>
      </div>
      {#if sourcePhotos.length > 1}
        <button
          type="button"
          class="absolute top-1/2 left-6 z-10 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-none bg-white/15 text-xl text-white transition-colors hover:bg-white/30"
          onclick={(e: MouseEvent) => {
            e.stopPropagation();
            if (sourcePreviewIndex > 0) sourcePreviewIndex--;
          }}
          aria-label="Vorheriges Foto"
        >
          <i class="fas fa-chevron-left"></i>
        </button>
        <button
          type="button"
          class="absolute top-1/2 right-6 z-10 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-none bg-white/15 text-xl text-white transition-colors hover:bg-white/30"
          onclick={(e: MouseEvent) => {
            e.stopPropagation();
            if (sourcePreviewIndex < sourcePhotos.length - 1) sourcePreviewIndex++;
          }}
          aria-label="Nächstes Foto"
        >
          <i class="fas fa-chevron-right"></i>
        </button>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-xl bg-black/50 px-3 py-1 text-sm text-white"
          onclick={(e: MouseEvent) => {
            e.stopPropagation();
          }}
        >
          {sourcePreviewIndex + 1} / {sourcePhotos.length}
        </div>
      {/if}
    </div>
  {/if}
{/if}

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

  /* ─── Source Photos Grid ──────── */

  .source-photo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 0.75rem;
  }

  .source-photo-thumb {
    cursor: pointer;
    overflow: hidden;
    aspect-ratio: 1;
    border: 2px solid transparent;
    border-radius: var(--radius-xl, 0.75rem);
    background: var(--glass-bg-active, #f8f9fa);
    transition:
      transform 0.2s ease,
      border-color 0.2s ease;
  }

  .source-photo-thumb:hover {
    transform: scale(1.02);
    border-color: var(--color-primary);
  }

  .source-photo-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  @media (width <= 900px) {
    .detail-layout {
      grid-template-columns: 1fr;
    }
  }
</style>
