/**
 * Role Sync Manager - Cross-Tab Synchronization for Role Switching
 *
 * Implements dual-method synchronization:
 * 1. BroadcastChannel API - Fast, explicit communication between tabs
 * 2. Storage Event Listener - Fallback, automatic detection of localStorage changes
 *
 * This ensures robust synchronization even if one method fails or is forgotten.
 *
 * @module role-sync
 * @see archive/frontend-legacy/src/scripts/components/navigation/handlers.ts
 */

import { createLogger } from './logger';

const log = createLogger('RoleSyncManager');

// =============================================================================
// TYPES
// =============================================================================

/**
 * Role switch message structure for BroadcastChannel
 * Note: type is string (not literal) for defensive programming -
 * BroadcastChannel could theoretically receive other message types
 */
export interface RoleSwitchMessage {
  type: string;
  newRole?: 'root' | 'admin' | 'employee';
  token?: string;
  timestamp?: number;
}

/**
 * Callback type for role change events
 */
export type OnRoleSwitchCallback = (newRole: string, token?: string) => void;

/**
 * Dashboard URLs by role
 */
const DASHBOARD_URLS: Record<string, string> = {
  root: '/root-dashboard',
  admin: '/admin-dashboard',
  employee: '/employee-dashboard',
};

// =============================================================================
// SSR SAFETY
// =============================================================================

/**
 * Check if we're running in browser (not SSR)
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

// =============================================================================
// ROLE SYNC MANAGER CLASS
// =============================================================================

/**
 * RoleSyncManager - Singleton for cross-tab role synchronization
 *
 * Features:
 * - BroadcastChannel for instant tab communication
 * - Storage event listener as automatic fallback
 * - Debounced redirects to prevent race conditions
 * - Proper cleanup on destroy
 */
export class RoleSyncManager {
  private static instance: RoleSyncManager | null = null;

  private broadcastChannel: BroadcastChannel | null = null;
  private onRoleSwitchCallback: OnRoleSwitchCallback | null = null;
  private redirectTimeout: ReturnType<typeof setTimeout> | null = null;
  private isRedirecting = false;
  private readonly CHANNEL_NAME = 'role_switch_channel';
  private readonly REDIRECT_DEBOUNCE_MS = 300;

  // Bound handlers for proper cleanup
  private boundStorageHandler: ((event: StorageEvent) => void) | null = null;
  private boundBroadcastHandler:
    | ((event: MessageEvent<RoleSwitchMessage>) => void)
    | null = null;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get singleton instance (SSR-safe)
   */
  static getInstance(): RoleSyncManager {
    if (!isBrowser()) {
      // Return a dummy instance for SSR that does nothing
      return new RoleSyncManager();
    }

    RoleSyncManager.instance ??= new RoleSyncManager();
    return RoleSyncManager.instance;
  }

  /**
   * Initialize the sync manager with a callback
   * Call this in onMount() of your layout component
   *
   * @param onRoleSwitch - Callback when role changes in another tab
   */
  init(onRoleSwitch: OnRoleSwitchCallback): void {
    if (!isBrowser()) return;

    this.onRoleSwitchCallback = onRoleSwitch;

    // Setup both synchronization methods
    this.setupBroadcastChannel();
    this.setupStorageListener();

    log.debug('Initialized with dual-sync (BroadcastChannel + Storage Event)');
  }

  /**
   * Setup BroadcastChannel listener
   * Fast, explicit communication between tabs
   */
  private setupBroadcastChannel(): void {
    if (!isBrowser()) return;

    try {
      this.broadcastChannel = new BroadcastChannel(this.CHANNEL_NAME);

      this.boundBroadcastHandler = (event: MessageEvent<RoleSwitchMessage>) => {
        if (event.data.type === 'ROLE_SWITCHED' && event.data.newRole) {
          const { newRole, token } = event.data;
          log.info({ newRole }, 'BroadcastChannel: Role switched');

          // Update localStorage from the message (in case storage event didn't fire)
          localStorage.setItem('activeRole', newRole);
          if (token !== undefined && token !== '') {
            localStorage.setItem('accessToken', token);
          }

          // Handle the role change
          this.handleRoleChange(newRole, token);
        }
      };

      this.broadcastChannel.onmessage = this.boundBroadcastHandler;
    } catch {
      // BroadcastChannel not supported - fall back to storage events only
      log.warn('BroadcastChannel not available, using storage events only');
    }
  }

  /**
   * Setup Storage event listener
   * Automatic fallback - fires when ANY tab changes localStorage
   * Note: Storage events only fire in OTHER tabs, not the one that made the change
   */
  private setupStorageListener(): void {
    if (!isBrowser()) return;

    this.boundStorageHandler = (event: StorageEvent) => {
      // Only react to activeRole changes
      if (event.key === 'activeRole' && event.newValue !== event.oldValue) {
        log.info(
          { newRole: event.newValue },
          'Storage Event: activeRole changed',
        );

        // Debounce to prevent multiple rapid redirects
        if (this.redirectTimeout) {
          clearTimeout(this.redirectTimeout);
        }

        this.redirectTimeout = setTimeout(() => {
          const newRole = event.newValue;
          if (
            newRole === 'root' ||
            newRole === 'admin' ||
            newRole === 'employee'
          ) {
            this.handleRoleChange(newRole);
          }
        }, this.REDIRECT_DEBOUNCE_MS);
      }
    };

    window.addEventListener('storage', this.boundStorageHandler);
  }

  /**
   * Handle role change - redirect or refresh
   */
  private handleRoleChange(newRole: string, token?: string): void {
    if (this.isRedirecting) return;

    // Call the callback first (for state updates)
    if (this.onRoleSwitchCallback) {
      this.onRoleSwitchCallback(newRole, token);
    }

    // Determine if redirect is needed
    const currentPath = window.location.pathname;
    const targetPath = DASHBOARD_URLS[newRole];

    // Check if user has permission for the target role
    const userRole = localStorage.getItem('userRole');
    if (newRole === 'root' && userRole !== 'root') {
      log.warn(
        { newRole, userRole },
        'User does not have root permission, ignoring',
      );
      return;
    }

    // Only redirect if we're not already on the correct dashboard
    if (targetPath && !currentPath.includes(targetPath)) {
      log.info({ targetPath }, 'Redirecting to dashboard');
      this.isRedirecting = true;
      window.location.replace(targetPath);
    } else {
      // Already on correct page - just refresh to update UI
      log.debug('Refreshing current page');
      window.location.reload();
    }
  }

  /**
   * Broadcast a role switch to other tabs
   * Call this AFTER a successful role switch API call
   *
   * @param newRole - The new active role
   * @param token - Optional new access token
   */
  broadcast(newRole: 'root' | 'admin' | 'employee', token?: string): void {
    if (!isBrowser()) return;

    const message: RoleSwitchMessage = {
      type: 'ROLE_SWITCHED',
      newRole,
      token,
      timestamp: Date.now(),
    };

    // Method 1: BroadcastChannel (fast, explicit)
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(message);
        log.debug({ newRole }, 'Broadcast sent via BroadcastChannel');
      } catch (error) {
        log.warn({ err: error }, 'BroadcastChannel send failed');
      }
    }

    // Method 2: localStorage is already updated by RoleSwitch.svelte
    // Storage events will automatically fire in other tabs
    // This is the fallback mechanism
  }

  /**
   * Cleanup - call this in onDestroy() of your layout component
   */
  destroy(): void {
    if (!isBrowser()) return;

    // Clear timeout
    if (this.redirectTimeout) {
      clearTimeout(this.redirectTimeout);
      this.redirectTimeout = null;
    }

    // Close BroadcastChannel
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }

    // Remove storage listener
    if (this.boundStorageHandler) {
      window.removeEventListener('storage', this.boundStorageHandler);
      this.boundStorageHandler = null;
    }

    // Clear callback
    this.onRoleSwitchCallback = null;
    this.isRedirecting = false;

    log.debug('Destroyed and cleaned up');
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * Get the singleton RoleSyncManager instance
 * SSR-safe - returns a no-op instance during server-side rendering
 */
export function getRoleSyncManager(): RoleSyncManager {
  return RoleSyncManager.getInstance();
}

/**
 * Convenience function to broadcast a role switch
 * Use this in RoleSwitch.svelte after successful API call
 */
export function broadcastRoleSwitch(
  newRole: 'root' | 'admin' | 'employee',
  token?: string,
): void {
  getRoleSyncManager().broadcast(newRole, token);
}
