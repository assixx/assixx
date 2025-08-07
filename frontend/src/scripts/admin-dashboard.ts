/**
 * Admin Dashboard Script
 * Handles admin-specific functionality including employee, document, department, and team management
 */

import type { User, Document } from '../types/api.types';
import { apiClient } from '../utils/api-client';

import { getAuthToken, showSuccess, showError } from './auth';
import { showSection } from './show-section';

// Blackboard types (matching blackboard.ts)
interface BlackboardEntry {
  id: number;
  title: string;
  content: string;
  priority_level: 'low' | 'medium' | 'high' | 'critical';
  priorityLevel?: 'low' | 'medium' | 'high' | 'critical'; // v2 field name
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
  createdAt?: string; // v2 field name
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

interface DashboardStats {
  employeeCount: number;
  documentCount: number;
  departmentCount: number;
  teamCount: number;
}

interface Department {
  id: number;
  name: string;
  description?: string;
}

interface Team {
  id: number;
  name: string;
  department_id: number;
  department_name?: string;
}

interface EmployeeFormData {
  username: string;
  email: string;
  email_confirm: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name: string;
  employee_id: string;
  position?: string;
  department_id?: string;
  team_id?: string;
  phone?: string;
  birth_date?: string;
  start_date?: string;
  street?: string;
  house_number?: string;
  postal_code?: string;
  city?: string;
}

interface CreateEmployeeFormElements extends HTMLFormControlsCollection {
  username: HTMLInputElement;
  email: HTMLInputElement;
  email_confirm: HTMLInputElement;
  password: HTMLInputElement;
  password_confirm: HTMLInputElement;
  first_name: HTMLInputElement;
  last_name: HTMLInputElement;
  employee_id: HTMLInputElement;
  position: HTMLInputElement;
  department_id: HTMLSelectElement;
  team_id: HTMLSelectElement;
  phone: HTMLInputElement;
  birth_date: HTMLInputElement;
  start_date: HTMLInputElement;
  street: HTMLInputElement;
  house_number: HTMLInputElement;
  postal_code: HTMLInputElement;
  city: HTMLInputElement;
}

interface CreateEmployeeForm extends HTMLFormElement {
  readonly elements: CreateEmployeeFormElements;
}

// Global token variable
let token: string | null = null;

// Define functions globally so they can be accessed from HTML onclick handlers
// Load Departments for Employee Select (defined globally)
const loadDepartmentsForEmployeeSelect = async function (): Promise<void> {
  try {
    const authToken = token ?? getAuthToken();
    const useV2 = window.FEATURE_FLAGS?.USE_API_V2_DEPARTMENTS;
    console.log('[loadDepartmentsForEmployeeSelect] Feature flag USE_API_V2_DEPARTMENTS:', useV2);
    console.log('[loadDepartmentsForEmployeeSelect] window.FEATURE_FLAGS:', window.FEATURE_FLAGS);
    const apiPath = useV2 ? '/api/v2/departments' : '/api/departments';
    console.log('[loadDepartmentsForEmployeeSelect] Using API path:', apiPath);

    const response = await fetch(apiPath, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to load departments for select');
    }

    const responseData = await response.json();
    console.log('[loadDepartmentsForEmployeeSelect] Response data:', responseData);
    const departments = useV2 ? responseData.data : responseData;
    console.log('[loadDepartmentsForEmployeeSelect] Departments:', departments);
    const dropdownOptions = document.getElementById('employee-department-dropdown');

    if (!dropdownOptions) {
      console.error('[loadDepartmentsForEmployeeSelect] Dropdown options element not found!');
      return;
    }

    // Clear existing options and add placeholder
    dropdownOptions.innerHTML = `
      <div class="dropdown-option" data-value="" onclick="selectDropdownOption('employee-department', '', 'Keine Abteilung')">
        Keine Abteilung
      </div>
    `;

    console.log('[loadDepartmentsForEmployeeSelect] Adding departments to dropdown:', departments.length);
    departments.forEach((dept: Department) => {
      console.log('[loadDepartmentsForEmployeeSelect] Adding department:', dept);
      const optionDiv = document.createElement('div');
      optionDiv.className = 'dropdown-option';
      optionDiv.setAttribute('data-value', dept.id.toString());
      optionDiv.textContent = dept.name;
      // Set onclick as an attribute so it shows in HTML and works correctly
      optionDiv.setAttribute('onclick', `selectDropdownOption('employee-department', '${dept.id}', '${dept.name}')`);
      dropdownOptions.appendChild(optionDiv);
    });
    console.log('[loadDepartmentsForEmployeeSelect] Dropdown content:', dropdownOptions.innerHTML);
  } catch (error) {
    console.error('Error loading departments for select:', error);
    showError('Fehler beim Laden der Abteilungen');
  }
};

// Show New Employee Modal (defined globally)
const showNewEmployeeModal = function (): void {
  const modal = document.getElementById('employee-modal');
  if (modal) {
    // Formular zurücksetzen, falls es bereits benutzt wurde
    const form = document.getElementById('create-employee-form') as HTMLFormElement;
    if (form) {
      form.reset();

      // Fehler-Anzeigen zurücksetzen
      const emailError = document.getElementById('email-error');
      const passwordError = document.getElementById('password-error');

      if (emailError) emailError.style.display = 'none';
      if (passwordError) passwordError.style.display = 'none';
    }

    // Modal anzeigen
    modal.style.display = 'flex';

    // Abteilungen für das Formular laden
    void loadDepartmentsForEmployeeSelect();
  } else {
    console.error('employee-modal element not found!');

    alert('Das Mitarbeiterformular konnte nicht geöffnet werden.');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  token = getAuthToken();

  // Temporär deaktiviert: Auch ohne Token weitermachen (für Testzwecke)
  // if (!token) {
  //     console.log('No token found, redirecting to login');
  //     window.location.href = '/';
  //     return;
  // }

  // Für Testzwecke ohne Token
  token ??= 'test-mode';

  // User info in header is handled by unified-navigation.ts
  // loadHeaderUserInfo(); // Removed to avoid redundancy

  // Event Listeners for forms
  const createEmployeeForm = document.getElementById('create-employee-form') as CreateEmployeeForm | null;
  // const uploadDocumentForm = document.getElementById('document-upload-form') as HTMLFormElement;
  const departmentForm = document.getElementById('department-form') as HTMLFormElement | null;
  const teamForm = document.getElementById('team-form') as HTMLFormElement | null;
  // const logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement | null; // Not used - handled by unified-navigation

  // Buttons für Mitarbeiter-Modal
  const newEmployeeBtn = document.getElementById('new-employee-button') as HTMLButtonElement | null;
  const employeesSectionNewBtn = document.getElementById('employees-section-new-button') as HTMLButtonElement | null;

  // Event-Listener für Formulare
  if (createEmployeeForm) {
    createEmployeeForm.addEventListener('submit', (e) => void createEmployee(e));

    // Live-Validierung für E-Mail und Passwort hinzufügen
    const emailInput = document.getElementById('email') as HTMLInputElement | null;
    const emailConfirmInput = document.getElementById('email_confirm') as HTMLInputElement | null;
    const emailError = document.getElementById('email-error');

    const passwordInput = document.getElementById('password') as HTMLInputElement | null;
    const passwordConfirmInput = document.getElementById('password_confirm') as HTMLInputElement | null;
    const passwordError = document.getElementById('password-error');

    // E-Mail-Validierung
    if (emailInput && emailConfirmInput && emailError) {
      const checkEmails = function () {
        if (emailConfirmInput.value && emailInput.value !== emailConfirmInput.value) {
          emailError.style.display = 'block';
        } else {
          emailError.style.display = 'none';
        }
      };

      emailInput.addEventListener('input', checkEmails);
      emailConfirmInput.addEventListener('input', checkEmails);
    }

    // Passwort-Validierung
    if (passwordInput && passwordConfirmInput && passwordError) {
      const checkPasswords = function () {
        if (passwordConfirmInput.value && passwordInput.value !== passwordConfirmInput.value) {
          passwordError.style.display = 'block';
        } else {
          passwordError.style.display = 'none';
        }
      };

      passwordInput.addEventListener('input', checkPasswords);
      passwordConfirmInput.addEventListener('input', checkPasswords);
    }
  }

  // TODO: uploadDocument function needs to be implemented
  // if (uploadDocumentForm) uploadDocumentForm.addEventListener('submit', uploadDocument);
  if (departmentForm) departmentForm.addEventListener('submit', (e) => void createDepartment(e));
  if (teamForm) teamForm.addEventListener('submit', (e) => void createTeam(e));
  // Logout Button - DISABLED: Handled by unified-navigation.ts
  // if (logoutBtn) {
  //   logoutBtn.addEventListener('click', (e) => {
  //     e.preventDefault();
  //     logout().catch((error) => {
  //       console.error('Logout error:', error);
  //       // Fallback
  //       window.location.href = '/login';
  //     });
  //   });
  // }

  // Event-Listener für Mitarbeiter-Buttons
  if (newEmployeeBtn) {
    newEmployeeBtn.addEventListener('click', () => {
      showNewEmployeeModal();
    });
  }

  if (employeesSectionNewBtn) {
    employeesSectionNewBtn.addEventListener('click', () => {
      showNewEmployeeModal();
    });
  }

  // Initial loads - add slight delay to ensure DOM is ready
  console.log('[Admin Dashboard] Setting up initial loads...');
  setTimeout(() => {
    try {
      console.log('[Admin Dashboard] Starting initial loads...');
      void loadDashboardStats();
      void loadRecentEmployees();
      void loadRecentDocuments();
      void loadDepartments();
      void loadTeams();
      void loadDepartmentsForEmployeeSelect(); // Laden der Abteilungen für Mitarbeiterformular
      void loadBlackboardPreview(); // Laden der Blackboard-Einträge
      console.log('[Admin Dashboard] Calling loadBlackboardWidget...');
      void loadBlackboardWidget(); // Laden des Blackboard-Widgets
    } catch (error) {
      console.error('[Admin Dashboard] Error in initial loads:', error);
    }
  }, 100);

  // Handle section parameter on page load
  const urlParams = new URLSearchParams(window.location.search);
  const section = urlParams.get('section');
  if (section) {
    console.log('[Admin Dashboard] Section parameter found:', section);
    showSection(section);
  } else {
    console.log('[Admin Dashboard] No section parameter, showing dashboard');
    // Default to dashboard if no section specified
    showSection('dashboard');
  }

  // Setup manage links
  const manageEmployeesLink = document.getElementById('manage-employees-link');
  if (manageEmployeesLink) {
    manageEmployeesLink.addEventListener('click', (e) => {
      e.preventDefault();
      showSection('employees');
    });
  }

  // Employee Status Modal is now handled in admin-dashboard.html
  // Removed duplicate event listener to prevent conflicts

  const manageDocumentsLink = document.getElementById('manage-documents-link');
  if (manageDocumentsLink) {
    manageDocumentsLink.addEventListener('click', (e) => {
      e.preventDefault();
      showSection('documents');
    });
  }

  const manageDepartmentsLink = document.getElementById('manage-departments-link');
  if (manageDepartmentsLink) {
    manageDepartmentsLink.addEventListener('click', (e) => {
      e.preventDefault();
      showSection('departments');
    });
  }

  // Load Dashboard Statistics
  async function loadDashboardStats(): Promise<void> {
    try {
      // Get auth token
      const token = getAuthToken();
      if (!token) {
        console.error('No auth token found');
        return;
      }

      // Check if v2 APIs are available
      const useV2Users = window.FEATURE_FLAGS?.USE_API_V2_USERS;
      const useV2Documents = window.FEATURE_FLAGS?.USE_API_V2_DOCUMENTS;
      const useV2Departments = window.FEATURE_FLAGS?.USE_API_V2_DEPARTMENTS;
      const useV2Teams = window.FEATURE_FLAGS?.USE_API_V2_TEAMS;

      // If any v2 API is enabled, use individual loading instead
      if (useV2Users || useV2Documents || useV2Departments || useV2Teams) {
        console.log('[loadDashboardStats] Using v2 APIs - calling loadDashboardStatsIndividually()');
        return loadDashboardStatsIndividually();
      }

      // Otherwise use v1 admin stats endpoint
      const statsRes = await fetch('/api/admin/dashboard-stats', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (statsRes.ok) {
        const responseData = await statsRes.json();
        // Handle v2 response format which wraps data
        const stats: DashboardStats = responseData.data ?? responseData;

        // Update UI mit den Statistiken vom Admin Dashboard Endpoint
        const employeeCount = document.getElementById('employee-count');
        const documentCount = document.getElementById('document-count');
        const deptCountElement = document.getElementById('department-count');
        const teamCount = document.getElementById('team-count');

        if (employeeCount) employeeCount.textContent = (stats.employeeCount ?? 0).toString();
        if (documentCount) documentCount.textContent = (stats.documentCount ?? 0).toString();
        if (deptCountElement) deptCountElement.textContent = (stats.departmentCount ?? 0).toString();
        if (teamCount) teamCount.textContent = (stats.teamCount ?? 0).toString();
      } else {
        console.error('Failed to load dashboard stats', statsRes.statusText);

        // Check if unauthorized
        if (statsRes.status === 401) {
          console.error('Token expired or invalid, redirecting to login');
          window.location.href = '/login';
          return;
        }

        // Fallback: Einzeln laden, wenn der stats-Endpunkt fehlschlägt
        await loadDashboardStatsIndividually();
      }
    } catch (error) {
      console.error('Error loading dashboard stats:', error);

      // Fallback: Einzeln laden bei einem Fehler
      await loadDashboardStatsIndividually();
    }
  }

  // Fallback-Funktion, die Statistiken einzeln lädt
  async function loadDashboardStatsIndividually(): Promise<void> {
    // Get auth token
    const token = getAuthToken();
    if (!token) {
      console.error('No auth token found for individual stats loading');
      return;
    }

    // Mitarbeiter - Use v2 API if enabled
    try {
      const useV2Users = window.FEATURE_FLAGS?.USE_API_V2_USERS;
      let employees: User[] = [];

      if (useV2Users) {
        // Use apiClient for v2
        employees = (await apiClient.get<User[]>('/users?role=employee')) ?? [];
      } else {
        // Use v1 API
        const employeesRes = await fetch('/api/admin/employees', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (employeesRes.ok) {
          employees = await employeesRes.json();
        } else {
          console.error('Failed to load employees', employeesRes.statusText);
        }
      }

      const employeeCount = document.getElementById('employee-count');
      if (employeeCount) employeeCount.textContent = employees.length.toString();
    } catch (error) {
      console.error('Error loading employees:', error);
    }

    // Dokumente
    try {
      const useV2Documents = window.FEATURE_FLAGS?.USE_API_V2_DOCUMENTS;
      let documents: Document[] = [];

      if (useV2Documents) {
        // Use apiClient for v2
        documents = (await apiClient.get<Document[]>('/documents')) ?? [];
      } else {
        // Use v1 API
        const documentsRes = await fetch('/api/admin/documents', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (documentsRes.ok) {
          documents = await documentsRes.json();
        } else {
          console.error('Failed to load documents', documentsRes.statusText);
        }
      }

      const documentCount = document.getElementById('document-count');
      if (documentCount) documentCount.textContent = documents.length.toString();
    } catch (error) {
      console.error('Error loading documents:', error);
    }

    // Abteilungen - Already has v2 support
    try {
      const useV2Departments = window.FEATURE_FLAGS?.USE_API_V2_DEPARTMENTS;
      const apiPath = useV2Departments ? '/api/v2/departments' : '/api/departments';

      const departmentsRes = await fetch(apiPath, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (departmentsRes.ok) {
        const responseData = await departmentsRes.json();
        const departments = useV2Departments ? responseData.data : responseData;
        const deptCountElement = document.getElementById('department-count');
        if (deptCountElement) {
          deptCountElement.textContent = departments.length.toString();
        }
      } else {
        console.error('Failed to load departments', departmentsRes.statusText);
      }
    } catch (error) {
      console.error('Error loading departments:', error);
    }

    // Teams
    try {
      const useV2Teams = window.FEATURE_FLAGS?.USE_API_V2_TEAMS;
      let teams: Team[] = [];

      if (useV2Teams) {
        // Use apiClient for v2
        teams = (await apiClient.get<Team[]>('/teams')) ?? [];
      } else {
        // Use v1 API
        const teamsRes = await fetch('/api/teams', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (teamsRes.ok) {
          teams = await teamsRes.json();
        } else {
          console.error('Failed to load teams', teamsRes.statusText);
        }
      }

      const teamCount = document.getElementById('team-count');
      if (teamCount) teamCount.textContent = teams.length.toString();
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  }

  // Load Blackboard Preview - zeigt die neuesten 3 Einträge
  async function loadBlackboardPreview(): Promise<void> {
    try {
      const token = getAuthToken();
      if (!token) {
        console.error('No auth token found for blackboard preview');
        return;
      }

      const useV2Blackboard = window.FEATURE_FLAGS?.USE_API_V2_BLACKBOARD;
      let entries: BlackboardEntry[] = [];

      if (useV2Blackboard) {
        // Use apiClient for v2
        entries = (await apiClient.get<BlackboardEntry[]>('/blackboard?limit=3&sortBy=created_at&sortDir=DESC')) ?? [];
      } else {
        // Use v1 API
        const response = await fetch('/api/blackboard/entries?limit=3&sortBy=created_at&sortOrder=DESC', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          if (response.status === 401) {
            console.error('Unauthorized access to blackboard');
          }
          throw new Error('Failed to load blackboard entries');
        }

        const data = await response.json();
        entries = data.entries ?? [];
      }

      const previewContainer = document.getElementById('blackboard-preview');
      if (!previewContainer) return;

      // Clear loading placeholder
      previewContainer.innerHTML = '';

      if (entries.length === 0) {
        // Empty state
        previewContainer.innerHTML = `
          <div class="blackboard-empty-state">
            <i class="fas fa-clipboard"></i>
            <p>Keine Einträge vorhanden</p>
          </div>
        `;
        return;
      }

      // Render entries
      const entriesHtml = entries
        .map(
          (entry: {
            id: number;
            title: string;
            priority?: string;
            priorityLevel?: string;
            created_at?: string;
            createdAt?: string;
          }) => {
            // Handle v1 vs v2 field names
            const priority = entry.priority ?? entry.priorityLevel ?? 'normal';
            const createdAt = entry.created_at ?? entry.createdAt ?? '';

            const priorityClass = `priority-${priority}`;
            const priorityLabel = getPriorityLabel(priority);
            const createdDate = new Date(createdAt).toLocaleDateString('de-DE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            });

            return `
          <div class="list-item" onclick="window.location.href = "/blackboard"">
            <div class="list-item-content">
              <div class="list-item-title">${entry.title}</div>
              <div class="list-item-meta">
                <span class="priority-badge ${priorityClass}">${priorityLabel}</span>
                <span>${createdDate}</span>
              </div>
            </div>
          </div>
        `;
          },
        )
        .join('');

      previewContainer.innerHTML = entriesHtml;
    } catch (error) {
      console.error('Error loading blackboard preview:', error);

      const previewContainer = document.getElementById('blackboard-preview');
      if (previewContainer) {
        previewContainer.innerHTML = `
          <div class="blackboard-empty-state">
            <i class="fas fa-exclamation-triangle"></i>
            <p>Fehler beim Laden</p>
          </div>
        `;
      }
    }
  }

  // Hilfsfunktion für Priority Labels
  function getPriorityLabel(priority: string): string {
    const labels: Record<string, string> = {
      urgent: 'Dringend',
      high: 'Hoch',
      normal: 'Normal',
      low: 'Niedrig',
    };
    return labels[priority] ?? 'Normal';
  }

  // Load Blackboard Widget - zeigt die neuesten Einträge mit Anhängen
  async function loadBlackboardWidget(): Promise<void> {
    console.log('[BlackboardWidget] Starting to load widget...');
    try {
      const token = getAuthToken();
      if (!token) {
        console.error('[BlackboardWidget] No auth token found');
        return;
      }
      console.log('[BlackboardWidget] Token found, fetching entries...');

      const useV2Blackboard = window.FEATURE_FLAGS?.USE_API_V2_BLACKBOARD;
      let entries: BlackboardEntry[] = [];

      if (useV2Blackboard) {
        // Use apiClient for v2
        entries = (await apiClient.get<BlackboardEntry[]>('/blackboard/dashboard?limit=3')) ?? [];
        console.log('[BlackboardWidget] V2 API Response - entries:', entries);
      } else {
        // Use v1 API
        const response = await fetch('/api/blackboard/dashboard?limit=3', {
          headers: { Authorization: `Bearer ${token}` },
        });

        console.log('[BlackboardWidget] Response status:', response.status);

        if (!response.ok) {
          if (response.status === 401) {
            console.error('Unauthorized access to blackboard');
          }
          throw new Error('Failed to load blackboard entries');
        }

        entries = await response.json();
      }

      const containerElement = document.getElementById('blackboard-widget-container');
      if (!containerElement) {
        console.error('[BlackboardWidget] Container element not found: blackboard-widget-container');
        return;
      }
      console.log('[BlackboardWidget] Container element found:', containerElement);

      // Create the widget structure
      containerElement.innerHTML = `
        <div class="blackboard-widget">
          <div class="blackboard-widget-header">
            <h3 class="blackboard-widget-title">
              <i class="fas fa-thumbtack"></i>
              Schwarzes Brett
            </h3>
            <a href="/blackboard" class="blackboard-widget-link">
              Alle anzeigen <i class="fas fa-arrow-right"></i>
            </a>
          </div>
          <div id="blackboard-widget-content">
            <div class="blackboard-widget-loading">
              <i class="fas fa-spinner fa-spin"></i>
              <p>Lade Einträge...</p>
            </div>
          </div>
        </div>
      `;

      const widgetContent = document.getElementById('blackboard-widget-content');
      if (!widgetContent) return;
      console.log('[BlackboardWidget] API Response - entries array:', entries);
      console.log('[BlackboardWidget] Number of entries:', entries.length);
      console.log('[BlackboardWidget] First entry (if any):', entries[0]);

      // Clear loading placeholder
      widgetContent.innerHTML = '';

      if (entries.length === 0) {
        console.log('[BlackboardWidget] No entries found, showing empty state');
        // Empty state
        widgetContent.innerHTML = `
          <div class="blackboard-empty-state">
            <i class="fas fa-clipboard"></i>
            <p>Keine Einträge vorhanden</p>
          </div>
        `;
        return;
      }

      // Create mini-notes container
      const miniNotesContainer = document.createElement('div');
      miniNotesContainer.className = 'mini-notes-container';

      console.log('[BlackboardWidget] Creating mini-notes for entries...');

      // Render entries as mini-notes
      entries.forEach((entry: BlackboardEntry, index: number) => {
        console.log(`[BlackboardWidget] Processing entry ${index + 1}:`, entry);

        const noteDiv = document.createElement('div');
        const colorClass = entry.color ?? 'white';
        const hasAttachment = entry.attachments && entry.attachments.length > 0;
        noteDiv.className = `mini-note ${colorClass}${hasAttachment ? ' has-attachment' : ''}`;
        noteDiv.id = `mini-note-${entry.id}`;

        let attachmentHtml = '';
        if (hasAttachment && entry.attachments?.[0]) {
          const attachment = entry.attachments[0];
          // Handle v2 API path for attachments
          const attachmentPath = useV2Blackboard
            ? `/api/v2/blackboard/attachments/${attachment.id}`
            : `/api/blackboard/attachments/${attachment.id}/preview`;

          if (attachment.mime_type === 'application/pdf') {
            // PDF preview - using new approach with scaling
            attachmentHtml = `
              <div class="mini-note-attachment" style="position: relative; height: 220px; background: #f5f5f5; border-radius: 4px; overflow: hidden;">
                <div style="transform: scale(0.15); transform-origin: top left; width: ${100 / 0.15}%; height: ${100 / 0.15}%;">
                  <object data="${attachmentPath}#toolbar=0&navpanes=0&scrollbar=0&view=FitH" 
                          type="application/pdf" 
                          style="width: 100%; height: 100%; pointer-events: none;">
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #666;">
                      <i class="fas fa-file-pdf" style="font-size: 32px; color: #dc3545; margin-bottom: 5px;"></i>
                      <div style="font-size: 10px;">PDF-Dokument</div>
                    </div>
                  </object>
                </div>
              </div>
            `;
          } else if (attachment.mime_type.startsWith('image/')) {
            // Image preview
            attachmentHtml = `
              <div class="mini-note-attachment">
                <img src="${attachmentPath}" 
                     alt="${attachment.original_name}" 
                     style="width: 100%; height: auto; max-height: 120px; object-fit: cover; border-radius: 4px;"
                     loading="lazy"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div style="display: none; flex-direction: column; align-items: center; justify-content: center; height: 80px; color: #666;">
                  <i class="fas fa-image" style="font-size: 24px; margin-bottom: 5px;"></i>
                  <span style="font-size: 10px;">Bild</span>
                </div>
              </div>
            `;
          }
        }

        // Handle v1 vs v2 field names
        const createdAt = entry.created_at ?? entry.createdAt ?? '';
        const priorityLevel = entry.priority_level ?? entry.priorityLevel ?? 'normal';

        const createdDate = new Date(createdAt);
        const dateStr = createdDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

        noteDiv.innerHTML = `
          <div class="mini-pushpin"></div>
          <div class="mini-note-title">${entry.title}</div>
          ${attachmentHtml}
          <div class="mini-note-meta">
            <span class="mini-note-priority">
              <span class="priority-dot ${priorityLevel}"></span>
              ${getPriorityLabel(priorityLevel)}
            </span>
            <span>${dateStr}</span>
          </div>
        `;

        noteDiv.onclick = () => {
          window.location.href = '/blackboard';
        };

        miniNotesContainer.appendChild(noteDiv);
      });

      widgetContent.appendChild(miniNotesContainer);
      console.log('[BlackboardWidget] Mini-notes container appended to widget content');

      // Add widget loaded class
      const widget = containerElement.querySelector('.blackboard-widget');
      if (widget) {
        widget.classList.add('loaded');
        console.log('[BlackboardWidget] Widget marked as loaded');
      }
    } catch (error) {
      console.error('[BlackboardWidget] Error loading widget:', error);

      const widgetContent = document.getElementById('blackboard-widget-content');
      if (widgetContent) {
        widgetContent.innerHTML = `
          <div class="blackboard-empty-state">
            <i class="fas fa-exclamation-triangle"></i>
            <p>Fehler beim Laden</p>
          </div>
        `;
      }
    }
  }

  // Create Employee
  async function createEmployee(e: Event): Promise<void> {
    e.preventDefault();

    if (!createEmployeeForm) return;

    const formData = new FormData(createEmployeeForm);
    const employeeData = Object.fromEntries(formData.entries()) as unknown as EmployeeFormData;

    // E-Mail-Übereinstimmung prüfen
    const emailError = document.getElementById('email-error');
    if (employeeData.email !== employeeData.email_confirm) {
      if (emailError) emailError.style.display = 'block';

      alert('Die E-Mail-Adressen stimmen nicht überein');
      return;
    } else {
      if (emailError) emailError.style.display = 'none';
    }

    // Passwort-Übereinstimmung prüfen
    const passwordError = document.getElementById('password-error');
    if (employeeData.password !== employeeData.password_confirm) {
      if (passwordError) passwordError.style.display = 'block';

      alert('Die Passwörter stimmen nicht überein');
      return;
    } else {
      if (passwordError) passwordError.style.display = 'none';
    }

    try {
      const useV2Users = window.FEATURE_FLAGS?.USE_API_V2_USERS;
      let response: Response | { success: boolean; error?: string; data?: User };

      const userData = {
        username: employeeData.email.split('@')[0], // Generate username from email
        email: employeeData.email,
        password: employeeData.password,
        first_name: employeeData.first_name,
        last_name: employeeData.last_name,
        employee_id: employeeData.employee_id,
        department_id: employeeData.department_id ? parseInt(employeeData.department_id) : null,
        phone: employeeData.phone ?? '',
        birth_date: employeeData.birth_date ?? null,
        start_date: employeeData.start_date ?? null,
        street: employeeData.street ?? '',
        house_number: employeeData.house_number ?? '',
        postal_code: employeeData.postal_code ?? '',
        city: employeeData.city ?? '',
        role: 'employee', // Explicitly set role for v2 API
      };

      if (useV2Users) {
        // Use apiClient for v2 - convert snake_case to camelCase
        const v2UserData = {
          username: userData.username,
          email: userData.email,
          password: userData.password,
          firstName: userData.first_name,
          lastName: userData.last_name,
          employeeId: userData.employee_id,
          departmentId: userData.department_id,
          phone: userData.phone,
          birthDate: userData.birth_date,
          startDate: userData.start_date,
          street: userData.street,
          houseNumber: userData.house_number,
          postalCode: userData.postal_code,
          city: userData.city,
          role: userData.role,
        };

        try {
          response = await apiClient.post('/users', v2UserData);
        } catch (error) {
          response = { success: false, error: (error as Error).message ?? 'Failed to create employee' };
        }
      } else {
        // Use v1 API
        response = await fetch('/api/admin/employees', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(userData),
        });
      }

      const isSuccess = useV2Users ? (response as { success: boolean }).success : (response as Response).ok;

      if (isSuccess) {
        showSuccess('Mitarbeiter erfolgreich erstellt!');
        createEmployeeForm.reset();

        // Modal schließen
        const modal = document.getElementById('employee-modal');
        if (modal) modal.style.display = 'none';

        // Listen neu laden
        void loadRecentEmployees();
        void loadDashboardStats();

        // Seite neu laden für komplette Aktualisierung
        setTimeout(() => {
          window.location.reload();
        }, 1000); // Kurze Verzögerung damit die Erfolgsmeldung noch sichtbar ist
      } else {
        let errorMessage: string;
        if (useV2Users) {
          errorMessage = (response as { error?: string }).error ?? 'Fehler beim Erstellen des Mitarbeiters';
        } else {
          const error = await (response as Response).json();
          errorMessage = error.message ?? 'Fehler beim Erstellen des Mitarbeiters';
        }
        showError(errorMessage);
      }
    } catch (error) {
      console.error('Fehler beim Erstellen des Mitarbeiters:', error);
      showError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    }
  }

  // loadHeaderUserInfo function removed - handled by unified-navigation.ts

  // Logout function - DISABLED: Handled by unified-navigation.ts
  // async function logout(): Promise<void> {
  //   if (confirm('Möchten Sie sich wirklich abmelden?')) {
  //     // Import and use the logout function from auth module
  //     const { logout: authLogout } = await import('./auth.js');
  //     await authLogout();
  //   }
  // }

  // Placeholder functions - to be implemented
  async function loadRecentEmployees(): Promise<void> {
    try {
      const token = getAuthToken();
      const useV2Users = window.FEATURE_FLAGS?.USE_API_V2_USERS;
      let employees: User[] = [];

      if (useV2Users) {
        // Use apiClient for v2
        employees = (await apiClient.get<User[]>('/users?role=employee&limit=5')) ?? [];
      } else {
        // Use v1 API
        const response = await fetch('/api/users?role=employee&limit=5', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to load recent employees');
        }

        const data = await response.json();
        employees = Array.isArray(data) ? data : (data.users ?? data.employees ?? []);
      }

      // Fill compact card
      const employeeCard = document.getElementById('recent-employees');
      if (employeeCard) {
        employeeCard.innerHTML = '';

        if (!employees || employees.length === 0) {
          employeeCard.innerHTML = '<p class="text-muted">Keine neuen Mitarbeiter</p>';
        } else {
          employees.slice(0, 5).forEach((emp: User) => {
            const item = document.createElement('div');
            item.className = 'compact-item';
            item.innerHTML = `
              <span class="compact-item-name">${emp.first_name} ${emp.last_name}</span>
              <span class="compact-item-count">${emp.position ?? 'Mitarbeiter'}</span>
            `;
            employeeCard.appendChild(item);
          });
        }
      }

      // Also fill detailed list if it exists
      const employeeDetailList = document.getElementById('recent-employees-list');
      if (employeeDetailList) {
        employeeDetailList.innerHTML = '';

        if (!employees || employees.length === 0) {
          employeeDetailList.innerHTML = '<li class="text-muted">Keine neuen Mitarbeiter</li>';
        } else {
          employees.slice(0, 10).forEach((emp: User) => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
              <strong>${emp.first_name} ${emp.last_name}</strong> - ${emp.position ?? 'Mitarbeiter'}
              <span class="text-muted">(${emp.department ?? 'Keine Abteilung'})</span>
            `;
            employeeDetailList.appendChild(listItem);
          });
        }
      }
    } catch (error) {
      console.error('Error loading recent employees:', error);
    }
  }

  async function loadRecentDocuments(): Promise<void> {
    try {
      const token = getAuthToken();
      const useV2Documents = window.FEATURE_FLAGS?.USE_API_V2_DOCUMENTS;
      let documents: Document[] = [];

      if (useV2Documents) {
        // Use apiClient for v2
        documents = (await apiClient.get<Document[]>('/documents?limit=5')) ?? [];
      } else {
        // Use v1 API
        const response = await fetch('/api/documents?limit=5', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to load recent documents');
        }

        const data = await response.json();
        documents = Array.isArray(data)
          ? data
          : data.documents
            ? Array.isArray(data.documents)
              ? data.documents
              : []
            : data.data?.documents
              ? Array.isArray(data.data.documents)
                ? data.data.documents
                : []
              : [];
      }

      // Fill compact card
      const documentCard = document.getElementById('recent-documents');
      if (documentCard) {
        documentCard.innerHTML = '';

        if (!documents || documents.length === 0) {
          documentCard.innerHTML = '<p class="text-muted">Keine neuen Dokumente</p>';
        } else {
          documents.slice(0, 5).forEach((doc: Document & { fileName?: string; createdAt?: string }) => {
            const item = document.createElement('div');
            item.className = 'compact-item';
            // Handle v1 vs v2 field names
            const fileName = doc.file_name ?? doc.fileName ?? 'Unknown';
            const createdAt = doc.created_at ?? doc.createdAt ?? '';
            const uploadDate = new Date(createdAt).toLocaleDateString('de-DE');
            item.innerHTML = `
              <span class="compact-item-name">${fileName}</span>
              <span class="compact-item-count">${uploadDate}</span>
            `;
            documentCard.appendChild(item);
          });
        }
      }

      // Also fill detailed list if it exists
      const documentDetailList = document.getElementById('recent-documents-list');
      if (documentDetailList) {
        documentDetailList.innerHTML = '';

        if (!documents || documents.length === 0) {
          documentDetailList.innerHTML = '<li class="text-muted">Keine neuen Dokumente</li>';
        } else {
          documents.slice(0, 10).forEach((doc: Document & { fileName?: string; createdAt?: string }) => {
            const listItem = document.createElement('li');
            // Handle v1 vs v2 field names
            const fileName = doc.file_name ?? doc.fileName ?? 'Unknown';
            const createdAt = doc.created_at ?? doc.createdAt ?? '';
            const uploadDate = new Date(createdAt).toLocaleDateString('de-DE');
            listItem.innerHTML = `
              <strong>${fileName}</strong> - ${doc.category || 'Allgemein'}
              <span class="text-muted">(${uploadDate})</span>
            `;
            documentDetailList.appendChild(listItem);
          });
        }
      }
    } catch (error) {
      console.error('Error loading recent documents:', error);
    }
  }

  async function loadDepartments(): Promise<void> {
    try {
      const token = getAuthToken();
      const useV2Departments = window.FEATURE_FLAGS?.USE_API_V2_DEPARTMENTS;
      const apiPath = useV2Departments ? '/api/v2/departments' : '/api/departments';

      const response = await fetch(apiPath, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load departments');
      }

      const responseData = await response.json();

      // Handle v2 response format which wraps data
      const departments = useV2Departments && responseData.data ? responseData.data : responseData;

      const departmentList = document.getElementById('department-list');

      if (!departmentList) return;

      departmentList.innerHTML = '';

      if (!Array.isArray(departments) || departments.length === 0) {
        departmentList.innerHTML = '<p class="text-muted">Keine Abteilungen vorhanden</p>';
        return;
      }

      departments
        .slice(0, 5)
        .forEach((dept: { id: number; name: string; description?: string | { type: string; data: number[] } }) => {
          // Convert Buffer to String if needed
          let description = '';
          if (dept.description) {
            if (
              typeof dept.description === 'object' &&
              dept.description !== null &&
              'type' in dept.description &&
              dept.description.type === 'Buffer' &&
              'data' in dept.description &&
              Array.isArray(dept.description.data)
            ) {
              description = String.fromCharCode(...dept.description.data);
            } else if (typeof dept.description === 'string') {
              description = dept.description;
            }
          }

          const item = document.createElement('div');
          item.className = 'compact-item';
          item.innerHTML = `
          <span class="compact-item-name">${dept.name}</span>
          <span class="compact-item-count">${description}</span>
        `;
          departmentList.appendChild(item);
        });
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  }

  async function loadTeams(): Promise<void> {
    try {
      const token = getAuthToken();
      const useV2Teams = window.FEATURE_FLAGS?.USE_API_V2_TEAMS;
      let teams: Team[] = [];

      if (useV2Teams) {
        // Use apiClient for v2
        teams = (await apiClient.get<Team[]>('/teams')) ?? [];
      } else {
        // Use v1 API
        const response = await fetch('/api/teams', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to load teams');
        }

        teams = await response.json();
      }
      const teamList = document.getElementById('team-list');

      if (!teamList) return;

      teamList.innerHTML = '';

      if (teams.length === 0) {
        teamList.innerHTML = '<p class="text-muted">Keine Teams vorhanden</p>';
        return;
      }

      teams.slice(0, 5).forEach((team: Team & { departmentName?: string }) => {
        const item = document.createElement('div');
        item.className = 'compact-item';
        // Handle v1 vs v2 field names
        const departmentName = team.department_name ?? team.departmentName ?? '';
        item.innerHTML = `
          <span class="compact-item-name">${team.name}</span>
          <span class="compact-item-count">${departmentName}</span>
        `;
        teamList.appendChild(item);
      });
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  }

  // Note: loadDepartmentsForEmployeeSelect is now defined globally above

  async function createDepartment(e: Event): Promise<void> {
    e.preventDefault();

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    const departmentData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      status: (formData.get('status') as string) ?? 'active',
      visibility: (formData.get('visibility') as string) ?? 'public',
    };

    try {
      const token = getAuthToken();
      const useV2Departments = window.FEATURE_FLAGS?.USE_API_V2_DEPARTMENTS;

      if (useV2Departments) {
        // Use apiClient for v2
        try {
          await apiClient.post('/departments', departmentData);
          showSuccess('Abteilung erfolgreich erstellt');
        } catch (error) {
          throw new Error((error as Error).message ?? 'Failed to create department');
        }
      } else {
        // Use v1 API
        const apiPath = window.FEATURE_FLAGS?.USE_API_V2_DEPARTMENTS ? '/api/v2/departments' : '/api/departments';
        const response = await fetch(apiPath, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(departmentData),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message ?? 'Failed to create department');
        }

        await response.json();
        showSuccess('Abteilung erfolgreich erstellt');
      }

      // Reset form and close modal
      form.reset();
      const modal = document.getElementById('department-modal');
      if (modal) modal.style.display = 'none';

      // Reload departments
      await loadDepartments();
      await loadDepartmentsForEmployeeSelect();
    } catch (error) {
      console.error('Error creating department:', error);
      showError(`Fehler beim Erstellen der Abteilung: ${(error as Error).message}`);
    }
  }

  async function createTeam(e: Event): Promise<void> {
    e.preventDefault();

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    const teamData = {
      name: formData.get('name') as string,
      department_id: parseInt(formData.get('department_id') as string),
      description: formData.get('description') as string,
    };

    try {
      const token = getAuthToken();
      const useV2Teams = window.FEATURE_FLAGS?.USE_API_V2_TEAMS;

      if (useV2Teams) {
        // Use apiClient for v2 - convert to camelCase
        const v2TeamData = {
          name: teamData.name,
          departmentId: teamData.department_id,
          description: teamData.description,
        };

        try {
          await apiClient.post('/teams', v2TeamData);
          showSuccess('Team erfolgreich erstellt');
        } catch (error) {
          throw new Error((error as Error).message ?? 'Failed to create team');
        }
      } else {
        // Use v1 API
        const response = await fetch('/api/teams', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(teamData),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message ?? 'Failed to create team');
        }

        await response.json();
        showSuccess('Team erfolgreich erstellt');
      }

      // Reset form and close modal
      form.reset();
      const modal = document.getElementById('team-modal');
      if (modal) modal.style.display = 'none';

      // Reload teams
      await loadTeams();
    } catch (error) {
      console.error('Error creating team:', error);
      showError(`Fehler beim Erstellen des Teams: ${(error as Error).message}`);
    }
  }
});

// Extend window for admin dashboard functions
declare global {
  interface Window {
    showNewEmployeeModal: typeof showNewEmployeeModal;
    loadDepartmentsForEmployeeSelect: typeof loadDepartmentsForEmployeeSelect;
    showSection: typeof showSection;
    selectDropdownOption?: (dropdownName: string, value: string, label: string) => void;
    loadRecentEmployees?: () => Promise<void>;
    loadDashboardStats?: () => Promise<void>;
    loadEmployeesTable?: () => Promise<void>;
    // hideModal is declared in modal-manager.ts
  }
}

// Export functions to window for backwards compatibility
if (typeof window !== 'undefined') {
  window.showNewEmployeeModal = showNewEmployeeModal;
  window.loadDepartmentsForEmployeeSelect = loadDepartmentsForEmployeeSelect;
  window.showSection = showSection;

  // Export the async functions that are defined inside DOMContentLoaded
  // We need to wait for DOMContentLoaded to ensure they're defined
  document.addEventListener('DOMContentLoaded', () => {
    // These functions will be available after the main DOMContentLoaded handler runs
    setTimeout(() => {
      const adminDashboard = document.querySelector('#dashboard-section');
      if (adminDashboard) {
        // Export loadRecentEmployees and loadDashboardStats if they exist
        // They're defined in the DOMContentLoaded handler
      }
    }, 100);
  });
}

// Export loadBlackboardWidget to window for debugging
if (typeof window !== 'undefined') {
  (window as Window & { debugLoadBlackboardWidget?: () => void }).debugLoadBlackboardWidget = () => {
    console.log('[Debug] Manual loadBlackboardWidget call');
  };
}
