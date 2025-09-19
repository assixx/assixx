/**
 * Root Dashboard Script
 * Handles root user dashboard functionality and admin management
 */

import type { User } from '../types/api.types';
import { ApiClient } from '../utils/api-client';
import { setHTML } from '../utils/dom-utils';
import { showSuccessAlert, showErrorAlert, showAlert } from './utils/alerts';
import { getAuthToken } from './auth';

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
}

interface DashboardData {
  user: {
    id: number;
    userName: string;
    userRole: string;
    iat: number;
    exp: number;
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

document.addEventListener('DOMContentLoaded', () => {
  console.info('Root dashboard script loaded');
  const token = getAuthToken();
  console.info('Stored token:', token !== null && token !== '' ? 'Token vorhanden' : 'Kein Token gefunden');

  if (token === null || token === '') {
    console.error('No token found. Redirecting to login...');
    // Hide all content immediately
    document.body.style.display = 'none';
    // Redirect to login
    window.location.href = '/login';
    return;
  }

  // Elemente aus dem DOM holen
  const createAdminForm = document.querySelector<CreateAdminForm>('#create-admin-form');
  // const logoutBtn = document.querySelector('logout-btn') as HTMLButtonElement; // Not used - handled by unified-navigation
  const dashboardContent = document.querySelector<HTMLElement>('#dashboard-data');

  // Event delegation for log entries navigation
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Handle navigate to logs
    const logEntry = target.closest<HTMLElement>('[data-action="navigate-logs"]');
    if (logEntry) {
      window.location.href = '/logs';
    }
  });

  // Event-Listener hinzufügen
  if (createAdminForm !== null) {
    createAdminForm.addEventListener('submit', (e) => {
      void createAdmin(e);
    });
  }

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

  // Initialize API client
  const apiClient = ApiClient.getInstance();

  // Load user info in header
  void loadHeaderUserInfo();

  // Check if employee number needs to be set
  void checkEmployeeNumber();

  // Daten laden
  void loadDashboardData();
  void loadAdmins();
  void loadDashboardStats();
  void loadActivityLogs();

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
      if (employeeNumber === '000001' || employeeNumber.startsWith('TEMP-')) {
        showEmployeeNumberModal();
      }
    } catch (error) {
      console.error('Error checking employee number:', error);
    }
  }

  // Show employee number modal
  function showEmployeeNumberModal(): void {
    const modal = document.querySelector<HTMLElement>('#employeeNumberModal');
    const form = document.querySelector<HTMLFormElement>('#employeeNumberForm');
    const input = document.querySelector<HTMLInputElement>('#employeeNumberInput');

    if (modal === null || form === null || input === null) return;

    modal.style.display = 'flex';
    input.focus();

    // Allow letters, numbers and hyphens
    input.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      target.value = target.value.replace(/[^-0-9A-Za-z]/g, '');
    });

    form.addEventListener('submit', (e) => {
      void (async () => {
        e.preventDefault();

        const employeeNumber = input.value;

        if (employeeNumber.length < 1 || employeeNumber.length > 10) {
          console.error('Die Personalnummer muss zwischen 1 und 10 Zeichen lang sein.');
          showNotification('Die Personalnummer muss zwischen 1 und 10 Zeichen lang sein.', 'error');
          return;
        }

        try {
          await apiClient.request(API_ENDPOINTS.USERS_ME, {
            method: 'PATCH',
            body: JSON.stringify({ employee_number: employeeNumber }),
          });

          showNotification('Personalnummer erfolgreich gespeichert.', 'success');
          modal.style.display = 'none';
          // Reload to update UI
          window.location.reload();
        } catch (error) {
          console.error('Error updating employee number:', error);
          showNotification('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.', 'error');
        }
      })();
    });
  }

  // Admin erstellen
  async function createAdmin(e: Event): Promise<void> {
    e.preventDefault();
    console.info('Creating admin...');

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
      position: elements.position.value,
      notes: elements.notes?.value ?? '',
    };

    try {
      await apiClient.request(API_ENDPOINTS.ROOT_ADMINS, {
        method: 'POST',
        body: JSON.stringify(adminData),
      });

      showNotification('Admin erfolgreich erstellt', 'success');
      createAdminForm.reset();
      void loadAdmins();
    } catch (error) {
      console.error('Fehler beim Erstellen des Admins:', error);

      showNotification('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.', 'error');
    }
  }

  // Dashboard-Daten laden
  async function loadDashboardData(): Promise<void> {
    console.info('Loading dashboard data...');

    if (!dashboardContent) return;

    try {
      const data: DashboardData = await apiClient.request(API_ENDPOINTS.ROOT_DASHBOARD);
      console.info('Dashboard data:', data);
      setHTML(dashboardContent, '');
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  }

  // Extract admins from response
  function extractAdmins(response: AdminUser[] | { admins: AdminUser[] }): AdminUser[] {
    if (Array.isArray(response)) {
      return response;
    }
    if ('admins' in response && Array.isArray(response.admins)) {
      return response.admins;
    }
    return [];
  }

  // Extract users from response
  function extractUsers(response: User[] | { data: User[] }): User[] {
    if (Array.isArray(response)) {
      return response;
    }
    if ('data' in response && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  }

  // Update dashboard counters
  function updateDashboardCounters(admins: AdminUser[], users: User[]): void {
    const adminCount = document.querySelector<HTMLElement>('#admin-count');
    const userCount = document.querySelector<HTMLElement>('#user-count');
    const tenantCount = document.querySelector<HTMLElement>('#tenant-count');

    if (adminCount !== null) {
      adminCount.textContent = admins.length.toString();
    }
    if (userCount !== null) {
      userCount.textContent = users.length.toString();
    }
    if (tenantCount !== null) {
      tenantCount.textContent = '1'; // TODO: Implement tenant count
    }
  }

  // Dashboard-Statistiken laden
  async function loadDashboardStats(): Promise<void> {
    try {
      const [adminsResponse, usersResponse] = await Promise.all([
        apiClient.request<AdminUser[] | { admins: AdminUser[] }>(API_ENDPOINTS.ROOT_ADMINS),
        apiClient.request<User[] | { data: User[] }>(API_ENDPOINTS.USERS),
      ]);

      const admins = extractAdmins(adminsResponse);
      const users = extractUsers(usersResponse);

      updateDashboardCounters(admins, users);
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  }

  // Admin-Liste laden
  async function loadAdmins(): Promise<void> {
    try {
      console.info('Loading admins...');
      const response = await apiClient.request<AdminUser[] | { admins: AdminUser[] }>(API_ENDPOINTS.ROOT_ADMINS);

      // Handle both array and object responses
      const admins = Array.isArray(response)
        ? response
        : 'admins' in response && Array.isArray(response.admins)
          ? response.admins
          : [];

      console.info('Loaded admins:', admins);
      displayAdmins(admins);

      // Update admin count
      const adminCount = document.querySelector<HTMLElement>('#admin-count');
      if (adminCount && Array.isArray(admins)) {
        adminCount.textContent = admins.length.toString();
      }
    } catch (error) {
      console.error('Fehler beim Laden der Admins:', error);
    }
  }

  // Admin-Liste anzeigen (kept for loadAdmins count functionality)
  function displayAdmins(_admins: AdminUser[]): void {
    // Function kept empty as we removed the admin table
    // But keeping it to not break loadAdmins() which updates the count
  }

  // Ausloggen - DISABLED: Handled by unified-navigation.ts
  // async function logout(): Promise<void> {
  //   console.info('Logging out...');

  //   if (confirm('Möchten Sie sich wirklich abmelden?')) {
  //     try {
  //       // Import and use the logout function from auth module
  //       const { logout: authLogout } = await import('./auth.js');
  //       await authLogout();
  //     } catch (error) {
  //       console.error('Logout error:', error);
  //       // Fallback
  //       window.location.href = '/login';
  //     }
  //   }
  // }

  // Parse JWT token to get username
  function parseUsernameFromToken(token: string): string {
    try {
      const payload = JSON.parse(atob(token.split('.')[1])) as { userName?: string };
      return payload.userName ?? 'Root';
    } catch (error) {
      console.error('Error parsing JWT token:', error);
      return 'Root';
    }
  }

  // Get display name for user
  function getUserDisplayName(user: User): string {
    const hasFirstName = user.first_name !== undefined && user.first_name !== '';
    const hasLastName = user.last_name !== undefined && user.last_name !== '';

    if (!hasFirstName && !hasLastName) {
      return user.username;
    }

    const fullName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
    return fullName !== '' ? fullName : user.username;
  }

  // Update user avatar
  function updateUserAvatar(userAvatar: HTMLImageElement, profilePictureUrl: string | undefined): void {
    if (profilePictureUrl === undefined || profilePictureUrl === '') {
      return;
    }

    userAvatar.src = profilePictureUrl;
    userAvatar.onerror = function () {
      this.src = '/images/default-avatar.svg';
    };
  }

  // Load username from local storage fallback
  function loadUsernameFromStorage(): string {
    const userStr = localStorage.getItem('user');
    if (userStr === null || userStr === '') {
      return 'Root';
    }

    try {
      const userData = JSON.parse(userStr) as { userName?: string };
      return userData.userName ?? 'Root';
    } catch {
      return 'Root';
    }
  }

  // Load user info in header
  async function loadHeaderUserInfo(): Promise<void> {
    const authToken = getAuthToken();
    const userNameElement = document.querySelector<HTMLElement>('#user-name');
    const userAvatar = document.querySelector<HTMLImageElement>('#user-avatar');

    if (authToken === null || authToken === '' || userNameElement === null) {
      return;
    }

    // Set initial username from token
    userNameElement.textContent = parseUsernameFromToken(authToken);

    // Try to fetch full user profile
    try {
      const user = await apiClient.request<User>(API_ENDPOINTS.USERS_ME);
      userNameElement.textContent = getUserDisplayName(user);

      if (userAvatar !== null) {
        updateUserAvatar(userAvatar, user.profile_picture_url);
      }
    } catch (error) {
      console.error('Error loading user info:', error);
      // Fallback to local storage
      userNameElement.textContent = loadUsernameFromStorage();
    }
  }

  // Activity Logs laden
  async function loadActivityLogs(): Promise<void> {
    try {
      // Use v2 API directly via apiClient
      interface LogEntry {
        id: number;
        createdAt: string;
        action: string;
        userName: string;
        userRole: string;
        details?: string;
      }

      const result = await apiClient.request<{
        logs?: LogEntry[];
        data?: {
          logs: LogEntry[];
          pagination?: { limit: number; offset: number; total: number; hasMore: boolean };
        };
      }>(`${API_ENDPOINTS.LOGS}?limit=20`);
      const logsContainer = document.querySelector<HTMLElement>('#activity-logs');

      if (logsContainer !== null) {
        // Handle both response formats (direct logs array or nested in data)
        const logs = result.logs ?? result.data?.logs ?? [];

        if (logs.length === 0) {
          setHTML(
            logsContainer,
            '<div class="log-entry"><div class="log-details">Keine Aktivitäten vorhanden</div></div>',
          );
          return;
        }

        const logsHTML = logs
          .map((log: { createdAt: string; action: string; userName: string; userRole: string; details?: string }) => {
            const date = new Date(log.createdAt);
            const timeString = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            const dateString = date.toLocaleDateString('de-DE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            });

            return `
              <div class="log-entry" data-action="navigate-logs" style="cursor: pointer;">
                <div class="log-entry-header">
                  <div class="log-action">${getActionLabel(log.action)}</div>
                  <div class="log-timestamp">${dateString} ${timeString}</div>
                </div>
                <div class="log-details">
                  <span class="log-user">${log.userName}</span>
                  <span class="role-badge role-${log.userRole}">${getuserRoleLabel(log.userRole)}</span>
                  ${log.details !== undefined && log.details !== '' ? ` - ${log.details}` : ''}
                </div>
              </div>
            `;
          })
          .join('');

        setHTML(logsContainer, logsHTML);
      }
    } catch (error) {
      console.error('Error loading activity logs:', error);
    }
  }

  // Helper function to get readable action labels
  function getActionLabel(action: string): string {
    const actionLabels = new Map<string, string>([
      ['login', 'Anmeldung'],
      ['logout', 'Abmeldung'],
      ['create', 'Erstellt'],
      ['update', 'Aktualisiert'],
      ['delete', 'Gelöscht'],
      ['upload', 'Hochgeladen'],
      ['download', 'Heruntergeladen'],
      ['view', 'Angesehen'],
      ['assign', 'Zugewiesen'],
      ['unassign', 'Entfernt'],
    ]);
    return actionLabels.get(action) ?? action;
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
});
