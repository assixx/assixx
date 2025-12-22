/**
 * Toast/Notification Store for SvelteKit
 * 1:1 Copy from frontend/src/scripts/services/notification.service.ts
 * Using Svelte writable store for global state
 */

import { writable } from 'svelte/store';

// =============================================================================
// TYPES (JSDoc)
// =============================================================================

/**
 * @typedef {'success' | 'error' | 'warning' | 'info'} ToastType
 */

/**
 * @typedef {Object} Toast
 * @property {string} id
 * @property {ToastType} type
 * @property {string} title
 * @property {string} [message]
 * @property {number} [duration]
 * @property {boolean} [dismissing] - Animation state
 */

// =============================================================================
// STORE
// =============================================================================

const MAX_TOASTS = 3;
const DEFAULT_DURATION = 4000; // 4 seconds

/** @type {import('svelte/store').Writable<Toast[]>} */
export const toasts = writable([]);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate unique ID
 * @returns {string}
 */
function generateId() {
  return `toast-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// =============================================================================
// EXPORTED FUNCTIONS
// =============================================================================

/**
 * Show a toast notification
 * @param {Omit<Toast, 'id'>} toast
 * @returns {string} Toast ID
 */
export function showToast(toast) {
  let currentToasts = [];
  toasts.subscribe((t) => (currentToasts = t))();

  if (currentToasts.length >= MAX_TOASTS) {
    console.info(`[TOAST] Max ${MAX_TOASTS} toasts active, ignoring new one`);
    return '';
  }

  const id = generateId();
  const duration = toast.duration ?? DEFAULT_DURATION;

  /** @type {Toast} */
  const fullToast = {
    id,
    type: toast.type,
    title: toast.title,
    message: toast.message,
    duration,
    dismissing: false,
  };

  toasts.update((t) => [...t, fullToast]);

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
 * @param {string} id
 */
export function dismissToast(id) {
  // First mark as dismissing for animation
  toasts.update((t) =>
    t.map((toast) => (toast.id === id ? { ...toast, dismissing: true } : toast)),
  );

  // Then remove after animation
  setTimeout(() => {
    toasts.update((t) => t.filter((toast) => toast.id !== id));
  }, 300);
}

/**
 * Dismiss all toasts
 */
export function dismissAllToasts() {
  toasts.set([]);
}

// =============================================================================
// SHORTHAND FUNCTIONS (like legacy alerts.ts)
// =============================================================================

/**
 * Show success toast
 * @param {string} message
 * @param {number} [duration]
 * @returns {string}
 */
export function showSuccessAlert(message, duration) {
  return showToast({
    type: 'success',
    title: 'Erfolg',
    message,
    duration: duration ?? DEFAULT_DURATION,
  });
}

/**
 * Show error toast
 * @param {string} message
 * @param {number} [duration]
 * @returns {string}
 */
export function showErrorAlert(message, duration) {
  return showToast({
    type: 'error',
    title: 'Fehler',
    message,
    duration: duration ?? DEFAULT_DURATION * 2, // Errors stay longer
  });
}

/**
 * Show warning toast
 * @param {string} message
 * @param {number} [duration]
 * @returns {string}
 */
export function showWarningAlert(message, duration) {
  return showToast({
    type: 'warning',
    title: 'Warnung',
    message,
    duration: duration ?? DEFAULT_DURATION,
  });
}

/**
 * Show info toast
 * @param {string} message
 * @param {number} [duration]
 * @returns {string}
 */
export function showInfoAlert(message, duration) {
  return showToast({
    type: 'info',
    title: 'Information',
    message,
    duration: duration ?? DEFAULT_DURATION,
  });
}
