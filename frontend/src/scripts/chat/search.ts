/* eslint-disable max-lines */
/**
 * Chat Module - User Search
 * Simple live search for starting new conversations
 *
 * PERMISSIONS:
 * - root/admin: Can search and message ALL users in tenant_id
 * - employee: CANNOT start new chats (button + search hidden)
 */

import type { ChatUser } from './types';
import { getChatState } from './state';
import { $$, setHTML, escapeHtml } from '../../utils/dom-utils';

// ============================================================================
// Constants
// ============================================================================

const SEARCH_INPUT_HAS_VALUE_CLASS = 'search-input--has-value';
const SEARCH_WRAPPER_OPEN_CLASS = 'search-input-wrapper--open';
const SEARCH_RESULT_ACTIVE_CLASS = 'search-input__result-item--active';

// ============================================================================
// State
// ============================================================================

let searchInput: HTMLInputElement | null = null;
let searchWrapper: HTMLElement | null = null;
let searchContainer: HTMLElement | null = null;
let searchResults: HTMLElement | null = null;
let searchClearBtn: HTMLButtonElement | null = null;
let selectedResultIndex = -1;
let filteredUsers: ChatUser[] = [];
let onUserSelect: ((userId: number) => Promise<void>) | null = null;

// ============================================================================
// Search Initialization
// ============================================================================

/**
 * Initialize user search functionality
 * @param onSelect - Callback when user is selected to start conversation
 */
export function initUserSearch(onSelect: (userId: number) => Promise<void>): void {
  const state = getChatState();

  // Store callback
  onUserSelect = onSelect;

  // Get DOM elements
  const searchInputEl = $$('#chatUserSearch');
  const searchWrapperEl = $$('#chatUserSearchWrapper');
  const searchContainerEl = $$('#chat-user-search-container');
  const searchResultsEl = $$('#chatUserSearchResults');
  const searchClearBtnEl = $$('#chatUserSearchClear');
  const newChatBtn = $$('#newConversationBtn');

  // Type narrow and assign to module state
  searchInput = searchInputEl instanceof HTMLInputElement ? searchInputEl : null;
  searchWrapper = searchWrapperEl;
  searchContainer = searchContainerEl;
  searchResults = searchResultsEl;
  searchClearBtn = searchClearBtnEl instanceof HTMLButtonElement ? searchClearBtnEl : null;

  // Check if user can start chats
  if (!state.canStartChat()) {
    // SECURITY: Remove elements completely from DOM for employees
    // (not just hidden - prevents DevTools manipulation)
    newChatBtn?.remove();
    searchWrapper?.remove();
    console.info('Chat: User is employee - new chat elements removed from DOM');
    return;
  }

  // User is authorized (root/admin) - show the new chat button
  if (newChatBtn instanceof HTMLButtonElement) {
    newChatBtn.hidden = false;
    newChatBtn.addEventListener('click', () => {
      toggleSearch();
    });
  }

  // Setup event listeners
  setupSearchEventListeners();

  console.info('Chat: User search initialized');
}

/**
 * Toggle search visibility
 */
export function toggleSearch(): void {
  if (searchWrapper === null) return;

  const isHidden = searchWrapper.hidden;

  if (isHidden) {
    // Show search
    searchWrapper.hidden = false;
    searchInput?.focus();
  } else {
    // Hide search
    closeSearch();
  }
}

/**
 * Close search and reset
 */
export function closeSearch(): void {
  if (searchWrapper === null) return;

  searchWrapper.hidden = true;
  clearSearch();
}

/**
 * Clear search input and results
 */
function clearSearch(): void {
  if (searchInput !== null) {
    searchInput.value = '';
  }
  if (searchContainer !== null) {
    searchContainer.classList.remove(SEARCH_INPUT_HAS_VALUE_CLASS);
  }
  closeSearchResults();
  selectedResultIndex = -1;
  filteredUsers = [];
}

// ============================================================================
// Event Listeners
// ============================================================================

/**
 * Setup all search event listeners
 */
function setupSearchEventListeners(): void {
  if (searchInput === null || searchContainer === null) {
    console.error('Search input elements not found');
    return;
  }

  // Input changes - live search
  searchInput.addEventListener('input', () => {
    const query = searchInput?.value ?? '';
    handleSearchInput(query);
  });

  // Clear button
  searchClearBtn?.addEventListener('click', () => {
    clearSearch();
    searchInput?.focus();
  });

  // Keyboard navigation
  searchInput.addEventListener('keydown', handleKeyboardNavigation);

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (searchWrapper !== null && !searchWrapper.contains(e.target as Node)) {
      closeSearchResults();
    }
  });

  // Close on Escape
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSearch();
    }
  });
}

/**
 * Handle search input changes
 */
function handleSearchInput(query: string): void {
  const state = getChatState();

  // Toggle has-value class
  if (query.trim() !== '') {
    searchContainer?.classList.add(SEARCH_INPUT_HAS_VALUE_CLASS);
  } else {
    searchContainer?.classList.remove(SEARCH_INPUT_HAS_VALUE_CLASS);
    closeSearchResults();
    return;
  }

  // Filter users from availableUsers
  const searchLower = query.toLowerCase().trim();
  filteredUsers = state.availableUsers.filter((user) => {
    // Don't show current user in search
    if (user.id === state.currentUserId) return false;

    // Searchable fields
    const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.toLowerCase();
    const username = user.username.toLowerCase();
    const email = user.email.toLowerCase();
    const employeeNumber = (user.employeeNumber ?? '').toLowerCase();
    const areaName = (user.teamAreaName ?? '').toLowerCase();
    const departmentName = (user.departmentName ?? '').toLowerCase();

    return (
      fullName.includes(searchLower) ||
      username.includes(searchLower) ||
      email.includes(searchLower) ||
      employeeNumber.includes(searchLower) ||
      areaName.includes(searchLower) ||
      departmentName.includes(searchLower)
    );
  });

  // Reset selection
  selectedResultIndex = -1;

  // Render results
  renderSearchResults(filteredUsers, query);
}

/**
 * Handle keyboard navigation in search results
 */
function handleKeyboardNavigation(e: KeyboardEvent): void {
  const resultItems = searchResults?.querySelectorAll('.search-input__result-item');
  if (resultItems === undefined || resultItems.length === 0) return;

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      selectedResultIndex = Math.min(selectedResultIndex + 1, resultItems.length - 1);
      updateSelectedResult(resultItems);
      break;

    case 'ArrowUp':
      e.preventDefault();
      selectedResultIndex = Math.max(selectedResultIndex - 1, -1);
      updateSelectedResult(resultItems);
      break;

    case 'Enter':
      e.preventDefault();
      if (selectedResultIndex >= 0 && selectedResultIndex < filteredUsers.length) {
        // eslint-disable-next-line security/detect-object-injection -- Safe: selectedResultIndex is internally controlled numeric index with bounds check, not user input
        const selectedUser = filteredUsers[selectedResultIndex];
        if (selectedUser !== undefined) {
          void selectUser(selectedUser.id);
        }
      }
      break;
  }
}

/**
 * Update visual selection in results
 */
function updateSelectedResult(resultItems: NodeListOf<Element>): void {
  resultItems.forEach((item, index) => {
    if (index === selectedResultIndex) {
      item.classList.add(SEARCH_RESULT_ACTIVE_CLASS);
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove(SEARCH_RESULT_ACTIVE_CLASS);
    }
  });
}

// ============================================================================
// Search Results Rendering
// ============================================================================

/**
 * Render search results dropdown
 */
function renderSearchResults(users: ChatUser[], query: string): void {
  if (searchResults === null || searchWrapper === null) return;

  // If no query, hide results
  if (query.trim() === '') {
    closeSearchResults();
    return;
  }

  // Show dropdown
  searchWrapper.classList.add(SEARCH_WRAPPER_OPEN_CLASS);

  // No results
  if (users.length === 0) {
    setHTML(
      searchResults,
      `<div class="search-input__no-results">Kein Benutzer gefunden für "${escapeHtml(query)}"</div>`,
    );
    return;
  }

  // Limit to 8 results
  const limitedUsers = users.slice(0, 8);

  const resultsHTML = limitedUsers.map((user) => generateSearchResultItem(user, query)).join('');

  // Add "more results" hint
  const moreHTML =
    users.length > 8
      ? `<div class="search-input__no-results" style="font-size: 0.75rem; color: var(--text-secondary);">
           ${users.length - 8} weitere Treffer...
         </div>`
      : '';

  setHTML(searchResults, resultsHTML + moreHTML);

  // Add click handlers to results
  searchResults.querySelectorAll('.search-input__result-item').forEach((item) => {
    item.addEventListener('click', () => {
      const userId = Number.parseInt((item as HTMLElement).dataset['userId'] ?? '0', 10);
      if (userId !== 0) {
        void selectUser(userId);
      }
    });
  });
}

/**
 * Get display name for user
 * Priority: fullName > username (if not email) > email prefix
 */
function getDisplayName(user: ChatUser): string {
  const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  if (fullName !== '') return fullName;
  if (user.username !== user.email) return user.username;
  return user.email.split('@')[0] ?? user.email;
}

/**
 * Generate HTML for single search result
 * Shows: Full Name, Personalnummer, Email, Bereich (or Abteilung fallback)
 */
function generateSearchResultItem(user: ChatUser, query: string): string {
  const displayName = getDisplayName(user);

  // Personalnummer
  const employeeNumber = user.employeeNumber ?? '';

  // Bereich (Area) with Abteilung (Department) fallback
  const areaOrDepartment = user.teamAreaName ?? user.departmentName ?? '';

  // Role display
  const roleDisplay = getRoleDisplay(user.role);

  // Status class
  const statusClass = user.status === 'online' ? 'online' : user.status === 'away' ? 'away' : 'offline';

  // Build info line: Personalnummer | Email
  const infoParts: string[] = [];
  if (employeeNumber !== '') {
    infoParts.push(`#${highlightMatch(employeeNumber, query)}`);
  }
  infoParts.push(highlightMatch(user.email, query));
  const infoLine = infoParts.join(' · ');

  return `
    <div class="search-input__result-item" data-user-id="${user.id}">
      <div class="flex items-center gap-3 w-full">
        <div class="avatar avatar--sm avatar--color-${user.id % 10}" style="position: relative;">
          <span>${getInitials(displayName)}</span>
          <span class="status-indicator ${statusClass}" style="width: 8px; height: 8px; bottom: -1px; right: -1px;"></span>
        </div>
        <div class="flex-1 min-w-0">
          <div style="font-weight: 500; color: var(--text-primary);">
            ${highlightMatch(displayName, query)}
          </div>
          <div style="font-size: 0.75rem; color: var(--text-secondary);">
            ${infoLine}
          </div>
          <div style="font-size: 0.7rem; color: var(--text-muted); display: flex; gap: 6px; align-items: center; margin-top: 2px;">
            <span class="badge badge--${user.role === 'root' ? 'danger' : user.role === 'admin' ? 'warning' : 'info'}" style="font-size: 0.6rem; padding: 1px 5px;">
              ${roleDisplay}
            </span>
            ${areaOrDepartment !== '' ? `<span>${highlightMatch(areaOrDepartment, query)}</span>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Close search results dropdown
 */
function closeSearchResults(): void {
  if (searchWrapper !== null) {
    searchWrapper.classList.remove(SEARCH_WRAPPER_OPEN_CLASS);
  }
  if (searchResults !== null) {
    setHTML(searchResults, '');
  }
}

// ============================================================================
// User Selection
// ============================================================================

/**
 * Select user and start conversation
 */
async function selectUser(userId: number): Promise<void> {
  closeSearch();

  if (onUserSelect !== null) {
    await onUserSelect(userId);
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get role display name
 */
function getRoleDisplay(role: string): string {
  switch (role) {
    case 'root':
      return 'Root';
    case 'admin':
      return 'Admin';
    case 'employee':
      return 'Mitarbeiter';
    default:
      return role;
  }
}

/**
 * Get initials from name
 */
function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return `${parts[0]?.charAt(0) ?? ''}${parts[parts.length - 1]?.charAt(0) ?? ''}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

/**
 * Highlight search match in text
 */
function highlightMatch(text: string, query: string): string {
  if (query.trim() === '') return escapeHtml(text);

  const escapedQuery = escapeRegex(query);
  // eslint-disable-next-line security/detect-non-literal-regexp -- Safe: escapedQuery is sanitized by escapeRegex()
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return escapeHtml(text).replace(regex, '<strong>$1</strong>');
}

/**
 * Escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&');
}

// ============================================================================
// MESSAGE SEARCH (Ctrl+F style)
// ============================================================================

let messageSearchInput: HTMLInputElement | null = null;
let messageSearchBar: HTMLElement | null = null;
let messageSearchCounter: HTMLElement | null = null;
let searchMatches: HTMLElement[] = [];
let currentMatchIndex = -1;

/**
 * Initialize message search functionality
 */
export function initMessageSearch(): void {
  const searchBtn = $$('#searchMessagesBtn');
  messageSearchBar = $$('#chatSearchBar');
  messageSearchInput = $$('#chatSearchInput') as HTMLInputElement | null;
  messageSearchCounter = $$('#chatSearchCounter');

  const closeBtn = $$('#chatSearchClose');
  const prevBtn = $$('#chatSearchPrev');
  const nextBtn = $$('#chatSearchNext');

  // Toggle search bar
  searchBtn?.addEventListener('click', () => {
    toggleMessageSearch();
  });

  // Close button
  closeBtn?.addEventListener('click', () => {
    closeMessageSearch();
  });

  // Navigation buttons
  prevBtn?.addEventListener('click', () => {
    navigateMatch(-1);
  });

  nextBtn?.addEventListener('click', () => {
    navigateMatch(1);
  });

  // Input handler
  messageSearchInput?.addEventListener('input', () => {
    performMessageSearch(messageSearchInput?.value ?? '');
  });

  // Keyboard shortcuts
  // eslint-disable-next-line sonarjs/cognitive-complexity
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    // Ctrl+F to open search
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      const chatMain = document.querySelector('.chat-main');
      if (chatMain !== null && !chatMain.classList.contains('u-hidden')) {
        e.preventDefault();
        openMessageSearch();
      }
    }

    // Escape to close
    if (e.key === 'Escape' && messageSearchBar !== null && !messageSearchBar.classList.contains('hidden')) {
      closeMessageSearch();
    }

    // Enter to go to next match
    if (e.key === 'Enter' && document.activeElement === messageSearchInput) {
      e.preventDefault();
      if (e.shiftKey) {
        navigateMatch(-1);
      } else {
        navigateMatch(1);
      }
    }
  });
}

/**
 * Toggle message search visibility
 */
export function toggleMessageSearch(): void {
  if (messageSearchBar === null) return;

  if (messageSearchBar.classList.contains('hidden')) {
    openMessageSearch();
  } else {
    closeMessageSearch();
  }
}

/**
 * Open message search
 */
export function openMessageSearch(): void {
  if (messageSearchBar === null) return;

  messageSearchBar.classList.remove('hidden');
  messageSearchInput?.focus();
  messageSearchInput?.select();
}

/**
 * Close message search and clear highlights
 */
export function closeMessageSearch(): void {
  if (messageSearchBar === null) return;

  messageSearchBar.classList.add('hidden');
  clearMessageHighlights();

  if (messageSearchInput !== null) {
    messageSearchInput.value = '';
  }
  if (messageSearchCounter !== null) {
    messageSearchCounter.textContent = '';
  }

  searchMatches = [];
  currentMatchIndex = -1;
}

/**
 * Perform search in messages
 */
function performMessageSearch(query: string): void {
  clearMessageHighlights();
  searchMatches = [];
  currentMatchIndex = -1;

  if (query.trim() === '') {
    updateSearchCounter();
    return;
  }

  const messagesContainer = $$('#messagesContainer');
  if (messagesContainer === null) return;

  const messageTexts = messagesContainer.querySelectorAll('.message-text');
  const searchLower = query.toLowerCase();

  messageTexts.forEach((messageText) => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- textContent can be null per DOM spec
    const originalText = messageText.textContent ?? '';
    if (originalText.toLowerCase().includes(searchLower)) {
      // Highlight matches
      const highlighted = highlightTextContent(originalText, query);
      // eslint-disable-next-line no-unsanitized/property -- Safe: highlightTextContent uses escapeHtml and controlled regex replacement
      messageText.innerHTML = highlighted;

      // Collect match elements
      const marks = messageText.querySelectorAll('mark');
      marks.forEach((mark) => {
        searchMatches.push(mark);
      });
    }
  });

  // Navigate to first match
  if (searchMatches.length > 0) {
    currentMatchIndex = 0;
    highlightCurrentMatch();
  }

  updateSearchCounter();
}

/**
 * Highlight text content with search query
 */
function highlightTextContent(text: string, query: string): string {
  const escaped = escapeHtml(text);
  const escapedQuery = escapeRegex(query);
  // eslint-disable-next-line security/detect-non-literal-regexp -- Safe: escapedQuery is sanitized by escapeRegex()
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return escaped.replace(regex, '<mark>$1</mark>');
}

/**
 * Clear all message highlights
 */
function clearMessageHighlights(): void {
  const messagesContainer = $$('#messagesContainer');
  if (messagesContainer === null) return;

  const messageTexts = messagesContainer.querySelectorAll('.message-text');
  messageTexts.forEach((messageText) => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- textContent can be null per DOM spec
    const text = messageText.textContent ?? '';
    messageText.textContent = text;
  });
}

/**
 * Navigate to next/previous match
 */
function navigateMatch(direction: number): void {
  if (searchMatches.length === 0) return;

  // Remove current highlight
  // eslint-disable-next-line security/detect-object-injection -- Safe: currentMatchIndex is internally controlled numeric index with bounds check
  const currentMark = searchMatches[currentMatchIndex];
  currentMark?.classList.remove('current');

  // Calculate new index
  currentMatchIndex += direction;
  if (currentMatchIndex < 0) {
    currentMatchIndex = searchMatches.length - 1;
  } else if (currentMatchIndex >= searchMatches.length) {
    currentMatchIndex = 0;
  }

  highlightCurrentMatch();
  updateSearchCounter();
}

/**
 * Highlight current match and scroll to it
 */
function highlightCurrentMatch(): void {
  if (currentMatchIndex < 0 || currentMatchIndex >= searchMatches.length) return;

  // eslint-disable-next-line security/detect-object-injection -- Safe: currentMatchIndex bounds checked above
  const currentMark = searchMatches[currentMatchIndex];
  if (currentMark === undefined) return;

  currentMark.classList.add('current');
  currentMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * Update search counter display
 */
function updateSearchCounter(): void {
  if (messageSearchCounter === null) return;

  if (searchMatches.length === 0) {
    messageSearchCounter.textContent = messageSearchInput?.value !== '' ? '0 Treffer' : '';
  } else {
    messageSearchCounter.textContent = `${currentMatchIndex + 1} / ${searchMatches.length}`;
  }
}
