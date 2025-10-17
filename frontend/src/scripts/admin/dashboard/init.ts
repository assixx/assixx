/**
 * Admin Dashboard Initialization Module
 * Handles page-specific initialization that was previously inline
 * Following strict TypeScript standards and best practices
 */

import { SessionManager } from '../../utils/session-manager';
import { initBreadcrumb } from '../../components/breadcrumb';

/**
 * Initialize admin dashboard page
 */
export function initAdminDashboard(): void {
  // Validate dashboard access
  const session = SessionManager.getInstance();
  session.validateDashboardAccess('admin');

  // Clear any stored active navigation to ensure dashboard is selected
  localStorage.removeItem('activeNavigation');

  // Dashboard section is always visible (no more section switching)
  const dashboardSection = document.querySelector<HTMLElement>('#dashboard-section');
  if (dashboardSection !== null) {
    dashboardSection.classList.remove('hidden');
    dashboardSection.classList.add('block');
  }

  // Initialize button navigation
  initButtonNavigation();
}

/**
 * Initialize button navigation for card action buttons
 */
function initButtonNavigation(): void {
  // Find all buttons with data-href attribute
  const navigationButtons = document.querySelectorAll<HTMLButtonElement>('button[data-href]');

  navigationButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const href = button.dataset.href;
      if (href !== undefined && href !== '') {
        window.location.href = href;
      }
    });
  });
}

/**
 * Mark body as loaded after all scripts
 */
export function markBodyAsLoaded(): void {
  setTimeout(() => {
    document.body.classList.add('loaded');
  }, 100);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initAdminDashboard();
    initBreadcrumb();
  });
} else {
  // DOM is already ready
  initAdminDashboard();
  initBreadcrumb();
}

// Mark body as loaded after all scripts
window.addEventListener('load', () => {
  markBodyAsLoaded();
});
