/**
 * Role Switch Functionality
 * Ermöglicht Admins zwischen Admin und Employee View zu wechseln
 */

import { apiClient } from '../../utils/api-client';
import { $$ } from '../../utils/dom-utils';
import { showSuccessAlert, showErrorAlert, showWarningAlert } from '../utils/alerts';

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
      endpoint =
        currentActiveRole === 'employee' || currentActiveRole === 'admin'
          ? '/api/role-switch/to-original'
          : '/api/role-switch/to-employee';
    } else {
      endpoint = isCurrentlyEmployee ? '/api/role-switch/to-original' : '/api/role-switch/to-employee';
    }

    const response = await apiClient.post<{
      token: string;
      user: { activeRole: string };
      message?: string;
    }>(endpoint, {});

    // Update storage
    updateStorageAfterSwitch(response);

    // Update UI immediately before redirect
    updateRoleUI();

    // Show success message
    const roleDisplayName = getRoleDisplayName(response.user.activeRole);
    showSuccessAlert(`Wechsel zur ${roleDisplayName}-Ansicht...`);

    // Redirect to appropriate dashboard
    redirectToDashboard(response.user.activeRole);
  } catch (error) {
    console.error('Role switch error:', error);
    showErrorAlert('Fehler beim Rollenwechsel');

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
      showWarningAlert(`Sie sind bereits als ${getRoleDisplayName(targetRole)} aktiv!`);
      setDropdownState(dropdownDisplay, true);
      return;
    }

    const { endpoint, description } = determineEndpoint(targetRole, currentActiveRole);

    if (endpoint === '') {
      if (targetRole === 'employee' && currentActiveRole === 'employee') {
        console.warn('[RoleSwitch] Already in employee view!');
        showWarningAlert('Sie sind bereits als Mitarbeiter aktiv!');
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
    showSuccessAlert(`Wechsel zur ${getRoleDisplayName(targetRole)}-Ansicht...`);
    redirectToDashboard(targetRole);
  } catch (error) {
    console.error('Role switch error:', error);
    showErrorAlert('Fehler beim Rollenwechsel');
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
      showWarningAlert(`Sie sind bereits als ${getRoleDisplayName(targetRole)} aktiv!`);
      setDropdownState(dropdownDisplay, true);
      return;
    }

    const { endpoint, description } = determineAdminEndpoint(targetRole, currentActiveRole);

    if (endpoint === '') {
      console.warn('[RoleSwitch-Admin] Invalid switch:', currentActiveRole, '→', targetRole);
      showErrorAlert('Dieser Rollenwechsel ist nicht möglich');
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
    showSuccessAlert(`Wechsel zur ${getRoleDisplayName(targetRole)}-Ansicht...`);
    redirectToDashboard(targetRole);
  } catch (error) {
    console.error('[RoleSwitch-Admin] Error:', error);
    showErrorAlert('Fehler beim Rollenwechsel');
    setDropdownState(dropdownDisplay, true);
  }
}

// Export for use in other modules
export { switchRole, updateRoleUI };
