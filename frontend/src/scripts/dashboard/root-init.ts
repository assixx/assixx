/**
 * Root Dashboard Initialization Module
 * Handles session validation and breadcrumb initialization for root dashboard
 */

import { SessionManager } from '../utils/session-manager';
import { initBreadcrumb } from '../components/breadcrumb';

/**
 * Initialize the root dashboard
 * - Validates session access
 * - Sets up breadcrumb navigation
 */
export function initRootDashboard(): void {
  // Validate session access for root role
  const session = SessionManager.getInstance();
  session.validateDashboardAccess('root');

  // Initialize breadcrumb navigation
  // Breadcrumb wird automatisch generiert basierend auf der URL
  initBreadcrumb();
}

// Auto-initialize when module loads
initRootDashboard();
