/**
 * Password Strength Integration - Shared Utility
 * Generic password strength setup for any form module
 * Provides real-time password strength validation with zxcvbn-ts
 */

import type { ZxcvbnResult } from '@zxcvbn-ts/core';
import { $$id, setHTML, escapeHtml } from './dom-utils';
import {
  initPasswordStrength,
  checkPasswordStrength,
  getStrengthLabel,
  formatCrackTime,
  isPasswordStrengthReady,
} from './password-strength-core';

/**
 * Configuration for password strength validation setup
 */
export interface PasswordStrengthConfig {
  // Required: Password input field ID
  passwordFieldId: string;

  // Required: Container IDs for strength UI
  strengthContainerId: string;
  strengthBarId: string;
  strengthLabelId: string;
  strengthTimeId: string;

  // Optional: Feedback container IDs for warnings/suggestions
  feedbackContainerId?: string;
  feedbackWarningId?: string;
  feedbackSuggestionsId?: string;

  // Optional: Error element ID for validation messages
  errorElementId?: string;

  // Required: User context provider function
  getUserInputs: () => string[];

  // Optional: Configuration
  debounceMs?: number; // Default: 300ms
  requireMinScore?: number; // Minimum acceptable score (0-4), default: none
}

/**
 * Count how many character categories are present in password
 * Categories: uppercase, lowercase, numbers, special characters
 */
function countPasswordCategories(password: string): number {
  let count = 0;
  if (/[a-z]/.test(password)) count++;
  if (/[A-Z]/.test(password)) count++;
  if (/\d/.test(password)) count++;
  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) count++;
  return count;
}

/**
 * Get appropriate error message based on password validation
 */
function getPasswordErrorMessage(password: string, hasEnoughCategories: boolean): string {
  if (password.length < 12) {
    return 'Passwort muss mindestens 12 Zeichen lang sein';
  }
  if (password.length > 72) {
    return 'Passwort darf maximal 72 Zeichen lang sein (BCrypt-Limit)';
  }
  if (!hasEnoughCategories) {
    return 'Passwort muss Zeichen aus mindestens 3 Kategorien enthalten (Großbuchstaben, Kleinbuchstaben, Zahlen, Sonderzeichen)';
  }
  return '';
}

/**
 * Validate basic password requirements (length, complexity)
 * Must match backend PasswordSchema requirements
 */
function validateBasicPasswordRequirements(password: string): { isValid: boolean; errorMessage: string } {
  // eslint-disable-next-line security/detect-possible-timing-attacks -- Not a timing attack: checking empty string, not comparing secrets
  if (password === '') {
    return { isValid: true, errorMessage: '' };
  }

  const categoriesPresent = countPasswordCategories(password);
  const hasEnoughCategories = categoriesPresent >= 3;
  const isValidLength = password.length >= 12 && password.length <= 72;

  const isValid = isValidLength && hasEnoughCategories;
  const errorMessage = isValid ? '' : getPasswordErrorMessage(password, hasEnoughCategories);

  return { isValid, errorMessage };
}

/**
 * Clear password validation UI elements
 */
function clearPasswordValidationUI(
  passwordInput: HTMLInputElement,
  errorElement: HTMLElement | null,
  strengthContainer: HTMLElement | null,
  feedbackContainer: HTMLElement | null,
): void {
  passwordInput.classList.remove('is-error', 'is-success');

  if (errorElement !== null) {
    errorElement.textContent = '';
    errorElement.classList.add('u-hidden');
  }

  if (strengthContainer !== null) {
    strengthContainer.classList.add('u-hidden');
  }

  if (feedbackContainer !== null) {
    feedbackContainer.classList.add('u-hidden');
  }
}

/**
 * Update password error state with visual feedback
 */
function updatePasswordErrorState(
  passwordInput: HTMLInputElement,
  errorElement: HTMLElement | null,
  isValid: boolean,
  errorMessage: string,
): void {
  if (isValid) {
    passwordInput.classList.remove('is-error');
    passwordInput.classList.add('is-success');
    if (errorElement !== null) {
      errorElement.textContent = '';
      errorElement.classList.add('u-hidden');
    }
  } else {
    passwordInput.classList.remove('is-success');
    passwordInput.classList.add('is-error');
    if (errorElement !== null && errorMessage !== '') {
      errorElement.textContent = errorMessage;
      errorElement.classList.remove('u-hidden');
    }
  }
}

/**
 * Update strength UI elements (bar, label, time)
 */
function updateStrengthUI(
  result: ZxcvbnResult | null,
  strengthBar: HTMLElement | null,
  strengthLabel: HTMLElement | null,
  strengthTime: HTMLElement | null,
): void {
  if (result !== null && strengthBar !== null && strengthLabel !== null && strengthTime !== null) {
    // Update strength bar score
    strengthBar.dataset.score = result.score.toString();

    // Update strength label
    strengthLabel.textContent = getStrengthLabel(result.score);

    // Update crack time
    const crackTimeFormatted = formatCrackTime(result.crackTimesDisplay.offlineSlowHashing1e4PerSecond);
    strengthTime.textContent = crackTimeFormatted;
  }
}

/**
 * Update warning element visibility and content
 */
function updateWarningElement(warningElement: HTMLElement | null, warning: string): void {
  if (warningElement === null) {
    return;
  }

  if (warning !== '') {
    warningElement.textContent = warning;
    warningElement.classList.remove('u-hidden');
  } else {
    warningElement.classList.add('u-hidden');
  }
}

/**
 * Update suggestions element visibility and content
 */
function updateSuggestionsElement(suggestionsElement: HTMLElement | null, suggestions: string[]): void {
  if (suggestionsElement === null) {
    return;
  }

  if (suggestions.length > 0) {
    const suggestionsHTML = suggestions.map((suggestion) => `<li>${escapeHtml(suggestion)}</li>`).join('');
    setHTML(suggestionsElement, `<ul>${suggestionsHTML}</ul>`);
    suggestionsElement.classList.remove('u-hidden');
  } else {
    suggestionsElement.classList.add('u-hidden');
  }
}

/**
 * Update feedback UI elements (warnings, suggestions)
 * Cognitive complexity reduced by extracting helper functions
 */
function updateFeedbackUI(
  result: ZxcvbnResult | null,
  feedbackContainer: HTMLElement | null,
  feedbackWarning: HTMLElement | null,
  feedbackSuggestions: HTMLElement | null,
): void {
  if (result === null || feedbackContainer === null) {
    return;
  }

  const hasWarning = (result.feedback.warning ?? '') !== '';
  const hasSuggestions = result.feedback.suggestions.length > 0;

  if (hasWarning || hasSuggestions) {
    feedbackContainer.classList.remove('u-hidden');
    updateWarningElement(feedbackWarning, result.feedback.warning ?? '');
    updateSuggestionsElement(feedbackSuggestions, result.feedback.suggestions);
  } else {
    feedbackContainer.classList.add('u-hidden');
  }
}

/**
 * DOM elements for password strength validation
 */
interface PasswordStrengthElements {
  passwordInput: HTMLInputElement;
  strengthContainer: HTMLElement | null;
  strengthBar: HTMLElement | null;
  strengthLabel: HTMLElement | null;
  strengthTime: HTMLElement | null;
  errorElement: HTMLElement | null;
  feedbackContainer: HTMLElement | null;
  feedbackWarning: HTMLElement | null;
  feedbackSuggestions: HTMLElement | null;
}

/**
 * Retrieve all DOM elements for password strength validation
 */
function getPasswordStrengthElements(config: PasswordStrengthConfig): PasswordStrengthElements | null {
  const passwordInput = $$id(config.passwordFieldId.replace('#', '')) as HTMLInputElement | null;

  if (passwordInput === null) {
    console.warn('[setupPasswordStrength] Password input not found:', config.passwordFieldId);
    return null;
  }

  return {
    passwordInput,
    strengthContainer: $$id(config.strengthContainerId.replace('#', '')),
    strengthBar: $$id(config.strengthBarId.replace('#', '')),
    strengthLabel: $$id(config.strengthLabelId.replace('#', '')),
    strengthTime: $$id(config.strengthTimeId.replace('#', '')),
    errorElement: config.errorElementId !== undefined ? $$id(config.errorElementId.replace('#', '')) : null,
    feedbackContainer:
      config.feedbackContainerId !== undefined ? $$id(config.feedbackContainerId.replace('#', '')) : null,
    feedbackWarning: config.feedbackWarningId !== undefined ? $$id(config.feedbackWarningId.replace('#', '')) : null,
    feedbackSuggestions:
      config.feedbackSuggestionsId !== undefined ? $$id(config.feedbackSuggestionsId.replace('#', '')) : null,
  };
}

/**
 * Create password validation function with all required context
 */
function createPasswordValidator(
  elements: PasswordStrengthElements,
  config: PasswordStrengthConfig,
): () => Promise<void> {
  return async (): Promise<void> => {
    const password = elements.passwordInput.value;

    // Clear state if empty
    // eslint-disable-next-line security/detect-possible-timing-attacks -- Not a timing attack: checking empty string, not comparing secrets
    if (password === '') {
      clearPasswordValidationUI(
        elements.passwordInput,
        elements.errorElement,
        elements.strengthContainer,
        elements.feedbackContainer,
      );
      return;
    }

    // Show strength container
    if (elements.strengthContainer !== null) {
      elements.strengthContainer.classList.remove('u-hidden');
    }

    // Basic validation and UI update
    const basicValidation = validateBasicPasswordRequirements(password);
    updatePasswordErrorState(
      elements.passwordInput,
      elements.errorElement,
      basicValidation.isValid,
      basicValidation.errorMessage,
    );

    // Only run zxcvbn if initialized
    if (!isPasswordStrengthReady()) {
      return;
    }

    // Get user context and run zxcvbn
    const userInputs = config.getUserInputs();
    const result = await checkPasswordStrength(password, userInputs);

    // Update UI
    updateStrengthUI(result, elements.strengthBar, elements.strengthLabel, elements.strengthTime);
    updateFeedbackUI(result, elements.feedbackContainer, elements.feedbackWarning, elements.feedbackSuggestions);

    // Handle score requirement if configured
    if (config.requireMinScore !== undefined && result !== null && result.score < config.requireMinScore) {
      updatePasswordErrorState(
        elements.passwordInput,
        elements.errorElement,
        false,
        'Passwort ist zu schwach - bitte wählen Sie ein sichereres Passwort',
      );
      return;
    }

    // Handle very weak passwords (score 0)
    if (result !== null && result.score === 0 && basicValidation.isValid) {
      updatePasswordErrorState(
        elements.passwordInput,
        elements.errorElement,
        false,
        'Passwort ist zu schwach - bitte wählen Sie ein sichereres Passwort',
      );
    }
  };
}

/**
 * Reset password strength UI to initial state
 * Call this when closing modals to prevent cached validation state
 *
 * @param config - Partial configuration with only required element IDs
 *
 * @example
 * ```typescript
 * resetPasswordStrengthUI({
 *   passwordFieldId: 'admin-password',
 *   strengthContainerId: 'admin-password-strength-container',
 *   feedbackContainerId: 'admin-password-feedback',
 *   errorElementId: 'admin-password-error'
 * });
 * ```
 */
export function resetPasswordStrengthUI(config: {
  passwordFieldId: string;
  strengthContainerId?: string;
  feedbackContainerId?: string;
  errorElementId?: string;
}): void {
  const passwordInput = $$id(config.passwordFieldId.replace('#', '')) as HTMLInputElement | null;
  const strengthContainer =
    config.strengthContainerId !== undefined ? $$id(config.strengthContainerId.replace('#', '')) : null;
  const feedbackContainer =
    config.feedbackContainerId !== undefined ? $$id(config.feedbackContainerId.replace('#', '')) : null;
  const errorElement = config.errorElementId !== undefined ? $$id(config.errorElementId.replace('#', '')) : null;

  if (passwordInput === null) {
    return;
  }

  clearPasswordValidationUI(passwordInput, errorElement, strengthContainer, feedbackContainer);
}

/**
 * Setup real-time password strength validation
 * Generic function that works with any form module
 *
 * @param config - Configuration object with DOM IDs and callbacks
 *
 * @example
 * ```typescript
 * setupPasswordStrength({
 *   passwordFieldId: '#root-password',
 *   strengthContainerId: '#root-password-strength-container',
 *   strengthBarId: '#root-password-strength-bar',
 *   strengthLabelId: '#root-password-strength-label',
 *   strengthTimeId: '#root-password-strength-time',
 *   getUserInputs: () => {
 *     const firstName = ($$id('root-first-name') as HTMLInputElement)?.value ?? '';
 *     const lastName = ($$id('root-last-name') as HTMLInputElement)?.value ?? '';
 *     return [firstName, lastName].filter(v => v !== '');
 *   }
 * });
 * ```
 */
export function setupPasswordStrength(config: PasswordStrengthConfig): void {
  const elements = getPasswordStrengthElements(config);
  if (elements === null) {
    return;
  }

  // Initialize zxcvbn on first focus (lazy loading)
  const handleFirstFocus = async (): Promise<void> => {
    if (!isPasswordStrengthReady()) {
      await initPasswordStrength();
    }
  };

  elements.passwordInput.addEventListener('focus', () => {
    void handleFirstFocus();
  });

  // Create validation function with closure over elements and config
  const validatePasswordStrength = createPasswordValidator(elements, config);

  // Debounced validation on input
  const debounceMs = config.debounceMs ?? 300;
  let validationTimeout: NodeJS.Timeout | null = null;

  elements.passwordInput.addEventListener('input', () => {
    if (validationTimeout !== null) {
      clearTimeout(validationTimeout);
    }
    validationTimeout = setTimeout(() => {
      void validatePasswordStrength();
    }, debounceMs);
  });
}
