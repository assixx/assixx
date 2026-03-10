<script lang="ts">
  /**
   * Blackboard Detail - Page Component
   * SSR: Data loaded in +page.server.ts
   * Level 3: $derived from SSR data + invalidateAll() after mutations
   */
  import { browser } from '$app/environment';
  import { goto, invalidateAll } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/stores';

  import { notificationStore } from '$lib/stores/notification.store.svelte';
  import {
    sanitizeWithLineBreaks,
    showConfirm,
    showErrorAlert,
    showSuccessAlert,
  } from '$lib/utils';

  // Shared components (parent _lib)
  import BlackboardEditModal from '../_lib/BlackboardEditModal.svelte';
  import DeleteConfirmModal from '../_lib/DeleteConfirmModal.svelte';

  // Page-level components
  import {
    archiveEntry as archiveApi,
    buildDownloadUrl,
    confirmEntry as confirmApi,
    deleteEntry as deleteApi,
    unarchiveEntry as unarchiveApi,
    unconfirmEntry as unconfirmApi,
  } from './_lib/api';
  import AttachmentPreviewModal from './_lib/AttachmentPreviewModal.svelte';
  import CommentSection from './_lib/CommentSection.svelte';
  import {
    filterOtherFiles,
    filterPhotos,
    formatDate,
    formatDateTime,
    formatFileSize,
    getFileIcon,
    getOrgLevelText,
    getPriorityBadgeClass,
    getPriorityText,
    getVisibilityBadgeClass,
    isExpired,
  } from './_lib/utils';

  import type { PageData } from './$types';
  import type { Attachment, PreviewAttachment } from './_lib/types';

  /** Resolve path with base prefix (for dynamic runtime paths) */
  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
  }

  // =============================================================================
  // SSR DATA (single source of truth via $derived)
  // =============================================================================

  const { data }: { data: PageData } = $props();

  // Derived from SSR data
  const entry = $derived(data.entry);
  const comments = $derived(data.comments);
  const attachments = $derived(data.attachments);
  const currentUser = $derived(data.currentUser);

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  const uuid = $derived($page.params.uuid);

  /**
   * Permission logic for edit/delete:
   * - root: always allowed
   * - admin with hasFullAccess: always allowed
   * - creator (authorId === currentUser.id): allowed
   */
  const canEditOrDelete = $derived.by(() => {
    if (currentUser === null) return false;
    // Root can always edit/delete
    if (currentUser.role === 'root') return true;
    // Admin with full access can edit/delete
    if (currentUser.role === 'admin' && currentUser.hasFullAccess) return true;
    // Creator can edit/delete their own entries
    if (entry.authorId === currentUser.id) return true;
    return false;
  });

  const isAdmin = $derived.by(
    () =>
      currentUser !== null &&
      (currentUser.role === 'admin' || currentUser.role === 'root'),
  );
  const isConfirmed = $derived(entry.isConfirmed === true);
  /** Entry is archived (is_active = 3) - hide edit/delete/archive actions */
  const isArchived = $derived(entry.isActive === 3);
  const photos = $derived(filterPhotos(attachments));
  const otherFiles = $derived(filterOtherFiles(attachments));

  // =============================================================================
  // UI STATE (local only)
  // =============================================================================

  // Client-only content flag (for auth-required URLs)
  const mounted = $derived(browser);

  // Confirmation State
  let confirming = $state(false);

  // Delete Modal State
  let showDeleteModal = $state(false);
  let deleting = $state(false);

  // Preview Modal State
  let showPreviewModal = $state(false);
  let previewIndex = $state<number | null>(null);

  const previewAttachment = $derived.by((): PreviewAttachment | null => {
    if (previewIndex === null) return null;
    const att = attachments[previewIndex];
    return {
      fileUuid: att.fileUuid,
      filename: att.filename,
      mimeType: att.mimeType,
      fileSize: att.fileSize,
      uploaderName: att.uploaderName,
      downloadUrl: att.downloadUrl,
      previewUrl: att.previewUrl,
    };
  });

  // Edit Modal State
  let showEditModal = $state(false);

  // =============================================================================
  // API HANDLERS (with invalidateAll after mutations)
  // =============================================================================

  async function confirmEntry(): Promise<void> {
    confirming = true;
    const success = await confirmApi(uuid);
    if (success) {
      notificationStore.decrementCount('blackboard');
      showSuccessAlert('Eintrag als gelesen markiert');
      await invalidateAll();
    } else {
      showErrorAlert('Fehler beim Markieren als gelesen');
    }
    confirming = false;
  }

  async function unconfirmEntry(): Promise<void> {
    confirming = true;
    const success = await unconfirmApi(uuid);
    if (success) {
      notificationStore.incrementCount('blackboard');
      showSuccessAlert('Lesebestätigung zurückgenommen');
      await invalidateAll();
    } else {
      showErrorAlert('Fehler beim Zurücknehmen der Lesebestätigung');
    }
    confirming = false;
  }

  async function archiveEntry(): Promise<void> {
    const confirmed = await showConfirm(
      'Möchten Sie diesen Eintrag wirklich archivieren?',
    );
    if (!confirmed) return;
    const success = await archiveApi(uuid);
    if (success) {
      showSuccessAlert('Eintrag wurde archiviert');
      await goto(resolvePath('/blackboard'));
    } else {
      showErrorAlert('Fehler beim Archivieren');
    }
  }

  async function restoreEntry(): Promise<void> {
    const confirmed = await showConfirm(
      'Möchten Sie diesen Eintrag wiederherstellen?',
    );
    if (!confirmed) return;
    const success = await unarchiveApi(uuid);
    if (success) {
      showSuccessAlert('Eintrag wurde wiederhergestellt');
      await invalidateAll();
    } else {
      showErrorAlert('Fehler beim Wiederherstellen');
    }
  }

  async function handleDeleteEntry(): Promise<void> {
    deleting = true;
    const result = await deleteApi(uuid);
    if (result.success) {
      showSuccessAlert('Eintrag wurde gelöscht');
      await goto(resolvePath('/blackboard'));
    } else {
      showErrorAlert(result.error);
    }
    deleting = false;
    showDeleteModal = false;
  }

  /** Open edit modal */
  function openEditModal(): void {
    showEditModal = true;
  }

  /** Handle successful save from edit modal */
  async function handleEditSaved(): Promise<void> {
    await invalidateAll();
  }

  // =============================================================================
  // MODAL HANDLERS
  // =============================================================================

  function openPreview(att: Attachment): void {
    const idx = attachments.findIndex((a) => a.fileUuid === att.fileUuid);
    if (idx === -1) return;
    previewIndex = idx;
    showPreviewModal = true;
  }

  function closePreview(): void {
    showPreviewModal = false;
    previewIndex = null;
  }

  function handlePreviewPrev(): void {
    if (previewIndex === null || attachments.length <= 1) return;
    previewIndex =
      previewIndex === 0 ? attachments.length - 1 : previewIndex - 1;
  }

  function handlePreviewNext(): void {
    if (previewIndex === null || attachments.length <= 1) return;
    previewIndex =
      previewIndex === attachments.length - 1 ? 0 : previewIndex + 1;
  }

  function cancelDelete(): void {
    showDeleteModal = false;
  }

  function goBack(): void {
    void goto(resolvePath('/blackboard'));
  }

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (showDeleteModal) cancelDelete();
      else if (showEditModal) showEditModal = false;
      else if (showPreviewModal) closePreview();
    } else if (showPreviewModal) {
      if (e.key === 'ArrowLeft') handlePreviewPrev();
      else if (e.key === 'ArrowRight') handlePreviewNext();
    }
  }
</script>

<svelte:head>
  <title>{entry.title} - Schwarzes Brett - Assixx</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="container">
  <!-- Back Button -->
  <div class="mb-4">
    <button
      type="button"
      class="btn btn-light"
      onclick={goBack}
    >
      <i class="fas fa-arrow-left mr-2"></i>Zurück zur Übersicht
    </button>
  </div>

  <div class="detail-container">
    <!-- Main Content -->
    <div class="detail-main card">
      <!-- Header -->
      <div class="detail-header">
        <div>
          <div class="detail-title">{entry.title}</div>
          <div class="detail-meta">
            <span
              ><i class="fas fa-user"></i>
              {entry.authorFullName ?? entry.authorName ?? 'Unbekannt'}</span
            >
            <span
              ><i class="fas fa-calendar"></i>
              {formatDate(entry.createdAt)}</span
            >
            {#if entry.expiresAt}
              <span
                class="detail-meta__expires"
                class:detail-meta__expires--expired={isExpired(entry.expiresAt)}
                title={isExpired(entry.expiresAt) ? 'Abgelaufen' : 'Gültig bis'}
              >
                <i class="fas fa-clock"></i>
                {formatDate(entry.expiresAt)}
              </span>
            {/if}
          </div>
        </div>
        <div class="status-priority">
          <span class="badge {getPriorityBadgeClass(entry.priority)}"
            >{getPriorityText(entry.priority)}</span
          >
        </div>
      </div>

      <!-- Details Section -->
      <div class="content-section">
        <h3 class="section-title">
          <i class="fas fa-info-circle"></i> Details
        </h3>
        <div class="data-list data-list--grid">
          <div class="data-list__item">
            <span class="data-list__label">Sichtbarkeit</span>
            <span class="badge {getVisibilityBadgeClass(entry.orgLevel)}"
              >{getOrgLevelText(entry.orgLevel, entry)}</span
            >
          </div>
          {#if entry.tags && entry.tags.length > 0}
            <div class="data-list__item">
              <span class="data-list__label">Tags</span>
              <span class="data-list__value">
                {#each entry.tags as tag (tag)}<span
                    class="badge badge--tag mr-1">{tag}</span
                  >{/each}
              </span>
            </div>
          {/if}
        </div>
      </div>

      <!-- Content Section -->
      <div class="content-section">
        <h3 class="section-title"><i class="fas fa-align-left"></i> Inhalt</h3>
        <div class="section-content">
          <!-- eslint-disable-next-line svelte/no-at-html-tags -- Sanitized via DOMPurify in sanitizeWithLineBreaks() -->
          {@html sanitizeWithLineBreaks(entry.content)}
        </div>
      </div>

      <!-- Photo Gallery -->
      {#if photos.length > 0}
        <div class="content-section">
          <h3 class="section-title"><i class="fas fa-images"></i> Bilder</h3>
          <div class="photo-gallery">
            {#each photos as photo, index (photo.fileUuid)}
              <div
                class="photo-thumbnail"
                onclick={() => {
                  openPreview(photo);
                }}
                role="button"
                tabindex="0"
                onkeydown={(e) => {
                  if (e.key === 'Enter') openPreview(photo);
                }}
              >
                {#if mounted}
                  <img
                    src={buildDownloadUrl(photo.downloadUrl)}
                    alt={photo.filename}
                    loading="lazy"
                  />
                {:else}
                  <div class="photo-placeholder">
                    <i class="fas fa-image"></i>
                  </div>
                {/if}
                {#if index === 0 && photos.length > 1}<span class="photo-count"
                    >{photos.length} Fotos</span
                  >{/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Comments Section -->
      <CommentSection
        comments={comments.comments}
        total={comments.total}
        hasMore={comments.hasMore}
        {isArchived}
        {uuid}
      />
    </div>

    <!-- Sidebar -->
    <div class="detail-sidebar">
      <!-- Confirmation Status - Hidden for archived entries -->
      {#if !isArchived}
        <div class="sidebar-card card">
          <h3 class="section-title">
            <i class="fas fa-check-circle"></i> Lesebestätigung
          </h3>
          {#if isConfirmed}
            <div class="confirmation-done mb-4">
              <i class="fas fa-check-circle text-success"></i>
              <span>Bereits als gelesen markiert</span>
              {#if entry.confirmedAt}<span class="text-muted text-sm"
                  >{formatDateTime(entry.confirmedAt)}</span
                >{/if}
            </div>
            <button
              type="button"
              class="btn btn-light text-sm"
              onclick={unconfirmEntry}
              disabled={confirming}
            >
              {#if confirming}<span class="spinner-ring spinner-ring--sm mr-2"
                ></span>{:else}<i class="fas fa-undo mr-2"></i>{/if}
              Als ungelesen markieren
            </button>
          {:else}
            <button
              type="button"
              class="btn btn-upload"
              onclick={confirmEntry}
              disabled={confirming}
            >
              {#if confirming}<span class="spinner-ring spinner-ring--sm mr-2"
                ></span>{:else}<i class="fas fa-check mr-2"></i>{/if}
              Als gelesen markieren
            </button>
          {/if}
        </div>
      {/if}

      <!-- Attachments (non-photo files) -->
      {#if otherFiles.length > 0}
        <div class="sidebar-card card">
          <h3 class="section-title">
            <i class="fas fa-paperclip"></i> Anhänge
          </h3>
          <div class="attachment-list">
            {#each otherFiles as file (file.fileUuid)}
              <div
                class="attachment-item"
                onclick={() => {
                  openPreview(file);
                }}
                role="button"
                tabindex="0"
                onkeydown={(e) => {
                  if (e.key === 'Enter') openPreview(file);
                }}
              >
                <i class={getFileIcon(file.mimeType)}></i>
                <div class="attachment-info">
                  <div class="attachment-name">{file.filename}</div>
                  <div class="attachment-meta">
                    {formatFileSize(file.fileSize)} &bull; {file.uploaderName}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Actions - Hidden for archived entries -->
      {#if !isArchived && (canEditOrDelete || isAdmin)}
        <div class="sidebar-card card">
          <h3 class="section-title"><i class="fas fa-cog"></i> Aktionen</h3>
          <div class="action-buttons">
            {#if canEditOrDelete}
              <button
                type="button"
                class="btn btn-light"
                onclick={openEditModal}
                ><i class="fas fa-edit mr-2"></i>Bearbeiten</button
              >
              <button
                type="button"
                class="btn btn-danger"
                onclick={() => (showDeleteModal = true)}
                ><i class="fas fa-trash-alt mr-2"></i>Löschen</button
              >
            {/if}
            {#if isAdmin}
              <button
                type="button"
                class="btn btn-light"
                onclick={archiveEntry}
                ><i class="fas fa-archive mr-2"></i>Archivieren</button
              >
            {/if}
          </div>
        </div>
      {:else if isArchived}
        <div class="sidebar-card card">
          <div class="p-4 text-center">
            <i class="fas fa-archive mb-2 text-3xl text-(--color-warning)"></i>
            <p class="mb-4 text-(--color-text-secondary)">
              Dieser Eintrag ist archiviert
            </p>
            <button
              type="button"
              class="btn btn-light"
              onclick={restoreEntry}
            >
              <i class="fas fa-undo mr-2"></i>Wiederherstellen
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Preview Modal -->
<AttachmentPreviewModal
  show={showPreviewModal}
  attachment={previewAttachment}
  onclose={closePreview}
  onprev={handlePreviewPrev}
  onnext={handlePreviewNext}
  currentIndex={previewIndex ?? undefined}
  totalCount={attachments.length}
/>

<!-- Delete Confirmation Modal -->
<DeleteConfirmModal
  show={showDeleteModal}
  loading={deleting}
  oncancel={cancelDelete}
  onconfirm={handleDeleteEntry}
/>

<!-- Edit Entry Modal (Smart - loads org data internally) -->
{#if showEditModal}
  <BlackboardEditModal
    {entry}
    onclose={() => (showEditModal = false)}
    onsaved={handleEditSaved}
  />
{/if}

<style>
  /* ─── Layout (shared with kvp-detail) ──────── */

  .detail-container {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: 1fr 475px;
    gap: var(--spacing-6);
  }

  .detail-main {
    z-index: 1;
    padding: var(--spacing-8);
    margin-bottom: 0;
  }

  .detail-sidebar {
    position: relative;
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-6);
  }

  .sidebar-card {
    z-index: 1;
    margin-bottom: 0;
  }

  /* ─── Header ──────── */

  .detail-header {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-4);
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: var(--spacing-8);
  }

  .detail-title {
    margin-bottom: var(--spacing-2);
    font-size: 1.8rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .detail-meta {
    display: flex;
    gap: var(--spacing-6);
    font-size: 0.9rem;
    color: var(--text-muted);
  }

  .detail-meta span {
    display: inline-flex;
    gap: var(--spacing-2);
    align-items: center;
  }

  .detail-meta i {
    color: var(--primary-color);
  }

  .detail-meta__expires {
    font-style: italic;
    color: var(--text-muted);
  }

  .detail-meta__expires i {
    color: var(--text-muted);
  }

  .detail-meta__expires--expired {
    color: var(--color-red-400, #f87171);
  }

  .detail-meta__expires--expired i {
    color: var(--color-red-400, #f87171);
  }

  .status-priority {
    display: flex;
    flex-wrap: wrap;
    flex-shrink: 0;
    gap: var(--spacing-3);
    align-items: center;
  }

  /* ─── Content Sections ──────── */

  .content-section {
    margin-bottom: var(--spacing-8);
  }

  .section-title {
    display: flex;
    gap: var(--spacing-2);
    align-items: center;
    margin-bottom: var(--spacing-4);
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--primary-color);
  }

  .section-content {
    padding: var(--spacing-4);
    border: var(--glass-border);
    border-radius: var(--glass-card-radius);
    line-height: 1.6;
    color: var(--color-text-primary);
    overflow-wrap: anywhere;
    background: var(--glass-bg);
    backdrop-filter: var(--glass-backdrop);
    box-shadow: var(--glass-card-shadow);
  }

  /* ─── Sidebar Specific ──────── */

  .confirmation-done {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
    text-align: center;
  }

  .confirmation-done :global(.text-success) {
    font-size: 2rem;
    color: var(--color-success);
  }

  .attachment-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  .attachment-item {
    cursor: pointer;
    display: flex;
    gap: var(--spacing-2);
    align-items: center;
    padding: var(--spacing-3);
    border: 1px solid var(--color-glass-border);
    border-radius: var(--radius-xl);
    background: var(--glass-bg);
  }

  .attachment-item:hover {
    border-color: var(--primary-color);
    background: var(--glass-bg-active);
  }

  .attachment-info {
    flex: 1;
    min-width: 0;
  }

  .attachment-name {
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .attachment-meta {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .action-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-3);
  }

  /* ─── Photo Gallery ──────── */

  .photo-gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: var(--spacing-4);
    margin-top: var(--spacing-4);
  }

  .photo-thumbnail {
    cursor: pointer;
    position: relative;
    overflow: hidden;
    aspect-ratio: 1;
    border: 2px solid transparent;
    border-radius: var(--radius-xl);
    background: var(--glass-bg-active);
  }

  .photo-thumbnail:hover {
    transform: scale(1.05);
    border-color: var(--primary-color);
  }

  .photo-thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .photo-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-size: 1.5rem;
    color: var(--color-text-disabled);
    background: var(--glass-bg-active);
  }

  .photo-count {
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-white);
    background: color-mix(in oklch, var(--color-black) 70%, transparent);
  }

  /* ─── Responsive ──────── */

  @media (width < 768px) {
    .detail-container {
      grid-template-columns: 1fr;
    }
  }
</style>
