/**
 * Employee Dashboard Initialization Module
 * Handles employee-specific dashboard initialization and data loading
 * Following strict TypeScript standards and best practices
 */

import { SessionManager } from '../../utils/session-manager';
import { initBreadcrumb } from '../../components/breadcrumb';

// Use global apiClient from common.js
declare const apiClient: {
  get: (url: string) => Promise<unknown>;
};

interface UserPayload {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  role: string;
  activeRole?: string;
  tenant_id: number;
}

// API v2 response type for /users/me endpoint
interface UserApiResponse {
  id: number;
  username: string;
  firstName?: string;
  lastName?: string;
  departmentName?: string;
  teamName?: string;
  position?: string;
  role: string;
  tenantId: number;
}

/**
 * Initialize employee dashboard page
 */
export function initEmployeeDashboard(): void {
  // Initialize on page load
  document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    void loadDashboardData();
    initCardNavigation();

    // Clear any stored active navigation to ensure dashboard is selected
    localStorage.removeItem('activeNavigation');
  });
}

/**
 * Parse JWT token to get payload
 */
function parseToken(token: string): UserPayload | null {
  try {
    return JSON.parse(atob(token.split('.')[1])) as UserPayload;
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

/**
 * Load all dashboard data
 */
async function loadDashboardData(): Promise<void> {
  try {
    // Load employee profile data
    await loadEmployeeProfile();

    // Load document count (synchronous now)
    loadDocumentCount();
  } catch (error) {
    console.error('Error loading dashboard data:', error);
  }
}

/**
 * Type guard to validate UserApiResponse
 */
function isUserApiResponse(data: unknown): data is UserApiResponse {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const user = data as Record<string, unknown>;
  return (
    typeof user.id === 'number' &&
    typeof user.username === 'string' &&
    typeof user.role === 'string' &&
    typeof user.tenantId === 'number'
  );
}

/**
 * Load employee profile information
 */
async function loadEmployeeProfile(): Promise<void> {
  try {
    const response = await apiClient.get('/users/me');

    // Validate the response using type guard
    if (!isUserApiResponse(response)) {
      console.error('Invalid user response from API');
      return;
    }

    const user = response;

    // Update name with actual firstName and lastName from API (camelCase)
    const nameElement = document.querySelector<HTMLElement>('#employee-name');
    if (nameElement) {
      // API v2 returns fields in camelCase
      const firstName = user.firstName ?? '';
      const lastName = user.lastName ?? '';
      const nameParts = [firstName, lastName].filter((part) => part !== '');
      const fullName = nameParts.length > 0 ? nameParts.join(' ') : user.username;

      nameElement.textContent = fullName;
    }

    const deptElement = document.querySelector<HTMLElement>('#employee-department');
    if (deptElement) {
      deptElement.textContent = user.departmentName ?? 'Nicht zugewiesen';
    }

    const teamElement = document.querySelector<HTMLElement>('#employee-team');
    if (teamElement) {
      // API returns teamName in camelCase
      teamElement.textContent = user.teamName ?? 'Kein Team';
    }

    const posElement = document.querySelector<HTMLElement>('#employee-position');
    if (posElement) {
      posElement.textContent = user.position ?? 'Mitarbeiter';
    }
  } catch (error) {
    console.error('Error loading profile:', error);
  }
}

/**
 * Load document count and update badges
 */
function loadDocumentCount(): void {
  // This would be an API call to get document count
  // For now using static value as in original
  const documentCountElement = document.querySelector<HTMLElement>('#document-count');
  if (documentCountElement) {
    documentCountElement.textContent = '12';
  }

  // Update badge visibility - temporarily using static value until API is ready
  const newDocsCount = 3; // Will be replaced with API call
  const badge = document.querySelector<HTMLElement>('#new-documents-badge');
  if (badge) {
    // Currently always showing badge since count is hardcoded
    badge.textContent = `${newDocsCount} neue`;
    badge.style.display = 'inline-block';
  }
}

/**
 * Initialize card navigation for accent cards
 */
function initCardNavigation(): void {
  // Find all card-accent elements with data-href
  const cards = document.querySelectorAll<HTMLElement>('.card-accent[data-href]');

  cards.forEach((card) => {
    card.addEventListener('click', () => {
      const href = card.dataset.href;
      if (href !== undefined && href !== '') {
        window.location.href = href;
      }
    });

    // Add cursor pointer for clickable cards
    card.style.cursor = 'pointer';
  });
}

// Auto-initialize when module is imported
initEmployeeDashboard();

// Also initialize breadcrumb
initBreadcrumb();
