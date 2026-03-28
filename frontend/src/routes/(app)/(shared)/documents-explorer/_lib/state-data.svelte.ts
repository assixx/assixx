// =============================================================================
// DOCUMENTS EXPLORER - DATA STATE MODULE
// Factory function singleton pattern (Svelte 5 runes)
// Manages: documents, user, navigation, filtering, API operations
// =============================================================================

import { notificationStore } from '$lib/stores/notification.store.svelte';
import { createLogger } from '$lib/utils/logger';
import { handleSessionExpired, isSessionExpiredError } from '$lib/utils/session-expired.js';

import {
  fetchDocuments as apiFetchDocuments,
  markDocumentAsRead as apiMarkAsRead,
  fetchChatFolders as apiFetchChatFolders,
  fetchChatAttachments as apiFetchChatAttachments,
  getCurrentUser as apiGetCurrentUser,
} from './api';
import { SORT_LABELS, CATEGORY_LABELS, MESSAGES } from './constants';
import { applyAllFilters, calculateCategoryCounts, calculateStats } from './filters';
import { canUpload, canSeeActions } from './utils';

import type { Document, DocumentCategory, SortOption, ChatFolder, CurrentUser } from './types';

const log = createLogger('DocExplorerDataState');

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

// eslint-disable-next-line max-lines-per-function -- Factory function pattern: closure scope provides read-only encapsulation via getters
function createDocExplorerDataState() {
  // ---------------------------------------------------------------------------
  // STATE (closure scope, exposed via getters)
  // ---------------------------------------------------------------------------

  let allDocuments = $state<Document[]>([]);
  let filteredDocuments = $state<Document[]>([]);
  let chatFolders = $state<ChatFolder[]>([]);
  let chatFoldersLoaded = $state(true);
  let selectedConversationId = $state<number | null>(null);
  let currentUser = $state<CurrentUser | null>(null);
  let userRole = $state<string | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let currentCategory = $state<DocumentCategory>('all');
  let searchQuery = $state('');
  let sortOption = $state<SortOption>('newest');

  /** SSR documents baseline - stored for restoration when leaving chat */
  let ssrDocsBaseline = $state<Document[]>([]);

  // Debounce timer (private, not exposed)
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // ---------------------------------------------------------------------------
  // DERIVED VALUES
  // ---------------------------------------------------------------------------

  const categoryCounts = $derived(calculateCategoryCounts(allDocuments));
  const stats = $derived(calculateStats(filteredDocuments));
  const chatFoldersTotalCount = $derived(
    chatFolders.reduce((sum, f) => sum + f.attachmentCount, 0),
  );
  const currentSortLabel = $derived(SORT_LABELS[sortOption]);
  const showUploadButton = $derived(canUpload(userRole));
  const showActions = $derived(canSeeActions(userRole));
  const isViewingChatFolders = $derived(
    currentCategory === 'chat' && selectedConversationId === null,
  );
  const selectedChatFolderName = $derived.by(() => {
    if (selectedConversationId === null) return null;
    const folder = chatFolders.find((f) => f.conversationId === selectedConversationId);
    if (folder === undefined) return null;
    return folder.isGroup && folder.groupName !== null ? folder.groupName : folder.participantName;
  });

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  /** Build breadcrumb path string for logging */
  function buildBreadcrumbPath(category: DocumentCategory, conversationId: number | null): string {
    if (category === 'all') return '/Alle Dokumente';
    const categoryLabel = CATEGORY_LABELS[category];
    if (conversationId === null) return `/Alle Dokumente/${categoryLabel}`;
    const folder = chatFolders.find((f) => f.conversationId === conversationId);
    const folderName =
      folder !== undefined ?
        folder.isGroup && folder.groupName !== null ?
          folder.groupName
        : folder.participantName
      : `Conversation#${conversationId}`;
    return `/Alle Dokumente/${categoryLabel}/${folderName}`;
  }

  // ---------------------------------------------------------------------------
  // METHODS
  // ---------------------------------------------------------------------------

  /** Initialize state from SSR data (called via $effect in +page.svelte) */
  function initFromSSR(
    docs: Document[],
    ssrChatFolders: ChatFolder[],
    user: { id: number; role: string } | null,
  ): void {
    if (allDocuments.length === 0 && docs.length > 0) {
      allDocuments = [...docs];
      ssrDocsBaseline = [...docs];
      filteredDocuments = applyAllFilters(docs, 'all', '', 'newest');
    }
    if (chatFolders.length === 0 && ssrChatFolders.length > 0) {
      chatFolders = [...ssrChatFolders];
    }
    if (currentUser === null && user !== null) {
      currentUser = {
        id: user.id,
        tenantId: 0,
        role: user.role,
      };
      userRole = user.role;
    }
  }

  function applyFilters(): void {
    filteredDocuments = applyAllFilters(allDocuments, currentCategory, searchQuery, sortOption);
  }

  async function loadDocuments(): Promise<void> {
    loading = true;
    error = null;
    try {
      allDocuments = await apiFetchDocuments();
      applyFilters();
    } catch (err: unknown) {
      log.error({ err }, 'Error loading documents');
      if (isSessionExpiredError(err)) {
        handleSessionExpired();
        return;
      }
      error = err instanceof Error ? err.message : MESSAGES.ERROR_LOAD_FAILED;
    } finally {
      loading = false;
    }
  }

  async function loadChatFolders(): Promise<void> {
    if (chatFoldersLoaded) return;
    chatFoldersLoaded = true; // Set before await to prevent race condition
    try {
      chatFolders = await apiFetchChatFolders();
    } catch (err: unknown) {
      log.error({ err }, 'Error loading chat folders');
    }
  }

  async function loadChatAttachments(conversationId: number): Promise<void> {
    const previousPath = buildBreadcrumbPath(currentCategory, selectedConversationId);
    const folder = chatFolders.find((f) => f.conversationId === conversationId);
    const folderName =
      folder !== undefined ?
        folder.isGroup && folder.groupName !== null ?
          folder.groupName
        : folder.participantName
      : `Conversation#${conversationId}`;

    loading = true;
    selectedConversationId = conversationId;

    const newPath = buildBreadcrumbPath(currentCategory, conversationId);
    log.debug(
      {
        action: 'loadChatAttachments',
        from: { path: previousPath },
        to: { conversationId, folderName, path: newPath },
        trigger: 'ChatFoldersList click',
      },
      '[NAV] Chat folder click: %s → %s',
      previousPath,
      newPath,
    );

    try {
      allDocuments = await apiFetchChatAttachments(conversationId);
      log.debug(
        {
          conversationId,
          documentCount: allDocuments.length,
          path: newPath,
        },
        '[NAV] Loaded %d attachments for conversation %d',
        allDocuments.length,
        conversationId,
      );
      applyFilters();
    } catch (err: unknown) {
      log.error({ err, conversationId }, 'Error loading chat attachments');
      error = MESSAGES.ERROR_LOAD_FAILED;
    } finally {
      loading = false;
    }
  }

  async function loadCurrentUser(): Promise<void> {
    currentUser = await apiGetCurrentUser();
  }

  async function markAsRead(documentId: number): Promise<void> {
    try {
      await apiMarkAsRead(documentId);
      notificationStore.decrementCount('documents');
      allDocuments = allDocuments.map((doc) =>
        doc.id === documentId ? { ...doc, isRead: true } : doc,
      );
      applyFilters();
    } catch (err: unknown) {
      log.error({ err }, 'Error marking as read');
    }
  }

  function navigateToCategory(category: DocumentCategory): void {
    const previousCategory = currentCategory;
    const previousConversationId = selectedConversationId;
    const previousPath = buildBreadcrumbPath(previousCategory, previousConversationId);

    if (currentCategory === category && selectedConversationId === null) {
      log.debug({ category, path: previousPath }, '[NAV] Category unchanged, ignoring click');
      return;
    }

    // CRITICAL: If leaving chat category OR leaving a chat conversation,
    // restore allDocuments from SSR baseline because loadChatAttachments()
    // replaced allDocuments with only chat attachments
    const leavingChatCategory = previousCategory === 'chat' && category !== 'chat';
    const wasInChatConversation = previousConversationId !== null;
    if (leavingChatCategory || wasInChatConversation) {
      log.debug(
        {
          leavingChatCategory,
          wasInChatConversation,
          previousConversationId,
          ssrDocCount: ssrDocsBaseline.length,
        },
        '[NAV] Restoring allDocuments from SSR baseline',
      );
      allDocuments = [...ssrDocsBaseline];
    }

    currentCategory = category;
    selectedConversationId = null;

    const newPath = buildBreadcrumbPath(category, null);
    log.debug(
      {
        action: 'navigateToCategory',
        from: { category: previousCategory, path: previousPath },
        to: { category, path: newPath },
        label: CATEGORY_LABELS[category],
        restoredDocs: leavingChatCategory || wasInChatConversation,
      },
      '[NAV] Folder tree click: %s → %s',
      previousPath,
      newPath,
    );

    if (category === 'chat' && !chatFoldersLoaded) {
      void loadChatFolders();
    }
    if (category !== 'chat') {
      applyFilters();
    } else {
      filteredDocuments = [];
    }
  }

  function backToFolders(): void {
    const previousPath = buildBreadcrumbPath(currentCategory, selectedConversationId);
    const newPath = buildBreadcrumbPath(currentCategory, null);

    log.debug(
      {
        action: 'backToFolders',
        from: {
          conversationId: selectedConversationId,
          path: previousPath,
        },
        to: { category: currentCategory, path: newPath },
        trigger: 'back-to-folders-row OR breadcrumb',
      },
      '[NAV] Back to folders: %s → %s',
      previousPath,
      newPath,
    );

    selectedConversationId = null;
    filteredDocuments = [];
  }

  function handleSearchInput(query: string): void {
    if (searchDebounceTimer !== null) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      searchQuery = query;
      applyFilters();
    }, 150);
  }

  function clearSearch(): void {
    searchQuery = '';
    applyFilters();
  }

  function handleSortChange(option: SortOption): void {
    sortOption = option;
    applyFilters();
  }

  /** Update SSR baseline after mutations (upload, edit, delete) */
  function updateSsrBaseline(docs: Document[]): void {
    ssrDocsBaseline = [...docs];
  }

  function reset(): void {
    allDocuments = [];
    filteredDocuments = [];
    chatFolders = [];
    chatFoldersLoaded = true;
    selectedConversationId = null;
    currentUser = null;
    userRole = null;
    loading = false;
    error = null;
    currentCategory = 'all';
    searchQuery = '';
    sortOption = 'newest';
    ssrDocsBaseline = [];
    if (searchDebounceTimer !== null) {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------

  return {
    // Getters (read-only reactive access)
    get allDocuments() {
      return allDocuments;
    },
    get filteredDocuments() {
      return filteredDocuments;
    },
    get chatFolders() {
      return chatFolders;
    },
    get selectedConversationId() {
      return selectedConversationId;
    },
    get currentUser() {
      return currentUser;
    },
    get userRole() {
      return userRole;
    },
    get loading() {
      return loading;
    },
    get error() {
      return error;
    },
    get currentCategory() {
      return currentCategory;
    },
    get searchQuery() {
      return searchQuery;
    },
    get sortOption() {
      return sortOption;
    },

    // Derived getters
    get categoryCounts() {
      return categoryCounts;
    },
    get stats() {
      return stats;
    },
    get chatFoldersTotalCount() {
      return chatFoldersTotalCount;
    },
    get currentSortLabel() {
      return currentSortLabel;
    },
    get showUploadButton() {
      return showUploadButton;
    },
    get showActions() {
      return showActions;
    },
    get isViewingChatFolders() {
      return isViewingChatFolders;
    },
    get selectedChatFolderName() {
      return selectedChatFolderName;
    },

    // Methods
    initFromSSR,
    applyFilters,
    loadDocuments,
    loadChatFolders,
    loadChatAttachments,
    loadCurrentUser,
    markAsRead,
    navigateToCategory,
    backToFolders,
    handleSearchInput,
    clearSearch,
    handleSortChange,
    updateSsrBaseline,
    reset,
  };
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const dataState = createDocExplorerDataState();
