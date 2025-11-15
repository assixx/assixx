/* eslint-disable max-lines */
/**
 * Root Dashboard Script
 * Handles root user dashboard functionality and admin management
 */

import type { User } from '../../types/api.types';
import { ApiClient } from '../../utils/api-client';
import { setHTML } from '../../utils/dom-utils';
import { showSuccessAlert, showErrorAlert, showAlert } from '../utils/alerts';
import { getAuthToken } from '../auth/index';

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
  first_name: HTMLInputElement;
  last_name: HTMLInputElement;
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
function loadAllData(): void {
  void loadHeaderUserInfo();
  void checkEmployeeNumber();
  void loadDashboardData();
  void loadAdmins();
  void loadDashboardStats();
  void loadActivityLogs();
}

// Check if user has temporary employee number
async function checkEmployeeNumber(): Promise<void> {
  try {
    interface UserWithEmployeeNumber extends User {
      employeeNumber?: string;
      employee_number?: string;
    }

    const user = await apiClient.request<UserWithEmployeeNumber>(API_ENDPOINTS.USERS_ME);

    // Check if user has temporary employee number
    const employeeNumber = user.employeeNumber ?? user.employee_number ?? '';
    if (employeeNumber.startsWith('TEMP-') || employeeNumber.startsWith('TEMP_') || employeeNumber === '') {
      // User has temporary employee number, show modal
      const modal = document.querySelector<HTMLElement>('#employeeNumberModal');
      const form = document.querySelector<HTMLFormElement>('#employeeNumberForm');
      const input = document.querySelector<HTMLInputElement>('#employeeNumberInput');

      if (modal === null || form === null || input === null) return;

      modal.classList.remove('hidden');
      modal.classList.add('flex');
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

            // Reload user data to update cache and UI
            await apiClient.request<UserWithEmployeeNumber>(API_ENDPOINTS.USERS_ME);

            showNotification('Mitarbeiternummer erfolgreich aktualisiert.', 'success');
            modal.classList.add('hidden');
            modal.classList.remove('flex');
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
    first_name: elements.first_name.value,
    last_name: elements.last_name.value,
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
                <div class="stat-card">
                    <span class="stat-value">${data.adminCount}</span>
                    <span class="stat-label">Admins</span>
                </div>
                <div class="stat-card">
                    <span class="stat-value">${data.employeeCount}</span>
                    <span class="stat-label">Mitarbeiter</span>
                </div>
                <div class="stat-card">
                    <span class="stat-value">${data.totalUsers}</span>
                    <span class="stat-label">Gesamte Benutzer</span>
                </div>
                <div class="stat-card">
                    <span class="stat-value">${data.tenantCount}</span>
                    <span class="stat-label">Tenants</span>
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
                <td>${admin.first_name ?? ''} ${admin.last_name ?? ''}</td>
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
          const adminId = Number.parseInt(button.dataset.id ?? '0', 10);
          const newuserRole = button.classList.contains('btn-promote') ? 'admin' : 'employee';
          void updateAdmin(adminId, newuserRole);
        }
      });
    });

    // Event-Listener für Delete Buttons
    tbody.querySelectorAll('.btn-cancel').forEach((button) => {
      button.addEventListener('click', () => {
        if (button instanceof HTMLElement) {
          const adminId = Number.parseInt(button.dataset.id ?? '0', 10);
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

// Load header user info
async function loadHeaderUserInfo(): Promise<void> {
  try {
    const user = await apiClient.request<User>(API_ENDPOINTS.USERS_ME);
    const userNameEl = document.querySelector('#header-userName');
    const userRoleEl = document.querySelector('#header-userRole');

    if (userNameEl !== null) userNameEl.textContent = user.username;
    if (userRoleEl !== null) userRoleEl.textContent = user.role;
  } catch (error) {
    console.error('Error loading header info:', error);
  }
}

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
            <div class="stat-card">
                <h3>👥 Admins</h3>
                <div class="stat-value">${stats.totalAdmins}</div>
            </div>
            <div class="stat-card">
                <h3>👤 Mitarbeiter</h3>
                <div class="stat-value">${stats.totalEmployees}</div>
            </div>
            <div class="stat-card">
                <h3>🏢 Mandanten</h3>
                <div class="stat-value">${stats.totalTenants}</div>
            </div>
            <div class="stat-card">
                <h3>📊 Aktivitäten (24h)</h3>
                <div class="stat-value">${stats.recentActivity}</div>
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
    }

    const response = await apiClient.request<{ logs: LogEntry[] }>(`${API_ENDPOINTS.LOGS}?limit=5`);
    const logs = response.logs;

    const logsEl = document.querySelector('#activity-logs');
    if (logsEl === null) return;

    if (logs.length === 0) {
      // Use innerHTML directly for table content

      logsEl.innerHTML =
        '<tr><td colspan="5" class="text-center text-gray-400 py-8">Keine kürzlichen Aktivitäten</td></tr>';
      return;
    }

    const logsHTML = logs
      .map(
        (log) => `<tr>
                <td class="text-sm">${new Date(log.createdAt).toLocaleString('de-DE')}</td>
                <td>${
                  log.userName !== undefined && log.userName !== ''
                    ? `<span class="flex items-center gap-2"><i class="fas fa-user text-xs opacity-60"></i> ${log.userName}</span>`
                    : '<span class="text-gray-400">-</span>'
                }
                </td>
                <td><span class="badge badge--${getActionBadgeClass(log.action)}">${getActionLabel(log.action)}</span></td>
                <td class="text-sm text-gray-500">${
                  log.details !== undefined && log.details !== null
                    ? `${JSON.stringify(log.details).substring(0, 50)}...`
                    : '<span class="text-gray-400">-</span>'
                }
                </td>
                <td>${
                  log.userRole !== undefined && log.userRole !== ''
                    ? `<span class="badge badge--sm badge--role-${log.userRole.toLowerCase()}">${getuserRoleLabel(log.userRole)}</span>`
                    : '<span class="badge badge--sm badge--success">OK</span>'
                }
                </td>
            </tr>`,
      )
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

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Clear any stored active navigation to ensure dashboard is selected
  localStorage.removeItem('activeNavigation');

  initDashboard();
});
