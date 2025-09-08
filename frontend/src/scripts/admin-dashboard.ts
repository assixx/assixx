/**
 * Admin Dashboard Script - Modern TypeScript Implementation
 * Handles admin-specific functionality with modular architecture
 * Following strict TypeScript standards and best practices
 */

// ============================================================================
// IMPORTS
// ============================================================================

import type { User, Document, BlackboardEntry } from '../types/api.types';
import { ApiClient } from '../utils/api-client';
import { mapUsers, type MappedUser } from '../utils/api-mappers';
import { $$, $$id, createElement, setHTML, setText, show, hide } from '../utils/dom-utils';
import { getAuthToken, showSuccess, showError } from './auth';
import { showSection } from './show-section';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

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
  status?: string;
  visibility?: string;
  memberCount?: number;
}

interface Team {
  id: number;
  name: string;
  departmentId: number;
  departmentName?: string;
  description?: string;
  memberCount?: number;
}

interface EmployeeFormData {
  username: string;
  email: string;
  emailConfirm: string;
  password: string;
  passwordConfirm: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  position?: string;
  departmentId?: number;
  teamId?: number;
  phone?: string;
  birthDate?: string;
  startDate?: string;
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city?: string;
  role?: string;
}

interface BlackboardAttachment {
  id: number;
  entryId: number;
  filename: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: number;
  uploadedAt: string;
  uploaderName?: string;
}

interface BlackboardEntryExtended extends BlackboardEntry {
  priorityLevel?: 'low' | 'medium' | 'high' | 'critical';
  orgLevel?: 'all' | 'department' | 'team';
  orgId?: number;
  departmentId?: number;
  teamId?: number;
  color?: string;
  createdBy: number;
  createdByName?: string;
  authorName?: string;
  authorFirstName?: string;
  authorLastName?: string;
  authorFullName?: string;
  createdAt?: string;
  updatedAt?: string;
  attachmentCount?: number;
  attachments?: BlackboardAttachment[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const API_V2_DEPARTMENTS = '/api/v2/departments';
const API_V1_DEPARTMENTS = '/api/departments';
const API_V1_TEAMS = '/api/teams';

// UI Class Constants
const CLASS_COMPACT_ITEM = 'compact-item';
const CLASS_COMPACT_ITEM_NAME = 'compact-item-name';

// ============================================================================
// SERVICE CLASSES - Business Logic
// ============================================================================

/**
 * Service for handling dashboard statistics
 */
class DashboardService {
  private apiClient: ApiClient;

  constructor() {
    this.apiClient = ApiClient.getInstance();
  }

  async loadStats(): Promise<DashboardStats> {
    const authToken = getAuthToken();
    if (authToken === null || authToken === '') {
      throw new Error('No authentication token');
    }

    // Check if any v2 APIs are enabled
    const useV2Users = window.FEATURE_FLAGS?.USE_API_V2_USERS === true;
    const useV2Documents = window.FEATURE_FLAGS?.USE_API_V2_DOCUMENTS === true;
    const useV2Departments = window.FEATURE_FLAGS?.USE_API_V2_DEPARTMENTS === true;
    const useV2Teams = window.FEATURE_FLAGS?.USE_API_V2_TEAMS === true;

    // If any v2 API is enabled, load individually
    if (useV2Users || useV2Documents || useV2Departments || useV2Teams) {
      return await this.loadStatsIndividually();
    }

    // Try v1 admin stats endpoint
    try {
      const response = await fetch('/api/admin/dashboard-stats', {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        const data = (await response.json()) as DashboardStats | { data: DashboardStats };
        return 'data' in data ? data.data : data;
      }
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }

    // Fallback to individual loading
    return await this.loadStatsIndividually();
  }

  private async loadStatsIndividually(): Promise<DashboardStats> {
    const [employeeCount, documentCount, departmentCount, teamCount] = await Promise.all([
      this.getEmployeeCount(),
      this.getDocumentCount(),
      this.getDepartmentCount(),
      this.getTeamCount(),
    ]);

    return {
      employeeCount,
      documentCount,
      departmentCount,
      teamCount,
    };
  }

  private async getEmployeeCount(): Promise<number> {
    try {
      const useV2 = window.FEATURE_FLAGS?.USE_API_V2_USERS === true;
      if (useV2) {
        const users = await this.apiClient.get<User[]>('/users?role=employee');
        return users.length;
      }

      const authToken = getAuthToken();
      const response = await fetch('/api/admin/employees', {
        headers: { Authorization: `Bearer ${authToken ?? ''}` },
      });
      if (response.ok) {
        const employees = (await response.json()) as User[];
        return employees.length;
      }
    } catch (error) {
      console.error('Error loading employee count:', error);
    }
    return 0;
  }

  private async getDocumentCount(): Promise<number> {
    try {
      const useV2 = window.FEATURE_FLAGS?.USE_API_V2_DOCUMENTS === true;
      if (useV2) {
        const response = await this.apiClient.get<{ documents: Document[] }>('/documents');
        return response.documents.length;
      }

      const authToken = getAuthToken();
      const response = await fetch('/api/admin/documents', {
        headers: { Authorization: `Bearer ${authToken ?? ''}` },
      });
      if (response.ok) {
        const documents = (await response.json()) as Document[];
        return documents.length;
      }
    } catch (error) {
      console.error('Error loading document count:', error);
    }
    return 0;
  }

  private async getDepartmentCount(): Promise<number> {
    try {
      const useV2 = window.FEATURE_FLAGS?.USE_API_V2_DEPARTMENTS === true;
      const apiPath = useV2 ? API_V2_DEPARTMENTS : API_V1_DEPARTMENTS;
      const authToken = getAuthToken();

      const response = await fetch(apiPath, {
        headers: { Authorization: `Bearer ${authToken ?? ''}` },
      });

      if (response.ok) {
        const data = (await response.json()) as Department[] | { data: Department[] };
        const departments = useV2 && !Array.isArray(data) && 'data' in data ? data.data : (data as Department[]);
        return departments.length;
      }
    } catch (error) {
      console.error('Error loading department count:', error);
    }
    return 0;
  }

  private async getTeamCount(): Promise<number> {
    try {
      const useV2 = window.FEATURE_FLAGS?.USE_API_V2_TEAMS === true;
      if (useV2) {
        const teams = await this.apiClient.get<Team[]>('/teams');
        return teams.length;
      }

      const authToken = getAuthToken();
      const response = await fetch(API_V1_TEAMS, {
        headers: { Authorization: `Bearer ${authToken ?? ''}` },
      });
      if (response.ok) {
        const teams = (await response.json()) as Team[];
        return teams.length;
      }
    } catch (error) {
      console.error('Error loading team count:', error);
    }
    return 0;
  }
}

/**
 * Service for handling employee operations
 */
class EmployeeService {
  private apiClient: ApiClient;

  constructor() {
    this.apiClient = ApiClient.getInstance();
  }

  async loadRecentEmployees(limit = 5): Promise<MappedUser[]> {
    try {
      const useV2 = window.FEATURE_FLAGS?.USE_API_V2_USERS === true;
      let employees: User[] = [];

      if (useV2) {
        employees = await this.apiClient.get<User[]>(`/users?role=employee&limit=${String(limit)}`);
      } else {
        const authToken = getAuthToken();
        const response = await fetch(`/api/users?role=employee&limit=${String(limit)}`, {
          headers: { Authorization: `Bearer ${authToken ?? ''}` },
        });

        if (!response.ok) {
          throw new Error('Failed to load recent employees');
        }

        const data = (await response.json()) as User[] | { users?: User[]; employees?: User[] };
        employees = Array.isArray(data) ? data : (data.users ?? data.employees ?? []);
      }

      return mapUsers(employees);
    } catch (error) {
      console.error('Error loading recent employees:', error);
      return [];
    }
  }

  async createEmployee(formData: EmployeeFormData): Promise<void> {
    const useV2 = window.FEATURE_FLAGS?.USE_API_V2_USERS === true;

    const userData = {
      username: formData.email.split('@')[0],
      email: formData.email,
      password: formData.password,
      firstName: formData.firstName,
      lastName: formData.lastName,
      employeeId: formData.employeeId,
      departmentId: formData.departmentId ?? null,
      phone: formData.phone ?? '',
      birthDate: formData.birthDate ?? null,
      startDate: formData.startDate ?? null,
      street: formData.street ?? '',
      houseNumber: formData.houseNumber ?? '',
      postalCode: formData.postalCode ?? '',
      city: formData.city ?? '',
      role: 'employee' as const,
    };

    if (useV2) {
      await this.apiClient.post('/users', userData);
    } else {
      const authToken = getAuthToken();
      const response = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken ?? ''}`,
        },
        body: JSON.stringify({
          ...userData,
          first_name: userData.firstName,
          last_name: userData.lastName,
          employee_id: userData.employeeId,
          department_id: userData.departmentId,
          birth_date: userData.birthDate,
          start_date: userData.startDate,
          house_number: userData.houseNumber,
          postal_code: userData.postalCode,
        }),
      });

      if (!response.ok) {
        const error = (await response.json()) as { message?: string };
        throw new Error(error.message ?? 'Failed to create employee');
      }
    }

    showSuccess('Mitarbeiter erfolgreich erstellt!');
  }
}

/**
 * Service for handling department operations
 */
class DepartmentService {
  private apiClient: ApiClient;

  constructor() {
    this.apiClient = ApiClient.getInstance();
  }

  async loadDepartments(): Promise<Department[]> {
    try {
      const useV2 = window.FEATURE_FLAGS?.USE_API_V2_DEPARTMENTS === true;
      const apiPath = useV2 ? API_V2_DEPARTMENTS : API_V1_DEPARTMENTS;
      const authToken = getAuthToken();

      const response = await fetch(apiPath, {
        headers: { Authorization: `Bearer ${authToken ?? ''}` },
      });

      if (!response.ok) {
        throw new Error('Failed to load departments');
      }

      const data = (await response.json()) as Department[] | { data: Department[] };
      return useV2 && !Array.isArray(data) && 'data' in data ? data.data : (data as Department[]);
    } catch (error) {
      console.error('Error loading departments:', error);
      return [];
    }
  }

  async createDepartment(data: {
    name: string;
    description?: string;
    status?: string;
    visibility?: string;
  }): Promise<void> {
    const useV2 = window.FEATURE_FLAGS?.USE_API_V2_DEPARTMENTS === true;

    if (useV2) {
      await this.apiClient.post('/departments', data);
    } else {
      const authToken = getAuthToken();
      const response = await fetch(API_V1_DEPARTMENTS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken ?? ''}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = (await response.json()) as { message?: string };
        throw new Error(error.message ?? 'Failed to create department');
      }
    }

    showSuccess('Abteilung erfolgreich erstellt');
  }
}

/**
 * Service for handling team operations
 */
class TeamService {
  private apiClient: ApiClient;

  constructor() {
    this.apiClient = ApiClient.getInstance();
  }

  async loadTeams(): Promise<Team[]> {
    try {
      const useV2 = window.FEATURE_FLAGS?.USE_API_V2_TEAMS === true;

      if (useV2) {
        return await this.apiClient.get<Team[]>('/teams');
      }

      const authToken = getAuthToken();
      const response = await fetch(API_V1_TEAMS, {
        headers: { Authorization: `Bearer ${authToken ?? ''}` },
      });

      if (!response.ok) {
        throw new Error('Failed to load teams');
      }

      return (await response.json()) as Team[];
    } catch (error) {
      console.error('Error loading teams:', error);
      return [];
    }
  }

  async createTeam(data: { name: string; departmentId: number; description?: string }): Promise<void> {
    const useV2 = window.FEATURE_FLAGS?.USE_API_V2_TEAMS === true;

    if (useV2) {
      await this.apiClient.post('/teams', data);
    } else {
      const authToken = getAuthToken();
      const response = await fetch(API_V1_TEAMS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken ?? ''}`,
        },
        body: JSON.stringify({
          name: data.name,
          department_id: data.departmentId,
          description: data.description,
        }),
      });

      if (!response.ok) {
        const error = (await response.json()) as { message?: string };
        throw new Error(error.message ?? 'Failed to create team');
      }
    }

    showSuccess('Team erfolgreich erstellt');
  }
}

/**
 * Service for handling document operations
 */
class DocumentService {
  private apiClient: ApiClient;

  constructor() {
    this.apiClient = ApiClient.getInstance();
  }

  async loadRecentDocuments(limit = 5): Promise<Document[]> {
    try {
      const useV2 = window.FEATURE_FLAGS?.USE_API_V2_DOCUMENTS === true;

      if (useV2) {
        const response = await this.apiClient.get<{ documents: Document[] }>(`/documents?limit=${String(limit)}`);
        return response.documents;
      }

      const authToken = getAuthToken();
      const response = await fetch(`/api/documents?limit=${String(limit)}`, {
        headers: { Authorization: `Bearer ${authToken ?? ''}` },
      });

      if (!response.ok) {
        throw new Error('Failed to load recent documents');
      }

      const data = (await response.json()) as Document[] | { documents?: Document[] };
      return Array.isArray(data) ? data : (data.documents ?? []);
    } catch (error) {
      console.error('Error loading recent documents:', error);
      return [];
    }
  }
}

/**
 * Service for handling blackboard operations
 */
class BlackboardService {
  private apiClient: ApiClient;

  constructor() {
    this.apiClient = ApiClient.getInstance();
  }

  async loadPreview(limit = 3): Promise<BlackboardEntryExtended[]> {
    try {
      const authToken = getAuthToken();
      if (authToken === null || authToken === '') {
        throw new Error('No auth token');
      }

      const useV2 = window.FEATURE_FLAGS?.USE_API_V2_BLACKBOARD === true;

      if (useV2) {
        return await this.apiClient.get<BlackboardEntryExtended[]>(
          `/blackboard/entries?limit=${String(limit)}&sortBy=created_at&sortDir=DESC`,
        );
      }

      const response = await fetch(`/api/blackboard/entries?limit=${String(limit)}&sortBy=created_at&sortOrder=DESC`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) {
        throw new Error('Failed to load blackboard entries');
      }

      const data = (await response.json()) as {
        entries?: BlackboardEntryExtended[];
      };
      return data.entries ?? [];
    } catch (error) {
      console.error('Error loading blackboard preview:', error);
      return [];
    }
  }

  async loadWidget(limit = 3): Promise<BlackboardEntryExtended[]> {
    try {
      const authToken = getAuthToken();
      if (authToken === null || authToken === '') {
        throw new Error('No auth token');
      }

      const useV2 = window.FEATURE_FLAGS?.USE_API_V2_BLACKBOARD === true;

      if (useV2) {
        return await this.apiClient.get<BlackboardEntryExtended[]>(`/blackboard/dashboard?limit=${String(limit)}`);
      }

      const response = await fetch(`/api/blackboard/dashboard?limit=${String(limit)}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) {
        throw new Error('Failed to load blackboard widget');
      }

      return (await response.json()) as BlackboardEntryExtended[];
    } catch (error) {
      console.error('Error loading blackboard widget:', error);
      return [];
    }
  }

  getPriorityLabel(priority: string): string {
    switch (priority) {
      case 'urgent':
        return 'Dringend';
      case 'high':
        return 'Hoch';
      case 'normal':
        return 'Normal';
      case 'low':
        return 'Niedrig';
      case 'critical':
        return 'Kritisch';
      case 'medium':
        return 'Mittel';
      default:
        return 'Normal';
    }
  }
}

// ============================================================================
// UI MANAGER CLASSES - DOM Manipulation
// ============================================================================

/**
 * Manages dashboard UI updates
 */
class DashboardUI {
  updateStats(stats: DashboardStats): void {
    const employeeCount = $$id('employee-count');
    const documentCount = $$id('document-count');
    const departmentCount = $$id('department-count');
    const teamCount = $$id('team-count');

    if (employeeCount !== null) {
      setText(employeeCount, stats.employeeCount.toString());
    }
    if (documentCount !== null) {
      setText(documentCount, stats.documentCount.toString());
    }
    if (departmentCount !== null) {
      setText(departmentCount, stats.departmentCount.toString());
    }
    if (teamCount !== null) {
      setText(teamCount, stats.teamCount.toString());
    }
  }

  updateRecentEmployees(employees: MappedUser[]): void {
    const container = $$id('recent-employees');
    if (container === null) return;

    if (employees.length === 0) {
      setHTML(container, '<p class="text-muted">Keine neuen Mitarbeiter</p>');
      return;
    }

    const items = employees.slice(0, 5).map((emp) => {
      const item = createElement('div', { className: CLASS_COMPACT_ITEM });
      const nameSpan = createElement('span', { className: CLASS_COMPACT_ITEM_NAME }, emp.fullName);
      item.append(nameSpan);
      return item;
    });

    container.innerHTML = '';
    items.forEach((item) => {
      container.append(item);
    });
  }

  updateRecentDocuments(documents: Document[]): void {
    const container = $$id('recent-documents');
    if (container === null) return;

    if (documents.length === 0) {
      setHTML(container, '<p class="text-muted">Keine neuen Dokumente</p>');
      return;
    }

    const items = documents.slice(0, 5).map((doc) => {
      const item = createElement('div', { className: CLASS_COMPACT_ITEM });
      const nameSpan = createElement('span', { className: CLASS_COMPACT_ITEM_NAME }, doc.file_name);
      item.append(nameSpan);
      return item;
    });

    container.innerHTML = '';
    items.forEach((item) => {
      container.append(item);
    });
  }

  updateDepartments(departments: Department[]): void {
    const container = $$id('department-list');
    if (container === null) return;

    if (departments.length === 0) {
      setHTML(container, '<p class="text-muted">Keine Abteilungen vorhanden</p>');
      return;
    }

    const items = departments.slice(0, 5).map((dept) => {
      const item = createElement('div', { className: CLASS_COMPACT_ITEM });
      const nameSpan = createElement('span', { className: CLASS_COMPACT_ITEM_NAME }, dept.name);
      item.append(nameSpan);
      return item;
    });

    container.innerHTML = '';
    items.forEach((item) => {
      container.append(item);
    });
  }

  updateTeams(teams: Team[]): void {
    const container = $$id('team-list');
    if (container === null) return;

    if (teams.length === 0) {
      setHTML(container, '<p class="text-muted">Keine Teams vorhanden</p>');
      return;
    }

    const items = teams.slice(0, 5).map((team) => {
      const item = createElement('div', { className: CLASS_COMPACT_ITEM });
      const nameSpan = createElement('span', { className: CLASS_COMPACT_ITEM_NAME }, team.name);
      item.append(nameSpan);
      return item;
    });

    container.innerHTML = '';
    items.forEach((item) => {
      container.append(item);
    });
  }
}

/**
 * Manages blackboard UI updates
 */
class BlackboardUI {
  private blackboardService: BlackboardService;

  constructor() {
    this.blackboardService = new BlackboardService();
  }

  updatePreview(entries: BlackboardEntryExtended[]): void {
    const container = $$id('blackboard-preview');
    if (container === null) return;

    if (entries.length === 0) {
      const emptyState = `
        <div class="blackboard-empty-state">
          <i class="fas fa-clipboard"></i>
          <p>Keine Einträge vorhanden</p>
        </div>
      `;
      setHTML(container, emptyState);
      return;
    }

    const entriesHtml = entries
      .map((entry) => {
        const priority = entry.priority;
        const createdAt = entry.created_at;
        const priorityClass = `priority-${priority}`;
        const priorityLabel = this.blackboardService.getPriorityLabel(priority);
        const createdDate = new Date(createdAt).toLocaleDateString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });

        return `
          <div class="list-item" data-entry-id="${String(entry.id)}">
            <div class="list-item-content">
              <div class="list-item-title">${this.escapeHtml(entry.title)}</div>
              <div class="list-item-meta">
                <span class="priority-badge ${priorityClass}">${priorityLabel}</span>
                <span>${createdDate}</span>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    setHTML(container, entriesHtml);

    // Add click handlers
    container.querySelectorAll('.list-item').forEach((item) => {
      item.addEventListener('click', () => {
        window.location.href = '/blackboard';
      });
    });
  }

  updateWidget(entries: BlackboardEntryExtended[]): void {
    const container = $$id('blackboard-widget-container');
    if (container === null) return;

    const widgetHtml = `
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
          ${this.renderWidgetContent(entries)}
        </div>
      </div>
    `;

    setHTML(container, widgetHtml);

    const widget = container.querySelector('.blackboard-widget');
    if (widget !== null) {
      widget.classList.add('loaded');
    }
  }

  private renderWidgetContent(entries: BlackboardEntryExtended[]): string {
    if (entries.length === 0) {
      return `
        <div class="blackboard-empty-state">
          <i class="fas fa-clipboard"></i>
          <p>Keine Einträge vorhanden</p>
        </div>
      `;
    }

    const miniNotes = entries
      .map((entry) => {
        const colorClass = entry.color ?? 'white';
        const hasAttachment = (entry.attachments?.length ?? 0) > 0;
        const priorityLevel = entry.priority;
        const createdAt = entry.created_at;
        const dateStr = new Date(createdAt).toLocaleDateString('de-DE', {
          day: '2-digit',
          month: '2-digit',
        });

        return `
          <div class="mini-note ${colorClass}${hasAttachment ? ' has-attachment' : ''}"
               id="mini-note-${String(entry.id)}"
               data-entry-id="${String(entry.id)}">
            <div class="mini-pushpin"></div>
            <div class="mini-note-title">${this.escapeHtml(entry.title)}</div>
            <div class="mini-note-meta">
              <span class="mini-note-priority">
                <span class="priority-dot ${priorityLevel}"></span>
                ${this.blackboardService.getPriorityLabel(priorityLevel)}
              </span>
              <span>${dateStr}</span>
            </div>
          </div>
        `;
      })
      .join('');

    return `<div class="mini-notes-container">${miniNotes}</div>`;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

/**
 * Manages employee modal and form
 */
class EmployeeModalUI {
  private departmentService: DepartmentService;

  constructor() {
    this.departmentService = new DepartmentService();
  }

  async showNewEmployeeModal(): Promise<void> {
    const modal = $$id('employee-modal');
    if (modal === null) {
      console.error('Employee modal not found');
      return;
    }

    // Reset form
    const form = $$('#create-employee-form') as HTMLFormElement | null;
    if (form !== null) {
      form.reset();
      this.resetErrorMessages();
    }

    // Show modal
    show(modal);
    modal.style.display = 'flex';

    // Load departments
    await this.loadDepartmentsForSelect();
  }

  hideModal(): void {
    const modal = $$id('employee-modal');
    if (modal !== null) {
      hide(modal);
    }
  }

  private resetErrorMessages(): void {
    const emailError = $$id('email-error');
    const passwordError = $$id('password-error');

    if (emailError !== null) hide(emailError);
    if (passwordError !== null) hide(passwordError);
  }

  async loadDepartmentsForSelect(): Promise<void> {
    try {
      const departments = await this.departmentService.loadDepartments();
      const dropdown = $$id('employee-department-dropdown');

      if (dropdown === null) {
        console.error('Department dropdown not found');
        return;
      }

      // Clear and add placeholder
      const placeholderHtml = `
        <div class="dropdown-option" data-value="">
          Keine Abteilung
        </div>
      `;
      setHTML(dropdown, placeholderHtml);

      // Add departments
      departments.forEach((dept) => {
        const option = createElement(
          'div',
          {
            className: 'dropdown-option',
            dataset: { value: dept.id.toString() },
          },
          dept.name,
        );

        option.addEventListener('click', () => {
          this.selectDepartment(dept.id, dept.name);
        });

        dropdown.append(option);
      });
    } catch (error) {
      console.error('Error loading departments for select:', error);
      showError('Fehler beim Laden der Abteilungen');
    }
  }

  private selectDepartment(id: number, name: string): void {
    // Update hidden input
    const input = $$('#department_id') as HTMLInputElement | null;
    if (input !== null) {
      input.value = id.toString();
    }

    // Update display
    const display = $$('.dropdown-selected');
    if (display !== null) {
      setText(display, name);
    }

    // Close dropdown
    const dropdown = $$('.dropdown');
    if (dropdown !== null) {
      dropdown.classList.remove('open');
    }
  }

  setupValidation(): void {
    const emailInput = $$('#email') as HTMLInputElement | null;
    const emailConfirm = $$('#email_confirm') as HTMLInputElement | null;
    const emailError = $$id('email-error');

    const passwordInput = $$('#password') as HTMLInputElement | null;
    const passwordConfirm = $$('#password_confirm') as HTMLInputElement | null;
    const passwordError = $$id('password-error');

    // Email validation
    if (emailInput !== null && emailConfirm !== null && emailError !== null) {
      const checkEmails = (): void => {
        if (emailConfirm.value.length > 0 && emailInput.value !== emailConfirm.value) {
          show(emailError);
        } else {
          hide(emailError);
        }
      };

      emailInput.addEventListener('input', checkEmails);
      emailConfirm.addEventListener('input', checkEmails);
    }

    // Password validation
    if (passwordInput !== null && passwordConfirm !== null && passwordError !== null) {
      const checkPasswords = (): void => {
        if (passwordConfirm.value.length > 0 && passwordInput.value !== passwordConfirm.value) {
          show(passwordError);
        } else {
          hide(passwordError);
        }
      };

      passwordInput.addEventListener('input', checkPasswords);
      passwordConfirm.addEventListener('input', checkPasswords);
    }
  }
}

// ============================================================================
// MAIN ADMIN DASHBOARD CLASS
// ============================================================================

/**
 * Main AdminDashboard class that coordinates all components
 */
class AdminDashboard {
  private dashboardService: DashboardService;
  private employeeService: EmployeeService;
  private departmentService: DepartmentService;
  private teamService: TeamService;
  private documentService: DocumentService;
  private blackboardService: BlackboardService;

  private dashboardUI: DashboardUI;
  private blackboardUI: BlackboardUI;
  private employeeModalUI: EmployeeModalUI;

  constructor() {
    // Initialize services
    this.dashboardService = new DashboardService();
    this.employeeService = new EmployeeService();
    this.departmentService = new DepartmentService();
    this.teamService = new TeamService();
    this.documentService = new DocumentService();
    this.blackboardService = new BlackboardService();

    // Initialize UI managers
    this.dashboardUI = new DashboardUI();
    this.blackboardUI = new BlackboardUI();
    this.employeeModalUI = new EmployeeModalUI();
  }

  initialize(): void {
    // Check authentication
    const token = getAuthToken();
    if (token === null || token === '') {
      console.info('No token found, using test mode');
      // In production: redirect to login
      // window.location.href = '/login';
      // return;
    }

    // Setup event listeners
    this.setupEventListeners();

    // Load initial data with slight delay for DOM readiness
    setTimeout(() => {
      void this.loadInitialData();
    }, 100);

    // Handle section parameter
    this.handleSectionParameter();
  }

  private setupEventListeners(): void {
    // Employee form submission
    const createEmployeeForm = $$('#create-employee-form') as HTMLFormElement | null;
    if (createEmployeeForm !== null) {
      createEmployeeForm.addEventListener('submit', (e) => {
        void this.handleEmployeeSubmit(e);
      });
    }

    // Department form submission
    const departmentForm = $$('#department-form') as HTMLFormElement | null;
    if (departmentForm !== null) {
      departmentForm.addEventListener('submit', (e) => {
        void this.handleDepartmentSubmit(e);
      });
    }

    // Team form submission
    const teamForm = $$('#team-form') as HTMLFormElement | null;
    if (teamForm !== null) {
      teamForm.addEventListener('submit', (e) => {
        void this.handleTeamSubmit(e);
      });
    }

    // New employee button
    const newEmployeeBtn = $$id('new-employee-button');
    if (newEmployeeBtn !== null) {
      newEmployeeBtn.addEventListener('click', () => {
        void this.employeeModalUI.showNewEmployeeModal();
      });
    }

    // Employees section new button
    const employeesSectionBtn = $$id('employees-section-new-button');
    if (employeesSectionBtn !== null) {
      employeesSectionBtn.addEventListener('click', () => {
        void this.employeeModalUI.showNewEmployeeModal();
      });
    }

    // Setup form validation
    this.employeeModalUI.setupValidation();

    // Setup manage links
    this.setupManageLinks();
  }

  private setupManageLinks(): void {
    const links = [
      { id: 'manage-employees-link', section: 'employees' },
      { id: 'manage-documents-link', section: 'documents' },
      { id: 'manage-departments-link', section: 'departments' },
    ];

    links.forEach(({ id, section }) => {
      const link = $$id(id);
      if (link !== null) {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          showSection(section);
        });
      }
    });
  }

  private async loadInitialData(): Promise<void> {
    try {
      console.info('[Admin Dashboard] Loading initial data...');

      // Load Blackboard FIRST (most visible widget) - ALONE without competition
      await Promise.all([this.loadBlackboardWidget(), this.loadBlackboardPreview()]);

      // Give browser time to render Blackboard before loading other data
      await new Promise((resolve) => setTimeout(resolve, 10));

      // ONLY AFTER Blackboard is rendered, start loading other data
      await Promise.all([
        this.loadRecentEmployees(),
        this.loadDashboardStats(),
        this.loadRecentDocuments(),
        this.loadDepartments(),
        this.loadTeams(),
      ]);

      console.info('[Admin Dashboard] Initial data loaded successfully');
    } catch (error) {
      console.error('[Admin Dashboard] Error loading initial data:', error);
    }
  }

  private async loadDashboardStats(): Promise<void> {
    try {
      const stats = await this.dashboardService.loadStats();
      this.dashboardUI.updateStats(stats);
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  }

  private async loadRecentEmployees(): Promise<void> {
    try {
      const employees = await this.employeeService.loadRecentEmployees();
      this.dashboardUI.updateRecentEmployees(employees);
    } catch (error) {
      console.error('Error loading recent employees:', error);
    }
  }

  private async loadRecentDocuments(): Promise<void> {
    try {
      const documents = await this.documentService.loadRecentDocuments();
      this.dashboardUI.updateRecentDocuments(documents);
    } catch (error) {
      console.error('Error loading recent documents:', error);
    }
  }

  private async loadDepartments(): Promise<void> {
    try {
      const departments = await this.departmentService.loadDepartments();
      this.dashboardUI.updateDepartments(departments);
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  }

  private async loadTeams(): Promise<void> {
    try {
      const teams = await this.teamService.loadTeams();
      this.dashboardUI.updateTeams(teams);
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  }

  private async loadBlackboardPreview(): Promise<void> {
    try {
      const entries = await this.blackboardService.loadPreview();
      this.blackboardUI.updatePreview(entries);
    } catch (error) {
      console.error('Error loading blackboard preview:', error);
    }
  }

  private async loadBlackboardWidget(): Promise<void> {
    try {
      const entries = await this.blackboardService.loadWidget();
      this.blackboardUI.updateWidget(entries);
    } catch (error) {
      console.error('Error loading blackboard widget:', error);
    }
  }

  private async handleEmployeeSubmit(e: Event): Promise<void> {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    // Extract and validate form data
    const employeeData: EmployeeFormData = {
      username: formData.get('username') as string,
      email: formData.get('email') as string,
      emailConfirm: formData.get('email_confirm') as string,
      password: formData.get('password') as string,
      passwordConfirm: formData.get('password_confirm') as string,
      firstName: formData.get('first_name') as string,
      lastName: formData.get('last_name') as string,
      employeeId: formData.get('employee_id') as string,
      position: formData.get('position') as string,
      departmentId:
        formData.get('department_id') !== null
          ? Number.parseInt(formData.get('department_id') as string, 10)
          : undefined,
      phone: formData.get('phone') as string,
      birthDate: formData.get('birth_date') as string,
      startDate: formData.get('start_date') as string,
      street: formData.get('street') as string,
      houseNumber: formData.get('house_number') as string,
      postalCode: formData.get('postal_code') as string,
      city: formData.get('city') as string,
    };

    // Validate emails match
    if (employeeData.email !== employeeData.emailConfirm) {
      showError('Die E-Mail-Adressen stimmen nicht überein');
      return;
    }

    // Validate passwords match
    if (employeeData.password !== employeeData.passwordConfirm) {
      showError('Die Passwörter stimmen nicht überein');
      return;
    }

    try {
      await this.employeeService.createEmployee(employeeData);
      form.reset();
      this.employeeModalUI.hideModal();

      // Reload data
      await Promise.all([this.loadRecentEmployees(), this.loadDashboardStats()]);

      // Optional: reload page for full refresh
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error creating employee:', error);
      showError(error instanceof Error ? error.message : 'Fehler beim Erstellen des Mitarbeiters');
    }
  }

  private async handleDepartmentSubmit(e: Event): Promise<void> {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    const departmentData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      status: (formData.get('status') ?? 'active') as string,
      visibility: (formData.get('visibility') ?? 'public') as string,
    };

    try {
      await this.departmentService.createDepartment(departmentData);
      form.reset();

      // Hide modal
      const modal = $$id('department-modal');
      if (modal !== null) hide(modal);

      // Reload data
      await Promise.all([this.loadDepartments(), this.employeeModalUI.loadDepartmentsForSelect()]);
    } catch (error) {
      console.error('Error creating department:', error);
      showError(
        `Fehler beim Erstellen der Abteilung: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
      );
    }
  }

  private async handleTeamSubmit(e: Event): Promise<void> {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    const teamData = {
      name: formData.get('name') as string,
      departmentId: Number.parseInt(formData.get('department_id') as string, 10),
      description: formData.get('description') as string,
    };

    try {
      await this.teamService.createTeam(teamData);
      form.reset();

      // Hide modal
      const modal = $$id('team-modal');
      if (modal !== null) hide(modal);

      // Reload teams
      await this.loadTeams();
    } catch (error) {
      console.error('Error creating team:', error);
      showError(`Fehler beim Erstellen des Teams: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    }
  }

  private handleSectionParameter(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const section = urlParams.get('section');

    if (section !== null && section.length > 0) {
      console.info('[Admin Dashboard] Section parameter found:', section);
      showSection(section);
    } else {
      console.info('[Admin Dashboard] No section parameter, showing dashboard');
      showSection('dashboard');
    }
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.info('[Admin Dashboard] Initializing...');
  const dashboard = new AdminDashboard();
  dashboard.initialize();
});

// ============================================================================
// GLOBAL EXPORTS FOR BACKWARD COMPATIBILITY
// ============================================================================

declare global {
  interface Window {
    showNewEmployeeModal?: () => Promise<void>;
    loadDepartmentsForEmployeeSelect?: () => Promise<void>;
    showSection: typeof showSection;
    selectDropdownOption?: (dropdownName: string, value: string, label: string) => void;
  }
}

// Export functions to window for HTML onclick handlers
if (typeof window !== 'undefined') {
  const employeeModalUI = new EmployeeModalUI();

  window.showNewEmployeeModal = async (): Promise<void> => {
    await employeeModalUI.showNewEmployeeModal();
  };

  window.loadDepartmentsForEmployeeSelect = async (): Promise<void> => {
    await employeeModalUI.loadDepartmentsForSelect();
  };

  window.showSection = showSection;

  window.selectDropdownOption = (dropdownName: string, value: string, label: string): void => {
    console.info('selectDropdownOption', dropdownName, value, label);
    // Implementation for dropdown selection
    const input = $$(`#${dropdownName}_id`) as HTMLInputElement | null;
    if (input !== null) {
      input.value = value;
    }
    const display = $$(`#${dropdownName}-selected`);
    if (display !== null) {
      setText(display, label);
    }
  };
}
