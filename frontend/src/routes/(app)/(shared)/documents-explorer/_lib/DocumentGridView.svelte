<script lang="ts">
  import {
    formatFileSize,
    formatRelativeDate,
    getDisplayName,
    getFileExtension,
    getFileTypeDisplayInfo,
    truncateFilename,
    isDocumentNew,
    canEditDocument,
    canDeleteDocument,
  } from './utils';

  import type { Document, CurrentUser } from './types';

  interface Props {
    documents: Document[];
    currentUser: CurrentUser | null;
    showActions: boolean;
    onpreview: (doc: Document) => void;
    ondownload: (doc: Document, e: MouseEvent) => void;
    onedit: (doc: Document, e: MouseEvent) => void;
    ondelete: (doc: Document, e: MouseEvent) => void;
  }

  const { documents, currentUser, showActions, onpreview, ondownload, onedit, ondelete }: Props =
    $props();
</script>

<div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
  {#each documents as doc (doc.id)}
    {@const isNew = isDocumentNew(doc)}
    {@const displayName = getDisplayName(doc)}
    {@const ext = getFileExtension(displayName)}
    {@const typeInfo = getFileTypeDisplayInfo(doc.category, ext)}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="document-card card card--clickable card--compact card--no-margin"
      data-document-id={doc.id}
      onclick={() => {
        onpreview(doc);
      }}
    >
      <!-- Icon + Badges -->
      <div class="mb-3 flex items-start justify-between">
        <i class="{typeInfo.iconClass} document-card__icon"></i>
        <div class="document-card__badges">
          {#if isNew}
            <span class="document-card__badge document-card__badge--new">Neu</span>
          {/if}
          {#if !doc.isRead}
            <span class="document-card__badge document-card__badge--unread">Ungelesen</span>
          {/if}
        </div>
      </div>

      <!-- Name + Category -->
      <h3
        class="text-content-primary mb-1 truncate text-sm leading-snug {!doc.isRead ?
          'font-semibold'
        : 'font-medium'}"
        title={displayName}
      >
        {truncateFilename(displayName, 28)}
      </h3>
      <p class="text-content-secondary mb-3 text-xs">{doc.category}</p>

      <!-- Footer: Meta + Actions -->
      <div class="mt-auto flex items-center justify-between">
        <div class="text-content-tertiary flex items-center gap-2 text-xs">
          <span>{formatFileSize(doc.size)}</span>
          <span class="text-border-subtle">&middot;</span>
          <span>{formatRelativeDate(doc.uploadedAt)}</span>
        </div>
        {#if showActions}
          <div class="document-card__actions">
            <button
              type="button"
              class="action-icon action-icon--info"
              title="Herunterladen"
              aria-label="Dokument herunterladen"
              onclick={(e: MouseEvent) => {
                ondownload(doc, e);
              }}
            >
              <i class="fas fa-download"></i>
            </button>
            {#if canEditDocument(doc, currentUser)}
              <button
                type="button"
                class="action-icon action-icon--edit"
                title="Bearbeiten"
                aria-label="Dokument bearbeiten"
                onclick={(e: MouseEvent) => {
                  onedit(doc, e);
                }}
              >
                <i class="fas fa-edit"></i>
              </button>
            {/if}
            {#if canDeleteDocument(doc, currentUser)}
              <button
                type="button"
                class="action-icon action-icon--delete"
                title="Löschen"
                aria-label="Dokument löschen"
                onclick={(e: MouseEvent) => {
                  ondelete(doc, e);
                }}
              >
                <i class="fas fa-trash"></i>
              </button>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {/each}
</div>

<style>
  .document-card {
    display: flex;
    flex-direction: column;
  }

  /* File type icon — large, centered top-left anchor */
  .document-card__icon {
    font-size: 1.75rem;
    color: var(--color-primary);
    opacity: 80%;
    transition: opacity 0.2s ease;
  }

  .document-card:hover .document-card__icon {
    opacity: 100%;
  }

  /* Badges */
  .document-card__badges {
    display: flex;
    gap: 0.25rem;
  }

  .document-card__badge {
    border-radius: var(--radius-sm, 4px);
    padding: 0.125rem 0.375rem;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .document-card__badge--new {
    background: oklch(87% 0.12 145 / 20%);
    color: var(--color-success);
  }

  .document-card__badge--unread {
    background: oklch(65% 0.17 249 / 15%);
    color: var(--color-primary);
  }

  /* Actions — reveal on hover */
  .document-card__actions {
    display: flex;
    gap: 0.125rem;
    opacity: 0%;
    transition: opacity 0.15s ease;
  }

  .document-card:hover .document-card__actions {
    opacity: 100%;
  }

  /* On touch devices, always show actions */
  @media (hover: none) {
    .document-card__actions {
      opacity: 100%;
    }
  }
</style>
