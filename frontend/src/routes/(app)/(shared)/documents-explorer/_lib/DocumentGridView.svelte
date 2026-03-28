<script lang="ts">
  import {
    formatFileSize,
    formatRelativeDate,
    getDisplayName,
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
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="document-card bg-surface-2 border-border-subtle cursor-pointer rounded-lg border
        p-4 transition-all duration-200 hover:shadow-lg"
      data-document-id={doc.id}
      onclick={() => {
        onpreview(doc);
      }}
    >
      <div class="mb-4 flex items-start justify-between">
        <div class="flex items-center gap-3">
          <i class="fas fa-file-alt text-primary-500 text-3xl"></i>
          <div class="flex flex-col gap-1">
            {#if isNew}
              <span class="bg-success-100 text-success-700 rounded px-2 py-0.5 text-xs font-medium"
                >Neu</span
              >
            {/if}
            {#if !doc.isRead}
              <span class="bg-primary-100 text-primary-700 rounded px-2 py-0.5 text-xs font-medium"
                >Ungelesen</span
              >
            {/if}
          </div>
        </div>
        {#if showActions}
          <div class="flex items-center gap-1">
            <button
              type="button"
              class="action-icon action-icon--info"
              title="Vorschau"
              aria-label="Vorschau anzeigen"
              onclick={(e) => {
                e.stopPropagation();
                onpreview(doc);
              }}
            >
              <i class="fas fa-eye"></i>
            </button>
            <button
              type="button"
              class="action-icon action-icon--info"
              title="Herunterladen"
              aria-label="Dokument herunterladen"
              onclick={(e) => {
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
                onclick={(e) => {
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
                onclick={(e) => {
                  ondelete(doc, e);
                }}
              >
                <i class="fas fa-trash"></i>
              </button>
            {/if}
          </div>
        {/if}
      </div>
      <div class="mb-4">
        <h3
          class="text-content-primary mb-1 truncate text-sm font-medium {!doc.isRead ?
            'font-semibold'
          : ''}"
          title={getDisplayName(doc)}
        >
          {truncateFilename(getDisplayName(doc), 30)}
        </h3>
        <p class="text-content-secondary text-xs">{doc.category}</p>
      </div>
      <div class="text-content-tertiary flex items-center justify-between text-xs">
        <span>{formatFileSize(doc.size)}</span>
        <span>{formatRelativeDate(doc.uploadedAt)}</span>
      </div>
    </div>
  {/each}
</div>
