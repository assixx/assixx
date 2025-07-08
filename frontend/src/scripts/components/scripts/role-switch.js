/**
 * Role Switch Functionality
 * Ermöglicht Admins zwischen Admin und Employee View zu wechseln
 */
// Check if user is admin or root
const userRole = localStorage.getItem('userRole');
let currentView = localStorage.getItem('activeRole') || userRole;
// Role switch handler
async function switchRole() {
  const switchBtn = document.getElementById('role-switch-btn');
  const roleIndicator = document.getElementById('role-indicator');
  if (!switchBtn || !roleIndicator) return;
  // Disable button during switch
  switchBtn.disabled = true;
  switchBtn.style.opacity = '0.5';
  try {
    const token = localStorage.getItem('token');
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    // Update currentView from localStorage in case it changed
    currentView = localStorage.getItem('activeRole') || userRole;
    // Determine the endpoint based on current view and original role
    let endpoint = '';
    const isCurrentlyEmployee = currentView === 'employee';
    if (userRole === 'root') {
      // Root switching logic
      if (currentView === 'employee') {
        endpoint = '/api/role-switch/to-root'; // Employee → Root
      } else if (currentView === 'admin') {
        endpoint = '/api/role-switch/to-root'; // Admin → Root
      } else {
        // Root can switch to admin or employee (handled by dropdown)
        endpoint = '/api/role-switch/to-employee'; // Default
      }
    } else {
      // Admin switching logic (existing)
      endpoint = isCurrentlyEmployee ? '/api/role-switch/to-admin' : '/api/role-switch/to-employee';
    }
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('Rollenwechsel fehlgeschlagen');
    }
    const data = await response.json();
    // Update token and storage
    localStorage.setItem('token', data.token);
    localStorage.setItem('activeRole', data.user.activeRole);
    // Also update sessionStorage for KVP page compatibility
    if (data.user.activeRole === 'employee' && (userRole === 'admin' || userRole === 'root')) {
      sessionStorage.setItem('roleSwitch', 'employee');
    } else {
      sessionStorage.removeItem('roleSwitch');
    }
    // Update currentView immediately
    currentView = data.user.activeRole;
    // Update UI immediately before redirect
    updateRoleUI();
    // Show success message
    const message = isCurrentlyEmployee ? 'Wechsel zur Admin-Ansicht...' : 'Wechsel zur Mitarbeiter-Ansicht...';
    // Create toast notification
    showToast(message, 'success');
    // Redirect to appropriate dashboard after short delay
    setTimeout(() => {
      const currentPath = window.location.pathname;
      const newRole = data.user.activeRole;
      // If we're on a dashboard page, redirect to the appropriate dashboard
      if (currentPath.includes('dashboard')) {
        if (newRole === 'admin') {
          window.location.href = '/pages/admin-dashboard.html';
        } else if (newRole === 'employee') {
          window.location.href = '/pages/employee-dashboard.html';
        }
      } else {
        // For other pages (like KVP), just reload
        window.location.reload();
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
function updateRoleUI() {
  const roleIndicator = document.getElementById('role-indicator');
  const switchBtn = document.getElementById('role-switch-btn');
  const switchText = switchBtn?.querySelector('.role-switch-text');
  if (!roleIndicator || !switchBtn) return;
  // Update currentView from localStorage
  currentView = localStorage.getItem('activeRole') || userRole;
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
function showToast(message, type = 'success') {
  if (typeof window !== 'undefined') {
    const toastWindow = window;
    if (toastWindow.DashboardUI?.showToast) {
      toastWindow.DashboardUI.showToast(message, type);
      return;
    }
  }
  // Fallback toast implementation
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 24px;
    background: ${type === 'success' ? '#4caf50' : '#f44336'};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
// Add animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);
// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Handle for admins
  const switchBtn = document.getElementById('role-switch-btn');
  if (userRole === 'admin' && switchBtn) {
    switchBtn.style.display = 'flex';
    switchBtn.addEventListener('click', switchRole);
    updateRoleUI();
  } else if (switchBtn) {
    // Hide button for non-admins
    switchBtn.style.display = 'none';
  }
  // Handle for root users with dropdown
  const switchSelect = document.getElementById('role-switch-select');
  if (userRole === 'root' && switchSelect) {
    switchSelect.style.display = 'block';
    // Set current value
    const activeRole = localStorage.getItem('activeRole') || 'root';
    switchSelect.value = activeRole;
    // Add change event listener
    switchSelect.addEventListener('change', (e) => {
      const target = e.target;
      const selectedRole = target.value;
      switchRoleForRoot(selectedRole);
    });
    updateRoleUI();
  } else if (switchSelect) {
    // Hide select for non-root users
    switchSelect.style.display = 'none';
  }
});
// Handle role switch for root with dropdown
export async function switchRoleForRoot(targetRole) {
  // For custom dropdown, we'll update the display element instead
  const dropdownDisplay = document.getElementById('roleSwitchDisplay');
  if (dropdownDisplay) {
    // Disable dropdown during switch
    dropdownDisplay.style.pointerEvents = 'none';
    dropdownDisplay.style.opacity = '0.5';
  }
  try {
    const token = localStorage.getItem('token');
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    // Update currentView
    currentView = localStorage.getItem('activeRole') || userRole;
    // Determine endpoint based on target role
    let endpoint = '';
    if (targetRole === 'root') {
      endpoint = '/api/role-switch/to-root';
    } else if (targetRole === 'admin') {
      endpoint = '/api/role-switch/root-to-admin';
    } else if (targetRole === 'employee') {
      endpoint = '/api/role-switch/to-employee';
    }
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('Rollenwechsel fehlgeschlagen');
    }
    const data = await response.json();
    // Update token and storage
    localStorage.setItem('token', data.token);
    localStorage.setItem('activeRole', data.user.activeRole);
    // Also update sessionStorage for KVP page compatibility
    if (data.user.activeRole === 'employee' && (userRole === 'admin' || userRole === 'root')) {
      sessionStorage.setItem('roleSwitch', 'employee');
    } else {
      sessionStorage.removeItem('roleSwitch');
    }
    // Update currentView immediately
    currentView = data.user.activeRole;
    // Show success message
    const message = `Wechsel zur ${targetRole === 'root' ? 'Root' : targetRole === 'admin' ? 'Admin' : 'Mitarbeiter'}-Ansicht...`;
    showToast(message, 'success');
    // Redirect to appropriate dashboard after short delay
    setTimeout(() => {
      const currentPath = window.location.pathname;
      // If we're on a dashboard page, redirect to the appropriate dashboard
      if (currentPath.includes('dashboard')) {
        if (targetRole === 'root') {
          window.location.href = '/pages/root-dashboard.html';
        } else if (targetRole === 'admin') {
          window.location.href = '/pages/admin-dashboard.html';
        } else if (targetRole === 'employee') {
          window.location.href = '/pages/employee-dashboard.html';
        }
      } else {
        // For other pages (like KVP), just reload
        window.location.reload();
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
// Export for use in other modules
export { switchRole, updateRoleUI };
