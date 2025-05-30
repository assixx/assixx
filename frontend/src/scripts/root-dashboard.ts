/**
 * Root Dashboard Script
 * Handles root user dashboard functionality and admin management
 */

import type { User } from '../types/api.types';
import { getAuthToken, removeAuthToken } from './auth';

interface AdminUser extends User {
  company?: string;
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
  email: HTMLInputElement;
  password: HTMLInputElement;
  company?: HTMLInputElement;
}

interface CreateAdminForm extends HTMLFormElement {
  readonly elements: CreateAdminFormElements;
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('Root dashboard script loaded');
  const token = getAuthToken();
  console.log('Stored token:', token ? 'Token vorhanden' : 'Kein Token gefunden');

  if (!token) {
    console.error('No token found. Redirecting to login...');
    window.location.href = '/pages/index.html';
    return;
  }

  // Elemente aus dem DOM holen
  const createAdminForm = document.getElementById('create-admin-form') as CreateAdminForm;
  const adminTableBody = document.getElementById('admin-table-body') as HTMLTableSectionElement;
  const logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement;
  const dashboardContent = document.getElementById('dashboard-data') as HTMLElement;

  // Event-Listener hinzufügen
  if (createAdminForm) {
    createAdminForm.addEventListener('submit', createAdmin);
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  // Load user info in header
  loadHeaderUserInfo();

  // Daten laden
  loadDashboardData();
  loadAdmins();
  loadDashboardStats();

  // Admin erstellen
  async function createAdmin(e: Event): Promise<void> {
    e.preventDefault();
    console.log('Creating admin...');

    if (!createAdminForm) return;

    const formData = new FormData(createAdminForm);
    const adminData = Object.fromEntries(formData.entries());

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
        const _result = await response.json();
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
    console.log('Loading dashboard data...');

    if (!dashboardContent) return;

    try {
      const response = await fetch('/api/root-dashboard-data', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data: DashboardData = await response.json();
        console.log('Dashboard data:', data);
        dashboardContent.innerHTML = `
    <div class="dashboard-stats">
        <div class="stat-box">
            <h3>Nutzerinformationen</h3>
            <p><strong>Benutzername:</strong> ${data.user.username}</p>
            <p><strong>Rolle:</strong> ${data.user.role}</p>
            <p><strong>Benutzer-ID:</strong> ${data.user.id}</p>
        </div>
        <div class="stat-box">
            <h3>Sitzungsinformationen</h3>
            <p><strong>Angemeldet seit:</strong> ${new Date(data.user.iat * 1000).toLocaleString()}</p>
            <p><strong>Sitzung gültig bis:</strong> ${new Date(data.user.exp * 1000).toLocaleString()}</p>
            <p><strong>Verbleibende Zeit:</strong> ${Math.floor((data.user.exp - Date.now() / 1000) / 60)} Minuten</p>
        </div>
    </div>
`;
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
      console.log('Loading admins...');
      const response = await fetch('/root/admins', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const admins: AdminUser[] = await response.json();
        console.log('Loaded admins:', admins);
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

  // Admin-Liste anzeigen
  function displayAdmins(admins: AdminUser[]): void {
    if (!adminTableBody) return;

    adminTableBody.innerHTML = '';
    admins.forEach((admin) => {
      const row = document.createElement('tr');
      row.innerHTML = `
            <td>${admin.username}</td>
            <td>${admin.email}</td>
            <td>${admin.company || '-'}</td>
            <td>
                <button 
                    class="config-btn btn btn-success btn-sm" 
                    data-id="${admin.id}" 
                    data-username="${admin.username}">
                    Konfigurieren
                </button>
                <button 
                    class="delete-btn btn btn-danger btn-sm" 
                    data-id="${admin.id}" 
                    data-username="${admin.username}">
                    Löschen
                </button>
            </td>
        `;
      adminTableBody.appendChild(row);
    });

    // Event-Listener für Lösch-Buttons hinzufügen
    document.querySelectorAll<HTMLButtonElement>('.delete-btn').forEach((button) => {
      button.addEventListener('click', deleteAdmin);
    });

    // Event-Listener für Konfigurations-Buttons hinzufügen
    document.querySelectorAll<HTMLButtonElement>('.config-btn').forEach((button) => {
      button.addEventListener('click', configureAdmin);
    });
  }

  // Funktion zum Navigieren zur Admin-Konfigurationsseite
  function configureAdmin(e: Event): void {
    const button = e.target as HTMLButtonElement;
    const adminId = button.getAttribute('data-id');
    const adminUsername = button.getAttribute('data-username');

    if (!adminId || !adminUsername) return;

    // Zur Konfigurationsseite navigieren und die Admin-ID übergeben
    window.location.href = `/admin-config?id=${adminId}&username=${encodeURIComponent(adminUsername)}`;
  }

  async function deleteAdmin(e: Event): Promise<void> {
    const button = e.target as HTMLButtonElement;
    const adminId = button.getAttribute('data-id');
    const adminUsername = button.getAttribute('data-username');

    if (!adminId || !adminUsername) return;

    if (!confirm(`Sind Sie sicher, dass Sie den Admin "${adminUsername}" löschen möchten?`)) {
      return;
    }

    const currentToken = getAuthToken();
    if (!currentToken) return;

    try {
      const response = await fetch(`/root/delete-admin/${adminId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      });

      if (response.ok) {
        alert(`Admin "${adminUsername}" wurde erfolgreich gelöscht.`);
        // Admin-Liste neu laden
        loadAdmins();
      } else {
        const error = await response.json();
        alert(`Fehler: ${error.message}`);
      }
    } catch (error) {
      console.error('Fehler beim Löschen des Admins:', error);
      alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    }
  }

  // Ausloggen
  function logout(): void {
    console.log('Logging out...');
    if (confirm('Möchten Sie sich wirklich abmelden?')) {
      removeAuthToken();
      localStorage.removeItem('role');
      window.location.href = '/pages/index.html';
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
        const userData: any = await response.json();
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
});
