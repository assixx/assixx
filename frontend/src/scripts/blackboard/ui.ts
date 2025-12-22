/**
 * Blackboard UI Rendering
 * Handles all UI rendering and DOM manipulation
 * Following MANAGE pattern (like manage/areas/ui.ts)
 * Uses sticky-note-component.ts for card rendering (Single Source of Truth)
 */

import { $$id, setSafeHTML, escapeHtml } from '../../utils/dom-utils';
import { blackboardState } from './data';
import type { BlackboardEntry, BlackboardAttachment, Priority } from './types';
import { createStickyNote } from './sticky-note-component';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get priority label (German)
 */
function getPriorityLabel(priority: Priority): string {
  const labels: Record<Priority, string> = {
    low: 'Niedrig',
    medium: 'Normal',
    high: 'Hoch',
    urgent: 'Dringend',
  };
  // eslint-disable-next-line security/detect-object-injection -- priority is typed union, not user input
  return labels[priority];
}

/**
 * Get priority badge class
 */
function getPriorityBadgeClass(priority: Priority): string {
  const classes: Record<Priority, string> = {
    low: 'badge--info',
    medium: 'badge--secondary',
    high: 'badge--warning',
    urgent: 'badge--danger',
  };
  // eslint-disable-next-line security/detect-object-injection -- priority is typed union, not user input
  return classes[priority];
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format file size
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  // eslint-disable-next-line security/detect-object-injection -- i is calculated from Math.floor/Math.log, not user input
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i] ?? 'Bytes'}`;
}

// ============================================================================
// Grid Rendering
// ============================================================================

/**
 * Render blackboard grid with all entries
 */
export function renderBlackboardGrid(): void {
  const gridContainer = $$id('blackboardEntries');
  if (!gridContainer) {
    console.warn('[UI] Blackboard entries container not found');
    return;
  }

  const state = blackboardState;
  const entries = state.getEntries();

  // Clear existing content
  gridContainer.innerHTML = '';

  if (entries.length === 0) {
    renderEmptyState(gridContainer);
    gridContainer.removeAttribute('hidden');
    return;
  }

  // Render entries directly into the grid container
  entries.forEach((entry) => {
    const entryCard = createEntryCard(entry);
    gridContainer.append(entryCard);
  });

  gridContainer.removeAttribute('hidden');
  console.info('[UI] Rendered blackboard grid with', entries.length, 'entries');
}

/**
 * Render empty state (uses Design System sticky-note, white variant)
 */
function renderEmptyState(container: HTMLElement): void {
  const html = `
    <div class="sticky-note" style="background: #fff; cursor: default;">
      <div class="sticky-note__pin"></div>
      <div class="text-center">
        <i class="fas fa-clipboard-list" style="font-size: 1.5rem; opacity: 0.5; margin-bottom: 0.5rem;"></i>
        <div class="sticky-note__title" style="white-space: normal;">Keine Einträge</div>
        <div class="sticky-note__content" style="-webkit-line-clamp: unset;">Für diesen Filter wurden keine Einträge gefunden.</div>
      </div>
    </div>
  `;

  // eslint-disable-next-line no-unsanitized/property -- Static HTML with no user input
  container.innerHTML = html;
}

// ============================================================================
// Entry Card Rendering (Uses shared sticky-note-component)
// ============================================================================

/**
 * Create entry card element using shared sticky-note component
 */
function createEntryCard(entry: BlackboardEntry): HTMLElement {
  const state = blackboardState;
  const canEdit = state.canEditEntry(entry);
  const canDelete = state.canDeleteEntry(entry);

  // Create wrapper div for grid layout
  const item = document.createElement('div');
  item.className = 'pinboard-item';
  item.dataset['entryId'] = entry.id.toString();

  // Build options dynamically to avoid undefined with exactOptionalPropertyTypes
  // maxContentLength uses default from sticky-note-component (single source of truth)
  const options: Parameters<typeof createStickyNote>[1] = {
    size: 'large',
    showActions: canEdit || canDelete,
    onClick: (e) => {
      handleEntryClick(e.id);
    },
  };

  if (canEdit) {
    options.onEdit = (e) => {
      handleEditEntry(e);
    };
  }
  if (canDelete) {
    options.onDelete = (e) => {
      handleDeleteEntry(e);
    };
  }

  // Use shared sticky-note component
  const stickyNote = createStickyNote(entry, options);

  item.append(stickyNote);
  return item;
}

/**
 * Handle entry card click (view entry)
 */
function handleEntryClick(entryId: number): void {
  const state = blackboardState;
  const entry = state.getEntryById(entryId);

  if (!entry) return;

  // Navigate to detail page with UUID
  window.location.href = `/blackboard-detail?uuid=${encodeURIComponent(entry.uuid)}`;
}

/**
 * Handle edit entry action
 */
function handleEditEntry(entry: BlackboardEntry): void {
  // Dispatch custom event for edit action (handled by forms.ts)
  const event = new CustomEvent('blackboard:edit-entry', { detail: { entry } });
  document.dispatchEvent(event);
}

/**
 * Handle delete entry action
 */
function handleDeleteEntry(entry: BlackboardEntry): void {
  // Dispatch custom event for delete action (handled by forms.ts)
  const event = new CustomEvent('blackboard:delete-entry', { detail: { entry } });
  document.dispatchEvent(event);
}

// ============================================================================
// Entry Detail Modal Rendering
// ============================================================================

/**
 * Render entry detail in modal
 */
export function renderEntryDetailModal(entry: BlackboardEntry): void {
  const modalContent = $$id('view-entry-content');
  if (!modalContent) return;

  const html = `
    <div class="entry-detail">
      <div class="entry-detail__header">
        <h2 class="entry-detail__title">${escapeHtml(entry.title)}</h2>
        <div class="badge ${getPriorityBadgeClass(entry.priority)}">
          ${getPriorityLabel(entry.priority)}
        </div>
      </div>

      <div class="entry-detail__meta">
        <span><i class="fas fa-user"></i> ${escapeHtml(entry.authorFullName ?? 'Unbekannt')}</span>
        <span><i class="fas fa-clock"></i> ${formatDate(entry.createdAt)}</span>
      </div>

      <div class="entry-detail__content">
        ${escapeHtml(entry.content)}
      </div>

      ${entry.attachments && entry.attachments.length > 0 ? renderAttachments(entry.attachments) : ''}
    </div>
  `;

  setSafeHTML(modalContent, html);
}

/**
 * Get file type icon class
 */
function getFileIconClass(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'fa-image';
  if (mimeType === 'application/pdf') return 'fa-file-pdf';
  return 'fa-file';
}

/**
 * Render attachments section
 * Updated 2025-11-24: Uses documents API with preview support
 */
function renderAttachments(attachments: BlackboardAttachment[]): string {
  const attachmentItems = attachments
    .map((att) => {
      // filename is required in type, use it directly (fallback only for empty strings)
      const displayName = att.filename !== '' ? att.filename : (att.originalName ?? 'Datei');

      return `
        <div class="attachment-item flex items-center gap-3 p-3 rounded-lg bg-surface-2 hover:bg-surface-3 transition-colors">
          <i class="fas ${getFileIconClass(att.mimeType)} text-lg text-content-secondary"></i>
          <div class="flex-1 min-w-0">
            <span class="attachment-name block truncate font-medium">${escapeHtml(displayName)}</span>
            <span class="attachment-size text-xs text-content-tertiary">${formatFileSize(att.fileSize)}</span>
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <div class="entry-detail__attachments mt-6 pt-4 border-t border-gray-200">
      <h3 class="flex items-center gap-2 mb-4 text-lg font-semibold">
        <i class="fas fa-paperclip"></i> Anhänge (${attachments.length})
      </h3>
      <div class="space-y-2">
        ${attachmentItems}
      </div>
    </div>
  `;
}

// ============================================================================
// Loading State
// ============================================================================

/**
 * Show loading indicator (uses HTML element)
 */
export function showLoadingIndicator(): void {
  const loadingEl = $$id('loadingIndicator');
  const gridEl = $$id('blackboardEntries');

  if (loadingEl) loadingEl.removeAttribute('hidden');
  if (gridEl) gridEl.setAttribute('hidden', '');
}

/**
 * Hide loading indicator
 */
export function hideLoadingIndicator(): void {
  const loadingEl = $$id('loadingIndicator');
  if (loadingEl) loadingEl.setAttribute('hidden', '');
}

// ============================================================================
// Pagination Rendering
// ============================================================================

/**
 * Render pagination controls
 */
export function renderPagination(): void {
  const paginationContainer = $$id('pagination-container');
  if (!paginationContainer) return;

  const state = blackboardState;
  const pagination = state.getPaginationState();

  if (pagination.totalPages <= 1) {
    paginationContainer.innerHTML = '';
    return;
  }

  const html = `
    <div class="pagination">
      <button
        class="btn btn-secondary"
        data-action="change-page"
        data-page="${pagination.currentPage - 1}"
        ${pagination.currentPage === 1 ? 'disabled' : ''}
      >
        <i class="fas fa-chevron-left"></i> Zurück
      </button>

      <span class="pagination__info">
        Seite ${pagination.currentPage} von ${pagination.totalPages}
      </span>

      <button
        class="btn btn-secondary"
        data-action="change-page"
        data-page="${pagination.currentPage + 1}"
        ${pagination.currentPage === pagination.totalPages ? 'disabled' : ''}
      >
        Weiter <i class="fas fa-chevron-right"></i>
      </button>
    </div>
  `;

  setSafeHTML(paginationContainer, html);
}
