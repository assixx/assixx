/**
 * Blackboard System
 * Client-side TypeScript for the blackboard feature
 */

import type { User } from '../types/api.types';
import { ApiClient } from '../utils/api-client';

import { getAuthToken, showSuccess, showError } from './auth';
import { escapeHtml } from './common';
import { closeModal as dashboardCloseModal } from './dashboard-scripts';

/**
 * Escapes a string for safe use in JavaScript string literals
 * Handles backslashes, quotes, newlines, etc.
 */
function escapeJsString(str: string): string {
  return str
    .replace(/\\/g, '\\\\') // Escape backslashes first
    .replace(/'/g, "\\'") // Escape single quotes
    .replace(/"/g, '\\"') // Escape double quotes
    .replace(/\n/g, '\\n') // Escape newlines
    .replace(/\r/g, '\\r') // Escape carriage returns
    .replace(/\t/g, '\\t'); // Escape tabs
}

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
  pagination: PaginationInfo;
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
  const modal = document.getElementById(modalId);
  if (!modal) return;

  // Check if it's the new modal style (class="modal")
  if (modal.classList.contains('modal') && typeof window.showModal === 'function') {
    window.showModal(modalId);
  }
  // Check if it's the old modal style (class="modal-overlay")
  else if (modal.classList.contains('modal-overlay')) {
    // Use the original dashboard modal behavior
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
    modal.style.display = 'flex';
    setTimeout(() => {
      modal.classList.add('active');
    }, 10);
  }
}

function closeModal(modalId: string): void {
  const modal = document.getElementById(modalId);
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

// Function to initialize blackboard
function initializeBlackboard() {
  // Aktiviere das automatische Laden der Einträge
  entriesLoadingEnabled = true;

  // Alle Schließen-Buttons einrichten
  setupCloseButtons();

  // Note: previewAttachment will be available after this module loads completely

  // Debug: Log when this script loads
  console.info('[Blackboard] Script loaded at:', new Date().toISOString());

  // Check if user is logged in
  checkLoggedIn()
    .then(() => {
      // Header user info is now handled by unified navigation

      // Get user data from localStorage instead of fetching again
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser !== null && storedUser.length > 0) {
        try {
          const userData = JSON.parse(storedUser) as UserData;
          currentUserId = userData.id;
          isAdmin = userData.role === 'admin' || userData.role === 'root';

          console.info('[Blackboard] User data from localStorage:', userData);
          console.info('[Blackboard] isAdmin:', isAdmin);
          console.info('[Blackboard] User role:', userData.role);

          // Show/hide "New Entry" button based on permissions
          const newEntryBtn = document.querySelector('#newEntryBtn') as HTMLButtonElement | null;
          if (newEntryBtn) {
            console.info('[Blackboard] Setting newEntryBtn display:', isAdmin ? 'inline-flex' : 'none');
            newEntryBtn.style.display = isAdmin ? 'inline-flex' : 'none';
          } else {
            console.info('[Blackboard] newEntryBtn not found!');
          }

          // Load departments and teams for form dropdowns
          void loadDepartmentsAndTeams();
        } catch (error) {
          console.error('[Blackboard] Error parsing stored user data:', error);
          // Fallback: fetch user data if localStorage is corrupted
          fetchUserData()
            .then((userData: UserData) => {
              currentUserId = userData.id;
              isAdmin = userData.role === 'admin' || userData.role === 'root';

              console.info('[Blackboard] User data from API:', userData);
              console.info('[Blackboard] isAdmin after API call:', isAdmin);
              console.info('[Blackboard] User role from API:', userData.role);

              const newEntryBtn = document.querySelector('#newEntryBtn') as HTMLButtonElement | null;
              if (newEntryBtn) {
                console.info('[Blackboard] Setting newEntryBtn display after API:', isAdmin ? 'inline-flex' : 'none');
                newEntryBtn.style.display = isAdmin ? 'inline-flex' : 'none';
              } else {
                console.info('[Blackboard] newEntryBtn not found after API call!');
              }
              void loadDepartmentsAndTeams();
            })
            .catch((error_: unknown) => {
              console.error('[Blackboard] Error loading user data:', error_);
              showError('Fehler beim Laden der Benutzerdaten');
            });
        }
      } else {
        // No stored user data, fetch it
        fetchUserData()
          .then((userData: UserData) => {
            currentUserId = userData.id;
            isAdmin = userData.role === 'admin' || userData.role === 'root';

            console.info('[Blackboard] No localStorage - User data from API:', userData);
            console.info('[Blackboard] No localStorage - isAdmin:', isAdmin);
            console.info('[Blackboard] No localStorage - User role:', userData.role);

            const newEntryBtn = document.querySelector('#newEntryBtn') as HTMLButtonElement | null;
            if (newEntryBtn) {
              console.info(
                '[Blackboard] No localStorage - Setting newEntryBtn display:',
                isAdmin ? 'inline-flex' : 'none',
              );
              newEntryBtn.style.display = isAdmin ? 'inline-flex' : 'none';
            } else {
              console.info('[Blackboard] No localStorage - newEntryBtn not found!');
            }
            void loadDepartmentsAndTeams();
          })
          .catch((error: unknown) => {
            console.error('[Blackboard] Error loading user data:', error);
            showError('Fehler beim Laden der Benutzerdaten');
          });
      }

      // Always load entries on page load
      entriesLoadingEnabled = true;
      void loadEntries().then(() => {
        // Check if we have an entry parameter in the URL
        const urlParams = new URLSearchParams(window.location.search);
        const entryId = urlParams.get('entry');

        if (entryId !== null && entryId.length > 0) {
          // If we have an entry ID, scroll to the specific one
          const entryElement = document.querySelector(`[data-entry-id="${entryId}"]`);
          if (entryElement) {
            entryElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Add a highlight effect
            entryElement.classList.add('highlight-entry');
            setTimeout(() => {
              entryElement.classList.remove('highlight-entry');
            }, 3000);
          }
        }
      });

      // Hide the load entries button since entries are loaded automatically
      const loadEntriesBtn = document.querySelector('#loadEntriesBtn') as HTMLButtonElement | null;
      if (loadEntriesBtn) {
        loadEntriesBtn.style.display = 'none';
      }

      // Retry-Button Ereignisbehandlung
      const retryLoadBtn = document.querySelector('#retryLoadBtn') as HTMLButtonElement | null;
      if (retryLoadBtn) {
        retryLoadBtn.addEventListener('click', () => {
          entriesLoadingEnabled = true; // Erlaube das Laden nur nach Klick
          void loadEntries();
        });
      }

      // Setup event listeners
      setupEventListeners();
    })
    .catch((error: unknown) => {
      console.error('Error checking login:', error);
      window.location.href = '/login';
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
function setupEventListeners(): void {
  // Filter by level using pill buttons
  document.querySelectorAll<HTMLElement>('.filter-pill[data-value]').forEach((button) => {
    button.addEventListener('click', function (this: HTMLElement) {
      // Remove active class from all pills
      document.querySelectorAll('.filter-pill').forEach((pill) => {
        pill.classList.remove('active');
      });
      // Add active class to clicked pill
      this.classList.add('active');

      currentFilter = this.dataset.value ?? 'all';
      currentPage = 1;

      // Nur laden, wenn es aktiviert wurde
      if (entriesLoadingEnabled) {
        void loadEntries();
      }
    });
  });

  // Sort entries
  const sortFilter = document.querySelector('#sortFilter') as HTMLSelectElement | null;
  if (sortFilter) {
    sortFilter.addEventListener('change', function (this: HTMLSelectElement) {
      currentSort = this.value;

      // Nur laden, wenn es aktiviert wurde
      if (entriesLoadingEnabled) {
        void loadEntries();
      }
    });
  } else {
    console.error('Sort filter not found');
  }

  // Search button
  const searchButton = document.querySelector('#searchButton') as HTMLButtonElement | null;
  const searchInput = document.querySelector('#searchInput') as HTMLInputElement | null;

  if (searchButton && searchInput) {
    searchButton.addEventListener('click', () => {
      currentSearch = searchInput.value.trim();
      currentPage = 1;

      // Nur laden, wenn es aktiviert wurde
      if (entriesLoadingEnabled) {
        void loadEntries();
      }
    });

    searchInput.addEventListener('keypress', function (this: HTMLInputElement, e: KeyboardEvent) {
      if (e.key === 'Enter') {
        currentSearch = this.value.trim();
        currentPage = 1;

        // Nur laden, wenn es aktiviert wurde
        if (entriesLoadingEnabled) {
          void loadEntries();
        }
      }
    });
  } else {
    console.error('Search elements not found');
  }

  // New entry button
  const newEntryBtn = document.querySelector('#newEntryBtn') as HTMLButtonElement | null;
  if (newEntryBtn) {
    newEntryBtn.addEventListener('click', () => {
      openEntryForm();
    });
  } else {
    console.error('New entry button not found');
  }

  // Direct attachment button
  const directAttachBtn = document.querySelector('#directAttachBtn') as HTMLButtonElement | null;
  if (directAttachBtn) {
    directAttachBtn.addEventListener('click', () => {
      openDirectAttachModal();
    });
  } else {
    console.error('Direct attachment button not found');
  }

  // Save entry button
  const saveEntryBtn = document.querySelector('#saveEntryBtn') as HTMLButtonElement | null;
  if (saveEntryBtn) {
    saveEntryBtn.addEventListener('click', () => {
      void saveEntry();
    });
  } else {
    console.error('Save entry button not found');
  }

  // Organization level change
  const entryOrgLevel = document.querySelector('#entryOrgLevel') as HTMLSelectElement | null;
  if (entryOrgLevel) {
    entryOrgLevel.addEventListener('change', function (this: HTMLSelectElement) {
      updateOrgIdDropdown(this.value);
    });
  } else {
    console.error('Organization level dropdown not found');
  }

  // Color selection
  document.querySelectorAll<HTMLElement>('.color-option').forEach((button) => {
    button.addEventListener('click', function (this: HTMLElement) {
      // Remove active class from all color options
      document.querySelectorAll('.color-option').forEach((option) => {
        option.classList.remove('active');
      });
      // Add active class to clicked option
      this.classList.add('active');
    });
  });

  // File upload handling
  setupFileUploadHandlers();

  // Zoom controls
  setupZoomControls();

  // Fullscreen functionality
  setupFullscreenControls();
}

/**
 * Setup file upload handlers for attachments
 */
function setupFileUploadHandlers(): void {
  const dropZone = document.querySelector('#attachmentDropZone') as HTMLDivElement | null;
  const fileInput = document.querySelector('#attachmentInput') as HTMLInputElement | null;

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
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif'];

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
  const preview = document.querySelector('#attachmentPreview') as HTMLDivElement | null;
  const list = document.querySelector('#attachmentList') as HTMLDivElement | null;

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

    const icon = file.type === 'application/pdf' ? 'fa-file-pdf pdf' : 'fa-file-image image';
    const size = formatFileSize(file.size);

    item.innerHTML = `
      <div class="attachment-info">
        <i class="fas ${icon} attachment-icon"></i>
        <div class="attachment-details">
          <div class="attachment-name">${escapeHtml(file.name)}</div>
          <div class="attachment-size">${size}</div>
        </div>
      </div>
      <button type="button" class="attachment-remove" onclick="removeAttachment(${index})">
        <i class="fas fa-times"></i> Entfernen
      </button>
    `;

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
  const fileInput = document.querySelector('#attachmentInput') as HTMLInputElement | null;
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

  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Load blackboard entries
 */
async function loadEntries(): Promise<void> {
  // Wenn das Laden nicht aktiviert wurde (durch Klick auf den Button), dann abbrechen
  if (!entriesLoadingEnabled) {
    return;
  }

  try {
    // Verstecke die Lade-Button-Karte
    const loadEntriesCard = document.querySelector('#loadEntriesCard');
    if (loadEntriesCard) loadEntriesCard.classList.add('d-none');

    // Zeige den Ladeindikator
    const loadingIndicator = document.querySelector('#loadingIndicator');
    if (loadingIndicator) loadingIndicator.classList.remove('d-none');

    // Verstecke vorherige Ergebnisse oder Fehlermeldungen
    const blackboardEntries = document.querySelector('#blackboardEntries');
    if (blackboardEntries) blackboardEntries.classList.add('d-none');

    const noEntriesMessage = document.querySelector('#noEntriesMessage');
    if (noEntriesMessage) noEntriesMessage.classList.add('d-none');

    // Parse sort option
    const [sortBy, sortDir] = currentSort.split('|');

    // Get token from localStorage
    const token = getAuthToken();
    if (token === null || token.length === 0) {
      window.location.href = '/login';
      throw new Error('No token found');
    }

    // Use API client for v2 migration
    const apiClient = ApiClient.getInstance();
    // v2 API uses /blackboard/entries instead of /blackboard
    const useV2 = window.FEATURE_FLAGS?.USE_API_V2_BLACKBOARD ?? false;
    const endpoint = useV2
      ? `/blackboard/entries?page=${currentPage}&filter=${currentFilter}&search=${encodeURIComponent(currentSearch)}&sortBy=${sortBy}&sortDir=${sortDir}`
      : `/blackboard?page=${currentPage}&filter=${currentFilter}&search=${encodeURIComponent(currentSearch)}&sortBy=${sortBy}&sortDir=${sortDir}`;

    // Check feature flag
    let response: Response | { ok: boolean; status: number; json: () => Promise<unknown> };

    if (useV2) {
      try {
        const data = await apiClient.request(endpoint, { method: 'GET' }, { version: 'v2' });
        // Create a mock response for v2 to match v1 interface
        response = {
          ok: true,
          status: 200,
          json: async () => Promise.resolve(data),
        };
      } catch (error) {
        response = {
          ok: false,
          status: (error as { status?: number }).status ?? 500,
          json: async () => Promise.resolve(error),
        };
      }
    } else {
      response = await fetch(`/api${endpoint}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    }

    if (!response.ok) {
      if (response.status === 401) {
        // Redirect to login if unauthorized
        window.location.href = '/login';
        throw new Error('Unauthorized');
      }
      throw new Error('Failed to load entries');
    }

    const responseData = (await response.json()) as { data?: BlackboardResponse } & BlackboardResponse;
    const data: BlackboardResponse = responseData.data ?? responseData;

    // Update pagination
    updatePagination(data.pagination);

    // Display entries
    displayEntries(data.entries);

    // Erfolgreiche Anfrage - deaktiviere weitere automatische API-Aufrufe
    entriesLoadingEnabled = false;
  } catch (error) {
    console.error('Error loading entries:', error);
    showError('Fehler beim Laden der Einträge.');

    // Bei einem Fehler, zeige die "Keine Einträge" Nachricht mit Wiederholungs-Button
    const noEntriesMessage = document.querySelector('#noEntriesMessage');
    if (noEntriesMessage) {
      noEntriesMessage.classList.remove('d-none');
    }

    // Zeige die Lade-Button-Karte wieder an
    const loadEntriesCard = document.querySelector('#loadEntriesCard');
    if (loadEntriesCard) loadEntriesCard.classList.remove('d-none');
  } finally {
    // Verstecke den Ladeindikator
    const loadingIndicator = document.querySelector('#loadingIndicator');
    if (loadingIndicator) loadingIndicator.classList.add('d-none');
  }
}

/**
 * Check if user is logged in
 */
async function checkLoggedIn(): Promise<void> {
  const token = getAuthToken();
  if (token === null || token.length === 0) {
    throw new Error('No authentication token found');
  }

  // Use API client for v2 migration
  const apiClient = ApiClient.getInstance();
  const useV2 = window.FEATURE_FLAGS?.USE_API_V2_USERS ?? false;
  const endpoint = useV2 ? '/users/me' : '/user/profile';

  let response: Response | { ok: boolean };
  if (useV2) {
    try {
      await apiClient.request(endpoint, { method: 'GET' }, { version: 'v2' });
      response = { ok: true };
    } catch {
      response = { ok: false };
    }
  } else {
    response = await fetch(`/api${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  if (!response.ok) {
    throw new Error('Invalid token');
  }
}

/**
 * Fetch user data
 */
async function fetchUserData(): Promise<UserData> {
  const token = getAuthToken();
  if (token === null || token.length === 0) {
    throw new Error('No authentication token found');
  }

  const apiClient = ApiClient.getInstance();
  const useV2 = window.FEATURE_FLAGS?.USE_API_V2_USERS ?? false;
  const endpoint = useV2 ? '/users/me' : '/user/profile';

  if (useV2) {
    return await apiClient.request<UserData>(endpoint, { method: 'GET' }, { version: 'v2' });
  } else {
    const response = await fetch(`/api${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user data');
    }

    const result = (await response.json()) as { data?: UserData } & UserData;
    // API returns { success: true, data: {...} }, we need just the data
    return result.data ?? result;
  }
}

// loadHeaderUserInfo function removed - now handled by unified navigation

/**
 * Load departments and teams
 */
async function loadDepartmentsAndTeams(): Promise<void> {
  const token = getAuthToken();
  if (token === null || token.length === 0) return;

  try {
    const apiClient = ApiClient.getInstance();
    const useDeptV2 = window.FEATURE_FLAGS?.USE_API_V2_DEPARTMENTS ?? false;
    const useTeamV2 = window.FEATURE_FLAGS?.USE_API_V2_TEAMS ?? false;

    // Load departments
    if (useDeptV2) {
      try {
        departments = await apiClient.request<Department[]>('/departments', { method: 'GET' }, { version: 'v2' });
      } catch (error) {
        console.error('Error loading departments v2:', error);
      }
    } else {
      const deptResponse = await fetch('/api/departments', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (deptResponse.ok) {
        departments = (await deptResponse.json()) as Department[];
      }
    }

    // Load teams
    if (useTeamV2) {
      try {
        teams = await apiClient.request<Team[]>('/teams', { method: 'GET' }, { version: 'v2' });
      } catch (error) {
        console.error('Error loading teams v2:', error);
      }
    } else {
      const teamResponse = await fetch('/api/teams', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (teamResponse.ok) {
        teams = (await teamResponse.json()) as Team[];
      }
    }
  } catch (error) {
    console.error('Error loading departments and teams:', error);
  }
}

/**
 * Display blackboard entries
 */
function displayEntries(entries: BlackboardEntry[]): void {
  const container = document.querySelector('#blackboardEntries');
  if (!container) return;

  container.innerHTML = '';
  container.classList.remove('d-none');

  if (entries.length === 0) {
    const noEntriesMessage = document.querySelector('#noEntriesMessage');
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

/**
 * Create entry card element with pinboard style
 */
function createEntryCard(entry: BlackboardEntry): HTMLElement {
  const container = document.createElement('div');
  container.className = 'pinboard-item';

  // Randomly assign rotation class
  const rotations = ['rotate-1', 'rotate-2', 'rotate-3', 'rotate-n1', 'rotate-n2', 'rotate-n3'];
  const randomRotation = rotations[Math.floor(Math.random() * rotations.length)];

  // Randomly select pushpin style
  const pushpinStyles = ['pushpin-red', 'pushpin-blue', 'pushpin-yellow', 'pushpin-metal'];
  const randomPushpin = pushpinStyles[Math.floor(Math.random() * pushpinStyles.length)];

  // Determine card type based on priority or content
  let cardClass = 'pinboard-sticky';
  let cardColor = entry.color;

  // High priority items get info box style
  if (entry.priority_level === 'high' || entry.priority_level === 'critical') {
    cardClass = 'pinboard-info';
  }
  // Longer content gets note style
  else if (entry.content.length > 200) {
    cardClass = 'pinboard-note';
  }

  const canEdit = isAdmin || entry.created_by === currentUserId;
  const priorityIcon = getPriorityIcon(entry.priority_level);

  // Check if this is a direct attachment
  const isDirectAttachment = entry.content.startsWith('[Attachment:');
  let attachmentSize = 'medium';

  if (isDirectAttachment) {
    const sizeMatch = /\[Attachment:(small|medium|large)\]/.exec(entry.content);
    if (sizeMatch) {
      attachmentSize = sizeMatch[1];
    }
  }

  // Create different content based on whether it's a direct attachment
  let contentHtml = '';
  if (isDirectAttachment && entry.attachments && entry.attachments.length > 0) {
    const attachment = entry.attachments[0];
    const isImage = attachment.mime_type.startsWith('image/');
    const isPDF = attachment.mime_type === 'application/pdf';

    // Set size class
    let sizeStyle = '';
    if (attachmentSize === 'small') {
      sizeStyle = 'max-width: 200px; max-height: 200px;';
    } else if (attachmentSize === 'medium') {
      sizeStyle = 'max-width: 300px; max-height: 300px;';
    } else if (attachmentSize === 'large') {
      sizeStyle = 'max-width: 400px; max-height: 400px;';
    }

    if (isImage) {
      contentHtml = `
        <div class="pinboard-image" style="${sizeStyle} margin: 0 auto;">
          <img src="/api/blackboard/attachments/${attachment.id}/preview"
               alt="${escapeHtml(attachment.original_name)}"
               style="width: 100%; height: 100%; object-fit: contain; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"
               onclick="event.stopPropagation(); previewAttachment(${attachment.id}, '${escapeJsString(attachment.mime_type)}', '${escapeJsString(attachment.original_name)}')">
        </div>
      `;
    } else if (isPDF) {
      // SVG-Wrapper für PDF - verhindert Abschneiden
      const containerHeight = attachmentSize === 'small' ? 350 : attachmentSize === 'medium' ? 500 : 380;
      const scale = attachmentSize === 'small' ? 0.3 : attachmentSize === 'medium' ? 0.4 : 0.5;

      contentHtml = `
        <div class="pinboard-pdf-preview" style="${sizeStyle} height: ${containerHeight}px; position: relative; overflow: hidden; background: white; border-radius: 8px; border: 1px solid #ddd;">
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
               onclick="event.stopPropagation(); previewAttachment(${attachment.id}, '${escapeJsString(attachment.mime_type)}', '${escapeJsString(attachment.original_name)}')"
               title="Klicken für Vollansicht">
          </div>
        </div>
      `;
    }

    // Override card class for attachments
    cardClass = 'pinboard-attachment';
    cardColor = 'white';
  } else {
    // Regular text content
    contentHtml = `
      <div style="color: #333; font-size: 14px; line-height: 1.5; margin-bottom: 15px;">
        ${escapeHtml(entry.content).substring(0, 150).replace(/\n/g, '<br>')}${entry.content.length > 150 ? '...' : ''}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="${cardClass} ${cardClass === 'pinboard-sticky' ? `color-${cardColor}` : ''} ${randomRotation}" data-entry-id="${entry.id}" onclick="viewEntry(${entry.id})" style="cursor: pointer;">
      <div class="pushpin ${randomPushpin}"></div>

      <h4 style="margin: 0 0 10px 0; font-weight: 600; color:rgb(0, 0, 0);">
        ${priorityIcon} ${escapeHtml(entry.title)}
      </h4>

      ${contentHtml}

      ${
        !isDirectAttachment && entry.attachment_count !== undefined && entry.attachment_count > 0
          ? `
        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(0,0,0,0.1);">
          <i class="fas fa-paperclip" style="color: #666;"></i>
          <span style="color: #666; font-size: 12px;">${entry.attachment_count} Anhang${entry.attachment_count > 1 ? 'änge' : ''}</span>
        </div>
      `
          : ''
      }

      <div style="font-size: 12px; color: #000; display: flex; justify-content: space-between; align-items: center;">
        <span>
          <i class="fas fa-user" style="opacity: 0%.6;"></i> ${escapeHtml(entry.author_full_name ?? entry.author_name ?? 'Unknown')}
        </span>
        <span>
          ${formatDate(entry.created_at)}
        </span>
      </div>

      ${
        canEdit
          ? `
        <div class="entry-actions" style="position: absolute; top: 10px; right: 10px; opacity: 0%; /* transition: opacity 0.2s; */">
          <button class="btn btn-sm btn-link p-1" onclick="event.stopPropagation(); editEntry(${entry.id})" title="Bearbeiten">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-link p-1 text-danger" onclick="event.stopPropagation(); deleteEntry(${entry.id})" title="Löschen">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `
          : ''
      }
    </div>
  `;

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
    prevBtn.onclick = () => {
      changePage(currentPage - 1);
    };
    paginationContainer.append(prevBtn);
  }

  // Page numbers
  for (let i = 1; i <= pagination.totalPages; i++) {
    if (i === 1 || i === pagination.totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      const pageBtn = document.createElement('button');
      pageBtn.className = `btn btn-sm ${i === currentPage ? 'btn-primary' : 'btn-secondary'}`;
      pageBtn.textContent = i.toString();
      pageBtn.onclick = () => {
        changePage(i);
      };
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
    nextBtn.onclick = () => {
      changePage(currentPage + 1);
    };
    paginationContainer.append(nextBtn);
  }
}

/**
 * Change page
 */
function changePage(page: number): void {
  currentPage = page;
  entriesLoadingEnabled = true;
  void loadEntries();
}

/**
 * Open entry form for creating/editing
 */
function openEntryForm(entryId?: number): void {
  const modal = document.querySelector('#entryFormModal');
  if (!modal) return;

  // Reset form
  const form = document.querySelector('#entryForm') as HTMLFormElement | null;
  if (form) form.reset();

  // Reset color selection
  document.querySelectorAll('.color-option').forEach((option) => {
    option.classList.remove('active');
  });
  document.querySelector('.color-option[data-color="yellow"]')?.classList.add('active');

  // Reset file selection
  selectedFiles = [];
  updateAttachmentPreview();
  const fileInput = document.querySelector('#attachmentInput') as HTMLInputElement | null;
  if (fileInput) {
    fileInput.value = '';
  }

  if (entryId !== undefined && entryId !== 0) {
    // Load entry data for editing
    void loadEntryForEdit(entryId);
  } else {
    // New entry - reset org dropdown
    updateOrgIdDropdown('all');
    const entryOrgLevel = document.querySelector('#entryOrgLevel') as HTMLSelectElement | null;
    if (entryOrgLevel) {
      entryOrgLevel.value = 'company';
      updateOrgIdDropdown('company');
    }
  }

  // Show modal using the wrapper function
  openModal('entryFormModal');
}

/**
 * Update organization ID dropdown based on level
 */
function updateOrgIdDropdown(level: string): void {
  const orgIdContainer = document.querySelector('#orgIdContainer');
  const orgIdSelect = document.querySelector('#entryOrgId') as HTMLSelectElement | null;

  if (!orgIdContainer || !orgIdSelect) return;

  orgIdSelect.innerHTML = '';

  if (level === 'all') {
    orgIdContainer.style.display = 'none';
  } else if (level === 'department') {
    orgIdContainer.style.display = 'block';
    const label = orgIdContainer.querySelector('label');
    if (label) label.textContent = 'Abteilung';

    departments.forEach((dept) => {
      const option = document.createElement('option');
      option.value = dept.id.toString();
      option.textContent = dept.name;
      orgIdSelect.append(option);
    });
  } else if (level === 'team') {
    orgIdContainer.style.display = 'block';
    const label = orgIdContainer.querySelector('label');
    if (label) label.textContent = 'Team';

    teams.forEach((team) => {
      const option = document.createElement('option');
      option.value = team.id.toString();
      option.textContent = team.name;
      orgIdSelect.append(option);
    });
  }
}

/**
 * Save entry
 */
async function saveEntry(): Promise<void> {
  const form = document.querySelector('#entryForm') as HTMLFormElement | null;
  if (!form) return;

  const formData = new FormData(form);
  const token = getAuthToken();
  if (token === null || token.length === 0) return;

  // Get selected color
  const selectedColor = document.querySelector<HTMLElement>('.color-option.active');
  const color = selectedColor?.dataset.color ?? '#f8f9fa';

  const entryData = {
    title: formData.get('title') as string,
    content: formData.get('content') as string,
    priority_level: formData.get('priority_level') as string,
    org_level: formData.get('org_level') as string,
    org_id: formData.get('org_level') === 'all' ? null : Number.parseInt(formData.get('org_id') as string, 10),
    color,
  };

  try {
    const apiClient = ApiClient.getInstance();
    const useV2 = window.FEATURE_FLAGS?.USE_API_V2_BLACKBOARD ?? false;
    const entryId = formData.get('entry_id') as string;
    const endpoint = useV2
      ? entryId.length > 0
        ? `/blackboard/entries/${entryId}`
        : '/blackboard/entries'
      : entryId.length > 0
        ? `/blackboard/${entryId}`
        : '/blackboard';
    const method = entryId.length > 0 ? 'PUT' : 'POST';

    let response: { ok: boolean; json: () => Promise<unknown> };
    if (useV2) {
      try {
        const data = await apiClient.request(
          endpoint,
          {
            method,
            body: JSON.stringify(entryData),
          },
          { version: 'v2' },
        );
        response = { ok: true, json: async () => Promise.resolve(data) };
      } catch (error) {
        response = { ok: false, json: async () => Promise.resolve(error) };
      }
    } else {
      const url = entryId.length > 0 ? `/api/blackboard/${entryId}` : '/api/blackboard';
      response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(entryData),
      });
    }

    if (response.ok) {
      const savedEntry = (await response.json()) as { id: number };

      // Upload attachments if any
      if (selectedFiles.length > 0 && entryId.length === 0) {
        // Only upload attachments for new entries
        await uploadAttachments(savedEntry.id);
      }

      showSuccess(entryId.length > 0 ? 'Eintrag erfolgreich aktualisiert!' : 'Eintrag erfolgreich erstellt!');
      closeModal('entryFormModal');

      // Clear selected files
      selectedFiles = [];
      updateAttachmentPreview();

      entriesLoadingEnabled = true;
      void loadEntries();
    } else {
      const error = (await response.json()) as { message?: string };
      showError(error.message ?? 'Fehler beim Speichern des Eintrags');
    }
  } catch (error) {
    console.error('Error saving entry:', error);
    showError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
  }
}

/**
 * Load entry for editing
 */
async function loadEntryForEdit(entryId: number): Promise<void> {
  const token = getAuthToken();
  if (token === null || token.length === 0) return;

  try {
    const apiClient = ApiClient.getInstance();
    const useV2 = window.FEATURE_FLAGS?.USE_API_V2_BLACKBOARD ?? false;
    const endpoint = useV2 ? `/blackboard/entries/${entryId}` : `/blackboard/${entryId}`;

    let entry: BlackboardEntry;
    if (useV2) {
      entry = await apiClient.request<BlackboardEntry>(endpoint, { method: 'GET' }, { version: 'v2' });
    } else {
      const response = await fetch(`/api${endpoint}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        showError('Fehler beim Laden des Eintrags');
        return;
      }
      entry = (await response.json()) as BlackboardEntry;
    }

    // Fill form with entry data
    const form = document.querySelector('#entryForm') as HTMLFormElement | null;
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

  const token = getAuthToken();
  if (token === null || token.length === 0) return;

  const formData = new FormData();
  selectedFiles.forEach((file) => {
    formData.append('attachments', file);
  });

  try {
    const apiClient = ApiClient.getInstance();
    const useV2 = window.FEATURE_FLAGS?.USE_API_V2_BLACKBOARD ?? false;
    const endpoint = useV2 ? `/blackboard/entries/${entryId}/attachments` : `/blackboard/${entryId}/attachments`;

    let response: { ok: boolean; json: () => Promise<unknown> };
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
        response = { ok: true, json: async () => Promise.resolve({}) };
      } catch (error) {
        response = { ok: false, json: async () => Promise.resolve(error) };
      }
    } else {
      response = await fetch(`/api${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
    }

    if (!response.ok) {
      const error = (await response.json()) as { message?: string };
      showError(error.message ?? 'Fehler beim Hochladen der Anhänge');
    }
  } catch (error) {
    console.error('Error uploading attachments:', error);
    showError('Fehler beim Hochladen der Anhänge');
  }
}

/**
 * Load attachments for an entry
 */
async function loadAttachments(entryId: number): Promise<BlackboardAttachment[]> {
  const token = getAuthToken();
  if (token === null || token === '') {
    return [];
  }

  try {
    const apiClient = ApiClient.getInstance();
    const useV2 = window.FEATURE_FLAGS?.USE_API_V2_BLACKBOARD ?? false;
    const endpoint = useV2 ? `/blackboard/entries/${entryId}/attachments` : `/blackboard/${entryId}/attachments`;

    if (useV2) {
      return await apiClient.request<BlackboardAttachment[]>(endpoint, { method: 'GET' }, { version: 'v2' });
    } else {
      const response = await fetch(`/api${endpoint}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        return (await response.json()) as BlackboardAttachment[];
      }
    }
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
          <button class="modal-close" onclick="closeModal('deleteConfirmModal')">&times;</button>
        </div>
        <div class="modal-body">
          <p>Möchten Sie diesen Eintrag wirklich löschen?</p>
          <p class="text-muted">Diese Aktion kann nicht rückgängig gemacht werden.</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="closeModal('deleteConfirmModal')">Abbrechen</button>
          <button type="button" class="btn btn-danger" id="confirmDeleteBtn">
            <i class="fas fa-trash"></i> Löschen
          </button>
        </div>
      </div>
    `;
    document.body.append(confirmModal);
  }

  // Set up the confirm button
  const confirmBtn = document.querySelector('#confirmDeleteBtn');
  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      closeModal('deleteConfirmModal');
      await performDelete(entryId);
    };
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
  const token = getAuthToken();
  if (token === null || token.length === 0) return;

  try {
    const apiClient = ApiClient.getInstance();
    const useV2 = window.FEATURE_FLAGS?.USE_API_V2_BLACKBOARD ?? false;
    const endpoint = useV2 ? `/blackboard/entries/${entryId}` : `/blackboard/${entryId}`;

    let response: { ok: boolean; json: () => Promise<unknown> };
    if (useV2) {
      try {
        await apiClient.request(endpoint, { method: 'DELETE' }, { version: 'v2' });
        response = { ok: true, json: async () => Promise.resolve({}) };
      } catch (error) {
        response = { ok: false, json: async () => Promise.resolve(error) };
      }
    } else {
      response = await fetch(`/api${endpoint}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    }

    if (response.ok) {
      showSuccess('Eintrag erfolgreich gelöscht!');
      entriesLoadingEnabled = true;
      void loadEntries();
    } else {
      const error = (await response.json()) as { message?: string };
      showError(error.message ?? 'Fehler beim Löschen des Eintrags');
    }
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

/**
 * View entry details
 */
async function viewEntry(entryId: number): Promise<void> {
  console.info(`[Blackboard] viewEntry called for entry ${entryId}`);
  const token = getAuthToken();
  if (token === null || token.length === 0) return;

  try {
    console.info(`[Blackboard] Fetching entry ${entryId}...`);
    const apiClient = ApiClient.getInstance();
    const useV2 = window.FEATURE_FLAGS?.USE_API_V2_BLACKBOARD ?? false;
    const endpoint = useV2 ? `/blackboard/entries/${entryId}` : `/blackboard/${entryId}`;

    let entry: BlackboardEntry;
    if (useV2) {
      try {
        entry = await apiClient.request(endpoint, { method: 'GET' }, { version: 'v2' });
        console.info(`[Blackboard] Entry ${entryId} loaded (v2):`, entry);
      } catch (error) {
        console.error('[Blackboard] Error loading entry:', error);
        showError('Fehler beim Laden des Eintrags');
        return;
      }
    } else {
      const response = await fetch(`/api${endpoint}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        showError('Fehler beim Laden des Eintrags');
        return;
      }
      entry = (await response.json()) as BlackboardEntry;
      console.info(`[Blackboard] Entry ${entryId} loaded (v1):`, entry);
    }

    // Load attachments FIRST
    console.info(`[Blackboard] Loading attachments for entry ${entryId}...`);
    const attachments = await loadAttachments(entryId);
    console.info(`[Blackboard] Attachments loaded:`, attachments);

    // Show entry detail modal
    const detailContent = document.querySelector('#entryDetailContent');
    if (detailContent) {
      const priorityIcon = getPriorityIcon(entry.priority_level);
      const canEdit = isAdmin || entry.created_by === currentUserId;

      detailContent.innerHTML = `
          <div class="entry-detail-header">
            <h2>${priorityIcon} ${escapeHtml(entry.title)}</h2>
            <div class="entry-detail-meta">
              <span><i class="fas fa-user"></i> ${escapeHtml(entry.author_full_name ?? entry.author_name ?? 'Unknown')}</span>
              <span><i class="fas fa-clock"></i> ${formatDate(entry.created_at)}</span>
            </div>
          </div>
          <div class="entry-detail-content">
            ${escapeHtml(entry.content).replace(/\n/g, '<br>')}
          </div>
          ${
            entry.tags && entry.tags.length > 0
              ? `
            <div class="entry-tags">
              ${entry.tags.map((tag: string) => `<span class="badge badge-secondary">${escapeHtml(tag)}</span>`).join(' ')}
            </div>
          `
              : ''
          }
          ${
            attachments.length > 0
              ? `
            <div class="entry-attachments">
              <h4 class="entry-attachments-title">
                <i class="fas fa-paperclip"></i> Anhänge (${attachments.length})
              </h4>
              <div class="entry-attachment-list" id="attachment-list-${entryId}">
                ${attachments
                  .map((att) => {
                    const isPDF = att.mime_type === 'application/pdf';

                    console.info(`[Blackboard] Rendering attachment:`, att);

                    return `
                    <div class="entry-attachment-item"
                         data-attachment-id="${att.id}"
                         data-mime-type="${att.mime_type}"
                         data-filename="${escapeHtml(att.original_name)}"
                         style="cursor: pointer;"
                         title="Vorschau: ${escapeHtml(att.original_name)}"
                         onclick="console.info('[Blackboard] Inline onclick fired!', ${att.id}); window.previewAttachment && window.previewAttachment(${att.id}, '${escapeJsString(att.mime_type)}', '${escapeJsString(att.original_name)}'); return false;">
                      <i class="fas ${isPDF ? 'fa-file-pdf' : 'fa-file-image'}"></i>
                      <span>${escapeHtml(att.original_name)}</span>
                      <span class="attachment-size">(${formatFileSize(att.file_size)})</span>
                    </div>
                  `;
                  })
                  .join('')}
              </div>
            </div>
          `
              : ''
          }
        `;

      // Update footer buttons BEFORE showing modal
      const footer = document.querySelector('#entryDetailFooter');
      if (footer && canEdit) {
        footer.innerHTML = `
            <button type="button" class="btn btn-secondary" data-action="close">Schließen</button>
            <button type="button" class="btn btn-primary" onclick="editEntry(${entryId})">
              <i class="fas fa-edit"></i> Bearbeiten
            </button>
            <button type="button" class="btn btn-danger" onclick="deleteEntry(${entryId})">
              <i class="fas fa-trash"></i> Löschen
            </button>
          `;
      }
    }

    // Show modal FIRST
    console.info('[Blackboard] Showing entry detail modal');
    const detailModal = document.querySelector('#entryDetailModal');
    if (!detailModal) {
      console.error('[Blackboard] Entry detail modal not found!');
      return;
    }

    // Use modal wrapper to show detail modal
    console.info('[Blackboard] Opening entry detail modal');
    openModal('entryDetailModal');

    console.info('[Blackboard] Entry detail modal displayed');

    // Re-attach close button listeners after modal is shown
    setupCloseButtons();

    // NOW add click handlers for attachments AFTER modal is visible
    if (attachments.length > 0) {
      setTimeout(() => {
        const attachmentList = document.getElementById(`attachment-list-${entryId}`);
        console.info(`[Blackboard] Attachment list element:`, attachmentList);

        if (!attachmentList) {
          console.error('[Blackboard] Attachment list not found!');
          return;
        }

        const attachmentItems = attachmentList.querySelectorAll('.entry-attachment-item');
        console.info(`[Blackboard] Found ${attachmentItems.length} attachment items`);

        // Debug DOM structure
        console.info('[Blackboard] Attachment list HTML:', attachmentList.innerHTML);

        attachmentItems.forEach((item, index) => {
          const htmlItem = item as HTMLElement;
          const attachmentId = Number.parseInt(htmlItem.getAttribute('data-attachment-id') ?? '0', 10);
          const mimeType = htmlItem.getAttribute('data-mime-type') ?? '';
          const filename = htmlItem.getAttribute('data-filename') ?? '';

          console.info(`[Blackboard] Setting up attachment ${index}:`, {
            attachmentId,
            mimeType,
            filename,
            element: htmlItem,
            parentElement: htmlItem.parentElement,
          });

          // Direct click handler without cloning
          htmlItem.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.info(`[Blackboard] Attachment onclick fired:`, { attachmentId, mimeType, filename });

            // Call preview function
            if (typeof window.previewAttachment === 'function') {
              console.info('[Blackboard] Calling window.previewAttachment');
              void window.previewAttachment(attachmentId, mimeType, filename);
            } else if (typeof previewAttachment === 'function') {
              console.info('[Blackboard] Calling previewAttachment directly');
              void previewAttachment(attachmentId, mimeType, filename);
            } else {
              console.error('[Blackboard] previewAttachment function not found!');
            }
          };

          // Also add addEventListener as backup
          htmlItem.addEventListener(
            'click',
            (_) => {
              console.info(`[Blackboard] Attachment addEventListener fired:`, { attachmentId, mimeType, filename });
            },
            true,
          ); // Use capture phase

          // Visual feedback
          htmlItem.style.cursor = 'pointer';
          /* htmlItem.style.transition = 'all 0.2s ease'; */

          htmlItem.addEventListener('mouseenter', () => {
            htmlItem.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            htmlItem.style.transform = 'scale(1.02)';
          });

          htmlItem.addEventListener('mouseleave', () => {
            htmlItem.style.backgroundColor = '';
            htmlItem.style.transform = '';
          });

          // Log computed styles to check for issues
          const computedStyle = window.getComputedStyle(htmlItem);
          console.info(`[Blackboard] Attachment ${index} computed styles:`, {
            display: computedStyle.display,
            visibility: computedStyle.visibility,
            pointerEvents: computedStyle.pointerEvents,
            zIndex: computedStyle.zIndex,
            position: computedStyle.position,
          });
        });

        // Check if modal is blocking
        const modal = document.querySelector('#entryDetailModal');
        if (modal) {
          const modalStyle = window.getComputedStyle(modal);
          console.info('[Blackboard] Modal computed styles:', {
            zIndex: modalStyle.zIndex,
            position: modalStyle.position,
            pointerEvents: modalStyle.pointerEvents,
            display: modalStyle.display,
            visibility: modalStyle.visibility,
            opacity: modalStyle.opacity,
          });
          console.info('[Blackboard] Modal dimensions:', {
            offsetWidth: modal.offsetWidth,
            offsetHeight: modal.offsetHeight,
          });
        }

        // Check modal content
        const modalContent = document.querySelector('#entryDetailModal .modal-body');
        if (modalContent) {
          const contentStyle = window.getComputedStyle(modalContent);
          console.info('[Blackboard] Modal content styles:', {
            display: contentStyle.display,
            visibility: contentStyle.visibility,
            overflow: contentStyle.overflow,
          });
          console.info('[Blackboard] Modal content dimensions:', {
            offsetWidth: (modalContent as HTMLElement).offsetWidth,
            offsetHeight: (modalContent as HTMLElement).offsetHeight,
          });
        }

        // Test direct element access
        console.info('[Blackboard] Testing direct access...');
        const testAttachment = document.querySelector(`#attachment-list-${entryId} .entry-attachment-item`);
        if (testAttachment) {
          console.info('[Blackboard] Test attachment found:', testAttachment);
          console.info('[Blackboard] Can you see and click this element?', {
            offsetWidth: (testAttachment as HTMLElement).offsetWidth,
            offsetHeight: (testAttachment as HTMLElement).offsetHeight,
            offsetTop: (testAttachment as HTMLElement).offsetTop,
            offsetLeft: (testAttachment as HTMLElement).offsetLeft,
          });
        }
      }, 300); // Increased timeout to ensure modal is fully rendered
    }
  } catch (error) {
    console.error('Error viewing entry:', error);
    showError('Fehler beim Laden des Eintrags');
  }
}

// Extend window interface for modal and attachment functions
// Type declarations moved to the bottom of the file

/**
 * Preview attachment in modal
 */
async function previewAttachment(attachmentId: number, mimeType: string, fileName: string): Promise<void> {
  console.info(`[Blackboard] previewAttachment called:`, { attachmentId, mimeType, fileName });
  const token = getAuthToken();
  if (token === null || token.length === 0) {
    console.error('[Blackboard] No auth token for preview');
    return;
  }

  // Create preview modal if it doesn't exist
  let previewModal = document.querySelector('#attachmentPreviewModal');
  if (!previewModal) {
    previewModal = document.createElement('div');
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
  }

  // Show modal using the same approach as other modals
  console.info('[Blackboard] Showing preview modal');
  previewModal.style.display = 'flex';
  previewModal.classList.add('active');
  previewModal.style.opacity = '1';
  previewModal.style.visibility = 'visible';

  // Update title
  const titleElement = document.querySelector('#previewTitle');
  if (titleElement) titleElement.textContent = `Vorschau: ${fileName}`;

  // Update download link
  const downloadLink = document.querySelector('#downloadLink') as HTMLAnchorElement | null;
  if (downloadLink) {
    const useV2 = window.FEATURE_FLAGS?.USE_API_V2_BLACKBOARD ?? false;
    const endpoint = `/blackboard/attachments/${attachmentId}?download=true`;

    downloadLink.href = useV2 ? `/api/v2${endpoint}` : `/api${endpoint}`;
    downloadLink.setAttribute('download', fileName);
    // Add click handler to download with auth token
    downloadLink.onclick = async (e) => {
      e.preventDefault();
      try {
        let response: Response;
        if (useV2) {
          // For v2, use fetch directly for blob download
          response = await fetch(`/api/v2${endpoint}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        } else {
          response = await fetch(`/api${endpoint}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        }

        if (!response.ok) throw new Error('Download failed');

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.append(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Download error:', error);
        showError('Fehler beim Herunterladen der Datei');
      }
    };
  }

  // Load preview content
  const previewContent = document.querySelector('#previewContent');
  if (!previewContent) return;

  try {
    const useV2 = window.FEATURE_FLAGS?.USE_API_V2_BLACKBOARD ?? false;
    const endpoint = `/blackboard/attachments/${attachmentId}`;
    const attachmentUrl = useV2 ? `/api/v2${endpoint}` : `/api${endpoint}`;

    if (mimeType.startsWith('image/')) {
      // Fetch image with authorization header and convert to blob URL
      const response = await fetch(attachmentUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to load image');

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Display image safely to prevent XSS
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
    } else if (mimeType === 'application/pdf') {
      // For PDFs, use object tag instead of iframe to avoid CSP issues
      const response = await fetch(attachmentUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to load PDF');

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Display PDF with gray background to hide gaps
      previewContent.innerHTML = `
        <div style="width: 100%; height: 100%; background: #525659; display: flex; align-items: center; justify-content: center; overflow: hidden;">
          <iframe src="${blobUrl}#zoom=100"
                  style="width: calc(100% + 40px); height: 100%; border: none; display: block; margin-left: -20px;"
                  allowfullscreen>
          </iframe>
        </div>
      `;

      // Add click handler for "open in new tab" button
      setTimeout(() => {
        const openButton = document.querySelector('#openPdfNewTab');
        if (openButton) {
          openButton.onclick = async () => {
            try {
              const resp = await fetch(attachmentUrl, {
                headers: { Authorization: `Bearer ${token}` },
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
          };
        }
      }, 100);

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
    } else {
      // Unsupported file type - create elements safely
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

      unsupportedDiv.append(icon);
      unsupportedDiv.append(p1);
      unsupportedDiv.append(p2);
      previewContent.append(unsupportedDiv);
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
  const form = document.querySelector('#directAttachForm') as HTMLFormElement | null;
  if (form) form.reset();

  // Reset file input and global file
  const fileInput = document.querySelector('#directAttachInput') as HTMLInputElement | null;
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
  const dropZone = document.querySelector('#directAttachDropZone') as HTMLDivElement | null;
  const fileInput = document.querySelector('#directAttachInput') as HTMLInputElement | null;
  const saveBtn = document.querySelector('#saveDirectAttachBtn') as HTMLButtonElement | null;

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
      console.info('[DirectAttach] Size button clicked:', this.getAttribute('data-size'));
      document.querySelectorAll('.size-option').forEach((b) => {
        b.classList.remove('active');
      });
      this.classList.add('active');
    });
  });

  // Save button handler
  if (saveBtn) {
    saveBtn.onclick = async () => {
      console.info('[DirectAttach] Save button clicked');
      await saveDirectAttachment();
    };
  }
}

/**
 * Handle direct attachment file selection
 */
function handleDirectAttachFile(file: File): void {
  console.info('[DirectAttach] handleDirectAttachFile called with:', file.name, file.type, file.size);

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
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
  const titleInput = document.querySelector('#directAttachTitle') as HTMLInputElement | null;
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
  } else if (file.type === 'application/pdf') {
    previewImage.innerHTML = `<i class="fas fa-file-pdf" style="font-size: 64px; color: #dc3545;"></i>`;
  }
}

/**
 * Clear direct attachment
 */
function clearDirectAttachment(): void {
  console.info('[DirectAttach] Clearing attachment');
  const fileInput = document.querySelector('#directAttachInput') as HTMLInputElement | null;
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

  const titleInput = document.querySelector('#directAttachTitle') as HTMLInputElement | null;
  const orgLevelSelect = document.querySelector('#directAttachOrgLevel') as HTMLSelectElement | null;
  const prioritySelect = document.querySelector('#directAttachPriority') as HTMLSelectElement | null;
  const sizeOption = document.querySelector('.size-option.active');

  console.info('[DirectAttach] Elements found:', {
    globalFile: directAttachmentFile?.name ?? 'none',
    titleInput: !!titleInput,
    orgLevelSelect: !!orgLevelSelect,
    prioritySelect: !!prioritySelect,
    sizeOption: sizeOption?.getAttribute('data-size') ?? 'none',
  });

  if (!directAttachmentFile) {
    console.error('[DirectAttach] No file in global variable');
    showError('Bitte wählen Sie eine Datei aus');
    return;
  }

  const file = directAttachmentFile;
  const title = titleInput?.value ?? file.name.replace(/\.[^./]+$/, '');
  const size = sizeOption?.getAttribute('data-size') ?? 'medium';

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

    // Clear global file after successful upload
    directAttachmentFile = null;

    // Reset the form and file input for next use
    const form = document.querySelector('#directAttachForm') as HTMLFormElement | null;
    if (form) form.reset();

    const fileInput = document.querySelector('#directAttachInput') as HTMLInputElement | null;
    if (fileInput) fileInput.value = '';

    const preview = document.querySelector('#directAttachPreview');
    if (preview) preview.classList.add('d-none');

    // Reload entries
    entriesLoadingEnabled = true;
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
  const blackboardContainer = document.querySelector('#blackboardContainer');

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
  const exitFullscreenBtn = document.querySelector('#exitFullscreenBtn');
  const blackboardContainer = document.querySelector('#blackboardContainer');

  if (!fullscreenBtn || !exitFullscreenBtn || !blackboardContainer) {
    console.error('[Fullscreen] Required elements not found');
    return;
  }

  // Enter fullscreen
  fullscreenBtn.addEventListener('click', (_e) => {
    void (async () => {
      try {
        // Add fullscreen mode class to body
        document.body.classList.add('fullscreen-mode');

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
        document.body.classList.remove('fullscreen-mode');
      }
    })();
  });

  // Exit fullscreen
  exitFullscreenBtn.addEventListener('click', () => {
    exitFullscreen();
  });

  // Handle ESC key or browser exit fullscreen
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('mozfullscreenchange', handleFullscreenChange);
  document.addEventListener('MSFullscreenChange', handleFullscreenChange);

  // ESC key handler
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.body.classList.contains('fullscreen-mode')) {
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
    document.body.classList.remove('fullscreen-mode');
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

  document.body.classList.remove('fullscreen-mode');
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
