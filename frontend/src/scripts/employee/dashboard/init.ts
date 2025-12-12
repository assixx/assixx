/**
 * Employee Dashboard Initialization Module
 * Handles employee-specific dashboard initialization and data loading
 * Following strict TypeScript standards and best practices
 */

import { SessionManager } from '../../utils/session-manager';
import { initBreadcrumb } from '../../components/breadcrumb';
// Import BlackboardWidget to ensure widget.ts is loaded
import '../../blackboard/widget';

// JWT payload type for auth check
interface UserPayload {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  role: string;
  activeRole?: string;
  tenant_id: number;
}

/**
 * Initialize employee dashboard page
 * Note: Data loading (user info, documents, calendar) is handled by employee.ts
 * This module only handles: auth check, card navigation, breadcrumb
 */
export function initEmployeeDashboard(): void {
  document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    initFloatingDots();
    initButtonNavigation();
    initCardNavigation();
    // Clear any stored active navigation to ensure dashboard is selected
    localStorage.removeItem('activeNavigation');
  });
}

/**
 * Generate floating dots for welcome hero animation
 */
function initFloatingDots(count: number = 24): void {
  const container = document.querySelector('.floating-elements');
  if (container === null) return;

  for (let i = 0; i < count; i++) {
    const dot = document.createElement('div');
    dot.className = 'floating-dot';
    container.appendChild(dot);
  }
}

/**
 * Parse JWT token to get payload
 */
function parseToken(token: string): UserPayload | null {
  try {
    const tokenPart = token.split('.')[1];
    if (tokenPart === undefined) return null;
    return JSON.parse(atob(tokenPart)) as UserPayload;
  } catch {
    return null;
  }
}

/**
 * Check if user has employee access
 */
function isEmployeeAccess(payload: UserPayload): boolean {
  if (payload.role === 'employee') {
    return true;
  }

  const isAdminAsEmployee = payload.role === 'admin' && payload.activeRole === 'employee';
  const isRootAsEmployee = payload.role === 'root' && payload.activeRole === 'employee';

  return isAdminAsEmployee || isRootAsEmployee;
}

/**
 * Get redirect URL based on user role
 */
function getRedirectUrl(role: string): string {
  switch (role) {
    case 'admin':
      return '/admin-dashboard';
    case 'root':
      return '/root-dashboard';
    default:
      return '/login';
  }
}

/**
 * Check authentication and access rights
 */
function checkAuth(): void {
  const token = localStorage.getItem('token');
  if (token === null || token === '') {
    window.location.href = '/login';
    return;
  }

  const payload = parseToken(token);
  if (!payload) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    return;
  }

  // Update welcome message with full name
  const nameElement = document.querySelector<HTMLElement>('#employee-name');
  if (nameElement) {
    // JWT has snake_case format
    const firstName = payload.first_name ?? '';
    const lastName = payload.last_name ?? '';
    const nameParts = [firstName, lastName].filter((part) => part !== '');
    const fullName = nameParts.length > 0 ? nameParts.join(' ') : payload.username;
    nameElement.textContent = fullName;
  }

  // Check access rights
  if (!isEmployeeAccess(payload)) {
    console.info('[Employee Dashboard Auth] Redirecting - not authorized');
    window.location.href = getRedirectUrl(payload.role);
  }

  // Also use SessionManager for additional validation
  const session = SessionManager.getInstance();
  session.validateDashboardAccess('employee');
}

// Data loading (loadEmployeeProfile, loadDocumentCount) removed
// employee.ts handles all data loading to avoid duplicate API calls and race conditions

/**
 * Initialize button navigation for card action buttons
 */
function initButtonNavigation(): void {
  const navigationButtons = document.querySelectorAll<HTMLButtonElement>('button[data-href]');
  navigationButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const href = button.dataset['href'];
      if (href !== undefined && href !== '') {
        window.location.href = href;
      }
    });
  });
}

/**
 * Initialize card navigation for clickable accent cards
 */
function initCardNavigation(): void {
  const cards = document.querySelectorAll<HTMLElement>('.card-accent[data-href]');
  cards.forEach((card) => {
    card.addEventListener('click', () => {
      const href = card.dataset['href'];
      if (href !== undefined && href !== '') {
        window.location.href = href;
      }
    });
    card.style.cursor = 'pointer';
  });
}

// Auto-initialize when module is imported
initEmployeeDashboard();

// Also initialize breadcrumb
initBreadcrumb();
