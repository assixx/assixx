/**
 * API Client - Pure Utility Functions
 *
 * Stateless helper functions extracted from ApiClient.
 * None of these access class state (no `this`).
 */

import { ApiError, type ApiConfig } from './api-client.types';

// =============================================================================
// PERMISSION ERROR HUMANIZATION
// =============================================================================

/** Action labels for user-facing messages */
const ACTION_LABELS: Record<string, string> = {
  canRead: 'Lesen',
  canWrite: 'Bearbeiten',
  canDelete: 'Löschen',
};

/** Feature/module labels for user-facing messages */
const FEATURE_LABELS: Record<string, string> = {
  calendar: 'Kalender',
  'calendar-events': 'Kalendereinträge',
  blackboard: 'Schwarzes Brett',
  posts: 'Beiträge',
  chat: 'Chat',
  messages: 'Nachrichten',
  documents: 'Dokumente',
  'document-explorer': 'Dokumenten-Explorer',
  shifts: 'Schichtplanung',
  'shift-plans': 'Schichtpläne',
  vacation: 'Urlaub',
  requests: 'Anträge',
  entitlements: 'Urlaubsansprüche',
  rules: 'Urlaubsregeln',
  survey: 'Umfragen',
  kvp: 'KVP',
  suggestions: 'Verbesserungsvorschläge',
  users: 'Benutzerverwaltung',
  settings: 'Einstellungen',
  features: 'Features',
  'asset-status': 'Anlagenstatus',
};

/**
 * Translate a technical permission error into a user-friendly German message.
 *
 * Recognizes three backend patterns:
 * 1. Permission Guard:  "Permission denied: canWrite access required for calendar/calendar-events"
 * 2. Roles Guard:       "Access denied. Required roles: admin, root. Your role: employee"
 * 3. Service-level:     Various custom English messages
 *
 * Returns null if the message doesn't match a known pattern (pass through as-is).
 */
export function humanizePermissionError(message: string): string | null {
  // Pattern 1: Permission Guard — "Permission denied: {action} access required for {feature}/{module}"
  const permMatch = /^Permission denied:\s*(can\w+)\s+access required for\s+(\S+)$/.exec(message);
  if (permMatch !== null) {
    const [, action, featurePath] = permMatch;
    const parts = featurePath.split('/');
    const actionLabel = ACTION_LABELS[action] ?? action;

    // Build human-readable resource name from feature/module parts
    const resourceLabels = parts
      .map((part) => FEATURE_LABELS[part] ?? part)
      .filter((label, index, arr) => arr.indexOf(label) === index); // dedupe same label

    const resource = resourceLabels.join(' – ');

    return (
      `Keine Berechtigung zum ${actionLabel} von „${resource}". ` +
      'Bitte kontaktieren Sie Ihren Vorgesetzten oder Administrator.'
    );
  }

  // Pattern 2: Roles Guard — "Access denied. Required roles: admin, root. Your role: employee"
  if (message.startsWith('Access denied. Required roles:')) {
    return (
      'Sie haben nicht die erforderliche Rolle für diese Aktion. ' +
      'Bitte kontaktieren Sie Ihren Administrator.'
    );
  }

  // Pattern 3: Common service-level English messages
  if (message.includes('only modify your own')) {
    return 'Sie können nur Ihre eigenen Einträge bearbeiten.';
  }
  if (message.includes('only delete your own')) {
    return 'Sie können nur Ihre eigene Einträge löschen.';
  }
  if (message.includes("don't have access") || message.includes('do not have access')) {
    return (
      'Sie haben keinen Zugriff auf diese Ressource. ' +
      'Bitte kontaktieren Sie Ihren Vorgesetzten oder Administrator.'
    );
  }
  if (message.includes('Only root') || message.includes('only root')) {
    return 'Diese Aktion ist nur für System-Administratoren verfügbar.';
  }

  // No known pattern — return null to let caller decide
  return null;
}

// =============================================================================
// ABORT SIGNAL UTILITIES
// =============================================================================

/**
 * Combine multiple AbortSignals into one.
 * The combined signal aborts when ANY of the input signals abort.
 */
export function combineSignals(...signals: (AbortSignal | undefined)[]): AbortSignal {
  const controller = new AbortController();
  const validSignals = signals.filter((s): s is AbortSignal => s !== undefined);

  for (const signal of validSignals) {
    // If already aborted, abort immediately
    if (signal.aborted) {
      // AbortSignal.reason is typed as 'any' in DOM lib - explicitly type it
      const abortReason: unknown = signal.reason;
      controller.abort(abortReason);
      return controller.signal;
    }

    // Listen for abort on each signal
    signal.addEventListener(
      'abort',
      () => {
        // AbortSignal.reason is typed as 'any' in DOM lib - explicitly type it
        const abortReason: unknown = signal.reason;
        controller.abort(abortReason);
      },
      { once: true },
    );
  }

  return controller.signal;
}

/**
 * Create a timeout signal that aborts after the specified duration.
 * Returns both the signal and a cleanup function to clear the timeout.
 */
export function createTimeoutSignal(timeoutMs: number): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new DOMException('Request timeout', 'TimeoutError'));
  }, timeoutMs);

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeoutId);
    },
  };
}

// =============================================================================
// ERROR TYPE CHECKS
// =============================================================================

/**
 * Check if error is a timeout error
 */
export function isTimeoutError(error: Error): boolean {
  if (error.name === 'TimeoutError') {
    return true;
  }
  return error instanceof DOMException && error.message === 'Request timeout';
}

/**
 * Check if error is an abort error (expected during navigation)
 */
export function isAbortError(error: Error): boolean {
  if (error.name === 'AbortError') {
    return true;
  }
  return error.message.includes('NetworkError') || error.message.includes('aborted');
}

/**
 * Wrap an unknown error into a typed Error (ApiError or Error)
 */
export function wrapError(error: unknown): Error {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof Error) {
    return new ApiError(error.message, 'NETWORK_ERROR', 0);
  }

  return new ApiError('Unknown error occurred', 'UNKNOWN_ERROR', 0);
}

// =============================================================================
// REQUEST HELPERS
// =============================================================================

/**
 * Determine the Content-Type header value for a request
 */
export function getContentType(options: RequestInit, config: ApiConfig): string | null {
  const hasBody = options.body !== undefined && options.body !== null;
  if (!hasBody) {
    return null;
  }

  // Explicit content type from config
  if (config.contentType !== undefined && config.contentType !== null) {
    return config.contentType;
  }

  // FormData: let browser set Content-Type with boundary
  if (options.body instanceof FormData) {
    return null;
  }

  return 'application/json';
}

/**
 * Determine credentials mode for a request.
 *
 * Auth endpoints need 'include' to send HttpOnly refresh token cookie.
 * Other endpoints use 'omit' to avoid unnecessary cookie transmission.
 */
export function getCredentialsMode(endpoint: string): RequestCredentials {
  // Auth endpoints need cookies for HttpOnly refresh token
  const authEndpoints = ['/auth/login', '/auth/logout', '/auth/refresh'];
  const isAuthEndpoint = authEndpoints.some((auth) => endpoint.startsWith(auth));
  return isAuthEndpoint ? 'include' : 'omit';
}

/**
 * Extract error message and details from API response data
 */
export function extractErrorMessage(data: Record<string, unknown>): {
  message: string;
  details: string;
} {
  const error = data.error as { message?: string; details?: string } | undefined;

  const message =
    typeof error?.message === 'string' ? error.message
    : typeof data.error === 'string' ? data.error
    : typeof data.message === 'string' ? data.message
    : '';

  const details =
    typeof data.details === 'string' ? data.details
    : typeof error?.details === 'string' ? error.details
    : '';

  return { message, details };
}

/**
 * Create an ApiError from a non-V2 response
 */
export function createApiError(response: Response, data: Record<string, unknown>): ApiError {
  const error = data.error as { message?: string; code?: string; details?: unknown } | undefined;

  const message =
    typeof error?.message === 'string' ? error.message
    : typeof data.message === 'string' ? data.message
    : `Request failed with status ${response.status}`;

  const code = typeof error?.code === 'string' ? error.code : 'API_ERROR';

  return new ApiError(message, code, response.status, error?.details);
}
