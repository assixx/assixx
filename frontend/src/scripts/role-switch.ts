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
/**
 * Set dropdown display state
 */
function setDropdownState(dropdownDisplay: HTMLElement | null, enabled: boolean): void {
  if (!dropdownDisplay) return;
  dropdownDisplay.style.pointerEvents = enabled ? '' : 'none';
  dropdownDisplay.style.opacity = enabled ? '' : '0.5';
}

/**
 * Get role display name
 */
function getRoleDisplayName(role: string): string {
  if (role === 'root') return 'Root';
  if (role === 'admin') return 'Admin';
  return 'Mitarbeiter';
}

/**
 * Determine endpoint for role switching
 */
function determineEndpoint(
  targetRole: string,
  currentActiveRole: string | null,
): { endpoint: string; description: string } {
  if (targetRole === 'root' && currentActiveRole !== 'root') {
    return {
      endpoint: '/role-switch/to-original',
      description: `${currentActiveRole ?? 'unknown'} → Root (to-original)`,
    };
  }

  if (targetRole === 'admin') {
    if (currentActiveRole === 'root') {
      return {
        endpoint: '/role-switch/root-to-admin',
        description: 'Root → Admin (root-to-admin)',
      };
    }
    if (currentActiveRole === 'employee') {
      console.warn('[RoleSwitch] Cannot switch directly from Employee to Admin!');
      console.info('[RoleSwitch] Need to go: Employee → Root → Admin');
      return {
        endpoint: '/role-switch/to-original',
        description: 'Employee → Root first (to-original)',
      };
    }
  }

  if (targetRole === 'employee' && (currentActiveRole === 'root' || currentActiveRole === 'admin')) {
    return {
      endpoint: '/role-switch/to-employee',
      description: `${currentActiveRole} → Employee (to-employee)`,
    };
  }

  return { endpoint: '', description: '' };
}

/**
 * Update storage after role switch
 */
function updateStorageAfterSwitch(response: { token: string; user: { activeRole: string } }): void {
  localStorage.setItem('token', response.token);
  localStorage.setItem('activeRole', response.user.activeRole);

  if (response.user.activeRole === 'employee' && (userRole === 'admin' || userRole === 'root')) {
    sessionStorage.setItem('roleSwitch', 'employee');
  } else {
    sessionStorage.removeItem('roleSwitch');
  }

  currentView = response.user.activeRole;

  ['root', 'admin', 'employee'].forEach((role) => {
    localStorage.removeItem(`roleSwitchBannerDismissed_${role}`);
  });
}

/**
 * Log role switch details
 */
function logRoleSwitchDetails(
  prefix: string,
  originalRole: string | null,
  activeRole: string | null,
  targetRole: string,
): void {
  console.info(`[${prefix}] ============ ROLE SWITCH DETAILS ============`);
  console.info(`[${prefix}] Original Role:`, originalRole);
  console.info(`[${prefix}] Current Active Role:`, activeRole);
  console.info(`[${prefix}] Target Role:`, targetRole);
  console.info(`[${prefix}] Current View before switch:`, activeRole ?? originalRole);
}

/**
 * Log switch decision
 */
function logSwitchDecision(prefix: string, description: string, endpoint: string): void {
  console.info(`[${prefix}] Switch decision:`, description);
  console.info(`[${prefix}] Using endpoint:`, endpoint);
  console.info(`[${prefix}] ===========================================`);
}

/**
 * Redirect to appropriate dashboard
 */
function redirectToDashboard(targetRole: string): void {
  setTimeout(() => {
    if (targetRole === 'root') {
      window.location.href = '/root-dashboard';
    } else if (targetRole === 'admin') {
      window.location.href = '/admin-dashboard';
    } else {
      window.location.href = '/employee-dashboard';
    }
  }, 1000);
}

export async function switchRoleForRoot(targetRole: 'root' | 'admin' | 'employee'): Promise<void> {
  const dropdownDisplay = $$('#roleSwitchDisplay');
  setDropdownState(dropdownDisplay, false);

  try {
    const originalRole = localStorage.getItem('userRole');
    const activeRole = localStorage.getItem('activeRole');
    const currentActiveRole = activeRole ?? originalRole;

    logRoleSwitchDetails('RoleSwitch', originalRole, activeRole, targetRole);

    if (currentActiveRole === targetRole) {
      console.info('[RoleSwitch] Already in target role, showing warning');
      showToast(`Sie sind bereits als ${getRoleDisplayName(targetRole)} aktiv!`, 'warning');
      setDropdownState(dropdownDisplay, true);
      return;
    }

    const { endpoint, description } = determineEndpoint(targetRole, currentActiveRole);

    if (endpoint === '') {
      if (targetRole === 'employee' && currentActiveRole === 'employee') {
        console.warn('[RoleSwitch] Already in employee view!');
        showToast('Sie sind bereits als Mitarbeiter aktiv!', 'warning');
        setDropdownState(dropdownDisplay, true);
        return;
      }
      console.error('[RoleSwitch] No valid endpoint for switch!', {
        from: currentActiveRole,
        to: targetRole,
        original: originalRole,
      });
      return;
    }

    logSwitchDecision('RoleSwitch', description, endpoint);

    const response = await apiClient.post<{
      token: string;
      user: { activeRole: string };
      message?: string;
    }>(endpoint, {});

    updateStorageAfterSwitch(response);
    showToast(`Wechsel zur ${getRoleDisplayName(targetRole)}-Ansicht...`, 'success');
    redirectToDashboard(targetRole);
  } catch (error) {
    console.error('Role switch error:', error);
    showToast('Fehler beim Rollenwechsel', 'error');
    setDropdownState(dropdownDisplay, true);
  }
}

/**
 * Determine endpoint for admin role switching
 */
function determineAdminEndpoint(
  targetRole: string,
  currentActiveRole: string | null,
): { endpoint: string; description: string } {
  if (targetRole === 'employee' && currentActiveRole === 'admin') {
    return {
      endpoint: '/role-switch/to-employee',
      description: 'Admin → Employee (to-employee)',
    };
  }
  if (targetRole === 'admin' && currentActiveRole === 'employee') {
    return {
      endpoint: '/role-switch/to-original',
      description: 'Employee → Admin (to-original)',
    };
  }
  return { endpoint: '', description: '' };
}

/**
 * Handle storage update for admin role switch
 */
function updateAdminStorage(response: { token: string; user: { activeRole: string } }): void {
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
}

// Handle role switch for admin users
export async function switchRoleForAdmin(targetRole: 'admin' | 'employee'): Promise<void> {
  const dropdownDisplay = $$('#roleSwitchDisplay');
  setDropdownState(dropdownDisplay, false);

  try {
    const originalRole = localStorage.getItem('userRole');
    const activeRole = localStorage.getItem('activeRole');
    const currentActiveRole = activeRole ?? originalRole;

    logRoleSwitchDetails('RoleSwitch-Admin', originalRole, activeRole, targetRole);

    if (currentActiveRole === targetRole) {
      console.info('[RoleSwitch-Admin] Already in target role, showing warning');
      showToast(`Sie sind bereits als ${getRoleDisplayName(targetRole)} aktiv!`, 'warning');
      setDropdownState(dropdownDisplay, true);
      return;
    }

    const { endpoint, description } = determineAdminEndpoint(targetRole, currentActiveRole);

    if (endpoint === '') {
      console.warn('[RoleSwitch-Admin] Invalid switch:', currentActiveRole, '→', targetRole);
      showToast('Dieser Rollenwechsel ist nicht möglich', 'error');
      setDropdownState(dropdownDisplay, true);
      return;
    }

    logSwitchDecision('RoleSwitch-Admin', description, endpoint);

    const response = await apiClient.post<{
      token: string;
      user: { activeRole: string };
      message?: string;
    }>(endpoint.replace('/api', ''), {});

    updateAdminStorage(response);
    showToast(`Wechsel zur ${getRoleDisplayName(targetRole)}-Ansicht...`, 'success');
    redirectToDashboard(targetRole);
  } catch (error) {
    console.error('[RoleSwitch-Admin] Error:', error);
    showToast('Fehler beim Rollenwechsel', 'error');
    setDropdownState(dropdownDisplay, true);
  }
}

// Export for use in other modules
export { switchRole, updateRoleUI };
