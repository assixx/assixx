/**
 * Documents Explorer - Main Entry Point
 *
 * Initializes all managers and wires the application together
 * Single Page Application for unified document management
 *
 * @module explorer/index
 */

// Import managers (singleton instances)
import { stateManager } from './state';
import { router } from './router';
import { sidebarManager } from './sidebar';
import { toolbarManager } from './toolbar';
import { listViewManager } from './list';
import { gridViewManager } from './grid';
import { previewModalManager } from './modal';
import { uploadModalManager } from './upload-modal';
import { documentAPI } from './api';
import { permissionsManager } from './permissions';
// Import utilities
import { getUserRole, isAuthenticated } from '../../../utils/auth-helpers';
import { setSafeHTML, escapeHtml } from '../../../utils/dom-utils';

/**
 * Application state flags
 */
let isInitialized = false;
let initializationError: Error | null = null;

/**
 * Initialize the Documents Explorer application
 * This is the main entry point called on page load
 */
export async function initialize(): Promise<void> {
  // Prevent double initialization
  if (isInitialized) {
    console.warn('[Explorer] Already initialized, skipping...');
    return;
  }

  // Set immediately to prevent race condition
  isInitialized = true;

  console.info('[Explorer] Initializing Documents Explorer...');

  try {
    // Step 1: Check authentication
    if (!isAuthenticated()) {
      console.error('[Explorer] User not authenticated');
      showAuthenticationError();
      return;
    }

    // Step 2: Initialize unified navigation
    initializeUnifiedNavigation();

    // Step 3: Get user role and permissions
    const role = getUserRole();
    console.info(`[Explorer] User role: ${role ?? 'unknown'}`);

    // Set user role in state
    if (role !== null) {
      stateManager.setUserRole(role);
    }

    // Log permissions for debugging
    const permissions = permissionsManager.getPermissionSummary();
    console.info('[Explorer] Permissions:', permissions);

    // Step 4: Initialize UI managers (order matters!)
    // Router must be initialized first to handle initial route
    router.init();

    // Sidebar shows categories and navigation
    sidebarManager.init();

    // Toolbar handles search, filters, upload button
    toolbarManager.init();

    // View managers render documents
    listViewManager.init();
    gridViewManager.init();

    // Modal managers handle document preview and upload
    previewModalManager.init();
    uploadModalManager.init(); // Only initializes if user is admin

    // Step 5: Load initial data
    console.info('[Explorer] Loading documents...');
    stateManager.setLoading(true);

    try {
      const documents = await documentAPI.fetchDocuments();
      console.info(`[Explorer] Loaded ${documents.length} documents`);

      // Set documents in state (this will trigger UI updates via observers)
      stateManager.setDocuments(documents);
    } catch (error) {
      console.error('[Explorer] Failed to load documents:', error);
      const errorMessage = error instanceof Error ? error.message : 'Fehler beim Laden der Dokumente';
      stateManager.setError(errorMessage);
    } finally {
      stateManager.setLoading(false);
    }

    console.info('[Explorer] Initialization complete ✅');
  } catch (error) {
    console.error('[Explorer] Initialization failed:', error);
    initializationError = error instanceof Error ? error : new Error('Unknown error');
    showInitializationError(initializationError);
  }
}

/**
 * Initialize unified navigation component
 * Loads the shared navigation used across all pages
 */
function initializeUnifiedNavigation(): void {
  const navContainer = document.getElementById('navigation-container');

  if (navContainer === null) {
    console.warn('[Explorer] Navigation container not found, skipping...');
    return;
  }

  try {
    // Navigation is auto-initialized by its module script tag
    // Just verify it exists
    console.info('[Explorer] Unified navigation loaded via script tag');
  } catch (error) {
    console.warn('[Explorer] Navigation check failed:', error instanceof Error ? error.message : String(error));
    // Non-critical error - continue without navigation
  }
}

/**
 * Show authentication error
 * Redirects to login page after brief delay
 */
function showAuthenticationError(): void {
  const explorerEl = document.getElementById('documents-explorer');

  if (explorerEl !== null) {
    explorerEl.innerHTML = `
      <div class="flex items-center justify-center h-screen bg-surface-1">
        <div class="text-center p-8 bg-surface-2 rounded-lg border border-border-subtle max-w-md">
          <svg class="w-16 h-16 text-warning-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
          <h2 class="text-xl font-semibold text-content-primary mb-2">Nicht angemeldet</h2>
          <p class="text-content-secondary mb-4">Sie müssen angemeldet sein, um auf diese Seite zuzugreifen.</p>
          <p class="text-sm text-content-tertiary">Sie werden in 3 Sekunden zur Login-Seite weitergeleitet...</p>
        </div>
      </div>
    `;
  }

  // Redirect to login after 3 seconds
  setTimeout(() => {
    window.location.href = '/login.html';
  }, 3000);
}

/**
 * Show initialization error
 * Displays error message with retry option
 */
function showInitializationError(error: Error): void {
  const explorerEl = document.getElementById('documents-explorer');

  if (explorerEl !== null) {
    setSafeHTML(
      explorerEl,
      `
      <div class="flex items-center justify-center h-screen bg-surface-1">
        <div class="text-center p-8 bg-surface-2 rounded-lg border border-border-subtle max-w-md">
          <svg class="w-16 h-16 text-error-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <h2 class="text-xl font-semibold text-content-primary mb-2">Initialisierungsfehler</h2>
          <p class="text-content-secondary mb-4">${escapeHtml(error.message)}</p>
          <button
            id="retry-initialization"
            class="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    `,
    );

    // Attach retry handler
    const retryBtn = document.getElementById('retry-initialization');
    if (retryBtn !== null) {
      retryBtn.addEventListener('click', () => {
        window.location.reload();
      });
    }
  }
}

/**
 * Global error handler for unhandled errors
 * Logs errors and shows user-friendly message
 */
function setupGlobalErrorHandler(): void {
  window.addEventListener('error', (event) => {
    console.error('[Explorer] Global error:', event.error);

    // Don't show UI for script loading errors - these are logged already
    if (event.error instanceof Error && event.error.message.includes('Failed to fetch')) {
      return;
    }

    // Show error state if not already shown
    const currentState = stateManager.getState();
    if (currentState.error === null) {
      stateManager.setError('Ein unerwarteter Fehler ist aufgetreten');
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Explorer] Unhandled promise rejection:', event.reason);

    // Show error state if not already shown
    const currentState = stateManager.getState();
    if (currentState.error === null) {
      stateManager.setError('Ein unerwarteter Fehler ist aufgetreten');
    }
  });
}

/**
 * Setup performance monitoring (optional)
 * Logs initialization time for debugging
 */
function logPerformanceMetrics(): void {
  // Use modern PerformanceNavigationTiming instead of deprecated timing API
  const perfEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  const navTiming = perfEntries[0];
  if (navTiming !== undefined) {
    const loadTime = navTiming.loadEventEnd - navTiming.fetchStart;
    const domReady = navTiming.domContentLoadedEventEnd - navTiming.fetchStart;

    console.info('[Explorer] Performance Metrics:', {
      totalLoadTime: `${Math.round(loadTime)}ms`,
      domReadyTime: `${Math.round(domReady)}ms`,
    });
  }
}

/**
 * Auto-initialize on DOM ready
 * Entry point for the application
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setupGlobalErrorHandler();
    void initialize().then(() => {
      logPerformanceMetrics();
      // Return undefined to satisfy ESLint
      return undefined;
    });
  });
} else {
  // DOM already loaded (e.g., script loaded with defer)
  setupGlobalErrorHandler();
  void initialize().then(() => {
    logPerformanceMetrics();
    // Return undefined to satisfy ESLint
    return undefined;
  });
}

// Export for manual initialization if needed
export { isInitialized, initializationError };
