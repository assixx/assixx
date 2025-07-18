/**
 * Admin Configuration Page Script
 * Handles admin user management and activity logs
 */

import type { User } from '../types/api.types';

import { getAuthToken, showSuccess, showError } from './auth';
import { formatDateTime } from './common';

interface AdminUser extends User {
  company?: string;
  notes?: string;
  last_login?: string;
}

interface AdminLog {
  id: number;
  admin_id: number;
  action: string;
  description: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

interface AdminFormElements extends HTMLFormControlsCollection {
  'admin-id': HTMLInputElement;
  username: HTMLInputElement;
  email: HTMLInputElement;
  password: HTMLInputElement;
  company: HTMLInputElement;
  notes: HTMLTextAreaElement;
}

interface AdminUpdateForm extends HTMLFormElement {
  readonly elements: AdminFormElements & HTMLFormControlsCollection;
}

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const updateAdminForm = document.getElementById('update-admin-form') as AdminUpdateForm;
  const adminDetailsContainer = document.getElementById('admin-details') as HTMLElement;
  const adminUsernameTitle = document.getElementById('admin-username') as HTMLElement;
  const backBtn = document.getElementById('back-btn') as HTMLButtonElement;
  const tabButtons = document.querySelectorAll<HTMLButtonElement>('.tab-btn');

  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const adminId = urlParams.get('id');
  const adminUsername = urlParams.get('username');

  if (!adminId) {
    showError('Keine Admin-ID angegeben');
    return;
  }

  // Store admin ID in form
  const adminIdInput = document.getElementById('admin-id') as HTMLInputElement;
  if (adminIdInput) {
    adminIdInput.value = adminId;
  }

  // Display admin username in title
  if (adminUsername && adminUsernameTitle) {
    adminUsernameTitle.textContent = `Admin bearbeiten: ${adminUsername}`;
  }

  // Tab switching functionality
  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      // Set active tab button
      tabButtons.forEach((btn) => btn.classList.remove('active'));
      button.classList.add('active');

      // Set active tab content
      const tabId = button.getAttribute('data-tab');
      if (!tabId) return;

      document.querySelectorAll<HTMLElement>('.tab-content').forEach((tab) => {
        tab.classList.remove('active');
      });

      const activeTab = document.getElementById(tabId);
      if (activeTab) {
        activeTab.classList.add('active');
      }

      // Load logs
      const days = tabId === 'logs-3days' ? 3 : tabId === 'logs-10days' ? 10 : tabId === 'logs-30days' ? 30 : 0; // 0 for "all"
      void loadAdminLogs(adminId, days);
    });
  });

  // Event listeners
  if (updateAdminForm) {
    updateAdminForm.addEventListener('submit', (e) => void updateAdmin(e));
  }

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.location.href = '/root-dashboard';
    });
  }

  // Load data
  void loadAdminDetails(adminId);
  void loadAdminLogs(adminId, 3); // Default: load last 3 days

  /**
   * Load admin details
   */
  async function loadAdminDetails(adminId: string): Promise<void> {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch(`/api/root/admin/${adminId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const admin: AdminUser = await response.json();
        displayAdminDetails(admin);
        populateAdminForm(admin);
      } else {
        const error = await response.json();
        showError(error.message ?? 'Fehler beim Laden der Admin-Details');
      }
    } catch (error) {
      console.error('Fehler beim Laden der Admin-Details:', error);
      showError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    }
  }

  /**
   * Display admin details
   */
  function displayAdminDetails(admin: AdminUser): void {
    if (!adminDetailsContainer) return;

    const createdAt = formatDateTime(admin.created_at);
    const lastLogin = admin.last_login ? formatDateTime(admin.last_login) : 'Noch nie';

    adminDetailsContainer.innerHTML = `
      <p><strong>Benutzer-ID:</strong> ${admin.id}</p>
      <p><strong>Registriert am:</strong> ${createdAt}</p>
      <p><strong>Letzter Login:</strong> ${lastLogin}</p>
    `;
  }

  /**
   * Populate admin form with data
   */
  function populateAdminForm(admin: AdminUser): void {
    const usernameInput = document.getElementById('username') as HTMLInputElement;
    const emailInput = document.getElementById('email') as HTMLInputElement;
    const companyInput = document.getElementById('company') as HTMLInputElement;
    const notesInput = document.getElementById('notes') as HTMLTextAreaElement;

    if (usernameInput) usernameInput.value = admin.username ?? '';
    if (emailInput) emailInput.value = admin.email ?? '';
    if (companyInput) companyInput.value = admin.company ?? '';
    if (notesInput) notesInput.value = admin.notes ?? '';
    // Password is not populated as it's not stored in plain text
  }

  /**
   * Update admin
   */
  async function updateAdmin(e: Event): Promise<void> {
    e.preventDefault();

    const form = e.target as AdminUpdateForm;
    const formData = new FormData(form);
    const token = getAuthToken();

    if (!token) return;

    // Prepare update data
    const updateData: Partial<AdminUser> & { password?: string } = {
      username: formData.get('username') as string,
      email: formData.get('email') as string,
      company: formData.get('company') as string,
      notes: formData.get('notes') as string,
    };

    // Only include password if provided
    const password = formData.get('password') as string;
    if (password) {
      updateData.password = password;
    }

    // Show loading state
    const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    const originalText = submitButton?.textContent ?? 'Speichern';
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Wird gespeichert...';
    }

    try {
      const response = await fetch(`/api/root/admin/${adminId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      const result = await response.json();

      if (response.ok) {
        showSuccess('Admin-Daten erfolgreich aktualisiert!');
        // Reload details to show updated data
        if (adminId) {
          void loadAdminDetails(adminId);
        }
      } else {
        showError(result.error ?? 'Fehler beim Aktualisieren der Admin-Daten');
      }
    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
      showError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    } finally {
      // Reset button state
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    }
  }

  /**
   * Load admin logs
   */
  async function loadAdminLogs(adminId: string, days: number): Promise<void> {
    const token = getAuthToken();
    if (!token) return;

    // Find the correct container for the active tab
    const activeTab = document.querySelector('.tab-content.active');
    if (!activeTab) return;

    const logsContainer = activeTab.querySelector('.logs-container') as HTMLElement;
    if (!logsContainer) return;

    // Show loading state
    logsContainer.innerHTML = '<p>Lade Logs...</p>';

    try {
      const url = days > 0 ? `/api/root/admin/${adminId}/logs?days=${days}` : `/api/root/admin/${adminId}/logs`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const logs: AdminLog[] = await response.json();
        displayAdminLogs(logs, logsContainer);
      } else {
        logsContainer.innerHTML = '<p class="error-message">Fehler beim Laden der Logs.</p>';
      }
    } catch (error) {
      console.error('Fehler beim Laden der Logs:', error);
      logsContainer.innerHTML = '<p class="error-message">Ein Fehler ist aufgetreten.</p>';
    }
  }

  /**
   * Display admin logs
   */
  function displayAdminLogs(logs: AdminLog[], container: HTMLElement): void {
    if (logs.length === 0) {
      container.innerHTML = '<p>Keine Logs gefunden.</p>';
      return;
    }

    const logsHtml = logs
      .map((log) => {
        const createdAt = formatDateTime(log.created_at);
        const actionClass = getActionClass(log.action);

        return `
        <div class="log-entry ${actionClass}">
          <div class="log-header">
            <span class="log-date">${createdAt}</span>
            <span class="log-action">${log.action}</span>
          </div>
          <div class="log-description">${log.description}</div>
          ${log.ip_address ? `<div class="log-ip">IP: ${log.ip_address}</div>` : ''}
        </div>
      `;
      })
      .join('');

    container.innerHTML = logsHtml;
  }

  /**
   * Get CSS class for action type
   */
  function getActionClass(action: string): string {
    switch (action.toLowerCase()) {
      case 'login':
        return 'log-login';
      case 'logout':
        return 'log-logout';
      case 'create':
        return 'log-create';
      case 'update':
        return 'log-update';
      case 'delete':
        return 'log-delete';
      default:
        return 'log-other';
    }
  }
});
