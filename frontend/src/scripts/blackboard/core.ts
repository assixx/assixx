/**
 * Blackboard Core
 * Main functionality for the blackboard feature
 */

import type {
  BlackboardEntry,
  BlackboardAttachment,
  BlackboardResponse,
  Department,
  Team,
  PaginationInfo,
  UserData,
  V2EntryResponse,
  V2EntryDetailResponse,
} from './types';
import {
  openModal,
  closeModal,
  setupCloseButtons,
  previewAttachment,
  openDirectAttachModal,
  clearDirectAttachment,
  saveDirectAttachment,
  formatFileSize,
  openPdfInNewTab,
  setupZoomControls,
  setupFullscreenControls,
  buildAttachmentsSection,
  setupAttachmentHandlers,
  formatDate,
} from './ui-helpers';
import { ApiClient } from '../../utils/api-client';
import { $$id, $$, setHTML } from '../../utils/dom-utils';
import { showSuccess, showError } from '../auth';
import { escapeHtml } from '../common';

// Import constants
const PDF_MIME_TYPE = 'application/pdf';
const DISPLAY_FLEX = 'inline-flex';
const DISPLAY_HIDDEN = 'none';

// Initialize API client
const apiClient = ApiClient.getInstance();

// Global variables
let currentPage = 1;
let currentFilter = 'all';
let currentSearch = '';
let currentSort = 'created_at|DESC';
let departments: Department[] = [];
let teams: Team[] = [];
let isAdmin = false;
let currentUserId: number | null = null;
let selectedFiles: File[] = [];

// Global variable to prevent endless requests
let entriesLoadingEnabled = false;

/**
 * Check if user is logged in
 */
async function checkLoggedIn(): Promise<void> {
  try {
    // Use v2 API endpoint
    await apiClient.get('/users/me');
  } catch {
    throw new Error('Invalid token');
  }
}

// Helper function to set admin status
function setAdminStatus(role: string): void {
  const adminRoles = ['admin', 'root'];
  isAdmin = adminRoles.includes(role);
}

// Helper function to set entries loading state
function setEntriesLoadingEnabled(enabled: boolean): void {
  entriesLoadingEnabled = enabled;
}

// Helper functions for click handlers
function handleRemoveAttachment(target: HTMLElement): void {
  const removeAttachmentBtn = target.closest<HTMLElement>('[data-action="remove-attachment"]');
  if (removeAttachmentBtn?.dataset.index !== undefined) {
    removeAttachment(Number.parseInt(removeAttachmentBtn.dataset.index, 10));
  }
}

function handlePreviewAttachment(target: HTMLElement, e: Event): void {
  const previewBtn = target.closest<HTMLElement>('[data-action="preview-attachment"]');
  if (!previewBtn) return;

  e.stopPropagation();
  const { attachmentId, mimeType, filename } = previewBtn.dataset;
  if (attachmentId !== undefined && mimeType !== undefined && filename !== undefined) {
    void previewAttachment(Number.parseInt(attachmentId, 10), mimeType, filename);
  }
}

function handleViewEntry(target: HTMLElement): void {
  const viewEntryBtn = target.closest<HTMLElement>('[data-action="view-entry"]');
  if (viewEntryBtn?.dataset.entryId !== undefined) {
    void viewEntry(Number.parseInt(viewEntryBtn.dataset.entryId, 10));
  }
}

function handleEditEntry(target: HTMLElement, e: Event): void {
  const editEntryBtn = target.closest<HTMLElement>('[data-action="edit-entry"]');
  if (!editEntryBtn) return;

  e.stopPropagation();
  if (editEntryBtn.dataset.entryId !== undefined) {
    openEntryForm(Number.parseInt(editEntryBtn.dataset.entryId, 10));
  }
}

function handleDeleteEntry(target: HTMLElement, e: Event): void {
  const deleteEntryBtn = target.closest<HTMLElement>('[data-action="delete-entry"]');
  if (!deleteEntryBtn) return;

  e.stopPropagation();
  if (deleteEntryBtn.dataset.entryId !== undefined) {
    deleteEntry(Number.parseInt(deleteEntryBtn.dataset.entryId, 10));
  }
}

function handlePageNavigation(target: HTMLElement): void {
  const changePageBtn = target.closest<HTMLElement>('[data-action="change-page"]');
  if (changePageBtn?.dataset.page !== undefined) {
    changePage(Number.parseInt(changePageBtn.dataset.page, 10));
  }
}

function handleCloseModal(target: HTMLElement): void {
  const closeModalBtn = target.closest<HTMLElement>('[data-action="close-modal"]');
  if (closeModalBtn?.dataset.modalId !== undefined) {
    closeModal(closeModalBtn.dataset.modalId);
  }
}

// Helper functions moved outside
function processUserData(userData: UserData): void {
  currentUserId = userData.id;
  setAdminStatus(userData.role);
  console.info('[Blackboard] User data processed:', userData);
  console.info('[Blackboard] isAdmin:', isAdmin);
  console.info('[Blackboard] User role:', userData.role);
}

function updateNewEntryButtonVisibility(): void {
  const newEntryBtn = $$('#newEntryBtn');
  if (newEntryBtn) {
    console.info('[Blackboard] Setting newEntryBtn display:', isAdmin ? DISPLAY_FLEX : DISPLAY_HIDDEN);
    newEntryBtn.style.display = isAdmin ? DISPLAY_FLEX : DISPLAY_HIDDEN;
  } else {
    console.info('[Blackboard] newEntryBtn not found!');
  }
}

function loadUserDataFromStorage(): Promise<boolean> {
  const storedUser = localStorage.getItem('currentUser');
  if (storedUser === null || storedUser.length === 0) {
    return Promise.resolve(false);
  }

  try {
    const userData = JSON.parse(storedUser) as UserData;
    processUserData(userData);
    updateNewEntryButtonVisibility();
    void loadDepartmentsAndTeams();
    return Promise.resolve(true);
  } catch (error) {
    console.error('[Blackboard] Error parsing stored user data:', error);
    return Promise.resolve(false);
  }
}

async function loadUserDataFromAPI(): Promise<void> {
  try {
    const userData = await fetchUserData();
    processUserData(userData);
    updateNewEntryButtonVisibility();
    void loadDepartmentsAndTeams();
  } catch (error) {
    console.error('[Blackboard] Error loading user data:', error);
    showError('Fehler beim Laden der Benutzerdaten');
    throw error;
  }
}

function handleUrlEntryParameter(): void {
  const urlParams = new URLSearchParams(window.location.search);
  const entryId = urlParams.get('entry');

  if (entryId === null || entryId.length === 0) return;

  const entryElement = document.querySelector(`[data-entry-id="${entryId}"]`);
  if (entryElement === null) return;

  entryElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  entryElement.classList.add('highlight-entry');
  setTimeout(() => {
    entryElement.classList.remove('highlight-entry');
  }, 3000);
}

function setupRetryButton(): void {
  const retryLoadBtn = $$id('retryLoadBtn');
  if (!retryLoadBtn) return;

  retryLoadBtn.addEventListener('click', () => {
    setEntriesLoadingEnabled(true);
    void loadEntries();
  });
}

function setupGlobalEventDelegation(): void {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    handleRemoveAttachment(target);
    handlePreviewAttachment(target, e);
    handleViewEntry(target);
    handleEditEntry(target, e);
    handleDeleteEntry(target, e);
    handlePageNavigation(target);
    handleCloseModal(target);

    // Handle confirm delete
    const confirmDeleteBtn = target.closest<HTMLElement>('[data-action="confirm-delete"]');
    if (confirmDeleteBtn) {
      const entryId = confirmDeleteBtn.dataset.entryId;
      if (entryId !== undefined) {
        closeModal('deleteConfirmModal');
        void performDelete(Number.parseInt(entryId, 10));
      }
    }

    // Handle open PDF in new tab
    const openPdfBtn = target.closest<HTMLElement>('[data-action="open-pdf-new-tab"]');
    if (openPdfBtn) {
      const attachmentUrl = openPdfBtn.dataset.attachmentUrl;
      if (attachmentUrl !== undefined) {
        void openPdfInNewTab(attachmentUrl);
      }
    }

    // Handle save direct attachment
    const saveDirectBtn = target.closest<HTMLElement>('[data-action="save-direct-attachment"]');
    if (saveDirectBtn) {
      console.info('[DirectAttach] Save button clicked');
      void saveDirectAttachment();
    }
  });
}

async function initializeUserAndUI(): Promise<void> {
  try {
    await checkLoggedIn();

    // Try localStorage first, fallback to API
    const loadedFromStorage = await loadUserDataFromStorage();
    if (!loadedFromStorage) {
      await loadUserDataFromAPI();
    }

    // Load entries
    setEntriesLoadingEnabled(true);
    await loadEntries();

    // Handle URL parameters
    handleUrlEntryParameter();

    // Hide load entries button
    const loadEntriesBtn = $$('#loadEntriesBtn');
    if (loadEntriesBtn) {
      loadEntriesBtn.style.display = 'none';
    }

    // Setup retry button
    setupRetryButton();

    // Setup event listeners
    setupEventListeners();
  } catch (error) {
    console.error('Error checking login:', error);
    window.location.href = '/login';
  }
}

function initializeBlackboard() {
  // Setup Event Delegation for all dynamic content
  setupGlobalEventDelegation();

  // Aktiviere das automatische Laden der Einträge
  setEntriesLoadingEnabled(true);

  // Alle Schließen-Buttons einrichten
  setupCloseButtons();

  // Debug: Log when this script loads
  console.info('[Blackboard] Script loaded at:', new Date().toISOString());

  // Check if user is logged in
  void initializeUserAndUI();

  // Listen for reload events from UI helpers
  window.addEventListener('reloadBlackboardEntries', () => {
    if (entriesLoadingEnabled) {
      void loadEntries();
    }
  });
}

// Initialize when DOM is ready or immediately if already ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeBlackboard);
} else {
  // DOM is already ready, call the function directly
  initializeBlackboard();
}

/**
 * Setup all event listeners
 */
function setupFilterPills(): void {
  document.querySelectorAll<HTMLElement>('.filter-pill[data-value]').forEach((button) => {
    button.addEventListener('click', function (this: HTMLElement) {
      document.querySelectorAll('.filter-pill').forEach((pill) => {
        pill.classList.remove('active');
      });
      this.classList.add('active');
      currentFilter = this.dataset.value ?? 'all';
      currentPage = 1;
      if (entriesLoadingEnabled) {
        void loadEntries();
      }
    });
  });
}

function setupSortFilter(): void {
  const sortFilter = $$id('sortFilter') as HTMLSelectElement | null;
  if (sortFilter) {
    sortFilter.addEventListener('change', function (this: HTMLSelectElement) {
      currentSort = this.value;
      if (entriesLoadingEnabled) {
        void loadEntries();
      }
    });
  } else {
    console.error('Sort filter not found');
  }
}

function setupSearchFunctionality(): void {
  const searchButton = $$id('searchButton');
  const searchInput = $$('#searchInput') as HTMLInputElement | null;

  if (searchButton && searchInput) {
    searchButton.addEventListener('click', () => {
      currentSearch = searchInput.value.trim();
      currentPage = 1;
      if (entriesLoadingEnabled) {
        void loadEntries();
      }
    });

    searchInput.addEventListener('keypress', function (this: HTMLInputElement, e: KeyboardEvent) {
      if (e.key === 'Enter') {
        currentSearch = this.value.trim();
        currentPage = 1;
        if (entriesLoadingEnabled) {
          void loadEntries();
        }
      }
    });
  } else {
    console.error('Search elements not found');
  }
}

function setupActionButtons(): void {
  const newEntryBtn = $$id('newEntryBtn');
  if (newEntryBtn) {
    console.log('[Blackboard] Adding click listener to newEntryBtn');
    newEntryBtn.addEventListener('click', () => {
      console.log('[Blackboard] newEntryBtn clicked!');
      openEntryForm();
    });
  } else {
    console.error('New entry button not found');
  }

  const directAttachBtn = $$id('directAttachBtn');
  if (directAttachBtn) {
    directAttachBtn.addEventListener('click', () => {
      openDirectAttachModal();
    });
  } else {
    console.error('Direct attachment button not found');
  }

  const saveEntryBtn = $$id('saveEntryBtn');
  if (saveEntryBtn) {
    saveEntryBtn.addEventListener('click', () => {
      void saveEntry();
    });
  } else {
    console.error('Save entry button not found');
  }
}

function setupOrgLevelDropdown(): void {
  const entryOrgLevel = $$id('entryOrgLevel') as HTMLSelectElement | null;
  if (entryOrgLevel) {
    entryOrgLevel.addEventListener('change', function (this: HTMLSelectElement) {
      updateOrgIdDropdown(this.value);
    });
  } else {
    console.error('Organization level dropdown not found');
  }
}

function toggleDropdown(): void {
  const dropdown = $$id('orgIdDropdown');
  if (dropdown) {
    dropdown.classList.toggle('show');
  }
}

function updateDropdownSelection(value: string, text: string | null): void {
  const display = $$id('orgIdDisplay');
  if (display) {
    const span = display.querySelector('span');
    if (span) span.textContent = text;
  }

  const hiddenInput = $$id('orgIdValue') as HTMLInputElement | null;
  if (hiddenInput) {
    hiddenInput.value = value;
  }

  const select = $$id('entryOrgId') as HTMLSelectElement | null;
  if (select) {
    select.value = value;
  }

  const dropdown = $$id('orgIdDropdown');
  if (dropdown) {
    dropdown.classList.remove('show');
  }
}

function setupCustomDropdown(): void {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    if (target.closest('#orgIdDisplay')) {
      toggleDropdown();
      return;
    }

    const dropdownOption = target.closest('#orgIdDropdown .dropdown-option');
    if (dropdownOption instanceof HTMLElement) {
      const value = dropdownOption.dataset.value ?? '';
      const text = dropdownOption.textContent;
      updateDropdownSelection(value, text);
    }
  });
}

function setupColorSelection(): void {
  document.querySelectorAll<HTMLElement>('.color-option').forEach((button) => {
    button.addEventListener('click', function (this: HTMLElement) {
      document.querySelectorAll('.color-option').forEach((option) => {
        option.classList.remove('active');
      });
      this.classList.add('active');
    });
  });
}

function setupEventListeners(): void {
  setupFilterPills();
  setupSortFilter();
  setupSearchFunctionality();
  setupActionButtons();
  setupOrgLevelDropdown();
  setupCustomDropdown();
  setupColorSelection();
  setupFileUploadHandlers();
  setupZoomControls();
  setupFullscreenControls();
}

/**
 * Setup file upload handlers for attachments
 */
function setupFileUploadHandlers(): void {
  const dropZone = $$('#attachmentDropZone');
  const fileInput = $$('#attachmentInput') as HTMLInputElement | null;

  if (!dropZone || !fileInput) return;

  // Click to upload
  dropZone.addEventListener('click', () => {
    fileInput.click();
    // eslint-disable-next-line max-lines
  });

  // File input change
  fileInput.addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement | null;
    if (target?.files) {
      handleFileSelection([...target.files]);
    }
  });

  // Drag and drop
  dropZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropZone.classList.remove('drag-over');

    if (event.dataTransfer?.files) {
      handleFileSelection([...event.dataTransfer.files]);
    }
  });
}

/**
 * Handle file selection for attachments
 */
function handleFileSelection(files: File[]): void {
  const maxFiles = 5;
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = [PDF_MIME_TYPE, 'image/jpeg', 'image/jpg', 'image/png', 'image/gif'];

  // Filter valid files
  const validFiles = files.filter((file) => {
    if (!allowedTypes.includes(file.type)) {
      showError(`Dateiformat nicht unterstützt: ${file.name}`);
      return false;
    }
    if (file.size > maxSize) {
      showError(`Datei zu groß (max 10MB): ${file.name}`);
      return false;
    }
    return true;
  });

  // Check total file count
  if (selectedFiles.length + validFiles.length > maxFiles) {
    showError(`Maximal ${maxFiles} Dateien erlaubt`);
    return;
  }

  // Add to selected files
  selectedFiles = [...selectedFiles, ...validFiles];

  // Update preview
  updateAttachmentPreview();
}

/**
 * Update attachment preview display
 */
function updateAttachmentPreview(): void {
  const preview = $$('#attachmentPreview');
  const list = $$('#attachmentList');

  if (!preview || !list) return;

  if (selectedFiles.length === 0) {
    preview.style.display = 'none';
    return;
  }

  preview.style.display = 'block';
  list.innerHTML = '';

  selectedFiles.forEach((file, index) => {
    const item = document.createElement('div');
    item.className = 'attachment-item';

    const icon = file.type === PDF_MIME_TYPE ? 'fa-file-pdf pdf' : 'fa-file-image image';
    const size = formatFileSize(file.size);

    // Create attachment info wrapper
    const infoDiv = document.createElement('div');
    infoDiv.className = 'attachment-info';

    // Create icon
    const iconElement = document.createElement('i');
    iconElement.className = `fas ${icon} attachment-icon`;
    infoDiv.append(iconElement);

    // Create details container
    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'attachment-details';

    // Create name element
    const nameDiv = document.createElement('div');
    nameDiv.className = 'attachment-name';
    nameDiv.textContent = file.name;
    detailsDiv.append(nameDiv);

    // Create size element
    const sizeDiv = document.createElement('div');
    sizeDiv.className = 'attachment-size';
    sizeDiv.textContent = size;
    detailsDiv.append(sizeDiv);

    infoDiv.append(detailsDiv);
    item.append(infoDiv);

    // Create remove button
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'attachment-remove';
    removeButton.dataset.action = 'remove-attachment';
    removeButton.dataset.index = index.toString();

    const removeIcon = document.createElement('i');
    removeIcon.className = 'fas fa-times';
    removeButton.append(removeIcon, ' Entfernen');

    item.append(removeButton);
    list.append(item);
  });
}

/**
 * Remove attachment from selection
 */
function removeAttachment(index: number): void {
  selectedFiles.splice(index, 1);
  updateAttachmentPreview();

  // Reset file input
  const fileInput = $$('#attachmentInput') as HTMLInputElement | null;
  if (fileInput) {
    fileInput.value = '';
  }
}

// Helper to show/hide loading UI
function showLoadingUI(): void {
  const loadEntriesCard = $$id('loadEntriesCard');
  if (loadEntriesCard !== null) loadEntriesCard.classList.add('d-none');

  const loadingIndicator = $$id('loadingIndicator');
  if (loadingIndicator !== null) loadingIndicator.classList.remove('d-none');

  const blackboardEntries = $$id('blackboardEntries');
  if (blackboardEntries !== null) blackboardEntries.classList.add('d-none');

  const noEntriesMessage = $$id('noEntriesMessage');
  if (noEntriesMessage !== null) noEntriesMessage.classList.add('d-none');
}

// Helper to hide loading UI
function hideLoadingUI(): void {
  const loadingIndicator = $$id('loadingIndicator');
  if (loadingIndicator !== null) loadingIndicator.classList.add('d-none');
}

// Helper to handle API response
function processApiResponse(data: BlackboardResponse | BlackboardEntry[]): BlackboardEntry[] {
  if (Array.isArray(data)) {
    updatePagination({
      currentPage: 1,
      totalPages: 1,
      totalEntries: data.length,
      entriesPerPage: data.length > 0 ? data.length : 10,
    });
    return data;
  }

  const entries = data.entries;
  const pagination = data.pagination ?? {
    currentPage: 1,
    totalPages: 1,
    totalEntries: entries.length,
    entriesPerPage: 10,
  };

  updatePagination(pagination);
  return entries;
}

// Helper to handle load error
function handleLoadError(): void {
  console.error('Error loading entries');
  showError('Fehler beim Laden der Einträge.');

  const noEntriesMessage = $$id('noEntriesMessage');
  if (noEntriesMessage !== null) {
    noEntriesMessage.classList.remove('d-none');
  }

  const loadEntriesCard = $$id('loadEntriesCard');
  if (loadEntriesCard !== null) {
    loadEntriesCard.classList.remove('d-none');
  }
}

function mapV2EntryToUI(entry: BlackboardEntry): BlackboardEntry {
  const v2Entry = entry as unknown as V2EntryResponse;

  return {
    ...entry,
    priority_level: (v2Entry.priority ?? v2Entry.priority_level ?? entry.priority_level) as
      | 'low'
      | 'medium'
      | 'high'
      | 'critical',
    org_level: (v2Entry.orgLevel === 'company' ? 'all' : (v2Entry.orgLevel ?? v2Entry.org_level ?? entry.org_level)) as
      | 'all'
      | 'department'
      | 'team',
    org_id: v2Entry.orgId ?? v2Entry.org_id ?? entry.org_id,
    created_by: v2Entry.createdBy ?? v2Entry.created_by ?? entry.created_by,
    created_at: v2Entry.createdAt ?? v2Entry.created_at ?? entry.created_at,
    updated_at: v2Entry.updatedAt ?? v2Entry.updated_at ?? entry.updated_at,
  } as BlackboardEntry;
}

/**
 * Load blackboard entries
 */
async function loadEntries(): Promise<void> {
  if (!entriesLoadingEnabled) {
    return;
  }

  try {
    showLoadingUI();

    const [sortBy, sortDir] = currentSort.split('|');
    const endpoint = `/blackboard/entries?page=${currentPage}&filter=${currentFilter}&search=${encodeURIComponent(currentSearch)}&sortBy=${sortBy}&sortDir=${sortDir}`;

    try {
      const data = await apiClient.get<BlackboardResponse>(endpoint);
      console.log('[Blackboard] API Response:', data);

      const entries = processApiResponse(data);
      const mappedEntries = entries.map(mapV2EntryToUI);

      displayEntries(mappedEntries);

      if (entries.length === 0) {
        const noEntriesMessage = $$id('noEntriesMessage');
        if (noEntriesMessage !== null) noEntriesMessage.classList.remove('d-none');
      }

      setEntriesLoadingEnabled(false);
    } catch (error) {
      console.error('Error loading entries:', error);
      handleLoadError();
    } finally {
      hideLoadingUI();
    }
  } catch (error) {
    console.error('Unexpected error in loadBlackboardEntries:', error);
    hideLoadingUI();
  }
}

/**
 * Fetch user data
 */
async function fetchUserData(): Promise<UserData> {
  // Use v2 API endpoint
  return await apiClient.get<UserData>('/users/me');
}

/**
 * Load departments and teams
 */
async function loadDepartmentsAndTeams(): Promise<void> {
  try {
    // Load departments and teams using v2 API
    const [deptResult, teamResult] = await Promise.allSettled([
      apiClient.get<Department[]>('/departments'),
      apiClient.get<Team[]>('/teams'),
    ]);

    if (deptResult.status === 'fulfilled') {
      departments = deptResult.value;
    } else {
      console.error('Error loading departments:', deptResult.reason);
    }

    if (teamResult.status === 'fulfilled') {
      teams = teamResult.value;
    } else {
      console.error('Error loading teams:', teamResult.reason);
    }
  } catch (error) {
    console.error('Error loading departments and teams:', error);
  }
} /**
 * Display blackboard entries
 */
function displayEntries(entries: BlackboardEntry[]): void {
  const container = $$id('blackboardEntries');
  if (!container) return;

  container.innerHTML = '';
  container.classList.remove('d-none');

  if (entries.length === 0) {
    const noEntriesMessage = $$id('noEntriesMessage');
    if (noEntriesMessage) {
      noEntriesMessage.classList.remove('d-none');
    }
    return;
  }

  entries.forEach((entry) => {
    const entryCard = createEntryCard(entry);
    container.append(entryCard);
  });
}

// Helper: Get random rotation class
function getRandomRotation(): string {
  const rotations = ['rotate-1', 'rotate-2', 'rotate-3', 'rotate-n1', 'rotate-n2', 'rotate-n3'];
  return rotations[Math.floor(Math.random() * rotations.length)];
}

// Helper: Get random pushpin style
function getRandomPushpin(): string {
  const pushpinStyles = ['pushpin-red', 'pushpin-blue', 'pushpin-yellow', 'pushpin-metal'];
  return pushpinStyles[Math.floor(Math.random() * pushpinStyles.length)];
}

// Helper: Determine card styling based on priority and content
function determineCardStyle(entry: BlackboardEntry): { cardClass: string; cardColor: string } {
  let cardClass = 'pinboard-sticky';
  const cardColor = entry.color;

  if (entry.priority_level === 'high' || entry.priority_level === 'critical') {
    cardClass = 'pinboard-info';
  } else if (entry.content.length > 200) {
    cardClass = 'pinboard-note';
  }

  return { cardClass, cardColor };
}

// Helper: Get attachment size from content
function getAttachmentSize(content: string): string {
  const sizeMatch = /\[Attachment:(small|medium|large)\]/.exec(content);
  return sizeMatch !== null ? sizeMatch[1] : 'medium';
}

// Helper: Get size style for attachment
function getSizeStyle(size: string): string {
  if (size === 'small') return 'max-width: 200px; max-height: 200px;';
  if (size === 'medium') return 'max-width: 300px; max-height: 300px;';
  if (size === 'large') return 'max-width: 400px; max-height: 400px;';
  return '';
}

// Helper: Create image attachment HTML
function createImageAttachment(attachment: BlackboardAttachment, sizeStyle: string): string {
  return `
    <div class="pinboard-image" style="${sizeStyle} margin: 0 auto;">
      <img src="/api/blackboard/attachments/${attachment.id}/preview"
           alt="${escapeHtml(attachment.original_name)}"
           style="width: 100%; height: 100%; object-fit: contain; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); cursor: pointer;"
           data-action="preview-attachment"
           data-attachment-id="${attachment.id}"
           data-mime-type="${escapeHtml(attachment.mime_type)}"
           data-filename="${escapeHtml(attachment.original_name)}">
    </div>
  `;
}

// Helper: Create PDF attachment HTML
function createPDFAttachment(attachment: BlackboardAttachment, sizeStyle: string, attachmentSize: string): string {
  const containerHeight = attachmentSize === 'small' ? 350 : attachmentSize === 'medium' ? 500 : 380;
  const scale = attachmentSize === 'small' ? 0.3 : attachmentSize === 'medium' ? 0.4 : 0.5;

  return `
    <div class="pinboard-pdf-preview" style="${sizeStyle} height: ${containerHeight}px; position: relative; overflow: hidden; background: #fff; border-radius: 8px; border: 1px solid #ddd;">
      <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; overflow: hidden;">
        <div style="transform: scale(${scale}); transform-origin: top left; width: ${100 / scale}%; height: ${100 / scale}%;">
          <object
            data="/api/blackboard/attachments/${attachment.id}/preview#view=FitH&toolbar=0&navpanes=0&scrollbar=0"
            type="application/pdf"
            style="width: 100%; height: 100%; border: none;">
            <div style="padding: 20px; text-align: center;">
              <i class="fas fa-file-pdf" style="font-size: 48px; color: #dc3545;"></i>
              <p>PDF-Vorschau</p>
            </div>
          </object>
        </div>
      </div>
      <div class="pdf-overlay"
           style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; cursor: pointer; z-index: 10;"
           data-action="preview-attachment"
           data-attachment-id="${attachment.id}"
           data-mime-type="${escapeHtml(attachment.mime_type)}"
           data-filename="${escapeHtml(attachment.original_name)}"
           title="Klicken für Vollansicht">
      </div>
    </div>
  `;
}

// Helper: Create text content HTML
function createTextContent(content: string): string {
  const truncated = content.substring(0, 150);
  const displayText = escapeHtml(truncated).replace(/\n/g, '<br>');
  const ellipsis = content.length > 150 ? '...' : '';

  return `
    <div style="color: #333; font-size: 14px; line-height: 1.5; margin-bottom: 15px;">
      ${displayText}${ellipsis}
    </div>
  `;
}

// Helper: Create attachment info HTML
function createAttachmentInfo(entry: BlackboardEntry, isDirectAttachment: boolean): string {
  if (isDirectAttachment || entry.attachment_count === undefined || entry.attachment_count === 0) {
    return '';
  }

  const plural = entry.attachment_count > 1 ? 'änge' : '';
  return `
    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(0,0,0,0.1);">
      <i class="fas fa-paperclip" style="color: #666;"></i>
      <span style="color: #666; font-size: 12px;">${entry.attachment_count} Anhang${plural}</span>
    </div>
  `;
}

// Helper: Create entry actions HTML
function createEntryActions(entryId: number, canEdit: boolean): string {
  if (!canEdit) return '';

  return `
    <div class="entry-actions" style="position: absolute; top: 10px; right: 10px; opacity: 0;">
      <button class="btn btn-sm btn-link p-1" data-action="edit-entry" data-entry-id="${entryId}" title="Bearbeiten">
        <i class="fas fa-edit"></i>
      </button>
      <button class="btn btn-sm btn-link p-1 text-danger" data-action="delete-entry" data-entry-id="${entryId}" title="Löschen">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `;
}

function buildEntryCardHtml(
  entry: BlackboardEntry,
  cardClass: string,
  colorClass: string,
  randomRotation: string,
  randomPushpin: string,
  priorityIcon: string,
  contentHtml: string,
  isDirectAttachment: boolean,
  canEdit: boolean,
): string {
  const authorName = escapeHtml(entry.authorFullName ?? entry.author_full_name ?? entry.author_name ?? 'Unknown');

  return `
    <div class="${cardClass} ${colorClass} ${randomRotation}" data-entry-id="${entry.id}" data-action="view-entry" style="cursor: pointer;">
      <div class="pushpin ${randomPushpin}"></div>

      <h4 style="margin: 0 0 10px 0; font-weight: 600; color:rgb(0, 0, 0);">
        ${priorityIcon} ${escapeHtml(entry.title)}
      </h4>

      ${contentHtml}
      ${createAttachmentInfo(entry, isDirectAttachment)}

      <div style="font-size: 12px; color: #000; display: flex; justify-content: space-between; align-items: center;">
        <span>
          <i class="fas fa-user" style="opacity: 0.6;"></i> ${authorName}
        </span>
        <span>
          ${formatDate(entry.createdAt ?? entry.created_at)}
        </span>
      </div>

      ${createEntryActions(entry.id, canEdit)}
    </div>
  `;
}

/**
 * Create entry card element with pinboard style
 */
function createEntryCard(entry: BlackboardEntry): HTMLElement {
  const container = document.createElement('div');
  container.className = 'pinboard-item';

  const randomRotation = getRandomRotation();
  const randomPushpin = getRandomPushpin();
  let { cardClass, cardColor } = determineCardStyle(entry);

  const canEdit = isAdmin || entry.created_by === currentUserId;
  const priorityIcon = getPriorityIcon(entry.priority_level);
  const isDirectAttachment = entry.content.startsWith('[Attachment:');

  let contentHtml = '';
  if (isDirectAttachment && entry.attachments !== undefined && entry.attachments.length > 0) {
    const attachment = entry.attachments[0];
    const attachmentSize = getAttachmentSize(entry.content);
    const sizeStyle = getSizeStyle(attachmentSize);

    if (attachment.mime_type.startsWith('image/')) {
      contentHtml = createImageAttachment(attachment, sizeStyle);
    } else if (attachment.mime_type === PDF_MIME_TYPE) {
      contentHtml = createPDFAttachment(attachment, sizeStyle, attachmentSize);
    }

    cardClass = 'pinboard-attachment';
    cardColor = 'white';
  } else {
    contentHtml = createTextContent(entry.content);
  }

  const colorClass = cardClass === 'pinboard-sticky' ? `color-${cardColor}` : '';
  const htmlContent = buildEntryCardHtml(
    entry,
    cardClass,
    colorClass,
    randomRotation,
    randomPushpin,
    priorityIcon,
    contentHtml,
    isDirectAttachment,
    canEdit,
  );

  // Safe: content is sanitized by setHTML from dom-utils
  setHTML(container, htmlContent);

  // Show actions on hover
  if (canEdit) {
    const card = container.querySelector(`.${cardClass}`);
    if (card) {
      card.addEventListener('mouseenter', () => {
        const actions = card.querySelector('.entry-actions');
        if (actions) (actions as HTMLElement).style.opacity = '1';
      });
      card.addEventListener('mouseleave', () => {
        const actions = card.querySelector('.entry-actions');
        if (actions) (actions as HTMLElement).style.opacity = '0';
      });
    }
  }

  return container;
}

/**
 * Get priority icon
 */
function getPriorityIcon(priority: string): string {
  const icons: Record<string, string> = {
    low: '<i class="fas fa-circle" style="color: #4caf50; font-size: 10px;"></i>',
    medium: '<i class="fas fa-circle" style="color: #2196f3; font-size: 10px;"></i>',
    high: '<i class="fas fa-exclamation-circle" style="color: #ff9800; font-size: 12px;"></i>',
    critical: '<i class="fas fa-exclamation-triangle" style="color: #f44336; font-size: 12px;"></i>',
  };
  // eslint-disable-next-line security/detect-object-injection -- priority kommt aus DB als enum ('low'|'medium'|'high'|'critical'), kein beliebiger User-Input
  return icons[priority] ?? icons.medium;
}

function createPaginationButton(text: string, page: number, className = 'btn-secondary'): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = `btn btn-sm ${className}`;

  // Check if text is HTML (contains tags) or plain text
  if (text.includes('<')) {
    // For icon HTML, create the element safely
    const icon = document.createElement('i');
    if (text.includes('fa-chevron-left')) {
      icon.className = 'fas fa-chevron-left';
    } else if (text.includes('fa-chevron-right')) {
      icon.className = 'fas fa-chevron-right';
    }
    btn.appendChild(icon);
  } else {
    // Plain text is safe to use
    btn.textContent = text;
  }

  btn.dataset.action = 'change-page';
  btn.dataset.page = page.toString();
  return btn;
}

function shouldShowPageButton(pageNum: number, currentPage: number, totalPages: number): boolean {
  return pageNum === 1 || pageNum === totalPages || (pageNum >= currentPage - 2 && pageNum <= currentPage + 2);
}

function shouldShowEllipsis(pageNum: number, currentPage: number): boolean {
  return pageNum === currentPage - 3 || pageNum === currentPage + 3;
}

function appendPaginationElements(container: Element, pagination: PaginationInfo): void {
  // Previous button
  if (currentPage > 1) {
    const prevBtn = createPaginationButton('<i class="fas fa-chevron-left"></i>', currentPage - 1);
    container.append(prevBtn);
  }

  // Page numbers
  for (let i = 1; i <= pagination.totalPages; i++) {
    if (shouldShowPageButton(i, currentPage, pagination.totalPages)) {
      const className = i === currentPage ? 'btn-primary' : 'btn-secondary';
      const pageBtn = createPaginationButton(i.toString(), i, className);
      container.append(pageBtn);
    } else if (shouldShowEllipsis(i, currentPage)) {
      const dots = document.createElement('span');
      dots.textContent = '...';
      dots.className = 'pagination-dots';
      container.append(dots);
    }
  }

  // Next button
  if (currentPage < pagination.totalPages) {
    const nextBtn = createPaginationButton('<i class="fas fa-chevron-right"></i>', currentPage + 1);
    container.append(nextBtn);
  }
}

/**
 * Update pagination UI
 */
function updatePagination(pagination: PaginationInfo): void {
  const paginationContainer = document.querySelector('#pagination');
  if (!paginationContainer) return;

  paginationContainer.innerHTML = '';

  if (pagination.totalPages <= 1) return;

  appendPaginationElements(paginationContainer, pagination);
}

/**
 * Change page
 */
function changePage(page: number): void {
  currentPage = page;
  setEntriesLoadingEnabled(true);
  void loadEntries();
} /**
 * Open entry form for creating/editing
 */
function openEntryForm(entryId?: number): void {
  console.log('[Blackboard] openEntryForm called with entryId:', entryId);
  const modal = document.querySelector('.entry-form-modal');
  console.log('[Blackboard] Found .entry-form-modal:', modal);
  if (!modal) {
    console.log('[Blackboard] Modal with class .entry-form-modal not found, trying #entryFormModal');
    const modalById = $$id('entryFormModal');
    console.log('[Blackboard] Found #entryFormModal:', modalById);
    if (!modalById) return;
  }

  // Reset form
  const form = $$('#entryForm') as HTMLFormElement | null;
  if (form) form.reset();

  // Reset color selection
  document.querySelectorAll('.color-option').forEach((option) => {
    option.classList.remove('active');
  });
  document.querySelector('.color-option[data-color="yellow"]')?.classList.add('active');

  // Reset file selection
  selectedFiles = [];
  updateAttachmentPreview();
  const fileInput = $$('#attachmentInput') as HTMLInputElement | null;
  if (fileInput) {
    fileInput.value = '';
  }

  if (entryId !== undefined && entryId !== 0) {
    // Load entry data for editing
    void loadEntryForEdit(entryId);
  } else {
    // New entry - reset org dropdown
    updateOrgIdDropdown('all');
    const entryOrgLevel = $$id('entryOrgLevel') as HTMLSelectElement | null;
    if (entryOrgLevel) {
      entryOrgLevel.value = 'company';
      updateOrgIdDropdown('company');
    }
  }

  // Show modal using the wrapper function
  openModal('entryFormModal');
}

// Helper: Hide organization container
function hideOrgContainer(container: HTMLElement): void {
  container.classList.add('u-hidden');
  // Remove inline style to ensure u-hidden class takes effect
  container.style.removeProperty('display');
}

// Helper: Show organization container
function showOrgContainer(container: HTMLElement, labelText: string): void {
  // First remove the u-hidden class (which has !important)
  container.classList.remove('u-hidden');
  // Then set display to ensure visibility
  container.style.display = 'block';

  const label = container.querySelector('label');
  if (label) label.textContent = labelText;
}

// Helper: Update dropdown options
function updateDropdownOptions(
  items: { id: number; name: string }[],
  select: HTMLSelectElement,
  dropdownOptions: HTMLElement | null,
  dropdownDisplay: HTMLElement | null,
): void {
  // Clear and populate select
  select.innerHTML = '';
  items.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.id.toString();
    option.textContent = item.name;
    select.append(option);
  });

  // Update custom dropdown if exists
  if (!dropdownOptions || !dropdownDisplay) return;

  dropdownOptions.innerHTML = '';
  items.forEach((item) => {
    const optionDiv = document.createElement('div');
    optionDiv.className = 'dropdown-option';
    optionDiv.textContent = item.name;
    optionDiv.dataset.value = item.id.toString();
    dropdownOptions.append(optionDiv);
  });

  const span = dropdownDisplay.querySelector('span');
  if (span) {
    span.textContent = items.length > 0 ? items[0].name : 'Bitte wählen';
  }

  if (items.length > 0) {
    const hiddenInput = $$id('orgIdValue') as HTMLInputElement | null;
    if (hiddenInput) {
      hiddenInput.value = items[0].id.toString();
    }
  }
}

/**
 * Update organization ID dropdown based on level
 */
function updateOrgIdDropdown(level: string): void {
  const orgIdContainer = $$id('orgIdContainer');
  const orgIdSelect = $$id('entryOrgId') as HTMLSelectElement | null;

  if (!orgIdContainer || !orgIdSelect) return;

  orgIdSelect.innerHTML = ''; // Safe: clearing select options

  const dropdownOptions = $$id('orgIdDropdown');
  const dropdownDisplay = $$id('orgIdDisplay');

  if (level === 'all' || level === 'company') {
    hideOrgContainer(orgIdContainer);
  } else if (level === 'department') {
    showOrgContainer(orgIdContainer, 'Abteilung');
    updateDropdownOptions(departments, orgIdSelect, dropdownOptions, dropdownDisplay);
  } else if (level === 'team') {
    showOrgContainer(orgIdContainer, 'Team');
    updateDropdownOptions(teams, orgIdSelect, dropdownOptions, dropdownDisplay);
  }
}

/**
 * Helper to get organization ID from form data
 */
function getOrgIdValue(orgLevel: string, formData: FormData): number | null {
  if (orgLevel === 'all' || orgLevel === 'company') {
    return null;
  }

  // Try hidden input first (custom dropdown)
  const hiddenInput = $$id('orgIdValue') as HTMLInputElement | null;
  if (hiddenInput !== null && hiddenInput.value !== '' && hiddenInput.value.length > 0) {
    return Number.parseInt(hiddenInput.value, 10);
  }

  // Fallback to regular select
  const selectValue = formData.get('org_id');
  if (typeof selectValue === 'string' && selectValue.length > 0) {
    return Number.parseInt(selectValue, 10);
  }

  return null;
}

/**
 * Save entry
 */
async function saveEntry(): Promise<void> {
  const form = $$id('entryForm') as HTMLFormElement | null;
  if (!form) return;

  const formData = new FormData(form);

  // Get selected color
  const selectedColor = document.querySelector<HTMLElement>('.color-option.active');
  const color = selectedColor?.dataset.color ?? '#f8f9fa';

  // Map org_level value: 'all' -> 'company' for v2 API
  const orgLevel = formData.get('org_level') as string;
  const mappedOrgLevel = orgLevel === 'all' ? 'company' : orgLevel;

  // Get org_id from hidden input or select
  const orgIdValue = getOrgIdValue(orgLevel, formData);

  const entryData = {
    title: formData.get('title') as string,
    content: formData.get('content') as string,
    priority: formData.get('priority_level') as string, // v2 API uses 'priority'
    orgLevel: mappedOrgLevel, // v2 API uses camelCase
    orgId: orgIdValue, // v2 API uses camelCase
    color,
  };

  try {
    const entryId = formData.get('entry_id') as string;
    const endpoint = entryId.length > 0 ? `/blackboard/entries/${entryId}` : '/blackboard/entries';
    const method = entryId.length > 0 ? 'PUT' : 'POST';

    const savedEntry = await apiClient.request<{ id: number }>(
      endpoint,
      {
        method,
        body: JSON.stringify(entryData),
      },
      { version: 'v2' },
    );

    // Upload attachments if any
    const hasFiles = selectedFiles.length > 0;

    // Clear selected files before await to avoid race condition
    selectedFiles = [];

    if (hasFiles && entryId.length === 0) {
      // Only upload attachments for new entries
      await uploadAttachments(savedEntry.id);
    }

    showSuccess(entryId.length > 0 ? 'Eintrag erfolgreich aktualisiert!' : 'Eintrag erfolgreich erstellt!');
    closeModal('entryFormModal');

    // Update preview after clearing
    updateAttachmentPreview();

    setEntriesLoadingEnabled(true);
    void loadEntries();
  } catch (error) {
    console.error('Error saving entry:', error);
    showError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
  }
}

/**
 * Load entry for editing
 */
async function loadEntryForEdit(entryId: number): Promise<void> {
  try {
    const endpoint = `/blackboard/entries/${entryId}`;
    const response = await apiClient.request<V2EntryDetailResponse>(endpoint, { method: 'GET' }, { version: 'v2' });

    // Map v2 API response (camelCase) to form fields (snake_case)
    const entry = {
      id: response.id,
      title: response.title,
      content: response.content,
      priority_level: response.priority ?? response.priority_level ?? 'medium',
      org_level: response.orgLevel === 'company' ? 'all' : (response.orgLevel ?? response.org_level ?? 'all'),
      org_id: response.orgId ?? response.org_id,
      color: response.color ?? '#f8f9fa',
    };

    // Fill form with entry data
    const form = $$id('entryForm') as HTMLFormElement | null;
    if (!form) return;

    (form.elements.namedItem('entry_id') as HTMLInputElement).value = entry.id.toString();
    (form.elements.namedItem('title') as HTMLInputElement).value = entry.title;
    (form.elements.namedItem('content') as HTMLTextAreaElement).value = entry.content;
    (form.elements.namedItem('priority_level') as HTMLSelectElement).value = entry.priority_level;
    (form.elements.namedItem('org_level') as HTMLSelectElement).value = entry.org_level;

    // Update org dropdown
    updateOrgIdDropdown(entry.org_level);
    if (entry.org_id !== undefined && entry.org_id !== 0) {
      (form.elements.namedItem('org_id') as HTMLSelectElement).value = entry.org_id.toString();
    }

    // Select color
    document.querySelectorAll('.color-option').forEach((option) => {
      option.classList.remove('active');
    });
    const colorOption = document.querySelector(`.color-option[data-color="${entry.color}"]`);
    if (colorOption) {
      colorOption.classList.add('active');
    }
  } catch (error) {
    console.error('Error loading entry:', error);
    showError('Ein Fehler ist aufgetreten');
  }
}

/**
 * Upload attachments for an entry
 */
async function uploadAttachments(entryId: number): Promise<void> {
  if (selectedFiles.length === 0) return;

  const formData = new FormData();
  selectedFiles.forEach((file) => {
    formData.append('attachments', file);
  });

  try {
    const endpoint = `/blackboard/entries/${entryId}/attachments`;
    await apiClient.request(
      endpoint,
      {
        method: 'POST',
        body: formData,
      },
      { version: 'v2', contentType: '' },
    );
  } catch (error) {
    console.error('Error uploading attachments:', error);
    showError('Fehler beim Hochladen der Anhänge');
  }
}

/**
 * Load attachments for an entry
 */
async function loadAttachments(entryId: number): Promise<BlackboardAttachment[]> {
  try {
    const endpoint = `/blackboard/entries/${entryId}/attachments`;
    return await apiClient.request<BlackboardAttachment[]>(endpoint, { method: 'GET' }, { version: 'v2' });
  } catch (error) {
    console.error('Error loading attachments:', error);
  }

  return [];
}

/**
 * Show delete confirmation modal
 */
function showDeleteConfirmation(entryId: number): void {
  // Create confirmation modal if it doesn't exist
  let confirmModal = document.querySelector('#deleteConfirmModal');
  if (!confirmModal) {
    confirmModal = document.createElement('div');
    confirmModal.id = 'deleteConfirmModal';
    confirmModal.className = 'modal';
    confirmModal.innerHTML = `
      <div class="modal-content" style="max-width: 400px;">
        <div class="modal-header">
          <h3 class="modal-title">Eintrag löschen</h3>
          <button class="modal-close" data-action="close-modal" data-modal-id="deleteConfirmModal">&times;</button>
        </div>
        <div class="modal-body">
          <p>Möchten Sie diesen Eintrag wirklich löschen?</p>
          <p class="text-muted">Diese Aktion kann nicht rückgängig gemacht werden.</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-action="close-modal" data-modal-id="deleteConfirmModal">Abbrechen</button>
          <button type="button" class="btn btn-danger" id="confirmDeleteBtn">
            <i class="fas fa-trash"></i> Löschen
          </button>
        </div>
      </div>
    `;
    document.body.append(confirmModal);
  }

  // Set up the confirm button
  const confirmBtn = $$id('confirmDeleteBtn') as HTMLButtonElement | null;
  if (confirmBtn) {
    confirmBtn.dataset.action = 'confirm-delete';
    confirmBtn.dataset.entryId = entryId.toString();
  }

  // Show the modal
  openModal('deleteConfirmModal');
}

/**
 * Delete entry
 */
function deleteEntry(entryId: number): void {
  showDeleteConfirmation(entryId);
}

/**
 * Perform the actual deletion
 */
async function performDelete(entryId: number): Promise<void> {
  try {
    const endpoint = `/blackboard/entries/${entryId}`;
    await apiClient.request(endpoint, { method: 'DELETE' }, { version: 'v2' });

    showSuccess('Eintrag erfolgreich gelöscht!');
    setEntriesLoadingEnabled(true);
    void loadEntries();
  } catch (error) {
    console.error('Error deleting entry:', error);
    showError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
  }
}

// Helper: Build entry detail header HTML
function buildEntryDetailHeader(entry: BlackboardEntry, priorityIcon: string): string {
  // API v2 uses authorFullName (camelCase), v1 uses author_full_name (snake_case)
  const authorName = escapeHtml(entry.authorFullName ?? entry.author_full_name ?? entry.author_name ?? 'Unknown');
  return `
    <div class="entry-detail-header">
      <h2>${priorityIcon} ${escapeHtml(entry.title)}</h2>
      <div class="entry-detail-meta">
        <span><i class="fas fa-user"></i> ${authorName}</span>
        <span><i class="fas fa-clock"></i> ${formatDate(entry.createdAt ?? entry.created_at)}</span>
      </div>
    </div>
  `;
}

// Helper: Build entry tags HTML
function buildEntryTags(tags: string[] | undefined): string {
  if (tags === undefined || tags.length === 0) return '';

  const tagBadges = tags
    .map((tag: string) => `<span class="badge badge-secondary">${escapeHtml(tag)}</span>`)
    .join(' ');

  return `<div class="entry-tags">${tagBadges}</div>`;
}

// Helper: Build footer buttons HTML
function buildFooterButtons(entryId: number, canEdit: boolean): string {
  const closeButton = '<button type="button" class="btn btn-secondary" data-action="close">Schließen</button>';

  if (!canEdit) return closeButton;

  return `
    ${closeButton}
    <button type="button" class="btn btn-primary" data-action="edit-entry-modal" data-entry-id="${entryId}">
      <i class="fas fa-edit"></i> Bearbeiten
    </button>
    <button type="button" class="btn btn-danger" data-action="delete-entry-modal" data-entry-id="${entryId}">
      <i class="fas fa-trash"></i> Löschen
    </button>
  `;
}

/**
 * View entry details
 */
async function viewEntry(entryId: number): Promise<void> {
  console.info(`[Blackboard] viewEntry called for entry ${entryId}`);

  try {
    const endpoint = `/blackboard/entries/${entryId}`;
    const entry = await apiClient.request<BlackboardEntry>(endpoint, { method: 'GET' }, { version: 'v2' });
    console.info(`[Blackboard] Entry ${entryId} loaded`);

    const attachments = await loadAttachments(entryId);
    console.info(`[Blackboard] Attachments loaded:`, attachments);

    const detailContent = $$('#entryDetailContent');
    if (detailContent !== null) {
      const priorityIcon = getPriorityIcon(entry.priority_level);
      const canEdit = isAdmin || entry.created_by === currentUserId;

      const contentHtml = `
        ${buildEntryDetailHeader(entry, priorityIcon)}
        <div class="entry-detail-content">
          ${escapeHtml(entry.content).replace(/\n/g, '<br>')}
        </div>
        ${buildEntryTags(entry.tags)}
        ${buildAttachmentsSection(attachments, entryId)}
      `;

      // Safe: content is sanitized by setHTML from dom-utils
      setHTML(detailContent, contentHtml);

      const footer = $$('#entryDetailFooter');
      if (footer !== null) {
        // Safe: content is sanitized by setHTML from dom-utils
        setHTML(footer, buildFooterButtons(entryId, canEdit));
      }
    }

    // Show modal
    const detailModal = document.querySelector('#entryDetailModal');
    if (detailModal === null) {
      console.error('[Blackboard] Entry detail modal not found!');
      return;
    }

    openModal('entryDetailModal');
    setupCloseButtons();
    setupAttachmentHandlers(entryId, attachments);
  } catch (error) {
    console.error('Error viewing entry:', error);
    showError('Fehler beim Laden des Eintrags');
  }
}

// Type declarations for Window interface
declare global {
  interface Window {
    openEntryForm: typeof openEntryForm;
    viewEntry: typeof viewEntry;
    editEntry: typeof openEntryForm;
    deleteEntry: typeof deleteEntry;
    confirmEntryRead?: (entryId: number) => void;
    viewConfirmationStatus?: (entryId: number) => void;
    handleFileDownload?: (attachmentId: number, filename: string) => void;
    previewAttachment: typeof previewAttachment;
    deleteAttachment?: (attachmentId: number) => void;
    changePage: typeof changePage;
    removeAttachment: typeof removeAttachment;
    clearDirectAttachment: typeof clearDirectAttachment;
    saveDirectAttachment: typeof saveDirectAttachment;
    DashboardUI?: {
      openModal: (modalId: string) => void;
      closeModal: (modalId: string) => void;
      showToast: (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
      formatDate: (dateString: string) => string;
    };
  }
}

// Export functions to window for backwards compatibility
if (typeof window !== 'undefined') {
  window.editEntry = openEntryForm;
  window.deleteEntry = deleteEntry;
  window.changePage = changePage;
  window.viewEntry = viewEntry;
  window.openEntryForm = openEntryForm;
  window.removeAttachment = removeAttachment;
  window.previewAttachment = previewAttachment;
  window.clearDirectAttachment = clearDirectAttachment;
  window.saveDirectAttachment = saveDirectAttachment;
}
