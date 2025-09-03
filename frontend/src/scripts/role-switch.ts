/**
 * Role Switch Functionality
 * Ermöglicht Admins zwischen Admin und Employee View zu wechseln
 */

import { apiClient } from '../utils/api-client';
import { $$ } from '../utils/dom-utils';

// Check if user is admin or root
const userRole = localStorage.getItem('userRole');
let currentView = localStorage.getItem('activeRole') ?? userRole;

// Role switch handler
async function switchRole(): Promise<void> {
  const switchBtn = $$('#role-switch-btn') as HTMLButtonElement | null;
  const roleIndicator = $$('#role-indicator');

  if (switchBtn === null || roleIndicator === null) return;

  // Disable button during switch
  switchBtn.disabled = true;
  switchBtn.style.opacity = '0.5';

  try {
    // Get current active role from localStorage
    const currentActiveRole = localStorage.getItem('activeRole') ?? userRole;

    // Determine the endpoint based on current view and original role
    let endpoint = '';
    const isCurrentlyEmployee = currentActiveRole === 'employee';

    if (userRole === 'root') {
      // Root switching logic
      if (currentActiveRole === 'employee' || currentActiveRole === 'admin') {
        endpoint = '/api/role-switch/to-original'; // Back to Root
      } else {
        // Root can switch to admin or employee (handled by dropdown)
        endpoint = '/api/role-switch/to-employee'; // Default
      }
    } else {
      // Admin switching logic
      endpoint = isCurrentlyEmployee ? '/api/role-switch/to-original' : '/api/role-switch/to-employee';
    }

    const response = await apiClient.post<{
      token: string;
      user: {
        activeRole: string;
      };
      message?: string;
    }>(endpoint, {});

    // Update token and storage
    localStorage.setItem('token', response.token);
    localStorage.setItem('activeRole', response.user.activeRole);

    // Also update sessionStorage for KVP page compatibility
    if (response.user.activeRole === 'employee' && (userRole === 'admin' || userRole === 'root')) {
      sessionStorage.setItem('roleSwitch', 'employee');
    } else {
      sessionStorage.removeItem('roleSwitch');
    }

    // Update currentView immediately
    currentView = response.user.activeRole;

    // Clear all role switch banner dismissal states when switching roles
    ['root', 'admin', 'employee'].forEach((role) => {
      localStorage.removeItem(`roleSwitchBannerDismissed_${role}`);
    });

    // Update UI immediately before redirect
    updateRoleUI();

    // Show success message based on target role
    let message = '';
    if (response.user.activeRole === 'employee') {
      message = 'Wechsel zur Mitarbeiter-Ansicht...';
    } else if (response.user.activeRole === 'admin') {
      message = 'Wechsel zur Admin-Ansicht...';
    } else if (response.user.activeRole === 'root') {
      message = 'Wechsel zur Root-Ansicht...';
    }

    // Create toast notification
    showToast(message, 'success');

    // Always redirect to the appropriate dashboard
    setTimeout(() => {
      const newRole = response.user.activeRole;

      // Direct redirect to dashboard based on role
      if (newRole === 'admin') {
        window.location.href = '/admin-dashboard';
      } else if (newRole === 'employee') {
        window.location.href = '/employee-dashboard';
      } else {
        window.location.href = '/root-dashboard';
      }
    }, 1000);
  } catch (error) {
    console.error('Role switch error:', error);
    showToast('Fehler beim Rollenwechsel', 'error');

    // Re-enable button
    switchBtn.disabled = false;
    switchBtn.style.opacity = '1';
  }
}

// Update UI based on current role
function updateRoleUI(): void {
  const roleIndicator = $$('#role-indicator');
  const switchBtn = $$('#role-switch-btn') as HTMLButtonElement | null;
  const switchText = switchBtn !== null ? switchBtn.querySelector('.role-switch-text') : null;

  if (roleIndicator === null || switchBtn === null) return;

  // Update currentView from localStorage
  currentView = localStorage.getItem('activeRole') ?? userRole;

  if (currentView === 'employee' && userRole === 'admin') {
    // Admin is viewing as employee
    roleIndicator.textContent = 'Mitarbeiter';
    roleIndicator.classList.remove('admin');
    roleIndicator.classList.add('employee');

    if (switchText) {
      switchText.textContent = 'Als Admin';
    }
    switchBtn.title = 'Zurück zur Admin-Ansicht';
  } else if (userRole === 'admin') {
    // Normal admin view
    roleIndicator.textContent = 'Admin';
    roleIndicator.classList.remove('employee');
    roleIndicator.classList.add('admin');

    if (switchText) {
      switchText.textContent = 'Als Mitarbeiter';
    }
    switchBtn.title = 'Als Mitarbeiter anzeigen';
  }
}

// Toast notification helper
function showToast(message: string, type: 'success' | 'error' | 'warning' = 'success'): void {
  // Try to use existing toast system first
  interface ToastWindow {
    DashboardUI?: {
      showToast: (message: string, type: 'success' | 'error' | 'warning') => void;
    };
  }

  if (typeof window !== 'undefined') {
    const toastWindow = window as unknown as ToastWindow;
    if (toastWindow.DashboardUI?.showToast) {
      toastWindow.DashboardUI.showToast(message, type);
      return;
    }
  }

  // Fallback toast implementation
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  // Define colors based on type
  let bgColor, borderColor, textColor;
  if (type === 'success') {
    bgColor = 'rgba(76, 175, 80, 0.1)';
    borderColor = 'rgba(76, 175, 80, 0.2)';
    textColor = 'rgba(76, 175, 80, 0.9)';
  } else if (type === 'warning') {
    bgColor = 'rgba(255, 152, 0, 0.1)';
    borderColor = 'rgba(255, 152, 0, 0.2)';
    textColor = 'rgba(255, 152, 0, 0.9)';
  } else {
    bgColor = 'rgba(244, 67, 54, 0.1)';
    borderColor = 'rgba(244, 67, 54, 0.2)';
    textColor = 'rgba(244, 67, 54, 0.9)';
  }

  toast.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    padding: 16px 24px;
    background: ${bgColor};
    border: 1px solid ${borderColor};
    color: ${textColor};
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    z-index: 10000;
    font-size: 14px;
    font-weight: 500;
    backdrop-filter: blur(10px);
    animation: slideInRight 0.3s ease-out;
    display: flex;
    align-items: center;
    gap: 12px;
  `;

  // Add icon
  const icon = document.createElement('span');
  if (type === 'success') {
    icon.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>';
  } else if (type === 'warning') {
    icon.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>';
  } else {
    icon.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
  }

  // Add message text
  const messageSpan = document.createElement('span');
  messageSpan.textContent = message;

  toast.append(icon);
  toast.append(messageSpan);

  document.body.append(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease-in';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// Add animation styles if not already present
if (!document.querySelector('#toast-animations')) {
  const style = document.createElement('style');
  style.id = 'toast-animations';
  style.textContent = `
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  document.head.append(style);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Handle for admins
  const switchBtn = $$('#role-switch-btn') as HTMLButtonElement | null;

  if (userRole === 'admin' && switchBtn !== null) {
    switchBtn.style.display = 'flex';
    switchBtn.addEventListener('click', () => {
      void switchRole();
    });
    updateRoleUI();
  } else if (switchBtn !== null) {
    // Hide button for non-admins
    switchBtn.style.display = 'none';
  }

  // Handle for root users with dropdown
  const switchSelect = $$('#role-switch-select') as HTMLSelectElement | null;

  if (userRole === 'root' && switchSelect !== null) {
    switchSelect.style.display = 'block';

    // Set current value
    const activeRole = localStorage.getItem('activeRole') ?? 'root';
    switchSelect.value = activeRole;

    // Add change event listener
    switchSelect.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      const selectedRole = target.value as 'root' | 'admin' | 'employee';
      void switchRoleForRoot(selectedRole);
    });

    updateRoleUI();
  } else if (switchSelect !== null) {
    // Hide select for non-root users
    switchSelect.style.display = 'none';
  }
});

// Handle role switch for root with dropdown
export async function switchRoleForRoot(targetRole: 'root' | 'admin' | 'employee'): Promise<void> {
  // For custom dropdown, we'll update the display element instead
  const dropdownDisplay = $$('#roleSwitchDisplay');

  if (dropdownDisplay) {
    // Disable dropdown during switch
    dropdownDisplay.style.pointerEvents = 'none';
    dropdownDisplay.style.opacity = '0.5';
  }

  try {
    // Detailliertes Logging für Debugging
    const originalRole = localStorage.getItem('userRole');
    const activeRole = localStorage.getItem('activeRole');
    console.info('[RoleSwitch] ============ ROLE SWITCH DETAILS ============');
    console.info('[RoleSwitch] Original Role (userRole):', originalRole);
    console.info('[RoleSwitch] Current Active Role:', activeRole);
    console.info('[RoleSwitch] Target Role (selected):', targetRole);
    console.info('[RoleSwitch] Current View before switch:', activeRole ?? originalRole);

    // Wichtig: Wir müssen activeRole berücksichtigen, nicht nur targetRole!
    const currentActiveRole = activeRole ?? originalRole;

    // Check if already in the target role
    if (currentActiveRole === targetRole) {
      console.info('[RoleSwitch] Already in target role, showing warning');
      showToast(
        `Sie sind bereits als ${targetRole === 'root' ? 'Root' : targetRole === 'admin' ? 'Admin' : 'Mitarbeiter'} aktiv!`,
        'warning',
      );

      // Re-enable dropdown
      if (dropdownDisplay) {
        dropdownDisplay.style.pointerEvents = '';
        dropdownDisplay.style.opacity = '';
      }
      return;
    }

    // Determine endpoint based on CURRENT activeRole and TARGET role
    let endpoint = '';
    let switchDescription = '';

    // WICHTIG: Keine Prefixe hier! apiClient fügt das automatisch hinzu
    if (targetRole === 'root' && currentActiveRole !== 'root') {
      // Zurück zu Root von Admin oder Employee
      endpoint = '/role-switch/to-original';
      switchDescription = `${currentActiveRole ?? 'unknown'} → Root (to-original)`;
    } else if (targetRole === 'admin') {
      if (currentActiveRole === 'root') {
        // Root → Admin
        endpoint = '/role-switch/root-to-admin';
        switchDescription = 'Root → Admin (root-to-admin)';
      } else if (currentActiveRole === 'employee') {
        // Employee → Admin (wenn Original Role = Root)
        // Müssen erst zu Root zurück, dann zu Admin
        console.warn('[RoleSwitch] Cannot switch directly from Employee to Admin!');
        console.info('[RoleSwitch] Need to go: Employee → Root → Admin');
        // Versuchen wir to-original um zu Root zu kommen
        endpoint = '/role-switch/to-original';
        switchDescription = 'Employee → Root first (to-original)';
        // Nach erfolgreichem Switch müsste User nochmal auf Admin klicken
      }
    } else if (targetRole === 'employee') {
      if (currentActiveRole === 'root' || currentActiveRole === 'admin') {
        endpoint = '/role-switch/to-employee';
        switchDescription = `${currentActiveRole} → Employee (to-employee)`;
      } else {
        console.warn('[RoleSwitch] Already in employee view!');
        showToast('Sie sind bereits als Mitarbeiter aktiv!', 'warning');
        if (dropdownDisplay) {
          dropdownDisplay.style.pointerEvents = '';
          dropdownDisplay.style.opacity = '';
        }
        return;
      }
    }

    if (endpoint === '') {
      console.error('[RoleSwitch] No valid endpoint for switch!', {
        from: currentActiveRole,
        to: targetRole,
        original: originalRole,
      });
      return;
    }

    console.info('[RoleSwitch] Switch decision:', switchDescription);
    console.info('[RoleSwitch] Using endpoint:', endpoint);
    console.info('[RoleSwitch] ===========================================');

    const response = await apiClient.post<{
      token: string;
      user: {
        activeRole: string;
      };
      message?: string;
    }>(endpoint, {});

    // Update token and storage
    localStorage.setItem('token', response.token);
    localStorage.setItem('activeRole', response.user.activeRole);

    // Also update sessionStorage for KVP page compatibility
    if (response.user.activeRole === 'employee' && (userRole === 'admin' || userRole === 'root')) {
      sessionStorage.setItem('roleSwitch', 'employee');
    } else {
      sessionStorage.removeItem('roleSwitch');
    }

    // Update currentView immediately
    currentView = response.user.activeRole;

    // Clear all role switch banner dismissal states when switching roles
    ['root', 'admin', 'employee'].forEach((role) => {
      localStorage.removeItem(`roleSwitchBannerDismissed_${role}`);
    });

    // Show success message
    const message = `Wechsel zur ${targetRole === 'root' ? 'Root' : targetRole === 'admin' ? 'Admin' : 'Mitarbeiter'}-Ansicht...`;
    showToast(message, 'success');

    // Always redirect to the appropriate dashboard
    setTimeout(() => {
      // Direct redirect to dashboard based on target role
      if (targetRole === 'root') {
        window.location.href = '/root-dashboard';
      } else if (targetRole === 'admin') {
        window.location.href = '/admin-dashboard';
      } else {
        window.location.href = '/employee-dashboard';
      }
    }, 1000);
  } catch (error) {
    console.error('Role switch error:', error);
    showToast('Fehler beim Rollenwechsel', 'error');

    // Re-enable dropdown
    if (dropdownDisplay) {
      dropdownDisplay.style.pointerEvents = 'auto';
      dropdownDisplay.style.opacity = '1';
    }
  }
}

// Handle role switch for admin users
export async function switchRoleForAdmin(targetRole: 'admin' | 'employee'): Promise<void> {
  const dropdownDisplay = $$('#roleSwitchDisplay');

  if (dropdownDisplay) {
    dropdownDisplay.style.pointerEvents = 'none';
    dropdownDisplay.style.opacity = '0.5';
  }

  try {
    // Detailliertes Logging
    const originalRole = localStorage.getItem('userRole');
    const activeRole = localStorage.getItem('activeRole');
    console.info('[RoleSwitch-Admin] ============ ADMIN ROLE SWITCH ============');
    console.info('[RoleSwitch-Admin] Original Role:', originalRole);
    console.info('[RoleSwitch-Admin] Current Active Role:', activeRole);
    console.info('[RoleSwitch-Admin] Target Role:', targetRole);

    const currentActiveRole = activeRole ?? originalRole;

    // Check if already in the target role
    if (currentActiveRole === targetRole) {
      console.info('[RoleSwitch-Admin] Already in target role, showing warning');
      showToast(`Sie sind bereits als ${targetRole === 'admin' ? 'Admin' : 'Mitarbeiter'} aktiv!`, 'warning');

      // Re-enable dropdown if it exists
      if (dropdownDisplay) {
        dropdownDisplay.style.pointerEvents = '';
        dropdownDisplay.style.opacity = '';
      }
      return;
    }

    // WICHTIG: Keine Prefixe hier! apiClient fügt das automatisch hinzu
    let endpoint = '';
    let switchDescription = '';

    if (targetRole === 'employee' && currentActiveRole === 'admin') {
      endpoint = '/role-switch/to-employee';
      switchDescription = 'Admin → Employee (to-employee)';
    } else if (targetRole === 'admin' && currentActiveRole === 'employee') {
      endpoint = '/role-switch/to-original';
      switchDescription = 'Employee → Admin (to-original)';
    } else {
      console.warn('[RoleSwitch-Admin] Invalid switch:', currentActiveRole, '→', targetRole);
      showToast('Dieser Rollenwechsel ist nicht möglich', 'error');
      if (dropdownDisplay) {
        dropdownDisplay.style.pointerEvents = '';
        dropdownDisplay.style.opacity = '';
      }
      return;
    }

    console.info('[RoleSwitch-Admin] Decision:', switchDescription);
    console.info('[RoleSwitch-Admin] Endpoint:', endpoint);
    console.info('[RoleSwitch-Admin] =========================================');

    const response = await apiClient.post<{
      token: string;
      user: { activeRole: string };
      message?: string;
    }>(endpoint.replace('/api', ''), {});

    localStorage.setItem('token', response.token);
    localStorage.setItem('activeRole', response.user.activeRole);

    if (response.user.activeRole === 'employee' && userRole === 'admin') {
      sessionStorage.setItem('roleSwitch', 'employee');
    } else {
      sessionStorage.removeItem('roleSwitch');
    }

    currentView = response.user.activeRole;

    ['admin', 'employee'].forEach((role) => {
      localStorage.removeItem(`roleSwitchBannerDismissed_${role}`);
    });

    // Deutsche Toast-Meldung wie bei Root
    const message = `Wechsel zur ${targetRole === 'admin' ? 'Admin' : 'Mitarbeiter'}-Ansicht...`;
    showToast(message, 'success');

    // Redirect to appropriate dashboard like Root does
    setTimeout(() => {
      if (targetRole === 'admin') {
        window.location.href = '/admin-dashboard';
      } else {
        window.location.href = '/employee-dashboard';
      }
    }, 1000);
  } catch (error) {
    console.error('[RoleSwitch-Admin] Error:', error);
    showToast('Fehler beim Rollenwechsel', 'error');
  } finally {
    if (dropdownDisplay) {
      dropdownDisplay.style.pointerEvents = '';
      dropdownDisplay.style.opacity = '';
    }
  }
}

// Export for use in other modules
export { switchRole, updateRoleUI };
