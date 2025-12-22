<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { sanitizeWithLineBreaks } from '$lib/utils/sanitize-html';

  // Page-specific CSS (reuses kvp-detail layout)
  import '../../../../styles/kvp-detail.css';

  // _lib/ imports
  import type {
    DetailEntry,
    Comment,
    Attachment,
    PreviewAttachment,
    CurrentUser,
  } from './_lib/types';
  import {
    fetchFullEntry,
    loadCurrentUser as loadUser,
    confirmEntry as confirmApi,
    unconfirmEntry as unconfirmApi,
    addComment as addCommentApi,
    archiveEntry as archiveApi,
    buildDownloadUrl,
  } from './_lib/api';
  import {
    formatDate,
    formatDateTime,
    getPriorityText,
    getPriorityBadgeClass,
    getOrgLevelText,
    getVisibilityBadgeClass,
    getFileIcon,
    formatFileSize,
    getPreviewFileType,
    getAvatarColor,
    filterPhotos,
    filterOtherFiles,
  } from './_lib/utils';

  // =============================================================================
  // SVELTE 5 RUNES - State
  // =============================================================================

  // Entry Data
  let entry = $state<DetailEntry | null>(null);
  let comments = $state<Comment[]>([]);
  let attachments = $state<Attachment[]>([]);

  // Loading States
  let loading = $state(true);
  let error = $state<string | null>(null);

  // User State
  let currentUser = $state<CurrentUser | null>(null);

  // Comment Form State
  let newComment = $state('');
  let submittingComment = $state(false);

  // Confirmation State
  let confirming = $state(false);

  // Preview Modal State
  let showPreviewModal = $state(false);
  let previewAttachment = $state<PreviewAttachment | null>(null);

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  const uuid = $derived($page.params.uuid);
  const isAdmin = $derived.by(
    () => currentUser !== null && (currentUser.role === 'admin' || currentUser.role === 'root'),
  );
  const isConfirmed = $derived.by(() => entry !== null && entry.isConfirmed === true);
  const photos = $derived(filterPhotos(attachments));
  const otherFiles = $derived(filterOtherFiles(attachments));

  // =============================================================================
  // API HANDLERS
  // =============================================================================

  async function loadEntry(): Promise<void> {
    if (!uuid) return;
    loading = true;
    error = null;

    try {
      const result = await fetchFullEntry(uuid);
      if (!result) {
        error = 'Eintrag nicht gefunden';
        return;
      }
      entry = result.entry;
      comments = result.comments;
      attachments = result.attachments;
    } catch (err) {
      console.error('[Blackboard Detail] Error:', err);
      error = err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten';
    } finally {
      loading = false;
    }
  }

  async function loadCurrentUser(): Promise<void> {
    currentUser = await loadUser();
  }

  async function confirmEntry(): Promise<void> {
    if (!entry || !uuid) return;
    confirming = true;
    const success = await confirmApi(uuid);
    if (success) entry = { ...entry, isConfirmed: true, confirmedAt: new Date().toISOString() };
    confirming = false;
  }

  async function unconfirmEntry(): Promise<void> {
    if (!entry || !uuid) return;
    confirming = true;
    const success = await unconfirmApi(uuid);
    if (success) entry = { ...entry, isConfirmed: false, confirmedAt: null };
    confirming = false;
  }

  async function handleAddComment(e: Event): Promise<void> {
    e.preventDefault();
    if (!newComment.trim() || !uuid) return;
    submittingComment = true;
    const success = await addCommentApi(uuid, newComment);
    if (success) {
      newComment = '';
      await loadEntry();
    }
    submittingComment = false;
  }

  async function archiveEntry(): Promise<void> {
    if (!entry || !uuid || !confirm('Möchten Sie diesen Eintrag wirklich archivieren?')) return;
    const success = await archiveApi(uuid);
    if (success) goto(`${base}/blackboard`);
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
    };
    showPreviewModal = true;
  }

  function closePreview(): void {
    showPreviewModal = false;
    previewAttachment = null;
  }

  function downloadAttachment(): void {
    if (!previewAttachment) return;
    window.open(buildDownloadUrl(previewAttachment.fileUuid), '_blank');
  }

  function goBack(): void {
    goto(`${base}/blackboard`);
  }

  // =============================================================================
  // LIFECYCLE
  // =============================================================================

  let mounted = false;
  $effect(() => {
    if (!mounted && uuid) {
      mounted = true;
      loadCurrentUser();
      loadEntry();
    }
  });

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && showPreviewModal) closePreview();
  }
</script>

<svelte:head>
  <title>{entry?.title ?? 'Eintrag'} - Schwarzes Brett - Assixx</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="container">
  <!-- Back Button -->
  <div class="mb-4">
    <button class="btn btn-light" onclick={goBack}>
      <i class="fas fa-arrow-left mr-2"></i>Zurück zur Übersicht
    </button>
  </div>

  {#if loading}
    <div class="text-center p-10">
      <div class="spinner-ring spinner-ring--lg"></div>
      <p class="mt-4 text-[var(--color-text-secondary)]">Eintrag wird geladen...</p>
    </div>
  {:else if error}
    <div class="text-center p-10">
      <i class="fas fa-exclamation-triangle text-6xl text-[var(--color-danger)] mb-4"></i>
      <p class="text-[var(--color-text-secondary)]">{error}</p>
      <button class="btn btn-primary mt-4" onclick={loadEntry}>Erneut versuchen</button>
    </div>
  {:else if entry}
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
            {#if entry.expiresAt}
              <div class="data-list__item">
                <span class="data-list__label">Gültig bis</span>
                <span class="data-list__value">{formatDate(entry.expiresAt)}</span>
              </div>
            {/if}
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
          <!-- eslint-disable-next-line svelte/no-at-html-tags -- Content sanitized via DOMPurify in sanitizeWithLineBreaks() -->
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
                  onclick={() => openPreview(photo)}
                  role="button"
                  tabindex="0"
                  onkeydown={(e) => e.key === 'Enter' && openPreview(photo)}
                >
                  <img src={buildDownloadUrl(photo.fileUuid)} alt={photo.filename} loading="lazy" />
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

          <!-- Comment Form -->
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

          <!-- Comment List -->
          <div class="comment-list">
            {#if comments.length === 0}
              <p class="text-muted">Keine Kommentare vorhanden.</p>
            {:else}
              {#each comments as comment (comment.id)}
                <div class="comment-item" class:comment-internal={comment.isInternal}>
                  <div class="comment-header">
                    <div class="comment-author">
                      <div class="avatar avatar--sm avatar--color-{getAvatarColor(comment.id)}">
                        {#if comment.profilePicture}
                          <img
                            src={comment.profilePicture}
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
        <!-- Confirmation Status -->
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
            <button class="btn btn-upload w-full" onclick={confirmEntry} disabled={confirming}>
              {#if confirming}<span class="spinner-ring spinner-ring--sm mr-2"></span>{:else}<i
                  class="fas fa-check mr-2"
                ></i>{/if}
              Als gelesen markieren
            </button>
          {/if}
        </div>

        <!-- Attachments (non-photo files) -->
        {#if otherFiles.length > 0}
          <div class="sidebar-card">
            <h3 class="section-title"><i class="fas fa-paperclip"></i> Anhänge</h3>
            <div class="attachment-list">
              {#each otherFiles as file (file.fileUuid)}
                <div
                  class="attachment-item"
                  onclick={() => openPreview(file)}
                  role="button"
                  tabindex="0"
                  onkeydown={(e) => e.key === 'Enter' && openPreview(file)}
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

        <!-- Actions (Admin Only) -->
        {#if isAdmin}
          <div class="sidebar-card">
            <h3 class="section-title"><i class="fas fa-cog"></i> Aktionen</h3>
            <div class="action-buttons">
              <button class="btn btn-light w-full" onclick={archiveEntry}
                ><i class="fas fa-archive mr-2"></i>Archivieren</button
              >
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<!-- Preview Modal -->
{#if showPreviewModal && previewAttachment}
  <div
    class="modal-overlay modal-overlay--active"
    onclick={closePreview}
    onkeydown={(e) => e.key === 'Escape' && closePreview()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="ds-modal ds-modal--xl"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
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
        <button class="ds-modal__close" onclick={closePreview} aria-label="Schließen"
          ><i class="fas fa-times"></i></button
        >
      </div>
      <div class="ds-modal__body p-0">
        {#if getPreviewFileType(previewAttachment.mimeType) === 'pdf'}
          <iframe
            src={buildDownloadUrl(previewAttachment.fileUuid)}
            title="PDF Vorschau"
            class="block w-full h-[70vh] min-h-[600px] border-none"
          ></iframe>
        {:else if getPreviewFileType(previewAttachment.mimeType) === 'image'}
          <div
            class="h-[70vh] min-h-[600px] w-full flex items-center justify-center bg-[var(--surface-1)]"
          >
            <img
              src={buildDownloadUrl(previewAttachment.fileUuid)}
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
</style>
