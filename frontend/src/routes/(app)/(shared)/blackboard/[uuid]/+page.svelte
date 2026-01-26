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
  import { getProfilePictureUrl } from '$lib/utils/avatar-helpers';

  // Page-specific CSS (reuses kvp-detail layout)
  import '../../../../../styles/kvp-detail.css';

  // _lib/ imports
  import {
    addComment as addCommentApi,
    archiveEntry as archiveApi,
    buildDownloadUrl,
    confirmEntry as confirmApi,
    deleteEntry as deleteApi,
    unarchiveEntry as unarchiveApi,
    unconfirmEntry as unconfirmApi,
  } from './_lib/api';
  import {
    filterOtherFiles,
    filterPhotos,
    formatDate,
    formatDateTime,
    getAvatarColor,
    getFileIcon,
    formatFileSize,
    getOrgLevelText,
    getPreviewFileType,
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
    () => currentUser !== null && (currentUser.role === 'admin' || currentUser.role === 'root'),
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

  // Comment Form State
  let newComment = $state('');
  let submittingComment = $state(false);

  // Confirmation State
  let confirming = $state(false);

  // Delete Modal State
  let showDeleteModal = $state(false);
  let deleting = $state(false);

  // Preview Modal State
  let showPreviewModal = $state(false);
  let previewAttachment = $state<PreviewAttachment | null>(null);

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

  async function handleAddComment(e: Event): Promise<void> {
    e.preventDefault();
    const commentText = newComment.trim();
    if (!commentText) return;
    submittingComment = true;
    const success = await addCommentApi(uuid, commentText);
    if (success) {
      // eslint-disable-next-line require-atomic-updates -- Setting to constant '', not using previous value. Input disabled via submittingComment.
      newComment = '';
      showSuccessAlert('Kommentar hinzugefügt');
      await invalidateAll();
    } else {
      showErrorAlert('Fehler beim Hinzufügen des Kommentars');
    }
    submittingComment = false;
  }

  async function archiveEntry(): Promise<void> {
    const confirmed = await showConfirm('Möchten Sie diesen Eintrag wirklich archivieren?');
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
    const confirmed = await showConfirm('Möchten Sie diesen Eintrag wiederherstellen?');
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

  /** Navigate to blackboard list with edit parameter */
  function goToBlackboardForEdit(): void {
    void goto(resolvePath(`/blackboard?edit=${entry.uuid}`));
  }

  // =============================================================================
  // MODAL HANDLERS
  // =============================================================================

  function openPreview(att: Attachment): void {
    previewAttachment = {
      fileUuid: att.fileUuid,
      filename: att.filename,
      mimeType: att.mimeType,
      fileSize: att.fileSize,
      uploadedByName: att.uploadedByName,
      downloadUrl: att.downloadUrl,
      previewUrl: att.previewUrl,
    };
    showPreviewModal = true;
  }

  function closePreview(): void {
    showPreviewModal = false;
    previewAttachment = null;
  }

  function downloadAttachment(): void {
    if (!previewAttachment) return;
    window.open(buildDownloadUrl(previewAttachment.downloadUrl), '_blank');
  }

  function goBack(): void {
    void goto(resolvePath('/blackboard'));
  }

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (showDeleteModal) showDeleteModal = false;
      else if (showPreviewModal) closePreview();
    }
  }

  /**
   * Determines the avatar color class based on profile picture availability.
   * Returns empty string if profile picture exists, otherwise returns color class.
   * Uses userId for consistent color per user (same user = same color everywhere).
   */
  function getAvatarColorClass(profilePicture: string | null | undefined, userId: number): string {
    const hasProfilePic =
      profilePicture !== null && profilePicture !== undefined && profilePicture !== '';
    return hasProfilePic ? '' : `avatar--color-${getAvatarColor(userId)}`;
  }

  /**
   * Type-safe check for non-empty string value.
   * Handles null, undefined, and empty string cases explicitly.
   */
  function hasProfilePicture(value: string | null | undefined): value is string {
    return value !== null && value !== undefined && value !== '';
  }
</script>

<svelte:head>
  <title>{entry.title} - Schwarzes Brett - Assixx</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="container">
  <!-- Back Button -->
  <div class="mb-4">
    <button type="button" class="btn btn-light" onclick={goBack}>
      <i class="fas fa-arrow-left mr-2"></i>Zurück zur Übersicht
    </button>
  </div>

  <div class="detail-container">
    <!-- Main Content -->
    <div class="detail-main">
      <!-- Header -->
      <div class="detail-header">
        <div>
          <div class="detail-title">{entry.title}</div>
          <div class="detail-meta">
            <span
              ><i class="fas fa-user"></i>
              {entry.authorFullName ?? entry.authorName ?? 'Unbekannt'}</span
            >
            <span><i class="fas fa-calendar"></i> {formatDate(entry.createdAt)}</span>
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
        <h3 class="section-title"><i class="fas fa-info-circle"></i> Details</h3>
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
                {#each entry.tags as tag (tag)}<span class="badge badge--tag mr-1">{tag}</span
                  >{/each}
              </span>
            </div>
          {/if}
        </div>
      </div>

      <!-- Content Section -->
      <div class="content-section">
        <h3 class="section-title"><i class="fas fa-align-left"></i> Inhalt</h3>
        <!-- eslint-disable-next-line svelte/no-at-html-tags -- Sanitized via DOMPurify -->
        <div class="section-content">{@html sanitizeWithLineBreaks(entry.content)}</div>
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
                  <div class="photo-placeholder"><i class="fas fa-image"></i></div>
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
      <div class="comments-section">
        <h3 class="section-title">
          <i class="fas fa-comments"></i> Kommentare
          <span class="badge badge--count ml-2">{comments.length}</span>
        </h3>

        <!-- Comment Form - Hidden for archived entries -->
        {#if !isArchived}
          <form class="flex gap-4 mb-6" onsubmit={handleAddComment}>
            <div class="form-field flex-1">
              <textarea
                class="form-field__control"
                placeholder="Kommentar hinzufügen..."
                rows="3"
                required
                bind:value={newComment}
              ></textarea>
            </div>
            <div class="flex items-start">
              <button type="submit" class="btn btn-primary" disabled={submittingComment}>
                {#if submittingComment}<span class="spinner-ring spinner-ring--sm mr-2"
                  ></span>{:else}<i class="fas fa-paper-plane mr-2"></i>{/if}
                Senden
              </button>
            </div>
          </form>
        {/if}

        <!-- Comment List -->
        <div class="comment-list">
          {#if comments.length === 0}
            <p class="text-muted">Keine Kommentare vorhanden.</p>
          {:else}
            {#each comments as comment (comment.id)}
              <div class="comment-item" class:comment-internal={comment.isInternal}>
                <div class="comment-header">
                  <div class="comment-author">
                    <div
                      class="avatar avatar--sm {getAvatarColorClass(
                        comment.profilePicture,
                        comment.userId,
                      )}"
                    >
                      {#if hasProfilePicture(comment.profilePicture)}
                        <img
                          src={getProfilePictureUrl(comment.profilePicture)}
                          alt="{comment.firstName} {comment.lastName}"
                          class="avatar__image"
                        />
                      {:else}
                        <span class="avatar__initials"
                          >{(comment.firstName?.[0] ?? 'U').toUpperCase()}{(
                            comment.lastName?.[0] ?? 'N'
                          ).toUpperCase()}</span
                        >
                      {/if}
                    </div>
                    <div>
                      <strong>{comment.firstName ?? 'Unbekannt'} {comment.lastName ?? ''}</strong>
                      {#if comment.isInternal}<span class="internal-badge">Intern</span>{/if}
                    </div>
                  </div>
                  <span class="comment-date">{formatDateTime(comment.createdAt)}</span>
                </div>
                <div class="comment-content">{comment.comment}</div>
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </div>

    <!-- Sidebar -->
    <div class="detail-sidebar">
      <!-- Confirmation Status - Hidden for archived entries -->
      {#if !isArchived}
        <div class="sidebar-card">
          <h3 class="section-title"><i class="fas fa-check-circle"></i> Lesebestätigung</h3>
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
              class="btn btn-light w-full text-sm"
              onclick={unconfirmEntry}
              disabled={confirming}
            >
              {#if confirming}<span class="spinner-ring spinner-ring--sm mr-2"></span>{:else}<i
                  class="fas fa-undo mr-2"
                ></i>{/if}
              Als ungelesen markieren
            </button>
          {:else}
            <button
              type="button"
              class="btn btn-upload w-full"
              onclick={confirmEntry}
              disabled={confirming}
            >
              {#if confirming}<span class="spinner-ring spinner-ring--sm mr-2"></span>{:else}<i
                  class="fas fa-check mr-2"
                ></i>{/if}
              Als gelesen markieren
            </button>
          {/if}
        </div>
      {/if}

      <!-- Attachments (non-photo files) -->
      {#if otherFiles.length > 0}
        <div class="sidebar-card">
          <h3 class="section-title"><i class="fas fa-paperclip"></i> Anhänge</h3>
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
                    {formatFileSize(file.fileSize)} &bull; {file.uploadedByName}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Actions - Hidden for archived entries -->
      {#if !isArchived && (canEditOrDelete || isAdmin)}
        <div class="sidebar-card">
          <h3 class="section-title"><i class="fas fa-cog"></i> Aktionen</h3>
          <div class="action-buttons">
            {#if canEditOrDelete}
              <button
                type="button"
                class="btn btn-light w-full mb-2"
                onclick={goToBlackboardForEdit}><i class="fas fa-edit mr-2"></i>Bearbeiten</button
              >
              <button
                type="button"
                class="btn btn-danger w-full mb-2"
                onclick={() => (showDeleteModal = true)}
                ><i class="fas fa-trash-alt mr-2"></i>Löschen</button
              >
            {/if}
            {#if isAdmin}
              <button type="button" class="btn btn-light w-full" onclick={archiveEntry}
                ><i class="fas fa-archive mr-2"></i>Archivieren</button
              >
            {/if}
          </div>
        </div>
      {:else if isArchived}
        <div class="sidebar-card">
          <div class="text-center p-4">
            <i class="fas fa-archive text-3xl text-[var(--color-warning)] mb-2"></i>
            <p class="text-[var(--color-text-secondary)] mb-4">Dieser Eintrag ist archiviert</p>
            <button type="button" class="btn btn-light w-full" onclick={restoreEntry}>
              <i class="fas fa-undo mr-2"></i>Wiederherstellen
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Preview Modal -->
{#if showPreviewModal && previewAttachment}
  <div
    class="modal-overlay modal-overlay--active"
    onclick={closePreview}
    onkeydown={(e) => {
      if (e.key === 'Escape') closePreview();
    }}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="ds-modal ds-modal--xl"
      onclick={(e) => {
        e.stopPropagation();
      }}
      onkeydown={(e) => {
        e.stopPropagation();
      }}
      role="document"
    >
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">
          {#if getPreviewFileType(previewAttachment.mimeType) === 'pdf'}<i
              class="fas fa-file-pdf text-error-500 mr-2"
            ></i>
          {:else if getPreviewFileType(previewAttachment.mimeType) === 'image'}<i
              class="fas fa-image text-success-500 mr-2"
            ></i>
          {:else}<i class="fas fa-file mr-2"></i>{/if}
          {previewAttachment.filename}
        </h3>
        <button type="button" class="ds-modal__close" onclick={closePreview} aria-label="Schließen"
          ><i class="fas fa-times"></i></button
        >
      </div>
      <div class="ds-modal__body p-0">
        {#if getPreviewFileType(previewAttachment.mimeType) === 'pdf'}
          <iframe
            src={buildDownloadUrl(previewAttachment.previewUrl ?? previewAttachment.downloadUrl)}
            title="PDF Vorschau"
            class="block w-full h-[70vh] min-h-[600px] border-none"
          ></iframe>
        {:else if getPreviewFileType(previewAttachment.mimeType) === 'image'}
          <div
            class="h-[70vh] min-h-[600px] w-full flex items-center justify-center bg-[var(--surface-1)]"
          >
            <img
              src={buildDownloadUrl(previewAttachment.previewUrl ?? previewAttachment.downloadUrl)}
              alt={previewAttachment.filename}
              class="max-w-full max-h-full object-contain"
            />
          </div>
        {:else}
          <div
            class="h-[70vh] min-h-[600px] w-full flex items-center justify-center bg-[var(--surface-1)]"
          >
            <div class="text-center text-[var(--color-text-secondary)]">
              <i class="fas fa-file-alt text-6xl mb-4"></i>
              <p class="text-lg">Vorschau nicht verfügbar</p>
              <p class="text-sm mt-2">Bitte laden Sie die Datei herunter.</p>
            </div>
          </div>
        {/if}
        <div class="p-4 bg-[var(--surface-2)] border-t border-[var(--border-subtle)]">
          <div class="flex items-center gap-6 text-sm text-[var(--color-text-secondary)]">
            <span class="flex items-center gap-2"
              ><i class="fas fa-file-archive"></i>
              {formatFileSize(previewAttachment.fileSize)}</span
            >
            <span class="flex items-center gap-2"
              ><i class="fas fa-user"></i> {previewAttachment.uploadedByName}</span
            >
          </div>
        </div>
      </div>
      <div class="ds-modal__footer">
        <button type="button" class="btn btn-cancel" onclick={closePreview}
          ><i class="fas fa-times mr-2"></i>Schließen</button
        >
        <button type="button" class="btn btn-modal" onclick={downloadAttachment}
          ><i class="fas fa-download mr-2"></i>Herunterladen</button
        >
      </div>
    </div>
  </div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteModal}
  <div
    class="modal-overlay modal-overlay--active"
    onclick={() => (showDeleteModal = false)}
    onkeydown={(e) => {
      if (e.key === 'Escape') showDeleteModal = false;
    }}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="confirm-modal confirm-modal--danger"
      onclick={(e) => {
        e.stopPropagation();
      }}
      onkeydown={(e) => {
        e.stopPropagation();
      }}
      role="document"
    >
      <div class="confirm-modal__icon"><i class="fas fa-exclamation-triangle"></i></div>
      <h3 class="confirm-modal__title">Eintrag löschen?</h3>
      <p class="confirm-modal__message">
        Möchten Sie diesen Eintrag wirklich löschen? Diese Aktion kann nicht rückgängig gemacht
        werden.
      </p>
      <div class="confirm-modal__actions">
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--cancel"
          onclick={() => (showDeleteModal = false)}
          disabled={deleting}>Abbrechen</button
        >
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--danger"
          onclick={handleDeleteEntry}
          disabled={deleting}
        >
          {#if deleting}<span class="spinner-ring spinner-ring--sm mr-2"></span>{/if}
          Endgültig löschen
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .confirmation-done {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
    text-align: center;
  }
  .confirmation-done .text-success {
    font-size: 2rem;
    color: var(--color-success);
  }
  .comment-date {
    font-size: 0.85rem;
    color: rgb(255 255 255 / 50%);
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
    color: rgb(255 255 255 / 60%);
  }
  .photo-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-2, #2a2a3a);
    color: var(--color-text-secondary, #888);
    font-size: 2rem;
  }
</style>
