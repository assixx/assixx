/**
 * Dashboard Scripts - gemeinsame Funktionalität für alle Dashboard-Seiten
 */

import type { User } from '../types/api.types';
import { apiClient } from '../utils/api-client';
import { getAuthToken, removeAuthToken } from './auth';
// import { formatDate as formatDateUtil } from './common';

interface TabClickDetail {
  value?: string;
  id: string;
}

interface DashboardUI {
  openModal: (modalId: string) => void;
  closeModal: (modalId: string) => void;
  showToast: (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
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
  const modal = document.getElementById(modalId);
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
  const modal = document.getElementById(modalId);
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
 * Benutzerdaten und Logout-Funktionalität
 */
async function setupUserAndLogout(): Promise<void> {
  const userInfo = document.querySelector('#user-info');
  const logoutBtn = document.querySelector('#logout-btn');

  if (userInfo) {
    // Lade Benutzerdaten
    const token = getAuthToken();
    if (token !== null && token !== '') {
      try {
        const useV2Users = window.FEATURE_FLAGS?.USE_API_V2_USERS;
        let userData: User | null = null;

        if (useV2Users === true) {
          // Use API v2 with apiClient
          userData = await apiClient.get<User>('/users/profile');
        } else {
          // Use API v1 with fetch
          const response = await fetch('/api/user/profile', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (!response.ok) {
            throw new Error('Fehler beim Laden der Benutzerdaten');
          }

          userData = (await response.json()) as User;
        }

        // Anzeigename setzen (Name oder Username)
        const displayName =
          userData.first_name !== undefined && userData.first_name !== ''
            ? `${userData.first_name} ${userData.last_name ?? ''}`
            : userData.username;
        userInfo.textContent = displayName;
      } catch (error) {
        console.error('Fehler beim Laden der Benutzerdaten:', error);
        // Bei Fehler zur Login-Seite weiterleiten
        window.location.href = '/login';
      }
    } else {
      window.location.href = '/login';
    }
  }

  if (logoutBtn !== null) {
    logoutBtn.addEventListener('click', () => {
      removeAuthToken();
      window.location.href = '/login';
    });
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

/**
 * Toast-Benachrichtigung anzeigen
 */
function showToast(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info'): void {
  // Create toast container if it doesn't exist
  let toastContainer = document.querySelector<HTMLElement>('.toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.append(toastContainer);
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast-${type} fade-in`;
  toast.innerHTML = message;

  // Add to container
  toastContainer.append(toast);

  // Auto remove after 3 seconds
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
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
    showToast,
    formatDate,
  };
}

// Export functions for module usage
export { openModal, closeModal, showToast, formatDate, initModals, initTabs };
