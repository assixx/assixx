/**
 * Password Toggle Utility
 *
 * Helper functions for password visibility toggle functionality
 * Works with Design System password-toggle component
 *
 * IMPORTANT: Returns AbortController for cleanup to prevent memory leaks!
 */

import { $$ } from './dom-utils';

/**
 * Setup password visibility toggle for a single password field
 *
 * @param inputSelector - CSS selector for password input (e.g., '#password')
 * @param toggleSelector - CSS selector for toggle button (e.g., '#password-toggle')
 *
 * @returns AbortController to cleanup event listeners (call .abort() when modal closes)
 *
 * @example
 * const cleanup = setupPasswordToggle('#password', '#password-toggle');
 * // Later when modal closes:
 * cleanup?.abort();
 */
export function setupPasswordToggle(inputSelector: string, toggleSelector: string): AbortController | null {
  const input = $$(inputSelector);
  const button = $$(toggleSelector);

  if (
    input === null ||
    button === null ||
    !(input instanceof HTMLInputElement) ||
    !(button instanceof HTMLButtonElement)
  ) {
    console.warn(`[PasswordToggle] Could not find input (${inputSelector}) or button (${toggleSelector})`);
    return null;
  }

  const icon = button.querySelector('i');
  if (icon === null) {
    console.warn(`[PasswordToggle] No icon found in toggle button (${toggleSelector})`);
    return null;
  }

  // Create AbortController for cleanup
  const controller = new AbortController();

  button.addEventListener(
    'click',
    () => {
      togglePasswordVisibility(input, icon, button);
    },
    { signal: controller.signal },
  );

  return controller;
}

/**
 * Toggle password visibility for an input field
 *
 * @param input - Password input element
 * @param icon - Icon element inside toggle button
 * @param button - Toggle button element
 */
function togglePasswordVisibility(input: HTMLInputElement, icon: HTMLElement, button: HTMLButtonElement): void {
  if (input.type === 'password') {
    // Show password
    input.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
    button.setAttribute('aria-label', 'Passwort verstecken');
  } else {
    // Hide password
    input.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
    button.setAttribute('aria-label', 'Passwort anzeigen');
  }
}

/**
 * Setup multiple password toggles at once with a single master AbortController
 *
 * @param configs - Array of input/toggle selector pairs
 *
 * @returns Master AbortController for cleanup, or null if no toggles were set up
 *
 * @example
 * const cleanup = setupPasswordToggles([
 *   { input: '#password', toggle: '#password-toggle' },
 *   { input: '#password-confirm', toggle: '#password-confirm-toggle' }
 * ]);
 * // Later when modal closes:
 * cleanup?.abort();
 */
export function setupPasswordToggles(configs: { input: string; toggle: string }[]): AbortController | null {
  const controller = new AbortController();
  let successCount = 0;

  configs.forEach((config) => {
    const input = $$(config.input);
    const button = $$(config.toggle);

    // Validate elements
    if (
      input === null ||
      button === null ||
      !(input instanceof HTMLInputElement) ||
      !(button instanceof HTMLButtonElement)
    ) {
      console.warn(`[PasswordToggle] Could not find input (${config.input}) or button (${config.toggle})`);
      return;
    }

    const icon = button.querySelector('i');
    if (icon === null) {
      console.warn(`[PasswordToggle] No icon found in toggle button (${config.toggle})`);
      return;
    }

    // Add event listener with master controller's signal
    button.addEventListener(
      'click',
      () => {
        togglePasswordVisibility(input, icon, button);
      },
      { signal: controller.signal },
    );

    successCount++;
  });

  // Return master controller only if at least one toggle was set up
  return successCount > 0 ? controller : null;
}

/**
 * Reset a single password field to hidden state (cleanup for modal close)
 *
 * @param inputSelector - CSS selector for password input (e.g., '#password')
 * @param toggleSelector - CSS selector for toggle button (e.g., '#password-toggle')
 *
 * @example
 * resetPasswordToggle('#password', '#password-toggle');
 */
export function resetPasswordToggle(inputSelector: string, toggleSelector: string): void {
  const input = $$(inputSelector);
  const button = $$(toggleSelector);

  if (input instanceof HTMLInputElement) {
    input.type = 'password';
  }

  if (button instanceof HTMLButtonElement) {
    const icon = button.querySelector('i');
    if (icon !== null) {
      icon.classList.remove('fa-eye-slash');
      icon.classList.add('fa-eye');
      button.setAttribute('aria-label', 'Passwort anzeigen');
    }
  }
}

/**
 * Reset multiple password toggles at once
 *
 * @param configs - Array of input/toggle selector pairs
 *
 * @example
 * // When closing modal:
 * resetPasswordToggles([
 *   { input: '#password', toggle: '#password-toggle' },
 *   { input: '#password-confirm', toggle: '#password-confirm-toggle' }
 * ]);
 */
export function resetPasswordToggles(configs: { input: string; toggle: string }[]): void {
  configs.forEach((config) => {
    resetPasswordToggle(config.input, config.toggle);
  });
}

/**
 * Reset password toggles AND re-initialize event listeners
 * Use this when reopening a modal after it was closed (and cleanup.abort() was called)
 *
 * @param configs - Array of input/toggle selector pairs
 * @param oldCleanup - Previous AbortController to abort (if exists)
 *
 * @returns New AbortController for cleanup
 *
 * @example
 * // When opening modal:
 * passwordToggleCleanup = resetAndReinitializePasswordToggles(
 *   [
 *     { input: '#password', toggle: '#password-toggle' },
 *     { input: '#password-confirm', toggle: '#password-confirm-toggle' }
 *   ],
 *   passwordToggleCleanup // abort old listeners
 * );
 *
 * // When closing modal:
 * passwordToggleCleanup?.abort();
 * passwordToggleCleanup = null;
 */
export function resetAndReinitializePasswordToggles(
  configs: { input: string; toggle: string }[],
  oldCleanup: AbortController | null = null,
): AbortController | null {
  // Abort old event listeners (if any)
  oldCleanup?.abort();

  // Reset UI state
  resetPasswordToggles(configs);

  // Re-initialize event listeners
  return setupPasswordToggles(configs);
}
