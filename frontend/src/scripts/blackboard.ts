/**
 * Blackboard System
 * Client-side TypeScript for the blackboard feature
 */

import type { User } from '../types/api.types';
import { ApiClient } from '../utils/api-client';
import { $$id, $$, setHTML } from '../utils/dom-utils';
import { showSuccess, showError } from './auth';
import { escapeHtml } from './common';
import { closeModal as dashboardCloseModal } from './dashboard-scripts';

// DOMPurify is handled internally by dom-utils.ts - never use it directly!

// Initialize API client
const apiClient = ApiClient.getInstance();

// Constants
const MIME_TYPE_PDF = 'application/pdf';
const FULLSCREEN_MODE_CLASS = 'fullscreen-mode';

// Display style constants
const DISPLAY_INLINE_FLEX = 'inline-flex';
const DISPLAY_NONE = 'none';

interface BlackboardEntry {
  id: number;
  title: string;
  content: string;
  priority_level: 'low' | 'medium' | 'high' | 'critical';
  org_level: 'all' | 'department' | 'team';
  org_id?: number;
  department_id?: number;
  team_id?: number;
  color: string;
  created_by: number;
  created_by_name?: string;
  author_name?: string;
  author_first_name?: string;
  author_last_name?: string;
  author_full_name?: string;
  created_at: string;
  updated_at: string;
  tags?: string[];
  attachment_count?: number;
  attachments?: BlackboardAttachment[];
}

interface BlackboardAttachment {
  id: number;
  entry_id: number;
  filename: string;
  original_name: string;
  file_size: number;
  mime_type: string;
  uploaded_by: number;
  uploaded_at: string;
  uploader_name?: string;
}

interface Department {
  id: number;
  name: string;
}

interface Team {
  id: number;
  name: string;
  department_id: number;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalEntries: number;
  entriesPerPage: number;
}

interface BlackboardResponse {
  entries: BlackboardEntry[];
  pagination?: PaginationInfo;
}

interface UserData extends User {
  departmentId?: number;
  department_id?: number;
  teamId?: number;
  team_id?: number;
}

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
let directAttachmentFile: File | null = null;

// Store event handlers globally to avoid duplicates
const directAttachHandlers: {
  dropZoneClick?: () => void;
  fileInputChange?: (e: Event) => void;
  dragOver?: (e: DragEvent) => void;
  dragLeave?: () => void;
  drop?: (e: DragEvent) => void;
} = {};

// Modal helper functions to handle different implementations
function openModal(modalId: string): void {
  console.log('[Blackboard] openModal called with modalId:', modalId);
  const modal = $$id(modalId);
  console.log('[Blackboard] Modal element found:', modal);
  if (!modal) {
    console.error('[Blackboard] Modal not found:', modalId);
    return;
  }

  console.log('[Blackboard] Modal classList:', modal.classList.toString());
  console.log('[Blackboard] window.showModal exists:', typeof window.showModal);

  // Check if it's the new modal style (class="modal")
  if (modal.classList.contains('modal') && typeof window.showModal === 'function') {
    console.log('[Blackboard] Using window.showModal');
    window.showModal(modalId);
  }
  // Check if it's the old modal style (class="modal-overlay")
  else if (modal.classList.contains('modal-overlay')) {
    // Use the original dashboard modal behavior
    modal.classList.remove('u-hidden'); // Remove u-hidden class first
    modal.style.display = 'flex'; // Add display flex for modal-overlay
    modal.style.opacity = '1';
    modal.style.visibility = 'visible';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  // Try DashboardUI if available
  else if (typeof window.DashboardUI?.openModal === 'function') {
    window.DashboardUI.openModal(modalId);
  }
  // Fallback implementation
  else {
    modal.classList.remove('u-hidden'); // Remove u-hidden for fallback too
    modal.style.display = 'flex';
    setTimeout(() => {
      modal.classList.add('active');
    }, 10);
  }
}

function closeModal(modalId: string): void {
  const modal = $$id(modalId);
  if (!modal) return;

  // Check if it's the new modal style (class="modal")
  if (modal.classList.contains('modal') && typeof window.hideModal === 'function') {
    window.hideModal(modalId);
  }
  // Check if it's the old modal style (class="modal-overlay")
  else if (modal.classList.contains('modal-overlay')) {
    // Use the original dashboard modal behavior
    modal.style.opacity = '0';
    modal.style.visibility = 'hidden';
    modal.classList.remove('active');
    modal.classList.add('u-hidden'); // Re-add u-hidden class
    document.body.style.overflow = '';
  }
  // Try DashboardUI if available
  else if (typeof window.DashboardUI?.closeModal === 'function') {
    window.DashboardUI.closeModal(modalId);
  }
  // Use imported function as fallback
  else {
    dashboardCloseModal(modalId);
  }
}

// Initialize when document is ready
// Globale Variable, um zu verhindern, dass Endlosanfragen gesendet werden
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

// Function to initialize blackboard
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
    console.info('[Blackboard] Setting newEntryBtn display:', isAdmin ? DISPLAY_INLINE_FLEX : DISPLAY_NONE);
    newEntryBtn.style.display = isAdmin ? DISPLAY_INLINE_FLEX : DISPLAY_NONE;
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

async function openPdfInNewTab(attachmentUrl: string): Promise<void> {
  try {
    const resp = await fetch(attachmentUrl, {
      credentials: 'same-origin',
    });
    const fileBlob = await resp.blob();
    const url = URL.createObjectURL(fileBlob);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    console.error('Error opening PDF in new tab:', error);
    showError('Fehler beim Öffnen der PDF');
  }
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
}

// Initialize when DOM is ready or immediately if already ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeBlackboard);
} else {
  // DOM is already ready, call the function directly
  initializeBlackboard();
}

/**
 * Setup close buttons for all modals
 */
function setupCloseButtons(): void {
  // Füge Event-Listener zu allen Elementen mit data-action="close" hinzu
  document.querySelectorAll<HTMLElement>('[data-action="close"]').forEach((button) => {
    button.addEventListener('click', function (this: HTMLElement) {
      // Finde das übergeordnete Modal (both modal-overlay and modal classes)
      const modal = this.closest('.modal-overlay, .modal');
      if (modal) {
        closeModal(modal.id);
      } else {
        console.error('No parent modal found for close button');
      }
    });
  });

  // Schließen beim Klicken außerhalb des Modal-Inhalts
  document.querySelectorAll<HTMLElement>('.modal-overlay, .modal').forEach((modal) => {
    modal.addEventListener('click', (event: MouseEvent) => {
      // Nur schließen, wenn der Klick auf den Modal-Hintergrund erfolgt (nicht auf den Inhalt)
      if (event.target === modal) {
        closeModal(modal.id);
      }
    });
  });
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

function setupCustomDropdown(): void {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    if (target.closest('#orgIdDisplay')) {
      const dropdown = $$id('orgIdDropdown');
      if (dropdown) {
        dropdown.classList.toggle('show');
      }
    }

    const dropdownOption = target.closest('#orgIdDropdown .dropdown-option');
    if (dropdownOption instanceof HTMLElement) {
      const value = dropdownOption.dataset.value ?? '';
      const text = dropdownOption.textContent;

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
  const allowedTypes = [MIME_TYPE_PDF, 'image/jpeg', 'image/jpg', 'image/png', 'image/gif'];

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

    const icon = file.type === MIME_TYPE_PDF ? 'fa-file-pdf pdf' : 'fa-file-image image';
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

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  // eslint-disable-next-line security/detect-object-injection -- i ist berechneter Index (0-2), basiert auf Math.log(), kein User-Input, 100% sicher
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
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

      // Map v2 API response (camelCase) to UI format (snake_case) if needed
      interface V2EntryResponse {
        id: number;
        title: string;
        content: string;
        priority?: string;
        priority_level?: string;
        orgLevel?: string;
        org_level?: string;
        orgId?: number;
        org_id?: number;
        createdBy?: number;
        created_by?: number;
        createdAt?: string;
        created_at?: string;
        updatedAt?: string;
        updated_at?: string;
        color?: string;
        [key: string]: unknown;
      }

      const mappedEntries = entries.map((entry) => {
        const v2Entry = entry as unknown as V2EntryResponse;

        return {
          ...entry,
          priority_level: (v2Entry.priority ?? v2Entry.priority_level ?? entry.priority_level) as
            | 'low'
            | 'medium'
            | 'high'
            | 'critical',
          org_level: (v2Entry.orgLevel === 'company'
            ? 'all'
            : (v2Entry.orgLevel ?? v2Entry.org_level ?? entry.org_level)) as 'all' | 'department' | 'team',
          org_id: v2Entry.orgId ?? v2Entry.org_id ?? entry.org_id,
          created_by: v2Entry.createdBy ?? v2Entry.created_by ?? entry.created_by,
          created_at: v2Entry.createdAt ?? v2Entry.created_at ?? entry.created_at,
          updated_at: v2Entry.updatedAt ?? v2Entry.updated_at ?? entry.updated_at,
        } as BlackboardEntry;
      });

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

// loadHeaderUserInfo function removed - now handled by unified navigation

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
}

/**
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
    } else if (attachment.mime_type === MIME_TYPE_PDF) {
      contentHtml = createPDFAttachment(attachment, sizeStyle, attachmentSize);
    }

    cardClass = 'pinboard-attachment';
    cardColor = 'white';
  } else {
    contentHtml = createTextContent(entry.content);
  }

  const authorName = escapeHtml(entry.author_full_name ?? entry.author_name ?? 'Unknown');
  const colorClass = cardClass === 'pinboard-sticky' ? `color-${cardColor}` : '';

  const htmlContent = `
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
          ${formatDate(entry.created_at)}
        </span>
      </div>

      ${createEntryActions(entry.id, canEdit)}
    </div>
  `;

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

/**
 * Update pagination UI
 */
function updatePagination(pagination: PaginationInfo): void {
  const paginationContainer = document.querySelector('#pagination');
  if (!paginationContainer) return;

  paginationContainer.innerHTML = '';

  if (pagination.totalPages <= 1) return;

  // Previous button
  if (currentPage > 1) {
    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn btn-sm btn-secondary';
    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevBtn.dataset.action = 'change-page';
    prevBtn.dataset.page = (currentPage - 1).toString();
    paginationContainer.append(prevBtn);
  }

  // Page numbers
  for (let i = 1; i <= pagination.totalPages; i++) {
    if (i === 1 || i === pagination.totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      const pageBtn = document.createElement('button');
      pageBtn.className = `btn btn-sm ${i === currentPage ? 'btn-primary' : 'btn-secondary'}`;
      pageBtn.textContent = i.toString();
      pageBtn.dataset.action = 'change-page';
      pageBtn.dataset.page = i.toString();
      paginationContainer.append(pageBtn);
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      const dots = document.createElement('span');
      dots.textContent = '...';
      dots.className = 'pagination-dots';
      paginationContainer.append(dots);
    }
  }

  // Next button
  if (currentPage < pagination.totalPages) {
    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn-sm btn-secondary';
    nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextBtn.dataset.action = 'change-page';
    nextBtn.dataset.page = (currentPage + 1).toString();
    paginationContainer.append(nextBtn);
  }
}

/**
 * Change page
 */
function changePage(page: number): void {
  currentPage = page;
  setEntriesLoadingEnabled(true);
  void loadEntries();
}

/**
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
    // V2 API returns camelCase fields
    interface V2EntryDetailResponse {
      id: number;
      title: string;
      content: string;
      priority?: string;
      priority_level?: string;
      orgLevel?: string;
      org_level?: string;
      orgId?: number;
      org_id?: number;
      color?: string;
      [key: string]: unknown;
    }

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

// Utility functions
// escapeHtml is imported from common.ts

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Helper: Build entry detail header HTML
function buildEntryDetailHeader(entry: BlackboardEntry, priorityIcon: string): string {
  const authorName = escapeHtml(entry.author_full_name ?? entry.author_name ?? 'Unknown');
  return `
    <div class="entry-detail-header">
      <h2>${priorityIcon} ${escapeHtml(entry.title)}</h2>
      <div class="entry-detail-meta">
        <span><i class="fas fa-user"></i> ${authorName}</span>
        <span><i class="fas fa-clock"></i> ${formatDate(entry.created_at)}</span>
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

// Helper: Build attachment item HTML
function buildAttachmentItem(att: BlackboardAttachment): string {
  const isPDF = att.mime_type === MIME_TYPE_PDF;
  const iconClass = isPDF ? 'fa-file-pdf' : 'fa-file-image';

  return `
    <div class="entry-attachment-item"
         data-attachment-id="${att.id}"
         data-mime-type="${att.mime_type}"
         data-filename="${escapeHtml(att.original_name)}"
         style="cursor: pointer;"
         title="Vorschau: ${escapeHtml(att.original_name)}"
         data-action="preview-attachment-link">
      <i class="fas ${iconClass}"></i>
      <span>${escapeHtml(att.original_name)}</span>
      <span class="attachment-size">(${formatFileSize(att.file_size)})</span>
    </div>
  `;
}

// Helper: Build attachments section HTML
function buildAttachmentsSection(attachments: BlackboardAttachment[], entryId: number): string {
  if (attachments.length === 0) return '';

  const attachmentItems = attachments.map((att) => buildAttachmentItem(att)).join('');

  return `
    <div class="entry-attachments">
      <h4 class="entry-attachments-title">
        <i class="fas fa-paperclip"></i> Anhänge (${attachments.length})
      </h4>
      <div class="entry-attachment-list" id="attachment-list-${entryId}">
        ${attachmentItems}
      </div>
    </div>
  `;
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

// Helper: Setup attachment click handlers
function setupAttachmentHandlers(entryId: number, attachments: BlackboardAttachment[]): void {
  if (attachments.length === 0) return;

  setTimeout(() => {
    const attachmentList = document.querySelector(`#attachment-list-${entryId}`);
    if (attachmentList === null) {
      console.error('[Blackboard] Attachment list not found!');
      return;
    }

    const attachmentItems = attachmentList.querySelectorAll('.entry-attachment-item');
    console.info(`[Blackboard] Found ${attachmentItems.length} attachment items`);

    attachmentItems.forEach((item) => {
      const htmlItem = item as HTMLElement;
      const attachmentId = Number.parseInt(htmlItem.dataset.attachmentId ?? '0', 10);

      htmlItem.dataset.action = 'preview-attachment-item';
      htmlItem.dataset.attachmentId = attachmentId.toString();
      htmlItem.style.cursor = 'pointer';
    });
  }, 100);
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

// Extend window interface for modal and attachment functions
// Type declarations moved to the bottom of the file

// Helper: Create or get preview modal
function getOrCreatePreviewModal(): HTMLElement {
  const existingModal = document.querySelector('#attachmentPreviewModal');
  if (existingModal !== null) return existingModal as HTMLElement;

  const previewModal = document.createElement('div');
  previewModal.id = 'attachmentPreviewModal';
  previewModal.className = 'modal-overlay';
  previewModal.innerHTML = `
    <div class="modal-container modal-lg">
      <div class="modal-header">
        <h2 id="previewTitle">Vorschau</h2>
        <button type="button" class="modal-close" data-action="close">&times;</button>
      </div>
      <div class="modal-body" id="previewContent" style="overflow: auto; max-height: calc(85vh - 150px); min-height: 400px; padding: 0;">
        <div class="text-center">
          <i class="fas fa-spinner fa-spin fa-3x"></i>
          <p>Lade Vorschau...</p>
        </div>
      </div>
      <div class="modal-footer">
        <a id="downloadLink" class="btn btn-primary" download>
          <i class="fas fa-download"></i> Herunterladen
        </a>
        <button type="button" class="btn btn-secondary" data-action="close">Schließen</button>
      </div>
    </div>
  `;
  document.body.append(previewModal);
  setupCloseButtons();
  return previewModal;
}

// Helper: Setup download link
function setupDownloadLink(attachmentId: number, fileName: string): void {
  const downloadLink = $$id('downloadLink') as HTMLAnchorElement | null;
  if (downloadLink === null) return;

  const useV2 = window.FEATURE_FLAGS?.USE_API_V2_BLACKBOARD ?? false;
  const endpoint = `/blackboard/attachments/${attachmentId}?download=true`;

  downloadLink.href = useV2 ? `/api/v2${endpoint}` : `/api${endpoint}`;
  downloadLink.setAttribute('download', fileName);
  downloadLink.dataset.action = 'download-attachment';
  downloadLink.dataset.attachmentId = attachmentId.toString();
  downloadLink.dataset.filename = fileName;
  downloadLink.dataset.endpoint = endpoint;
}

// Helper: Display image preview
async function displayImagePreview(
  endpoint: string,
  fileName: string,
  previewContent: HTMLElement,
  previewModal: HTMLElement,
): Promise<void> {
  const response = await fetch(`/api/v2${endpoint}`, { credentials: 'same-origin' });
  if (!response.ok) throw new Error('Failed to load image');

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);

  previewContent.innerHTML = '';
  const centerDiv = document.createElement('div');
  centerDiv.className = 'text-center';
  const img = document.createElement('img');
  img.src = blobUrl;
  img.alt = fileName;
  img.style.cssText = 'max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);';
  centerDiv.append(img);
  previewContent.append(centerDiv);

  // Clean up blob URL when modal is closed
  const closeButtons = previewModal.querySelectorAll('[data-action="close"]');
  closeButtons.forEach((btn) => {
    btn.addEventListener(
      'click',
      () => {
        URL.revokeObjectURL(blobUrl);
      },
      { once: true },
    );
  });
}

// Helper: Display PDF preview
async function displayPDFPreview(
  endpoint: string,
  attachmentUrl: string,
  previewContent: HTMLElement,
  previewModal: HTMLElement,
): Promise<void> {
  const response = await fetch(`/api/v2${endpoint}`, { credentials: 'same-origin' });
  if (!response.ok) throw new Error('Failed to load PDF');

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);

  setHTML(
    previewContent,
    `
      <div style="width: 100%; height: 100%; background: #525659; display: flex; align-items: center; justify-content: center; overflow: hidden;">
        <iframe src="${blobUrl}#zoom=100"
                style="width: calc(100% + 40px); height: 100%; border: none; display: block; margin-left: -20px;"
                allowfullscreen>
        </iframe>
      </div>
    `,
  );

  setTimeout(() => {
    const openButton = $$id('openPdfNewTab') as HTMLButtonElement | null;
    if (openButton !== null) {
      openButton.dataset.action = 'open-pdf-new-tab';
      openButton.dataset.attachmentUrl = attachmentUrl;
    }
  }, 100);

  const closeButtons = previewModal.querySelectorAll('[data-action="close"]');
  closeButtons.forEach((btn) => {
    btn.addEventListener(
      'click',
      () => {
        URL.revokeObjectURL(blobUrl);
      },
      { once: true },
    );
  });
}

// Helper: Display unsupported file preview
function displayUnsupportedPreview(fileName: string, previewContent: HTMLElement): void {
  previewContent.innerHTML = '';
  const unsupportedDiv = document.createElement('div');
  unsupportedDiv.className = 'text-center';
  unsupportedDiv.style.padding = '40px';

  const icon = document.createElement('i');
  icon.className = 'fas fa-file fa-5x';
  icon.style.cssText = 'color: var(--text-secondary); margin-bottom: 20px;';

  const p1 = document.createElement('p');
  p1.textContent = 'Vorschau für diesen Dateityp nicht verfügbar.';

  const p2 = document.createElement('p');
  p2.className = 'text-muted';
  p2.textContent = fileName;

  unsupportedDiv.append(icon, p1, p2);
  previewContent.append(unsupportedDiv);
}

/**
 * Preview attachment in modal
 */
async function previewAttachment(attachmentId: number, mimeType: string, fileName: string): Promise<void> {
  console.info(`[Blackboard] previewAttachment called:`, { attachmentId, mimeType, fileName });

  const previewModal = getOrCreatePreviewModal();

  // Show modal
  previewModal.style.display = 'flex';
  previewModal.classList.add('active');
  previewModal.style.opacity = '1';
  previewModal.style.visibility = 'visible';

  // Update title
  const titleElement = document.querySelector('#previewTitle');
  if (titleElement !== null) titleElement.textContent = `Vorschau: ${fileName}`;

  setupDownloadLink(attachmentId, fileName);

  const previewContent = document.querySelector<HTMLElement>('#previewContent');
  if (previewContent === null) return;

  try {
    const useV2 = window.FEATURE_FLAGS?.USE_API_V2_BLACKBOARD ?? false;
    const endpoint = `/blackboard/attachments/${attachmentId}`;
    const attachmentUrl = useV2 ? `/api/v2${endpoint}` : `/api${endpoint}`;

    if (mimeType.startsWith('image/')) {
      await displayImagePreview(endpoint, fileName, previewContent, previewModal);
    } else if (mimeType === MIME_TYPE_PDF) {
      await displayPDFPreview(endpoint, attachmentUrl, previewContent, previewModal);
    } else {
      displayUnsupportedPreview(fileName, previewContent);
    }
  } catch (error) {
    console.error('Error loading preview:', error);
    previewContent.innerHTML = `
      <div class="text-center" style="padding: 40px;">
        <i class="fas fa-exclamation-circle fa-3x" style="color: var(--danger-color); margin-bottom: 20px;"></i>
        <p>Fehler beim Laden der Vorschau.</p>
      </div>
    `;
  }
}

declare global {
  interface Window {
    // showModal and hideModal are declared in modal-manager.ts
    openEntryForm: typeof openEntryForm;
    viewEntry: typeof viewEntry;
    editEntry: typeof openEntryForm;
    deleteEntry: typeof deleteEntry;
    // TODO: Lesebestätigungen Feature nicht implementiert
    // confirmEntryRead: Würde Lesebestätigung für aktuellen User speichern
    // viewConfirmationStatus: Würde Modal mit Übersicht aller Bestätigungen öffnen
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

/**
 * Open direct attachment modal
 */
function openDirectAttachModal(): void {
  console.info('[DirectAttach] Opening modal');
  const modal = document.querySelector('#directAttachModal');
  if (!modal) return;

  // Reset form
  const form = $$id('directAttachForm') as HTMLFormElement | null;
  if (form) form.reset();

  // Reset file input and global file
  const fileInput = $$id('directAttachInput') as HTMLInputElement | null;
  if (fileInput) {
    console.info('[DirectAttach] Resetting file input');
    fileInput.value = '';
  }
  directAttachmentFile = null;

  // Hide preview
  const preview = document.querySelector('#directAttachPreview');
  if (preview) preview.classList.add('d-none');

  // Reset size selection
  document.querySelectorAll('.size-option').forEach((btn) => {
    btn.classList.remove('active');
  });
  const mediumButton = document.querySelector('.size-option[data-size="medium"]');
  if (mediumButton) {
    mediumButton.classList.add('active');
    console.info('[DirectAttach] Set medium size as active');
  }

  // Show modal first
  openModal('directAttachModal');

  // Setup file upload handlers after modal is shown
  setTimeout(() => {
    setupDirectAttachHandlers();
  }, 100);
}

/**
 * Setup direct attachment handlers
 */
function setupDirectAttachHandlers(): void {
  console.info('[DirectAttach] Setting up handlers');
  const dropZone = $$id('directAttachDropZone');
  const fileInput = $$id('directAttachInput') as HTMLInputElement | null;
  const saveBtn = $$id('saveDirectAttachBtn') as HTMLButtonElement | null;

  if (!dropZone || !fileInput) {
    console.error('[DirectAttach] Missing required elements');
    return;
  }

  // Remove old handlers if they exist
  if (directAttachHandlers.dropZoneClick) {
    dropZone.removeEventListener('click', directAttachHandlers.dropZoneClick);
  }
  if (directAttachHandlers.fileInputChange) {
    fileInput.removeEventListener('change', directAttachHandlers.fileInputChange);
  }
  if (directAttachHandlers.dragOver) {
    dropZone.removeEventListener('dragover', directAttachHandlers.dragOver);
  }
  if (directAttachHandlers.dragLeave) {
    dropZone.removeEventListener('dragleave', directAttachHandlers.dragLeave);
  }
  if (directAttachHandlers.drop) {
    dropZone.removeEventListener('drop', directAttachHandlers.drop);
  }

  // Create new handlers
  directAttachHandlers.dropZoneClick = () => {
    console.info('[DirectAttach] Drop zone clicked');
    fileInput.click();
  };

  directAttachHandlers.fileInputChange = (event: Event) => {
    const target = event.target as HTMLInputElement | null;
    console.info('[DirectAttach] File input changed:', target?.files?.length);
    if (target?.files?.[0]) {
      handleDirectAttachFile(target.files[0]);
    }
  };

  directAttachHandlers.dragOver = (event: DragEvent) => {
    event.preventDefault();
    dropZone.style.borderColor = 'rgba(0, 142, 255, 0.5)';
    dropZone.style.background = 'rgba(0, 142, 255, 0.05)';
  };

  directAttachHandlers.dragLeave = () => {
    dropZone.style.borderColor = 'rgba(255,255,255,0.3)';
    dropZone.style.background = 'transparent';
  };

  directAttachHandlers.drop = (event: DragEvent) => {
    event.preventDefault();
    dropZone.style.borderColor = 'rgba(255,255,255,0.3)';
    dropZone.style.background = 'transparent';

    if (event.dataTransfer?.files[0]) {
      console.info('[DirectAttach] File dropped:', event.dataTransfer.files[0].name);
      handleDirectAttachFile(event.dataTransfer.files[0]);
    }
  };

  // Add new listeners
  dropZone.addEventListener('click', directAttachHandlers.dropZoneClick);
  fileInput.addEventListener('change', directAttachHandlers.fileInputChange);
  dropZone.addEventListener('dragover', directAttachHandlers.dragOver);
  dropZone.addEventListener('dragleave', directAttachHandlers.dragLeave);
  dropZone.addEventListener('drop', directAttachHandlers.drop);

  // Size selection buttons - use event delegation
  document.querySelectorAll('.size-option').forEach((btn) => {
    btn.addEventListener('click', function (this: HTMLElement) {
      console.info('[DirectAttach] Size button clicked:', this.dataset.size);
      document.querySelectorAll('.size-option').forEach((b) => {
        b.classList.remove('active');
      });
      this.classList.add('active');
    });
  });

  // Save button handler
  if (saveBtn) {
    saveBtn.dataset.action = 'save-direct-attachment';
  }
}

/**
 * Handle direct attachment file selection
 */
function handleDirectAttachFile(file: File): void {
  console.info('[DirectAttach] handleDirectAttachFile called with:', file.name, file.type, file.size);

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', MIME_TYPE_PDF];
  if (!allowedTypes.includes(file.type)) {
    showError('Nur JPG, PNG und PDF Dateien sind erlaubt');
    return;
  }

  // Validate file size (10MB)
  if (file.size > 10 * 1024 * 1024) {
    showError('Die Datei darf maximal 10 MB groß sein');
    return;
  }

  // Store the file globally
  directAttachmentFile = file;
  console.info('[DirectAttach] File stored globally');

  // Show preview
  const preview = document.querySelector('#directAttachPreview');
  const previewImage = document.querySelector('#previewImage');
  const fileName = document.querySelector('#previewFileName');
  const fileSize = document.querySelector('#previewFileSize');

  if (!preview || !previewImage || !fileName || !fileSize) return;

  preview.classList.remove('d-none');
  fileName.textContent = file.name;
  fileSize.textContent = formatFileSize(file.size);

  // Set title from filename if empty
  const titleInput = $$id('directAttachTitle') as HTMLInputElement | null;
  if (titleInput && titleInput.value.length === 0) {
    titleInput.value = file.name.replace(/\.[^./]+$/, ''); // Remove extension
  }

  // Show preview based on file type
  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = (e) => {
      // Create img element safely to prevent XSS
      previewImage.innerHTML = '';
      const img = document.createElement('img');
      img.src = e.target?.result as string;
      img.alt = file.name;
      img.style.cssText = 'max-width: 100%; max-height: 100%; object-fit: contain;';
      previewImage.append(img);
    };
    reader.readAsDataURL(file);
  } else if (file.type === MIME_TYPE_PDF) {
    previewImage.innerHTML = `<i class="fas fa-file-pdf" style="font-size: 64px; color: #dc3545;"></i>`;
  }
}

/**
 * Clear direct attachment
 */
function clearDirectAttachment(): void {
  console.info('[DirectAttach] Clearing attachment');
  const fileInput = $$id('directAttachInput') as HTMLInputElement | null;
  const preview = document.querySelector('#directAttachPreview');

  if (fileInput) fileInput.value = '';
  if (preview) preview.classList.add('d-none');

  // Clear global file
  directAttachmentFile = null;
}

/**
 * Save direct attachment
 */
async function saveDirectAttachment(): Promise<void> {
  console.info('[DirectAttach] saveDirectAttachment called');
  console.info('[DirectAttach] Global file:', directAttachmentFile?.name ?? 'none');

  const titleInput = $$id('directAttachTitle') as HTMLInputElement | null;
  const orgLevelSelect = $$id('directAttachOrgLevel') as HTMLSelectElement | null;
  const prioritySelect = $$id('directAttachPriority') as HTMLSelectElement | null;
  const sizeOption = document.querySelector<HTMLElement>('.size-option.active');

  console.info('[DirectAttach] Elements found:', {
    globalFile: directAttachmentFile?.name ?? 'none',
    titleInput: !!titleInput,
    orgLevelSelect: !!orgLevelSelect,
    prioritySelect: !!prioritySelect,
    sizeOption: sizeOption?.dataset.size ?? 'none',
  });

  if (!directAttachmentFile) {
    console.error('[DirectAttach] No file in global variable');
    showError('Bitte wählen Sie eine Datei aus');
    return;
  }

  const file = directAttachmentFile;
  const title = titleInput?.value ?? file.name.replace(/\.[^./]+$/, '');
  const size = sizeOption?.dataset.size ?? 'medium';

  // Create FormData
  const formData = new FormData();
  formData.append('title', title);
  formData.append('content', `[Attachment:${size}]`); // Special content format
  formData.append('org_level', orgLevelSelect?.value ?? 'company');
  formData.append('org_id', '1'); // TODO: Get actual org_id based on level
  formData.append('priority_level', prioritySelect?.value ?? 'normal');
  formData.append('color', 'white'); // White background for images
  formData.append('tags', 'attachment,image');
  formData.append('attachment', file);

  // Clear before async operation to avoid race condition
  directAttachmentFile = null;

  try {
    const token = localStorage.getItem('token');
    if (token === null || token.length === 0) {
      showError('Keine Authentifizierung gefunden');
      return;
    }

    const apiClient = ApiClient.getInstance();
    const useV2 = window.FEATURE_FLAGS?.USE_API_V2_BLACKBOARD ?? false;
    const endpoint = useV2 ? '/blackboard/entries' : '/blackboard';

    if (useV2) {
      try {
        await apiClient.request(
          endpoint,
          {
            method: 'POST',
            body: formData,
          },
          { version: 'v2', contentType: '' },
        );
      } catch (error) {
        throw new Error((error as { message?: string }).message ?? 'Fehler beim Speichern');
      }
    } else {
      const response = await fetch(`/api${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = (await response.json()) as { message?: string };
        throw new Error(error.message ?? 'Fehler beim Speichern');
      }
    }

    showSuccess('Datei erfolgreich angeheftet!');
    closeModal('directAttachModal');

    // Reset the form and file input for next use
    const form = $$id('directAttachForm') as HTMLFormElement | null;
    if (form) form.reset();

    const fileInput = $$id('directAttachInput') as HTMLInputElement | null;
    if (fileInput) fileInput.value = '';

    const preview = $$id('directAttachPreview');
    if (preview) preview.classList.add('d-none');

    // Reload entries
    setEntriesLoadingEnabled(true);
    void loadEntries();
  } catch (error) {
    console.error('Error saving direct attachment:', error);
    showError(error instanceof Error ? error.message : 'Fehler beim Speichern');
  }
}

// Global variables for zoom and fullscreen
let currentZoom = 100;
let fullscreenAutoRefreshInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Setup zoom controls for the blackboard
 */
function setupZoomControls(): void {
  const zoomInBtn = document.querySelector('#zoomInBtn');
  const zoomOutBtn = document.querySelector('#zoomOutBtn');
  const zoomLevelDisplay = document.querySelector('#zoomLevel');
  const blackboardContainer = document.querySelector<HTMLElement>('#blackboardContainer');

  if (!zoomInBtn || !zoomOutBtn || !zoomLevelDisplay || !blackboardContainer) {
    console.error('[Zoom] Required elements not found');
    return;
  }

  // Zoom in
  zoomInBtn.addEventListener('click', () => {
    if (currentZoom < 200) {
      currentZoom += 10;
      blackboardContainer.style.zoom = `${currentZoom}%`;
      zoomLevelDisplay.textContent = `${currentZoom}%`;
    }
  });

  // Zoom out
  zoomOutBtn.addEventListener('click', () => {
    if (currentZoom > 50) {
      currentZoom -= 10;
      blackboardContainer.style.zoom = `${currentZoom}%`;
      zoomLevelDisplay.textContent = `${currentZoom}%`;
    }
  });
}

/**
 * Setup fullscreen controls
 */
function setupFullscreenControls(): void {
  const fullscreenBtn = document.querySelector('#fullscreenBtn');
  const blackboardContainer = document.querySelector('#blackboardContainer');

  if (!fullscreenBtn || !blackboardContainer) {
    console.error('[Fullscreen] Required elements not found');
    return;
  }

  // Enter fullscreen
  fullscreenBtn.addEventListener('click', (_e) => {
    void (async () => {
      try {
        // Add fullscreen mode class to body
        document.body.classList.add(FULLSCREEN_MODE_CLASS);

        // Request fullscreen - check for browser compatibility
        const elem = document.documentElement as Document['documentElement'] & {
          webkitRequestFullscreen?: () => Promise<void>;
          msRequestFullscreen?: () => Promise<void>;
        };

        if ('requestFullscreen' in document.documentElement) {
          await document.documentElement.requestFullscreen();
        } else if (elem.webkitRequestFullscreen !== undefined) {
          await elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen !== undefined) {
          await elem.msRequestFullscreen();
        }

        // Start auto-refresh (every 60 minutes)
        startAutoRefresh();

        // Update button icon
        const icon = fullscreenBtn.querySelector('i');
        if (icon) {
          icon.classList.remove('fa-expand');
          icon.classList.add('fa-compress');
        }
      } catch (error) {
        console.error('[Fullscreen] Error entering fullscreen:', error);
        document.body.classList.remove(FULLSCREEN_MODE_CLASS);
      }
    })();
  });

  // Handle ESC key or browser exit fullscreen
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('mozfullscreenchange', handleFullscreenChange);
  document.addEventListener('MSFullscreenChange', handleFullscreenChange);

  // ESC key handler
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.body.classList.contains(FULLSCREEN_MODE_CLASS)) {
      exitFullscreen();
    }
  });
}

/**
 * Handle fullscreen state changes
 */
function handleFullscreenChange(): void {
  const isFullscreen = !!(
    document.fullscreenElement ??
    (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement ??
    (document as Document & { mozFullScreenElement?: Element }).mozFullScreenElement ??
    (document as Document & { msFullscreenElement?: Element }).msFullscreenElement
  );

  if (!isFullscreen) {
    // User exited fullscreen
    document.body.classList.remove(FULLSCREEN_MODE_CLASS);
    stopAutoRefresh();

    // Reset button icon
    const fullscreenBtn = document.querySelector('#fullscreenBtn');
    if (fullscreenBtn) {
      const icon = fullscreenBtn.querySelector('i');
      if (icon) {
        icon.classList.remove('fa-compress');
        icon.classList.add('fa-expand');
      }
    }
  }
}

/**
 * Exit fullscreen mode
 */
function exitFullscreen(): void {
  // Check for browser compatibility
  const doc = document as Document & {
    webkitExitFullscreen?: () => void;
    mozCancelFullScreen?: () => void;
    msExitFullscreen?: () => void;
  };

  if ('exitFullscreen' in document) {
    void document.exitFullscreen();
  } else if (doc.webkitExitFullscreen !== undefined) {
    doc.webkitExitFullscreen();
  } else if (doc.mozCancelFullScreen !== undefined) {
    doc.mozCancelFullScreen();
  } else if (doc.msExitFullscreen !== undefined) {
    doc.msExitFullscreen();
  }

  document.body.classList.remove(FULLSCREEN_MODE_CLASS);
  stopAutoRefresh();
}

/**
 * Start auto-refresh in fullscreen mode
 */
function startAutoRefresh(): void {
  // Initial load
  if (entriesLoadingEnabled) {
    void loadEntries();
  }

  // Set up interval for 60 minutes (3600000 ms)
  fullscreenAutoRefreshInterval = setInterval(() => {
    console.info('[AutoRefresh] Reloading entries...');
    if (entriesLoadingEnabled) {
      void loadEntries();
    }
  }, 3600000); // 60 minutes

  // Update indicator text
  const indicator = document.querySelector('.auto-refresh-indicator');
  if (indicator) {
    indicator.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Auto-Refresh: 60 Min';
  }
}

/**
 * Stop auto-refresh
 */
function stopAutoRefresh(): void {
  if (fullscreenAutoRefreshInterval) {
    clearInterval(fullscreenAutoRefreshInterval);
    fullscreenAutoRefreshInterval = null;
  }
}
