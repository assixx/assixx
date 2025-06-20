/**
 * Root Dashboard Script
 * Handles root user dashboard functionality and admin management
 */

import type { User } from '../types/api.types';
import { getAuthToken } from './auth';

interface AdminUser extends User {
  company?: string;
  position?: string;
  notes?: string;
}

interface DashboardData {
  user: {
    id: number;
    username: string;
    role: string;
    iat: number;
    exp: number;
  };
}

interface CreateAdminFormElements extends HTMLFormControlsCollection {
  username: HTMLInputElement;
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
    window.location.href = '/pages/login.html';
    return;
  }

  // Elemente aus dem DOM holen
  const createAdminForm = document.getElementById('create-admin-form') as CreateAdminForm;
  const logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement;
  const dashboardContent = document.getElementById('dashboard-data') as HTMLElement;

  // Event-Listener hinzufügen
  if (createAdminForm) {
    createAdminForm.addEventListener('submit', createAdmin);
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      logout().catch((error) => {
        console.error('Logout error:', error);
        // Fallback
        window.location.href = '/pages/login.html';
      });
    });
  }

  // Load user info in header
  loadHeaderUserInfo();

  // Daten laden
  loadDashboardData();
  loadAdmins();
  loadDashboardStats();
  loadActivityLogs();

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
      username: elements.username.value,
      first_name: elements.first_name.value,
      last_name: elements.last_name.value,
      email: elements.email.value,
      password: elements.password.value,
      position: elements.position.value,
      notes: elements.notes?.value || '',
    };

    try {
      const response = await fetch('/root/create-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(adminData),
      });

      if (response.ok) {
        await response.json();

        alert('Admin erfolgreich erstellt');
        createAdminForm.reset();
        loadAdmins();
      } else {
        const error = await response.json();

        alert(`Fehler: ${error.message}`);
      }
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
      const response = await fetch('/api/root-dashboard-data', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data: DashboardData = await response.json();
        console.info('Dashboard data:', data);
        dashboardContent.innerHTML = ``;
      } else {
        console.error('Error loading dashboard:', response.status);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  }

  // Dashboard-Statistiken laden
  async function loadDashboardStats(): Promise<void> {
    try {
      const [adminsResponse, usersResponse] = await Promise.all([
        fetch('/root/admins', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/users', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (adminsResponse.ok && usersResponse.ok) {
        const admins: AdminUser[] = await adminsResponse.json();
        const users: User[] = await usersResponse.json();

        // Update counters
        const adminCount = document.getElementById('admin-count');
        const userCount = document.getElementById('user-count');
        const tenantCount = document.getElementById('tenant-count');

        if (adminCount) adminCount.textContent = admins.length.toString();
        if (userCount) userCount.textContent = users.length.toString();
        if (tenantCount) tenantCount.textContent = '1'; // TODO: Implement tenant count
      }
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  }

  // Admin-Liste laden
  async function loadAdmins(): Promise<void> {
    try {
      console.info('Loading admins...');
      const response = await fetch('/root/admins', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const admins: AdminUser[] = await response.json();
        console.info('Loaded admins:', admins);
        displayAdmins(admins);

        // Update admin count
        const adminCount = document.getElementById('admin-count');
        if (adminCount) {
          adminCount.textContent = admins.length.toString();
        }
      } else {
        console.error('Error loading admins:', response.status);
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

  // Ausloggen
  async function logout(): Promise<void> {
    console.info('Logging out...');

    if (confirm('Möchten Sie sich wirklich abmelden?')) {
      try {
        // Import and use the logout function from auth module
        const { logout: authLogout } = await import('./auth.js');
        await authLogout();
      } catch (error) {
        console.error('Logout error:', error);
        // Fallback
        window.location.href = '/pages/login.html';
      }
    }
  }

  // Load user info in header
  async function loadHeaderUserInfo(): Promise<void> {
    try {
      const token = getAuthToken();
      const userNameElement = document.getElementById('user-name') as HTMLElement;
      const userAvatar = document.getElementById('user-avatar') as HTMLImageElement;

      if (!token || !userNameElement) return;

      // Parse JWT token to get basic user info
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        userNameElement.textContent = payload.username || 'Root';
      } catch (e) {
        console.error('Error parsing JWT token:', e);
      }

      // Try to fetch full user profile for more details
      const response = await fetch('/api/user/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const userData = (await response.json()) as { data?: User; user?: User } & User;
        const user = userData.data || userData.user || userData;

        // Update username with full name if available
        if (user.first_name || user.last_name) {
          const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
          userNameElement.textContent = fullName || user.username || 'Root';
        } else {
          userNameElement.textContent = user.username || 'Root';
        }

        // Update avatar if available
        if (userAvatar && user.profile_picture_url) {
          userAvatar.src = user.profile_picture_url;
          userAvatar.onerror = function () {
            this.src = '/images/default-avatar.svg';
          };
        }
      }
    } catch (error) {
      console.error('Error loading user info:', error);
      // Fallback to local storage
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const userName = document.getElementById('user-name');
      if (userName) {
        userName.textContent = user.username || 'Root';
      }
    }
  }

  // Activity Logs laden
  async function loadActivityLogs(): Promise<void> {
    try {
      const response = await fetch('/api/logs?limit=20', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        const logsContainer = document.getElementById('activity-logs');

        if (logsContainer && result.success && result.data) {
          const logs = result.data.logs;

          if (logs.length === 0) {
            logsContainer.innerHTML =
              '<div class="log-entry"><div class="log-details">Keine Aktivitäten vorhanden</div></div>';
            return;
          }

          logsContainer.innerHTML = logs
            .map((log: any) => {
              const date = new Date(log.created_at);
              const timeString = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
              const dateString = date.toLocaleDateString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              });

              return `
              <div class="log-entry" onclick="window.location.href='/pages/logs.html'">
                <div class="log-entry-header">
                  <div class="log-action">${getActionLabel(log.action)}</div>
                  <div class="log-timestamp">${dateString} ${timeString}</div>
                </div>
                <div class="log-details">
                  <span class="log-user">${log.user_name}</span>
                  <span style="color: var(--text-secondary);">(${getRoleLabel(log.user_role)})</span>
                  ${log.details ? ` - ${log.details}` : ''}
                </div>
              </div>
            `;
            })
            .join('');
        }
      }
    } catch (error) {
      console.error('Error loading activity logs:', error);
    }
  }

  // Helper function to get readable action labels
  function getActionLabel(action: string): string {
    const actionLabels: { [key: string]: string } = {
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
    return actionLabels[action] || action;
  }

  // Helper function to get readable role labels
  function getRoleLabel(role: string): string {
    const roleLabels: { [key: string]: string } = {
      root: 'Root',
      admin: 'Admin',
      employee: 'Mitarbeiter',
    };
    return roleLabels[role] || role;
  }
});
