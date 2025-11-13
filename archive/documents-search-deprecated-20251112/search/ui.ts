/**
 * Documents Search - UI Rendering
 * Handles document card rendering and UI updates
 */

import domPurify from 'dompurify';
import { setSafeHTML } from '../../../utils/dom-utils';
import type { Document } from '../shared/types';
import { formatDate, formatFileSize, escapeHtml, getScopeLabel, getFileIcon } from '../shared/ui-helpers';
import { openModal } from './modal';

// DOM Elements
const documentsContainer = (): HTMLElement | null => document.querySelector('#documentsContainer');
const emptyStateElement = (): HTMLElement | null => document.querySelector('#documents-empty');

/**
 * Show loading state
 */
export function showLoading(): void {
  const container = documentsContainer();
  const emptyState = emptyStateElement();
  if (container === null) return;

  // Hide empty state
  if (emptyState !== null) {
    emptyState.classList.add('u-hidden');
  }

  container.innerHTML = `
    <div class="flex justify-center items-center py-20">
      <div class="spinner"></div>
      <span class="ml-3 text-[var(--color-text-secondary)]">Dokumente werden geladen...</span>
    </div>
  `;
}

/**
 * Hide loading state
 */
export function hideLoading(): void {
  // Loading is replaced by actual content, so nothing to do
}

/**
 * Render documents as cards
 * @param documents - Array of documents to render
 */
export function renderDocuments(documents: Document[]): void {
  const container = documentsContainer();
  const emptyState = emptyStateElement();
  if (container === null) return;

  // Hide empty state
  if (emptyState !== null) {
    emptyState.classList.add('u-hidden');
  }

  // Create document cards
  const cardsHTML = documents.map((doc) => createDocumentCard(doc)).join('');

  // Render with grid layout (replaces loading spinner)
  const gridHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      ${cardsHTML}
    </div>
  `;
  setSafeHTML(container, gridHTML);
}

/**
 * Clear container content (grid and loading spinner)
 */
function clearContainerContent(container: HTMLElement): void {
  // Remove grid if exists
  const gridContainer = container.querySelector('.grid');
  if (gridContainer !== null) {
    gridContainer.remove();
  }

  // Remove loading spinner if exists
  const spinnerContainer = container.querySelector('.flex.justify-center');
  if (spinnerContainer !== null) {
    spinnerContainer.remove();
  }
}

/**
 * Update empty state content based on search term
 */
function updateEmptyStateContent(emptyState: HTMLElement, searchTerm: string): void {
  const iconElement = emptyState.querySelector('.empty-state__icon i');
  const titleElement = emptyState.querySelector('.empty-state__title');
  const descElement = emptyState.querySelector('.empty-state__description');

  const isSearching = searchTerm !== '';

  if (iconElement !== null) {
    iconElement.className = isSearching ? 'fas fa-search' : 'fas fa-inbox';
  }

  if (titleElement !== null) {
    titleElement.textContent = isSearching ? 'Keine Dokumente gefunden' : 'Keine Dokumente verfügbar';
  }

  if (descElement !== null) {
    descElement.textContent = isSearching
      ? `Ihre Suche nach "${escapeHtml(searchTerm)}" ergab keine Treffer. Versuchen Sie einen anderen Suchbegriff.`
      : 'Es wurden noch keine Dokumente hochgeladen oder Sie haben keine Zugriffsrechte auf Dokumente.';
  }
}

/**
 * Render empty state
 * @param searchTerm - Current search term (if any)
 */
export function renderEmptyState(searchTerm: string): void {
  const container = documentsContainer();
  const emptyState = emptyStateElement();
  if (container === null || emptyState === null) return;

  // Clear any existing content
  clearContainerContent(container);

  // Update empty state text
  updateEmptyStateContent(emptyState, searchTerm);

  // Show empty state
  emptyState.classList.remove('u-hidden');
}

/**
 * Create a single document card
 * @param doc - Document to render
 * @returns HTML string
 */
function createDocumentCard(doc: Document): string {
  const icon = getFileIcon(doc.file_name);
  const scopeLabel = getScopeLabel(doc.scope ?? 'unknown');
  const isRead = doc.is_read ?? false;

  const cardHTML = `
    <div class="card ${isRead ? '' : 'border-l-4 border-l-blue-500'}"
         data-doc-id="${doc.id}">
      <div class="card__body">
        <!-- Icon & Badge -->
        <div class="flex items-start justify-between mb-3">
          <div class="text-4xl text-[var(--color-primary)]">
            <i class="${icon}"></i>
          </div>
          ${!isRead ? '<span class="badge badge--info">Neu</span>' : ''}
        </div>

        <!-- Title -->
        <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-2 truncate"
            title="${escapeHtml(doc.file_name)}">
          ${escapeHtml(doc.file_name)}
        </h3>

        <!-- Scope Badge -->
        <div class="mb-3">
          <span class="badge badge--secondary">
            <i class="fas fa-tag mr-1"></i>
            ${scopeLabel}
          </span>
        </div>

        <!-- Meta Info -->
        <div class="space-y-2 text-sm text-[var(--color-text-secondary)] mb-4">
          <div class="flex items-center gap-2">
            <i class="fas fa-calendar w-4"></i>
            <span>${formatDate(doc.created_at)}</span>
          </div>
          <div class="flex items-center gap-2">
            <i class="fas fa-user w-4"></i>
            <span>${escapeHtml(doc.uploaded_by_name ?? 'System')}</span>
          </div>
          ${
            doc.file_size !== 0
              ? `
          <div class="flex items-center gap-2">
            <i class="fas fa-weight w-4"></i>
            <span>${formatFileSize(doc.file_size)}</span>
          </div>
          `
              : ''
          }
        </div>

        <!-- Action Button -->
        <button type="button" class="btn btn-info w-full btn-open-document">
          <i class="fas fa-eye mr-2"></i>
          Öffnen
        </button>
      </div>
    </div>
  `;

  return domPurify.sanitize(cardHTML);
}

/**
 * Setup global viewDocument function
 */
declare global {
  interface Window {
    viewDocument: (documentId: number) => void;
    allDocuments?: Document[];
  }
}

/**
 * View document in modal
 * @param documentId - Document ID
 */
window.viewDocument = (documentId: number): void => {
  console.info('[DocumentsSearch] Opening document:', documentId);

  // Find document in current list
  const documents = window.allDocuments ?? [];
  const document = documents.find((doc) => doc.id === documentId);

  if (document === undefined) {
    console.error('[DocumentsSearch] Document not found:', documentId);
    return;
  }

  // Open modal (fire and forget - errors handled inside openModal)
  openModal(document);
};
