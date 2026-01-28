<script lang="ts">
  import { MESSAGES, DB_CATEGORY_LABELS, MIN_LIST_ROWS } from './constants';
  import {
    formatFileSize,
    formatDate,
    getDisplayName,
    isDocumentNew,
    canEditDocument,
    canDeleteDocument,
  } from './utils';

  import type { Document, CurrentUser } from './types';

  interface Props {
    documents: Document[];
    currentUser: CurrentUser | null;
    showActions: boolean;
    showBackToFolders: boolean;
    onpreview: (doc: Document) => void;
    ondownload: (doc: Document, e: MouseEvent) => void;
    onedit: (doc: Document, e: MouseEvent) => void;
    ondelete: (doc: Document, e: MouseEvent) => void;
    onbackToFolders: () => void;
  }

  const {
    documents,
    currentUser,
    showActions,
    showBackToFolders,
    onpreview,
    ondownload,
    onedit,
    ondelete,
    onbackToFolders,
  }: Props = $props();

  const placeholderRowCount = $derived(
    Math.max(0, MIN_LIST_ROWS - documents.length),
  );
</script>

<div class="overflow-x-auto">
  <table
    class="data-table data-table--striped data-table--hover data-table--bordered"
  >
    <thead>
      <tr>
        <th>{MESSAGES.TH_NAME}</th>
        <th>{MESSAGES.TH_CATEGORY}</th>
        <th>{MESSAGES.TH_TAGS}</th>
        <th>{MESSAGES.TH_SIZE}</th>
        <th>{MESSAGES.TH_DATE}</th>
        <th>{MESSAGES.TH_ACTIONS}</th>
      </tr>
    </thead>
    <tbody id="list-rows">
      {#if showBackToFolders}
        <tr
          class="back-to-folders-row cursor-pointer"
          onclick={onbackToFolders}
        >
          <td>
            <div class="flex items-center gap-3">
              <i
                class="fas fa-level-up-alt"
                style="font-size: 24px; color: var(--color-content-secondary);"
              ></i>
              <span class="font-medium text-content-secondary">..</span>
            </div>
          </td>
          <td class="text-content-tertiary">Übergeordneter Ordner</td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
      {/if}

      {#if documents.length === 0 && !showBackToFolders}
        <tr>
          <td
            colspan="6"
            class="text-center text-content-secondary py-8"
          >
            {MESSAGES.EMPTY_DESCRIPTION}
          </td>
        </tr>
      {/if}

      {#each documents as doc (doc.id)}
        {@const isNew = isDocumentNew(doc)}
        <tr
          class="document-row cursor-pointer"
          data-document-id={doc.id}
          data-read={doc.isRead}
          onclick={() => {
            onpreview(doc);
          }}
        >
          <td>
            <div class="flex items-center gap-3">
              <i
                class="fas fa-file-alt flex-shrink-0"
                style="font-size: 24px; color: var(--color-icon-primary);"
              ></i>
              <div class="user-info">
                <span
                  class="user-name"
                  class:font-semibold={!doc.isRead}
                  title={getDisplayName(doc)}
                >
                  {getDisplayName(doc)}
                </span>
                {#if isNew}
                  <span class="badge badge--sm badge--success">Neu</span>
                {/if}
                {#if !doc.isRead}
                  <span
                    class="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0"
                    title="Ungelesen"
                  ></span>
                {/if}
              </div>
            </div>
          </td>
          <td>{DB_CATEGORY_LABELS[doc.category] ?? doc.category}</td>
          <td>
            {#if doc.tags && doc.tags.length > 0}
              <div class="flex flex-wrap gap-1">
                {#each doc.tags.slice(0, 3) as tag (tag)}
                  <span
                    class="badge badge--info"
                    style="padding: 2px 6px;">{tag}</span
                  >
                {/each}
                {#if doc.tags.length > 3}
                  <span class="text-xs text-content-tertiary"
                    >+{doc.tags.length - 3}</span
                  >
                {/if}
              </div>
            {:else}
              <span class="text-content-tertiary">-</span>
            {/if}
          </td>
          <td>{formatFileSize(doc.size)}</td>
          <td>{formatDate(doc.uploadedAt)}</td>
          <td>
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
          </td>
        </tr>
      {/each}

      <!-- Placeholder rows -->
      {#each Array(placeholderRowCount) as _, i (i)}
        <tr class="placeholder-row">
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
