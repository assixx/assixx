/**
 * Documents Search Page - Main Controller
 * Handles search functionality and document rendering
 */

import { showErrorAlert } from '../../utils/alerts';
import { setSafeHTML } from '../../../utils/dom-utils';
import { loadDocuments } from '../shared/api';
import type { Document, SortOption } from '../shared/types';
import { escapeHtml } from '../shared/ui-helpers';
import { renderDocuments, renderEmptyState, showLoading, hideLoading } from './ui';
import { initializeModal } from './modal';

// Constants
const SEARCH_WRAPPER_OPEN_CLASS = 'search-input-wrapper--open';
const SEARCH_INPUT_LOADING_CLASS = 'search-input--loading';

// State
let allDocuments: Document[] = [];
let filteredDocuments: Document[] = [];
let currentSearchTerm = '';
let currentSort: SortOption = 'newest';
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// DOM Elements
let searchInput: HTMLInputElement | null = null;
let searchClearBtn: HTMLButtonElement | null = null;
let searchContainer: HTMLElement | null = null;
let searchWrapper: HTMLElement | null = null;
let searchResultsContainer: HTMLElement | null = null;
let sortDropdown: HTMLElement | null = null;
let sortTrigger: HTMLElement | null = null;
let sortMenu: HTMLElement | null = null;
let sortValue: HTMLInputElement | null = null;
let totalDocsElement: HTMLElement | null = null;
let documentsContainer: HTMLElement | null = null;

/**
 * Initialize the search page
 */
export async function initialize(): Promise<void> {
  console.info('[DocumentsSearch] Initializing...');

  initializeDOMElements();
  setupEventListeners();
  initializeModal(); // Initialize modal logic
  await loadAndRenderDocuments();

  // Focus search input
  searchInput?.focus();

  console.info('[DocumentsSearch] Initialized successfully');
}

/**
 * Initialize DOM element references
 */
function initializeDOMElements(): void {
  searchInput = document.querySelector<HTMLInputElement>('#searchInput');
  searchClearBtn = document.querySelector<HTMLButtonElement>('#search-clear');
  searchContainer = document.querySelector<HTMLElement>('#search-container');
  searchWrapper = document.querySelector<HTMLElement>('#search-wrapper');
  searchResultsContainer = document.querySelector<HTMLElement>('#search-results');
  sortDropdown = document.querySelector<HTMLElement>('#sort-dropdown');
  sortTrigger = document.querySelector<HTMLElement>('#sort-trigger');
  sortMenu = document.querySelector<HTMLElement>('#sort-menu');
  sortValue = document.querySelector<HTMLInputElement>('#sortValue');
  totalDocsElement = document.querySelector<HTMLElement>('#totalDocs');
  documentsContainer = document.querySelector<HTMLElement>('#documentsContainer');
}

/**
 * Setup event listeners
 */
function setupEventListeners(): void {
  // Search input
  searchInput?.addEventListener('input', handleSearchInput);

  // Search clear button
  searchClearBtn?.addEventListener('click', handleSearchClear);

  // Search results item click
  searchResultsContainer?.addEventListener('click', handleResultClick);

  // Document card button click (Event Delegation)
  documentsContainer?.addEventListener('click', handleDocumentCardClick);

  // Sort dropdown toggle
  sortTrigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    sortTrigger?.classList.toggle('active');
    sortMenu?.classList.toggle('active');
  });

  // Sort dropdown options
  sortMenu?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const option = target.closest('.dropdown__option');

    if (option === null || !(option instanceof HTMLElement)) {
      return;
    }

    handleSortSelect(option);
  });

  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Close sort dropdown
    if (sortDropdown !== null && !sortDropdown.contains(target)) {
      sortMenu?.classList.remove('active');
      sortTrigger?.classList.remove('active');
    }

    // Close search results dropdown
    if (searchWrapper !== null && !searchWrapper.contains(target)) {
      closeSearchResults();
    }
  });
}

/**
 * Handle search input changes with debouncing
 */
function handleSearchInput(e: Event): void {
  const target = e.target as HTMLInputElement;
  const searchTerm = target.value.trim();

  // Toggle has-value class for clear button
  if (searchTerm !== '') {
    searchContainer?.classList.add('search-input--has-value');
  } else {
    searchContainer?.classList.remove('search-input--has-value');
    closeSearchResults();
  }

  // Clear previous timer
  if (searchDebounceTimer !== null) {
    clearTimeout(searchDebounceTimer);
  }

  // Show loading state
  if (searchTerm !== '') {
    searchContainer?.classList.add(SEARCH_INPUT_LOADING_CLASS);
  }

  // Debounce search (300ms)
  searchDebounceTimer = setTimeout(() => {
    currentSearchTerm = searchTerm.toLowerCase();

    // Hide loading state
    searchContainer?.classList.remove(SEARCH_INPUT_LOADING_CLASS);

    // Show live search preview if searching
    if (currentSearchTerm !== '') {
      showSearchPreview();
    }

    // Filter and render main results
    filterAndRenderDocuments();
  }, 300);
}

/**
 * Handle search clear button
 */
function handleSearchClear(): void {
  if (searchInput !== null) {
    searchInput.value = '';
    currentSearchTerm = '';
    searchContainer?.classList.remove('search-input--has-value');
    searchContainer?.classList.remove(SEARCH_INPUT_LOADING_CLASS);
    closeSearchResults();
    filterAndRenderDocuments();
    searchInput.focus();
  }
}

/**
 * Handle sort option selection
 */
function handleSortSelect(option: HTMLElement): void {
  const value = option.dataset.value as SortOption | undefined;
  // textContent CAN be null according to DOM spec, despite TypeScript typing
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const text = (option.textContent ?? '').trim();

  if (value === undefined) {
    return;
  }

  // Update hidden input
  if (sortValue !== null) {
    sortValue.value = value;
  }

  // Update trigger text
  const triggerSpan = sortTrigger?.querySelector('span');
  if (triggerSpan !== null && triggerSpan !== undefined) {
    triggerSpan.textContent = text;
  }

  // Update state
  currentSort = value;

  // Close dropdown
  sortMenu?.classList.remove('active');
  sortTrigger?.classList.remove('active');

  // Re-render
  filterAndRenderDocuments();
}

/**
 * Load documents from API
 */
async function loadAndRenderDocuments(): Promise<void> {
  // Show loading spinner only if request takes longer than 200ms (prevents flashing)
  let showSpinner = false;
  const spinnerTimer = setTimeout(() => {
    showSpinner = true;
    searchContainer?.classList.add(SEARCH_INPUT_LOADING_CLASS);
    showLoading();
  }, 200);

  try {
    allDocuments = await loadDocuments('all');

    // Store in window for modal access
    window.allDocuments = allDocuments;

    filterAndRenderDocuments();
  } catch (error) {
    console.error('[DocumentsSearch] Error loading documents:', error);
    showErrorAlert('Fehler beim Laden der Dokumente');
    searchContainer?.classList.add('search-input--error');
  } finally {
    // Always clean up spinner timer and state
    clearTimeout(spinnerTimer);
    // Only hide loading if it was actually shown (after 200ms timeout)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (showSpinner) {
      hideLoading();
      searchContainer?.classList.remove(SEARCH_INPUT_LOADING_CLASS);
    }
  }
}

/**
 * Filter documents based on search term
 */
function filterDocuments(): Document[] {
  if (currentSearchTerm === '') {
    return allDocuments;
  }

  return allDocuments.filter((doc) => {
    const fileName = doc.file_name.toLowerCase();
    const description = (doc.description ?? '').toLowerCase();
    const uploaderName = (doc.uploaded_by_name ?? '').toLowerCase();
    const scope = (doc.scope ?? '').toLowerCase();

    return (
      fileName.includes(currentSearchTerm) ||
      description.includes(currentSearchTerm) ||
      uploaderName.includes(currentSearchTerm) ||
      scope.includes(currentSearchTerm)
    );
  });
}

/**
 * Sort documents based on current sort option
 */
function sortDocuments(documents: Document[]): Document[] {
  const sorted = [...documents];

  switch (currentSort) {
    case 'newest':
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      break;
    case 'oldest':
      sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      break;
    case 'name':
      sorted.sort((a, b) => a.file_name.localeCompare(b.file_name));
      break;
    case 'size':
      sorted.sort((a, b) => b.file_size - a.file_size);
      break;
  }

  return sorted;
}

/**
 * Filter, sort and render documents
 */
function filterAndRenderDocuments(): void {
  // Filter
  filteredDocuments = filterDocuments();

  // Sort
  filteredDocuments = sortDocuments(filteredDocuments);

  // Update count
  if (totalDocsElement !== null) {
    totalDocsElement.textContent = filteredDocuments.length.toString();
  }

  // Render
  if (filteredDocuments.length === 0) {
    renderEmptyState(currentSearchTerm);
  } else {
    renderDocuments(filteredDocuments);
  }
}

/**
 * Show live search preview dropdown with top results
 */
function showSearchPreview(): void {
  if (searchResultsContainer === null || searchWrapper === null) return;

  // Get filtered documents
  const preview = filterDocuments();

  // Show max 5 results in preview
  const topResults = preview.slice(0, 5);

  if (topResults.length === 0) {
    // No results
    const noResultsHTML = `
      <div class="search-input__no-results">
        <i class="fas fa-search mr-2"></i>
        Keine Ergebnisse für "${escapeHtml(currentSearchTerm)}"
      </div>
    `;
    setSafeHTML(searchResultsContainer, noResultsHTML);
    searchWrapper.classList.add(SEARCH_WRAPPER_OPEN_CLASS);
    return;
  }

  // Render results
  const resultsHTML = topResults
    .map((doc) => {
      const fileName = doc.file_name;
      const highlightedName = highlightSearchTerm(fileName, currentSearchTerm);

      return `
        <div class="search-input__result-item" data-doc-id="${doc.id}">
          <div class="flex items-center gap-3">
            <i class="fas fa-file text-[var(--color-primary)]"></i>
            <div class="flex-1 min-w-0">
              <div class="font-medium text-[var(--color-text-primary)] truncate">${highlightedName}</div>
              <div class="text-sm text-[var(--color-text-secondary)] truncate">
                ${doc.uploaded_by_name ?? 'System'} • ${new Date(doc.created_at).toLocaleDateString('de-DE')}
              </div>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  setSafeHTML(searchResultsContainer, resultsHTML);
  searchWrapper.classList.add(SEARCH_WRAPPER_OPEN_CLASS);
}

/**
 * Close search results dropdown
 */
function closeSearchResults(): void {
  searchWrapper?.classList.remove(SEARCH_WRAPPER_OPEN_CLASS);
  if (searchResultsContainer !== null) {
    searchResultsContainer.innerHTML = '';
  }
}

/**
 * Handle click on search result item
 */
function handleResultClick(e: Event): void {
  const target = e.target as HTMLElement;
  const resultItem = target.closest('.search-input__result-item');

  if (resultItem === null || !(resultItem instanceof HTMLElement)) {
    return;
  }

  const docId = resultItem.dataset.docId;
  if (docId !== undefined) {
    closeSearchResults();
    window.viewDocument(Number.parseInt(docId, 10));
  }
}

/**
 * Handle click on document card "Öffnen" button
 * Uses Event Delegation to avoid inline onclick handlers
 */
function handleDocumentCardClick(e: Event): void {
  const target = e.target as HTMLElement;

  // Check if click was on button or inside button (icon/text)
  const button = target.closest('.btn-open-document');
  if (button === null) {
    return;
  }

  // Find parent card with data-doc-id
  const card = button.closest('[data-doc-id]');
  if (card === null || !(card instanceof HTMLElement)) {
    return;
  }

  const docId = card.dataset.docId;
  if (docId !== undefined) {
    window.viewDocument(Number.parseInt(docId, 10));
  }
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Highlight search term in text
 */
function highlightSearchTerm(text: string, searchTerm: string): string {
  if (searchTerm === '') return text;

  const escapedTerm = escapeRegExp(searchTerm);
  // Safe: searchTerm is escaped with escapeRegExp to prevent ReDoS attacks
  // eslint-disable-next-line security/detect-non-literal-regexp
  const regex = new RegExp(`(${escapedTerm})`, 'gi');
  return text.replace(regex, '<strong>$1</strong>');
}
