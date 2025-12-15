/* eslint-disable max-lines */
/**
 * Root Dashboard Script
 * Handles root user dashboard functionality and admin management
 */

import type { User } from '../../types/api.types';
import { ApiClient } from '../../utils/api-client';
import { setHTML } from '../../utils/dom-utils';
import { showSuccessAlert, showErrorAlert, showAlert } from '../utils/alerts';
import { getAuthToken, loadUserInfo } from '../auth/index';

// API Endpoints
const API_ENDPOINTS = {
  ROOT_ADMINS: '/root/admins',
  ROOT_DASHBOARD: '/root/dashboard',
  USERS: '/users',
  USERS_ME: '/users/me',
  LOGS: '/logs',
} as const;

// Helper function for notifications (using modern alerts)
function showNotification(message: string, type: 'success' | 'error' | 'warning' = 'success'): void {
  if (type === 'success') {
    showSuccessAlert(message);
  } else if (type === 'error') {
    showErrorAlert(message);
  } else {
    showAlert(message);
  }
}

interface AdminUser extends User {
  company?: string;
  position?: string;
  notes?: string;
  userName?: string;
  userRole?: string;
}

interface DashboardData {
  adminCount: number;
  employeeCount: number;
  totalUsers: number;
  tenantCount: number;
  activeFeatures: string[];
  systemHealth: {
    database: string;
    storage: string;
    services: string;
  };
}

interface CreateAdminFormElements extends HTMLFormControlsCollection {
  userName: HTMLInputElement;
  firstName: HTMLInputElement;
  lastName: HTMLInputElement;
  email: HTMLInputElement;
  email_confirm: HTMLInputElement;
  password: HTMLInputElement;
  password_confirm: HTMLInputElement;
  position: HTMLInputElement;
  notes?: HTMLTextAreaElement;
}

interface CreateAdminForm extends HTMLFormElement {
  readonly elements: CreateAdminFormElements;
}

// Global API client
let apiClient: ApiClient;

// Initialize the dashboard
function initDashboard(): void {
  console.info('Root dashboard script loaded');

  // Check authentication
  const token = getAuthToken();
  console.info('Stored token:', token !== null && token !== '' ? 'Token vorhanden' : 'Kein Token gefunden');

  if (token === null || token === '') {
    console.error('No token found. Redirecting to login...');
    document.body.style.display = 'none';
    window.location.href = '/login';
    return;
  }

  // Initialize API client
  apiClient = ApiClient.getInstance();

  // Setup event listeners
  setupEventListeners();

  // Load initial data
  loadAllData();
}

// Setup all event listeners
function setupEventListeners(): void {
  // Navigation event delegation
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const logEntry = target.closest<HTMLElement>('[data-action="navigate-logs"]');
    if (logEntry) {
      window.location.href = '/logs';
    }
  });

  // Admin form submission
  const createAdminForm = document.querySelector<CreateAdminForm>('#create-admin-form');
  if (createAdminForm !== null) {
    createAdminForm.addEventListener('submit', (e) => {
      void createAdmin(e);
    });
  }
}

// Load all initial data
// NOTE: loadHeaderUserInfo() removed - UnifiedNavigation already handles this via loadUserInfo()
function loadAllData(): void {
  void checkEmployeeNumber();
  void loadDashboardData();
  void loadAdmins();
  void loadDashboardStats();
  void loadActivityLogs();
}

// Check if user has temporary employee number
// Uses cached loadUserInfo() to prevent duplicate /api/v2/users/me calls
async function checkEmployeeNumber(): Promise<void> {
  try {
    interface UserWithEmployeeNumber extends User {
      employeeNumber?: string;
      employee_number?: string;
    }

    // Use cached loadUserInfo instead of direct API call
    const user = (await loadUserInfo()) as UserWithEmployeeNumber;

    // Check if user has temporary employee number
    const employeeNumber = user.employeeNumber ?? user.employeeNumber ?? '';
    if (employeeNumber.startsWith('TEMP-') || employeeNumber.startsWith('TEMP_') || employeeNumber === '') {
      // User has temporary employee number, show modal
      const modal = document.querySelector<HTMLElement>('#employeeNumberModal');
      const form = document.querySelector<HTMLFormElement>('#employeeNumberForm');
      const input = document.querySelector<HTMLInputElement>('#employeeNumberInput');

      if (modal === null || form === null || input === null) return;

      // Show modal (Design System pattern: add --active class)
      modal.classList.add('modal-overlay--active');
      input.focus();

      // Allow letters, numbers and hyphens
      input.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        target.value = target.value.replace(/[^-0-9A-Za-z]/g, '');
      });

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        void (async () => {
          const newEmployeeNumber = input.value.trim();
          if (newEmployeeNumber === '') {
            showNotification('Bitte geben Sie eine gültige Mitarbeiternummer ein.', 'error');
            return;
          }

          try {
            await apiClient.request('/users/me', {
              method: 'PATCH',
              body: JSON.stringify({
                employeeNumber: newEmployeeNumber,
              }),
            });

            // Reload user data with cache invalidation to update UI
            await loadUserInfo(true);

            // Update sidebar employee number directly
            const sidebarEmployeeNumber = document.querySelector('#sidebar-employee-number span');
            if (sidebarEmployeeNumber !== null) {
              sidebarEmployeeNumber.textContent = newEmployeeNumber;
            }

            showNotification('Mitarbeiternummer erfolgreich aktualisiert.', 'success');
            modal.classList.remove('modal-overlay--active');
          } catch (error) {
            console.error('Error updating employee number:', error);
            showNotification(
              error instanceof Error ? error.message : 'Fehler beim Aktualisieren der Mitarbeiternummer.',
              'error',
            );
          }
        })();
      });
    }
  } catch (error) {
    console.error('Error checking employee number:', error);
    if (error instanceof Error) {
      showNotification(error.message, 'error');
    }
  }
}

// Admin erstellen
async function createAdmin(e: Event): Promise<void> {
  e.preventDefault();
  console.info('Creating admin...');

  const createAdminForm = e.target as CreateAdminForm | null;
  if (createAdminForm === null) return;

  const elements = createAdminForm.elements;

  // Validate email match
  if (elements.email.value !== elements.email_confirm.value) {
    showNotification('Die E-Mail-Adressen stimmen nicht überein!', 'error');
    elements.email_confirm.focus();
    return;
  }

  // Validate password match
  if (elements.password.value !== elements.password_confirm.value) {
    showNotification('Die Passwörter stimmen nicht überein!', 'error');
    elements.password_confirm.focus();
    return;
  }

  const adminData = {
    userName: elements.userName.value,
    firstName: elements.firstName.value,
    lastName: elements.lastName.value,
    email: elements.email.value,
    password: elements.password.value,
    userRole: 'admin',
    position: elements.position.value,
    notes: elements.notes?.value ?? '',
  };

  try {
    await apiClient.request(API_ENDPOINTS.ROOT_ADMINS, {
      method: 'POST',
      body: JSON.stringify(adminData),
    });

    showNotification('Admin erfolgreich angelegt', 'success');
    createAdminForm.reset();
    await loadAdmins();
  } catch (error) {
    console.error('Error creating admin:', error);
    showNotification(error instanceof Error ? error.message : 'Fehler beim Anlegen des Admins', 'error');
  }
}

// Fetch and display dashboard data
async function loadDashboardData(): Promise<void> {
  try {
    const data = await apiClient.request<DashboardData>(API_ENDPOINTS.ROOT_DASHBOARD);
    console.info('Dashboard data:', data);

    const dashboardContent = document.querySelector<HTMLElement>('#dashboard-data');
    if (dashboardContent === null) return;

    setHTML(
      dashboardContent,
      `
            <div class="stats-grid">
                <div class="card-stat">
                    <div class="card-stat__icon"><i class="fas fa-user-shield"></i></div>
                    <div class="card-stat__value">${data.adminCount}</div>
                    <div class="card-stat__label">Admins</div>
                </div>
                <div class="card-stat">
                    <div class="card-stat__icon"><i class="fas fa-users"></i></div>
                    <div class="card-stat__value">${data.employeeCount}</div>
                    <div class="card-stat__label">Mitarbeiter</div>
                </div>
                <div class="card-stat">
                    <div class="card-stat__icon"><i class="fas fa-user-friends"></i></div>
                    <div class="card-stat__value">${data.totalUsers}</div>
                    <div class="card-stat__label">Gesamte Benutzer</div>
                </div>
            </div>
        `,
    );
  } catch (error) {
    console.error('Error loading dashboard:', error);
    showNotification(error instanceof Error ? error.message : 'Fehler beim Laden des Dashboards', 'error');
  }
}

// Load and display admin list
async function loadAdmins(): Promise<void> {
  try {
    const admins = await apiClient.request<AdminUser[]>(API_ENDPOINTS.ROOT_ADMINS);
    console.info('Loaded admins:', admins);

    const tbody = document.querySelector('#admins-table tbody');
    if (tbody === null) return;

    if (admins.length === 0) {
      setHTML(tbody as HTMLElement, '<tr><td colspan="7" class="text-center">Keine Admins gefunden</td></tr>');
      return;
    }

    const rows = admins
      .map(
        (admin) => `
            <tr>
                <td>${admin.id}</td>
                <td>${admin.userName ?? admin.username}</td>
                <td>${admin.firstName ?? ''} ${admin.lastName ?? ''}</td>
                <td>${admin.email}</td>
                <td>${admin.userRole ?? admin.role}</td>
                <td>
                    ${
                      (admin.userRole ?? admin.role) === 'admin'
                        ? `<button class="btn-demote" data-id="${admin.id}">Zum Mitarbeiter</button>`
                        : `<button class="btn-promote" data-id="${admin.id}">Zum Admin</button>`
                    }
                </td>
                <td>
                    <button class="btn-cancel" data-id="${admin.id}">🗑️</button>
                </td>
            </tr>
        `,
      )
      .join('');

    setHTML(tbody as HTMLElement, rows);

    // Event-Listener für Promote/Demote Buttons
    tbody.querySelectorAll('.btn-promote, .btn-demote').forEach((button) => {
      button.addEventListener('click', () => {
        if (button instanceof HTMLElement) {
          const adminId = Number.parseInt(button.dataset['id'] ?? '0', 10);
          const newuserRole = button.classList.contains('btn-promote') ? 'admin' : 'employee';
          void updateAdmin(adminId, newuserRole);
        }
      });
    });

    // Event-Listener für Delete Buttons
    tbody.querySelectorAll('.btn-cancel').forEach((button) => {
      button.addEventListener('click', () => {
        if (button instanceof HTMLElement) {
          const adminId = Number.parseInt(button.dataset['id'] ?? '0', 10);
          void deleteAdmin(adminId);
        }
      });
    });
  } catch (error) {
    console.error('Error loading admins:', error);
    showNotification(error instanceof Error ? error.message : 'Fehler beim Laden der Admin-Liste', 'error');
  }
}

async function updateAdmin(adminId: number, newuserRole: 'admin' | 'employee'): Promise<void> {
  if (!window.confirm(`Möchten Sie diese userRole wirklich ändern?`)) {
    return;
  }

  try {
    await apiClient.request(`${API_ENDPOINTS.USERS}/${adminId}/userRole`, {
      method: 'PUT',
      body: JSON.stringify({ userRole: newuserRole }),
    });

    showNotification(`Benutzer erfolgreich zu ${newuserRole} geändert`, 'success');
    await loadAdmins();
  } catch (error) {
    console.error('Error updating admin:', error);
    showNotification(error instanceof Error ? error.message : 'Fehler beim Aktualisieren', 'error');
  }
}

// Delete admin
async function deleteAdmin(adminId: number): Promise<void> {
  if (!window.confirm('Möchten Sie diesen Admin wirklich löschen?')) {
    return;
  }

  try {
    await apiClient.request(`${API_ENDPOINTS.ROOT_ADMINS}/${adminId}`, {
      method: 'DELETE',
    });

    showNotification('Admin erfolgreich gelöscht', 'success');
    await loadAdmins();
  } catch (error) {
    console.error('Error deleting admin:', error);
    showNotification(error instanceof Error ? error.message : 'Fehler beim Löschen', 'error');
  }
}

// loadHeaderUserInfo() REMOVED - Redundant!
// UnifiedNavigation already handles header user info via loadUserInfo() from auth/index.ts
// This was causing duplicate /api/v2/users/me calls on every page load

// Load dashboard statistics
async function loadDashboardStats(): Promise<void> {
  try {
    interface StatsResponse {
      totalAdmins: number;
      totalEmployees: number;
      totalTenants: number;
      recentActivity: number;
    }

    const stats = await apiClient.request<StatsResponse>('/root/stats');

    const statsEl = document.querySelector('#dashboard-stats');
    if (statsEl === null) return;

    setHTML(
      statsEl as HTMLElement,
      `
            <div class="card-stat">
                <div class="card-stat__icon"><i class="fas fa-user-shield"></i></div>
                <div class="card-stat__value">${stats.totalAdmins}</div>
                <div class="card-stat__label">Admins</div>
            </div>
            <div class="card-stat">
                <div class="card-stat__icon"><i class="fas fa-users"></i></div>
                <div class="card-stat__value">${stats.totalEmployees}</div>
                <div class="card-stat__label">Mitarbeiter</div>
            </div>
            <div class="card-stat">
                <div class="card-stat__icon"><i class="fas fa-chart-line"></i></div>
                <div class="card-stat__value">${stats.recentActivity}</div>
                <div class="card-stat__label">Aktivitäten (24h)</div>
            </div>
        `,
    );
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// Load activity logs
async function loadActivityLogs(): Promise<void> {
  try {
    interface LogEntry {
      id: number;
      action: string;
      details?: unknown;
      createdAt: string;
      userName?: string;
      userRole?: string;
      userFirstName?: string;
      userLastName?: string;
      employeeNumber?: string;
    }

    const response = await apiClient.request<{ logs: LogEntry[] }>(`${API_ENDPOINTS.LOGS}?limit=5`);
    const logs = response.logs;

    const logsEl = document.querySelector('#activity-logs');
    if (logsEl === null) return;

    if (logs.length === 0) {
      // Use innerHTML directly for table content
      logsEl.innerHTML =
        '<tr><td colspan="4" class="text-center text-gray-400 py-8">Keine kürzlichen Aktivitäten</td></tr>';
      return;
    }

    const logsHTML = logs
      .map((log) => {
        // Build full name from firstName + lastName, fallback to userName
        const firstName = log.userFirstName ?? '';
        const lastName = log.userLastName ?? '';
        const fullName = `${firstName} ${lastName}`.trim();
        const displayName = fullName !== '' ? fullName : (log.userName ?? '-');
        const employeeNumber = log.employeeNumber ?? '-';

        // Role badge styling (same as logs.html)
        const badgeVariant = getRoleBadgeClass(log.userRole ?? '');
        const roleLabel = getuserRoleLabel(log.userRole ?? '');

        return `<tr>
                <td class="text-muted">${log.id}</td>
                <td>
                  <div class="user-info">
                    <span class="user-name">${displayName}</span>
                    <span class="badge badge--sm badge--${badgeVariant}">${roleLabel}</span>
                  </div>
                </td>
                <td class="text-muted">${employeeNumber}</td>
                <td><span class="badge badge--${getActionBadgeClass(log.action)}">${getActionLabel(log.action)}</span></td>
            </tr>`;
      })
      .join('');

    // Use innerHTML directly for table content to preserve TR/TD structure
    // eslint-disable-next-line no-unsanitized/property
    logsEl.innerHTML = logsHTML;
  } catch (error) {
    console.error('Error loading logs:', error);
  }
}

// Helper function to get readable action labels
function getActionLabel(action: string): string {
  const actionLabels = new Map<string, string>([
    ['create', 'Erstellt'],
    ['update', 'Aktualisiert'],
    ['delete', 'Gelöscht'],
    ['login', 'Anmeldung'],
    ['logout', 'Abmeldung'],
    ['view', 'Angesehen'],
    ['assign', 'Zugewiesen'],
    ['unassign', 'Entfernt'],
    ['role_switch_to_root', 'Wechsel zu Root'],
    ['role_switch_to_admin', 'Wechsel zu Admin'],
    ['role_switch_to_employee', 'Wechsel zu Mitarbeiter'],
    ['role_switch_root_to_admin', 'Root → Admin'],
  ]);
  return actionLabels.get(action) ?? action;
}

// Helper function to get badge class for actions
function getActionBadgeClass(action: string): string {
  // Map actions to Design System badge classes (exact variants from Storybook)
  const actionClasses = new Map<string, string>([
    ['create', 'create'],
    ['update', 'update'],
    ['delete', 'delete'],
    ['login', 'login'],
    ['logout', 'logout'],
    ['view', 'info'],
    ['assign', 'success'],
    ['unassign', 'danger'],
    ['role_switch_to_root', 'info'],
    ['role_switch_to_admin', 'info'],
    ['role_switch_to_employee', 'info'],
    ['role_switch_root_to_admin', 'info'],
  ]);
  return actionClasses.get(action) ?? 'info';
}

// Helper function to get readable userRole labels
function getuserRoleLabel(userRole: string): string {
  const userRoleLabels = new Map<string, string>([
    ['root', 'Root'],
    ['admin', 'Admin'],
    ['employee', 'Mitarbeiter'],
  ]);
  return userRoleLabels.get(userRole) ?? userRole;
}

// Helper function to get badge class for user roles (consistent with logs.html)
function getRoleBadgeClass(userRole: string): string {
  const roleClasses = new Map<string, string>([
    ['root', 'danger'],
    ['admin', 'warning'],
    ['employee', 'info'],
  ]);
  return roleClasses.get(userRole.toLowerCase()) ?? 'info';
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Clear any stored active navigation to ensure dashboard is selected
  localStorage.removeItem('activeNavigation');

  initDashboard();
});
