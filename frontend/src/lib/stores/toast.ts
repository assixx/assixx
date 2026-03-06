/**
 * Toast/Notification Store for SvelteKit
 * Using Svelte writable store for global state
 */

import { writable, type Writable } from 'svelte/store';

import { createLogger } from '$lib/utils/logger';

const log = createLogger('Toast');

// =============================================================================
// TYPES
// =============================================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  href: string;
}

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  dismissing?: boolean;
  action?: ToastAction;
}

// =============================================================================
// STORE
// =============================================================================

const MAX_TOASTS: number = 3;
const DEFAULT_DURATION: number = 4000; // 4 seconds

export const toasts: Writable<Toast[]> = writable([]);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate unique ID
 */
function generateId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// =============================================================================
// EXPORTED FUNCTIONS
// =============================================================================

/**
 * Show a toast notification
 */
export function showToast(toast: Omit<Toast, 'id'>): string {
  let currentToasts: Toast[] = [];
  toasts.subscribe((t: Toast[]) => (currentToasts = t))();

  if (currentToasts.length >= MAX_TOASTS) {
    log.warn({ maxToasts: MAX_TOASTS }, 'Max toasts active, ignoring new one');
    return '';
  }

  const id: string = generateId();
  const duration: number = toast.duration ?? DEFAULT_DURATION;

  const fullToast: Toast = {
    id,
    type: toast.type,
    title: toast.title,
    message: toast.message,
    duration,
    dismissing: false,
    action: toast.action,
  };

  toasts.update((t: Toast[]) => [...t, fullToast]);

  // Auto-dismiss after duration
  if (duration > 0) {
    setTimeout(() => {
      dismissToast(id);
    }, duration);
  }

  return id;
}

/**
 * Dismiss a toast by ID (with animation)
 */
export function dismissToast(id: string): void {
  // First mark as dismissing for animation
  toasts.update((t: Toast[]) =>
    t.map((toast: Toast) =>
      toast.id === id ? { ...toast, dismissing: true } : toast,
    ),
  );

  // Then remove after animation
  setTimeout(() => {
    toasts.update((t: Toast[]) => t.filter((toast: Toast) => toast.id !== id));
  }, 300);
}

/**
 * Dismiss all toasts
 */
export function dismissAllToasts(): void {
  toasts.set([]);
}

// =============================================================================
// SHORTHAND FUNCTIONS (like legacy alerts.ts)
// =============================================================================

/**
 * Show success toast
 */
export function showSuccessAlert(message: string, duration?: number): string {
  return showToast({
    type: 'success',
    title: 'Erfolg',
    message,
    duration: duration ?? DEFAULT_DURATION,
  });
}

/**
 * Show error toast
 */
export function showErrorAlert(message: string, duration?: number): string {
  return showToast({
    type: 'error',
    title: 'Fehler',
    message,
    duration: duration ?? DEFAULT_DURATION * 2, // Errors stay longer
  });
}

/**
 * Show warning toast
 */
export function showWarningAlert(message: string, duration?: number): string {
  return showToast({
    type: 'warning',
    title: 'Warnung',
    message,
    duration: duration ?? DEFAULT_DURATION,
  });
}

/**
 * Show info toast
 */
export function showInfoAlert(message: string, duration?: number): string {
  return showToast({
    type: 'info',
    title: 'Information',
    message,
    duration: duration ?? DEFAULT_DURATION,
  });
}
