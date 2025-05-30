/**
 * Blackboard System
 * Client-side TypeScript for the blackboard feature
 */

import type { User } from '../types/api.types';
import { getAuthToken } from './auth';
import { showSuccess, showError, showInfo } from './auth';
import { closeModal } from './dashboard-scripts';

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
  created_at: string;
  updated_at: string;
  tags?: string[];
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
let currentPage: number = 1;
let currentFilter: string = 'all';
let currentSearch: string = '';
let currentSort: string = 'created_at|DESC';
let departments: Department[] = [];
let teams: Team[] = [];
let totalPages: number = 1;
let isAdmin: boolean = false;
let currentUserId: number | null = null;
let currentUserRole: string | null = null;
let currentDepartmentId: number | null = null;
let currentTeamId: number | null = null;

// Initialize when document is ready
// Globale Variable, um zu verhindern, dass Endlosanfragen gesendet werden
let entriesLoadingEnabled: boolean = false;

document.addEventListener('DOMContentLoaded', () => {
  // Aktiviere das automatische Laden der Einträge
  entriesLoadingEnabled = true;

  // Alle Schließen-Buttons einrichten
  setupCloseButtons();

  // Check if user is logged in
  checkLoggedIn()
    .then(() => {
      // Load user data
      fetchUserData()
        .then((userData: UserData) => {
          currentUserId = userData.id;
          currentUserRole = userData.role;
          currentDepartmentId = userData.departmentId || userData.department_id || null;
          currentTeamId = userData.teamId || userData.team_id || null;
          isAdmin = userData.role === 'admin' || userData.role === 'root';

          // Show/hide "New Entry" button based on permissions
          const newEntryBtn = document.getElementById('newEntryBtn') as HTMLButtonElement;
          if (newEntryBtn) {
            newEntryBtn.style.display = isAdmin ? 'block' : 'none';
          }

          // Load departments and teams for form dropdowns
          loadDepartmentsAndTeams();

          // Wir laden die Einträge erst wenn der Button geklickt wird
          const loadEntriesBtn = document.getElementById('loadEntriesBtn') as HTMLButtonElement;
          if (loadEntriesBtn) {
            loadEntriesBtn.addEventListener('click', () => {
              entriesLoadingEnabled = true; // Erlaube das Laden nur nach Klick
              loadEntries();
            });
          }

          // Retry-Button Ereignisbehandlung
          const retryLoadBtn = document.getElementById('retryLoadBtn') as HTMLButtonElement;
          if (retryLoadBtn) {
            retryLoadBtn.addEventListener('click', () => {
              entriesLoadingEnabled = true; // Erlaube das Laden nur nach Klick
              loadEntries();
            });
          }
        })
        .catch((error) => {
          console.error('Error loading user data:', error);
          window.location.href = '/pages/login.html';
        });

      // Setup event listeners
      setupEventListeners();
    })
    .catch((error) => {
      console.error('Error checking login:', error);
      window.location.href = '/pages/login.html';
    });
});

/**
 * Setup close buttons for all modals
 */
function setupCloseButtons(): void {
  // Füge Event-Listener zu allen Elementen mit data-action="close" hinzu
  document.querySelectorAll<HTMLElement>('[data-action="close"]').forEach((button) => {
    button.addEventListener('click', function () {
      // Finde das übergeordnete Modal
      const modal = this.closest('.modal-overlay') as HTMLElement;
      if (modal) {
        if (typeof (window as any).DashboardUI?.closeModal === 'function') {
          (window as any).DashboardUI.closeModal(modal.id);
        } else {
          closeModal(modal.id);
        }
      } else {
        console.error('No parent modal found for close button');
      }
    });
  });

  // Schließen beim Klicken außerhalb des Modal-Inhalts
  document.querySelectorAll<HTMLElement>('.modal-overlay').forEach((modal) => {
    modal.addEventListener('click', (event: MouseEvent) => {
      // Nur schließen, wenn der Klick auf den Modal-Hintergrund erfolgt (nicht auf den Inhalt)
      if (event.target === modal) {
        if (typeof (window as any).DashboardUI?.closeModal === 'function') {
          (window as any).DashboardUI.closeModal(modal.id);
        } else {
          closeModal(modal.id);
        }
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
    button.addEventListener('click', function () {
      // Remove active class from all pills
      document
        .querySelectorAll('.filter-pill')
        .forEach((pill) => pill.classList.remove('active'));
      // Add active class to clicked pill
      this.classList.add('active');

      currentFilter = this.dataset.value || 'all';
      currentPage = 1;

      // Nur laden, wenn es aktiviert wurde
      if (entriesLoadingEnabled) {
        loadEntries();
      }
    });
  });

  // Sort entries
  const sortFilter = document.getElementById('sortFilter') as HTMLSelectElement;
  if (sortFilter) {
    sortFilter.addEventListener('change', function () {
      currentSort = this.value;

      // Nur laden, wenn es aktiviert wurde
      if (entriesLoadingEnabled) {
        loadEntries();
      }
    });
  } else {
    console.error('Sort filter not found');
  }

  // Search button
  const searchButton = document.getElementById('searchButton') as HTMLButtonElement;
  const searchInput = document.getElementById('searchInput') as HTMLInputElement;

  if (searchButton && searchInput) {
    searchButton.addEventListener('click', () => {
      currentSearch = searchInput.value.trim();
      currentPage = 1;

      // Nur laden, wenn es aktiviert wurde
      if (entriesLoadingEnabled) {
        loadEntries();
      }
    });

    searchInput.addEventListener('keypress', function (e: KeyboardEvent) {
      if (e.key === 'Enter') {
        currentSearch = this.value.trim();
        currentPage = 1;

        // Nur laden, wenn es aktiviert wurde
        if (entriesLoadingEnabled) {
          loadEntries();
        }
      }
    });
  } else {
    console.error('Search elements not found');
  }

  // New entry button
  const newEntryBtn = document.getElementById('newEntryBtn') as HTMLButtonElement;
  if (newEntryBtn) {
    newEntryBtn.addEventListener('click', () => {
      openEntryForm();
    });
  } else {
    console.error('New entry button not found');
  }

  // Save entry button
  const saveEntryBtn = document.getElementById('saveEntryBtn') as HTMLButtonElement;
  if (saveEntryBtn) {
    saveEntryBtn.addEventListener('click', () => {
      saveEntry();
    });
  } else {
    console.error('Save entry button not found');
  }

  // Organization level change
  const entryOrgLevel = document.getElementById('entryOrgLevel') as HTMLSelectElement;
  if (entryOrgLevel) {
    entryOrgLevel.addEventListener('change', function () {
      updateOrgIdDropdown(this.value);
    });
  } else {
    console.error('Organization level dropdown not found');
  }

  // Color selection
  document.querySelectorAll<HTMLElement>('.color-option').forEach((button) => {
    button.addEventListener('click', function () {
      // Remove active class from all color options
      document
        .querySelectorAll('.color-option')
        .forEach((option) => option.classList.remove('active'));
      // Add active class to clicked option
      this.classList.add('active');
    });
  });
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
    const loadEntriesCard = document.getElementById('loadEntriesCard') as HTMLElement;
    if (loadEntriesCard) loadEntriesCard.classList.add('d-none');

    // Zeige den Ladeindikator
    const loadingIndicator = document.getElementById('loadingIndicator') as HTMLElement;
    if (loadingIndicator) loadingIndicator.classList.remove('d-none');

    // Verstecke vorherige Ergebnisse oder Fehlermeldungen
    const blackboardEntries = document.getElementById('blackboardEntries') as HTMLElement;
    if (blackboardEntries) blackboardEntries.classList.add('d-none');

    const noEntriesMessage = document.getElementById('noEntriesMessage') as HTMLElement;
    if (noEntriesMessage) noEntriesMessage.classList.add('d-none');

    // Parse sort option
    const [sortBy, sortDir] = currentSort.split('|');

    // Get token from localStorage
    const token = getAuthToken();
    if (!token) {
      window.location.href = '/pages/login.html';
      throw new Error('No token found');
    }

    // Fetch entries with authentication token
    const response = await fetch(
      `/api/blackboard?page=${currentPage}&filter=${currentFilter}&search=${encodeURIComponent(currentSearch)}&sortBy=${sortBy}&sortDir=${sortDir}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        // Redirect to login if unauthorized
        window.location.href = '/pages/login.html';
        throw new Error('Unauthorized');
      }
      throw new Error('Failed to load entries');
    }

    const data: BlackboardResponse = await response.json();

    // Update pagination
    totalPages = data.pagination.totalPages;
    updatePagination(data.pagination);

    // Display entries
    displayEntries(data.entries);

    // Erfolgreiche Anfrage - deaktiviere weitere automatische API-Aufrufe
    entriesLoadingEnabled = false;
  } catch (error) {
    console.error('Error loading entries:', error);
    showError('Fehler beim Laden der Einträge.');

    // Bei einem Fehler, zeige die "Keine Einträge" Nachricht mit Wiederholungs-Button
    const noEntriesMessage = document.getElementById('noEntriesMessage') as HTMLElement;
    if (noEntriesMessage) {
      noEntriesMessage.classList.remove('d-none');
    }

    // Zeige die Lade-Button-Karte wieder an
    const loadEntriesCard = document.getElementById('loadEntriesCard') as HTMLElement;
    if (loadEntriesCard) loadEntriesCard.classList.remove('d-none');
  } finally {
    // Verstecke den Ladeindikator
    const loadingIndicator = document.getElementById('loadingIndicator') as HTMLElement;
    if (loadingIndicator) loadingIndicator.classList.add('d-none');
  }
}

/**
 * Check if user is logged in
 */
async function checkLoggedIn(): Promise<void> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('No authentication token found');
  }
  
  // Verify token is valid
  try {
    const response = await fetch('/api/user/profile', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      throw new Error('Invalid token');
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Fetch user data
 */
async function fetchUserData(): Promise<UserData> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('No authentication token found');
  }

  const response = await fetch('/api/user/profile', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user data');
  }

  return response.json();
}

/**
 * Load departments and teams
 */
async function loadDepartmentsAndTeams(): Promise<void> {
  const token = getAuthToken();
  if (!token) return;

  try {
    // Load departments
    const deptResponse = await fetch('/api/departments', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (deptResponse.ok) {
      departments = await deptResponse.json();
    }

    // Load teams
    const teamResponse = await fetch('/api/teams', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (teamResponse.ok) {
      teams = await teamResponse.json();
    }
  } catch (error) {
    console.error('Error loading departments and teams:', error);
  }
}

/**
 * Display blackboard entries
 */
function displayEntries(entries: BlackboardEntry[]): void {
  const container = document.getElementById('blackboardEntries') as HTMLElement;
  if (!container) return;

  container.innerHTML = '';
  container.classList.remove('d-none');

  if (entries.length === 0) {
    const noEntriesMessage = document.getElementById('noEntriesMessage') as HTMLElement;
    if (noEntriesMessage) {
      noEntriesMessage.classList.remove('d-none');
    }
    return;
  }

  entries.forEach((entry) => {
    const entryCard = createEntryCard(entry);
    container.appendChild(entryCard);
  });
}

/**
 * Create entry card element
 */
function createEntryCard(entry: BlackboardEntry): HTMLElement {
  const card = document.createElement('div');
  card.className = `blackboard-card priority-${entry.priority_level}`;
  card.style.backgroundColor = entry.color || '#f8f9fa';

  const priorityBadge = getPriorityBadge(entry.priority_level);
  const orgLevelBadge = getOrgLevelBadge(entry.org_level);
  const canEdit = isAdmin || entry.created_by === currentUserId;

  card.innerHTML = `
    <div class="card-header">
      <h3>${escapeHtml(entry.title)}</h3>
      <div class="card-actions">
        ${canEdit ? `
          <button class="btn btn-sm btn-primary" onclick="editEntry(${entry.id})">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteEntry(${entry.id})">
            <i class="fas fa-trash"></i>
          </button>
        ` : ''}
      </div>
    </div>
    <div class="card-body">
      <p>${escapeHtml(entry.content).replace(/\n/g, '<br>')}</p>
      <div class="card-meta">
        ${priorityBadge}
        ${orgLevelBadge}
        <span class="created-by">
          <i class="fas fa-user"></i> ${escapeHtml(entry.created_by_name || 'Unknown')}
        </span>
        <span class="created-at">
          <i class="fas fa-clock"></i> ${formatDate(entry.created_at)}
        </span>
      </div>
    </div>
  `;

  return card;
}

/**
 * Update pagination UI
 */
function updatePagination(pagination: PaginationInfo): void {
  const paginationContainer = document.getElementById('pagination') as HTMLElement;
  if (!paginationContainer) return;

  paginationContainer.innerHTML = '';

  if (pagination.totalPages <= 1) return;

  // Previous button
  if (currentPage > 1) {
    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn btn-sm btn-secondary';
    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevBtn.onclick = () => changePage(currentPage - 1);
    paginationContainer.appendChild(prevBtn);
  }

  // Page numbers
  for (let i = 1; i <= pagination.totalPages; i++) {
    if (
      i === 1 ||
      i === pagination.totalPages ||
      (i >= currentPage - 2 && i <= currentPage + 2)
    ) {
      const pageBtn = document.createElement('button');
      pageBtn.className = `btn btn-sm ${i === currentPage ? 'btn-primary' : 'btn-secondary'}`;
      pageBtn.textContent = i.toString();
      pageBtn.onclick = () => changePage(i);
      paginationContainer.appendChild(pageBtn);
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      const dots = document.createElement('span');
      dots.textContent = '...';
      dots.className = 'pagination-dots';
      paginationContainer.appendChild(dots);
    }
  }

  // Next button
  if (currentPage < pagination.totalPages) {
    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn-sm btn-secondary';
    nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextBtn.onclick = () => changePage(currentPage + 1);
    paginationContainer.appendChild(nextBtn);
  }
}

/**
 * Change page
 */
function changePage(page: number): void {
  currentPage = page;
  entriesLoadingEnabled = true;
  loadEntries();
}

/**
 * Open entry form for creating/editing
 */
function openEntryForm(entryId?: number): void {
  const modal = document.getElementById('entryFormModal') as HTMLElement;
  if (!modal) return;

  // Reset form
  const form = document.getElementById('entryForm') as HTMLFormElement;
  if (form) form.reset();

  // Reset color selection
  document.querySelectorAll('.color-option').forEach((option) => {
    option.classList.remove('active');
  });
  document.querySelector('.color-option[data-color="#f8f9fa"]')?.classList.add('active');

  if (entryId) {
    // Load entry data for editing
    loadEntryForEdit(entryId);
  } else {
    // New entry
    updateOrgIdDropdown('all');
  }

  // Show modal
  if (typeof (window as any).DashboardUI?.openModal === 'function') {
    (window as any).DashboardUI.openModal('entryFormModal');
  } else {
    modal.style.display = 'flex';
  }
}

/**
 * Update organization ID dropdown based on level
 */
function updateOrgIdDropdown(level: string): void {
  const orgIdContainer = document.getElementById('orgIdContainer') as HTMLElement;
  const orgIdSelect = document.getElementById('entryOrgId') as HTMLSelectElement;

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
      orgIdSelect.appendChild(option);
    });
  } else if (level === 'team') {
    orgIdContainer.style.display = 'block';
    const label = orgIdContainer.querySelector('label');
    if (label) label.textContent = 'Team';

    teams.forEach((team) => {
      const option = document.createElement('option');
      option.value = team.id.toString();
      option.textContent = team.name;
      orgIdSelect.appendChild(option);
    });
  }
}

/**
 * Save entry
 */
async function saveEntry(): Promise<void> {
  const form = document.getElementById('entryForm') as HTMLFormElement;
  if (!form) return;

  const formData = new FormData(form);
  const token = getAuthToken();
  if (!token) return;

  // Get selected color
  const selectedColor = document.querySelector('.color-option.active') as HTMLElement;
  const color = selectedColor?.dataset.color || '#f8f9fa';

  const entryData = {
    title: formData.get('title') as string,
    content: formData.get('content') as string,
    priority_level: formData.get('priority_level') as string,
    org_level: formData.get('org_level') as string,
    org_id: formData.get('org_level') === 'all' ? null : parseInt(formData.get('org_id') as string),
    color: color,
  };

  try {
    const entryId = formData.get('entry_id') as string;
    const url = entryId ? `/api/blackboard/${entryId}` : '/api/blackboard';
    const method = entryId ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(entryData),
    });

    if (response.ok) {
      showSuccess(entryId ? 'Eintrag erfolgreich aktualisiert!' : 'Eintrag erfolgreich erstellt!');
      closeModal('entryFormModal');
      entriesLoadingEnabled = true;
      loadEntries();
    } else {
      const error = await response.json();
      showError(error.message || 'Fehler beim Speichern des Eintrags');
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
  if (!token) return;

  try {
    const response = await fetch(`/api/blackboard/${entryId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const entry: BlackboardEntry = await response.json();
      
      // Fill form with entry data
      const form = document.getElementById('entryForm') as HTMLFormElement;
      if (!form) return;

      (form.elements.namedItem('entry_id') as HTMLInputElement).value = entry.id.toString();
      (form.elements.namedItem('title') as HTMLInputElement).value = entry.title;
      (form.elements.namedItem('content') as HTMLTextAreaElement).value = entry.content;
      (form.elements.namedItem('priority_level') as HTMLSelectElement).value = entry.priority_level;
      (form.elements.namedItem('org_level') as HTMLSelectElement).value = entry.org_level;

      // Update org dropdown
      updateOrgIdDropdown(entry.org_level);
      if (entry.org_id) {
        (form.elements.namedItem('org_id') as HTMLSelectElement).value = entry.org_id.toString();
      }

      // Select color
      document.querySelectorAll('.color-option').forEach((option) => {
        option.classList.remove('active');
      });
      const colorOption = document.querySelector(`.color-option[data-color="${entry.color}"]`) as HTMLElement;
      if (colorOption) {
        colorOption.classList.add('active');
      }
    } else {
      showError('Fehler beim Laden des Eintrags');
    }
  } catch (error) {
    console.error('Error loading entry:', error);
    showError('Ein Fehler ist aufgetreten');
  }
}

/**
 * Delete entry
 */
async function deleteEntry(entryId: number): Promise<void> {
  if (!confirm('Möchten Sie diesen Eintrag wirklich löschen?')) {
    return;
  }

  const token = getAuthToken();
  if (!token) return;

  try {
    const response = await fetch(`/api/blackboard/${entryId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      showSuccess('Eintrag erfolgreich gelöscht!');
      entriesLoadingEnabled = true;
      loadEntries();
    } else {
      const error = await response.json();
      showError(error.message || 'Fehler beim Löschen des Eintrags');
    }
  } catch (error) {
    console.error('Error deleting entry:', error);
    showError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
  }
}

// Utility functions
function getPriorityBadge(priority: string): string {
  const badges: Record<string, string> = {
    low: '<span class="badge badge-success">Niedrig</span>',
    medium: '<span class="badge badge-warning">Mittel</span>',
    high: '<span class="badge badge-danger">Hoch</span>',
    critical: '<span class="badge badge-dark">Kritisch</span>',
  };
  return badges[priority] || '';
}

function getOrgLevelBadge(level: string): string {
  const badges: Record<string, string> = {
    all: '<span class="badge badge-info">Alle</span>',
    department: '<span class="badge badge-primary">Abteilung</span>',
    team: '<span class="badge badge-secondary">Team</span>',
  };
  return badges[level] || '';
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

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

// Export functions to window for backwards compatibility
if (typeof window !== 'undefined') {
  (window as any).editEntry = openEntryForm;
  (window as any).deleteEntry = deleteEntry;
  (window as any).changePage = changePage;
}