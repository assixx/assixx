/**
 * Role Switch Functionality
 * Ermöglicht Admins zwischen Admin und Employee View zu wechseln
 */

// Check if user is admin
const userRole = localStorage.getItem('userRole');
let currentView = localStorage.getItem('activeRole') || userRole;

// Role switch handler
async function switchRole(): Promise<void> {
  const switchBtn = document.getElementById('role-switch-btn') as HTMLButtonElement;
  const roleIndicator = document.getElementById('role-indicator') as HTMLElement;

  if (!switchBtn || !roleIndicator) return;

  // Disable button during switch
  switchBtn.disabled = true;
  switchBtn.style.opacity = '0.5';

  try {
    const token = localStorage.getItem('token');
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

    // Update currentView from localStorage in case it changed
    currentView = localStorage.getItem('activeRole') || userRole;

    const isCurrentlyEmployee = currentView === 'employee';
    const endpoint = isCurrentlyEmployee ? '/api/role-switch/to-admin' : '/api/role-switch/to-employee';

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

    // Update currentView immediately
    currentView = data.user.activeRole;

    // Update UI immediately before redirect
    updateRoleUI();

    // Show success message
    const message = isCurrentlyEmployee ? 'Wechsel zur Admin-Ansicht...' : 'Wechsel zur Mitarbeiter-Ansicht...';

    // Create toast notification
    showToast(message, 'success');

    // Redirect after short delay
    setTimeout(() => {
      if (data.user.activeRole === 'employee') {
        window.location.href = '/pages/employee-dashboard.html';
      } else {
        window.location.href = '/pages/admin-dashboard.html';
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
  const roleIndicator = document.getElementById('role-indicator') as HTMLElement;
  const switchBtn = document.getElementById('role-switch-btn') as HTMLButtonElement;
  const switchText = switchBtn?.querySelector('.role-switch-text') as HTMLElement;

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
function showToast(message: string, type: 'success' | 'error' = 'success'): void {
  // Try to use existing toast system first
  if (typeof window !== 'undefined' && (window as any).DashboardUI?.showToast) {
    (window as any).DashboardUI.showToast(message, type);
    return;
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
  // Only show switch button for admins
  const switchBtn = document.getElementById('role-switch-btn') as HTMLButtonElement;

  if (userRole === 'admin' && switchBtn) {
    switchBtn.style.display = 'flex';
    switchBtn.addEventListener('click', switchRole);
    updateRoleUI();
  } else if (switchBtn) {
    // Hide button for non-admins
    switchBtn.style.display = 'none';
  }
});

// Export for use in other modules
export { switchRole, updateRoleUI };
