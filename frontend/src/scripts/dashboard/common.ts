/**
 * Dashboard Scripts - gemeinsame Funktionalität für alle Dashboard-Seiten
 */

import type { User } from '../../types/api.types';
import { apiClient } from '../../utils/api-client';
import { getAuthToken, removeAuthToken } from '../auth/index';
// import { formatDate as formatDateUtil } from './common';

interface TabClickDetail {
  value?: string;
  id: string;
}

interface DashboardUI {
  openModal: (modalId: string) => void;
  closeModal: (modalId: string) => void;
  formatDate: (dateString: string) => string;
}

document.addEventListener('DOMContentLoaded', () => {
  // Initialisiere Modals
  initModals();

  // Initialisiere Tab Navigation
  initTabs();

  // Logging-Handler für User Info und Logout
  void setupUserAndLogout();
});

/**
 * Modal-System Initialisierung
 */
function initModals(): void {
  // Close-Buttons für Modals
  document.querySelectorAll<HTMLElement>('.modal-close, [data-action="close"]').forEach((button) => {
    button.addEventListener('click', (e) => {
      // Find closest modal-overlay
      const target = e.currentTarget as HTMLElement;
      const modalOverlay = target.closest('.modal-overlay');
      if (modalOverlay) {
        closeModal(modalOverlay.id);
      }
    });
  });

  // Click outside modal to close
  document.querySelectorAll<HTMLElement>('.modal-overlay').forEach((modal) => {
    modal.addEventListener('click', (e: MouseEvent) => {
      if (e.target === modal) {
        closeModal(modal.id);
      }
    });
  });
}

/**
 * Öffnet ein Modal
 */
function openModal(modalId: string): void {
  const modal = document.querySelector<HTMLElement>(`#${modalId}`);
  if (modal) {
    modal.style.opacity = '1';
    modal.style.visibility = 'visible';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent scrolling while modal is open
  }
}

/**
 * Schließt ein Modal
 */
function closeModal(modalId: string): void {
  const modal = document.querySelector<HTMLElement>(`#${modalId}`);
  if (modal) {
    modal.style.opacity = '0';
    modal.style.visibility = 'hidden';
    modal.classList.remove('active');
    document.body.style.overflow = ''; // Restore scrolling
  }
}

/**
 * Tab-Navigation Initialisierung
 */
function initTabs(): void {
  document.querySelectorAll<HTMLElement>('.tab-btn').forEach((button) => {
    button.addEventListener('click', (e) => {
      // Deactivate all tabs
      const target = e.currentTarget as HTMLElement;
      const parent = target.closest('.tab-navigation');
      if (!parent) return;

      parent.querySelectorAll<HTMLElement>('.tab-btn').forEach((btn) => {
        btn.classList.remove('active');
      });

      // Activate clicked tab
      target.classList.add('active');

      // Trigger the tab click event for custom handlers
      const event = new CustomEvent<TabClickDetail>('tabClick', {
        detail: {
          value: target.dataset.value,
          id: target.id,
        },
      });
      document.dispatchEvent(event);
    });
  });
}

/**
 * Fetch user data from API v1 or v2
 */
async function fetchUserData(token: string): Promise<User> {
  // Try v2 API first, fallback to v1 if needed
  try {
    return await apiClient.get<User>('/users/me');
  } catch (error) {
    console.error('Error fetching user data with v2:', error);
    // Fallback to v1 API
    const response = await fetch('/api/user/profile', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Fehler beim Laden der Benutzerdaten');
    }

    return (await response.json()) as User;
  }
}

/**
 * Get display name from user data
 */
function getDisplayName(userData: User): string {
  if (userData.first_name !== undefined && userData.first_name !== '') {
    return `${userData.first_name} ${userData.last_name ?? ''}`;
  }
  return userData.username;
}

/**
 * Handle user info display
 */
async function handleUserInfoDisplay(userInfo: Element): Promise<void> {
  const token = getAuthToken();

  if (token === null || token === '') {
    window.location.href = '/login';
    return;
  }

  try {
    const userData = await fetchUserData(token);
    const displayName = getDisplayName(userData);
    userInfo.textContent = displayName;
  } catch (error) {
    console.error('Fehler beim Laden der Benutzerdaten:', error);
    window.location.href = '/login';
  }
}

/**
 * Setup logout button handler
 */
function setupLogoutHandler(logoutBtn: Element): void {
  logoutBtn.addEventListener('click', () => {
    removeAuthToken();
    window.location.href = '/login';
  });
}

/**
 * Benutzerdaten und Logout-Funktionalität
 */
async function setupUserAndLogout(): Promise<void> {
  const userInfo = document.querySelector('#user-info');
  const logoutBtn = document.querySelector('#logout-btn');

  if (userInfo !== null) {
    await handleUserInfoDisplay(userInfo);
  }

  if (logoutBtn !== null) {
    setupLogoutHandler(logoutBtn);
  }
}

/**
 * Hilfsfunktion zum Formatieren eines Datums
 */
function formatDate(dateString: string): string {
  if (dateString === '') return '-';

  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Expose global utilities
declare global {
  interface Window {
    DashboardUI?: DashboardUI;
  }
}

if (typeof window !== 'undefined') {
  window.DashboardUI = {
    openModal,
    closeModal,
    formatDate,
  };
}

// Export functions for module usage
export { openModal, closeModal, formatDate, initModals, initTabs };
