/**
 * Root Dashboard Script
 * Handles root user dashboard functionality and admin management
 */

import type { User } from '../types/api.types';
import { ApiClient } from '../utils/api-client';

import { getAuthToken } from './auth';

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
  console.info('Stored token:', token ? 'Token vorhanden' : 'Kein Token gefunden');

  if (!token) {
    console.error('No token found. Redirecting to login...');
    // Hide all content immediately
    document.body.style.display = 'none';
    // Redirect to login
    window.location.href = '/login';
    return;
  }

  // Elemente aus dem DOM holen
  const createAdminForm = document.getElementById('create-admin-form') as CreateAdminForm;
  // const logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement; // Not used - handled by unified-navigation
  const dashboardContent = document.getElementById('dashboard-data');

  // Event-Listener hinzufügen
  if (createAdminForm) {
    createAdminForm.addEventListener('submit', (e) => void createAdmin(e));
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

      const user = await apiClient.request<UserWithEmployeeNumber>('/users/me');

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
    const modal = document.getElementById('employeeNumberModal');
    const form = document.getElementById('employeeNumberForm') as HTMLFormElement;
    const input = document.getElementById('employeeNumberInput') as HTMLInputElement;

    if (!modal || !form || !input) return;

    modal.style.display = 'flex';
    input.focus();

    // Allow letters, numbers and hyphens
    input.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      target.value = target.value.replace(/[^A-Za-z0-9-]/g, '');
    });

    form.addEventListener('submit', (e) => {
      void (async () => {
        e.preventDefault();

        const employeeNumber = input.value;

        if (employeeNumber.length < 1 || employeeNumber.length > 10) {
          alert('Die Personalnummer muss zwischen 1 und 10 Zeichen lang sein.');
          return;
        }

        try {
          await apiClient.request('/users/me', {
            method: 'PATCH',
            body: JSON.stringify({ employee_number: employeeNumber }),
          });

          alert('Personalnummer erfolgreich gespeichert.');
          modal.style.display = 'none';
          // Reload to update UI
          window.location.reload();
        } catch (error) {
          console.error('Error updating employee number:', error);
          alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
        }
      })();
    });
  }

  // Admin erstellen
  async function createAdmin(e: Event): Promise<void> {
    e.preventDefault();
    console.info('Creating admin...');

    if (!createAdminForm) return;

    const elements = createAdminForm.elements;

    // Validate email match
    if (elements.email.value !== elements.email_confirm.value) {
      alert('Die E-Mail-Adressen stimmen nicht überein!');
      elements.email_confirm.focus();
      return;
    }

    // Validate password match
    if (elements.password.value !== elements.password_confirm.value) {
      alert('Die Passwörter stimmen nicht überein!');
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
      await apiClient.request('/root/admins', {
        method: 'POST',
        body: JSON.stringify(adminData),
      });

      alert('Admin erfolgreich erstellt');
      createAdminForm.reset();
      void loadAdmins();
    } catch (error) {
      console.error('Fehler beim Erstellen des Admins:', error);

      alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    }
  }

  // Dashboard-Daten laden
  async function loadDashboardData(): Promise<void> {
    console.info('Loading dashboard data...');

    if (!dashboardContent) return;

    try {
      const data: DashboardData = await apiClient.request('/root/dashboard');
      console.info('Dashboard data:', data);
      dashboardContent.innerHTML = ``;
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  }

  // Dashboard-Statistiken laden
  async function loadDashboardStats(): Promise<void> {
    try {
      const [adminsResponse, usersResponse] = await Promise.all([
        apiClient.request<{ admins: AdminUser[] }>('/root/admins'),
        apiClient.request<{ data: User[] }>('/users'),
      ]);

      const admins = adminsResponse.admins || [];
      const users = usersResponse.data || [];

      // Update counters
      const adminCount = document.getElementById('admin-count');
      const userCount = document.getElementById('user-count');
      const tenantCount = document.getElementById('tenant-count');

      if (adminCount && Array.isArray(admins)) {
        adminCount.textContent = admins.length.toString();
      }
      if (userCount && Array.isArray(users)) {
        userCount.textContent = users.length.toString();
      }
      if (tenantCount) tenantCount.textContent = '1'; // TODO: Implement tenant count
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  }

  // Admin-Liste laden
  async function loadAdmins(): Promise<void> {
    try {
      console.info('Loading admins...');
      const response = await apiClient.request<{ admins: AdminUser[] }>('/root/admins');
      const admins = response.admins || [];
      console.info('Loaded admins:', admins);
      displayAdmins(admins);

      // Update admin count
      const adminCount = document.getElementById('admin-count');
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

  // Load user info in header
  async function loadHeaderUserInfo(): Promise<void> {
    try {
      const token = getAuthToken();
      const userNameElement = document.getElementById('user-name');
      const userAvatar = document.getElementById('user-avatar') as HTMLImageElement;

      if (!token || !userNameElement) return;

      // Parse JWT token to get basic user info
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        userNameElement.textContent = payload.userName ?? 'Root';
      } catch (e) {
        console.error('Error parsing JWT token:', e);
      }

      // Try to fetch full user profile for more details
      try {
        const user = await apiClient.request<User>('/users/me');

        // Update username with full name if available
        if (user.first_name || user.last_name) {
          const fullName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
          userNameElement.textContent = fullName ?? (user.username || 'Root');
        } else {
          userNameElement.textContent = user.username ?? 'Root';
        }

        // Update avatar if available
        if (userAvatar && user.profile_picture_url) {
          userAvatar.src = user.profile_picture_url;
          userAvatar.onerror = function () {
            this.src = '/images/default-avatar.svg';
          };
        }
      } catch {
        // Error is already logged in the outer catch
      }
    } catch (error) {
      console.error('Error loading user info:', error);
      // Fallback to local storage
      const user = JSON.parse(localStorage.getItem('user') ?? '{}');
      const userName = document.getElementById('user-name');
      if (userName) {
        userName.textContent = user.userName ?? 'Root';
      }
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
      }>('/logs?limit=20');
      const logsContainer = document.getElementById('activity-logs');

      if (logsContainer && result) {
        // Handle both response formats (direct logs array or nested in data)
        const logs = result.logs ?? result.data?.logs ?? [];

        if (logs.length === 0) {
          logsContainer.innerHTML =
            '<div class="log-entry"><div class="log-details">Keine Aktivitäten vorhanden</div></div>';
          return;
        }

        logsContainer.innerHTML = logs
          .map((log: { createdAt: string; action: string; userName: string; userRole: string; details?: string }) => {
            const date = new Date(log.createdAt);
            const timeString = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            const dateString = date.toLocaleDateString('de-DE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            });

            return `
              <div class="log-entry" onclick="window.location.href = "/logs"">
                <div class="log-entry-header">
                  <div class="log-action">${getActionLabel(log.action)}</div>
                  <div class="log-timestamp">${dateString} ${timeString}</div>
                </div>
                <div class="log-details">
                  <span class="log-user">${log.userName}</span>
                  <span class="role-badge role-${log.userRole}">${getuserRoleLabel(log.userRole)}</span>
                  ${log.details ? ` - ${log.details}` : ''}
                </div>
              </div>
            `;
          })
          .join('');
      }
    } catch (error) {
      console.error('Error loading activity logs:', error);
    }
  }

  // Helper function to get readable action labels
  function getActionLabel(action: string): string {
    const actionLabels: Record<string, string> = {
      login: 'Anmeldung',
      logout: 'Abmeldung',
      create: 'Erstellt',
      update: 'Aktualisiert',
      delete: 'Gelöscht',
      upload: 'Hochgeladen',
      download: 'Heruntergeladen',
      view: 'Angesehen',
      assign: 'Zugewiesen',
      unassign: 'Entfernt',
    };
    return actionLabels[action] ?? action;
  }

  // Helper function to get readable userRole labels
  function getuserRoleLabel(userRole: string): string {
    const userRoleLabels: Record<string, string> = {
      root: 'Root',
      admin: 'Admin',
      employee: 'Mitarbeiter',
    };
    return userRoleLabels[userRole] ?? userRole;
  }
});
