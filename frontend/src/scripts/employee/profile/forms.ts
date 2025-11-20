/* eslint-disable max-lines */
/**
 * Employee Profile Management - Forms Layer
 * Form handling, validation, and event setup
 */

import { $$id, setHTML, escapeHtml } from '../../../utils/dom-utils';
import { showSuccessAlert, showErrorAlert, showConfirmDanger } from '../../utils/alerts';
import { setupPasswordToggles } from '../../../utils/password-toggle';
import {
  initPasswordStrength,
  checkPasswordStrength,
  getStrengthLabel,
  formatCrackTime,
} from '../../../utils/password-strength-core';
import { SessionManager } from '../../utils/session-manager';
import type { PasswordChangeData } from './types';
import { handleChangePassword, handleUploadProfilePicture, handleRemoveProfilePicture } from './data';

// ===== PASSWORD FORM SETUP =====

/**
 * Update zxcvbn strength UI elements
 * @param result - zxcvbn result object
 * @param strengthBar - Strength bar element
 * @param strengthLabel - Strength label element
 * @param strengthTime - Crack time element
 */
function updateStrengthUI(
  result: Awaited<ReturnType<typeof checkPasswordStrength>>,
  strengthBar: HTMLElement | null,
  strengthLabel: HTMLElement | null,
  strengthTime: HTMLElement | null,
): void {
  if (result === null) {
    return;
  }

  // Update strength bar
  if (strengthBar !== null) {
    strengthBar.setAttribute('data-score', String(result.score));
  }

  // Update strength label
  if (strengthLabel !== null) {
    strengthLabel.textContent = getStrengthLabel(result.score);
  }

  // Update crack time
  if (strengthTime !== null) {
    const crackTime = result.crackTimesDisplay.offlineSlowHashing1e4PerSecond;
    // crackTime is always defined as per zxcvbn types, check for empty string only
    strengthTime.textContent = crackTime !== '' ? formatCrackTime(crackTime) : '';
  }
}

/**
 * Update zxcvbn feedback UI elements
 * @param result - zxcvbn result object
 * @param feedbackContainer - Feedback container element
 * @param feedbackWarning - Warning element
 * @param feedbackSuggestions - Suggestions list element
 */
function updateFeedbackUI(
  result: Awaited<ReturnType<typeof checkPasswordStrength>>,
  feedbackContainer: HTMLElement | null,
  feedbackWarning: HTMLElement | null,
  feedbackSuggestions: HTMLElement | null,
): void {
  if (result === null || feedbackContainer === null) {
    return;
  }

  // Show feedback if weak password
  if (result.score < 3) {
    feedbackContainer.classList.remove('u-hidden');

    // Show warning (warning is always defined as per zxcvbn types, may be empty string)
    if (feedbackWarning !== null && result.feedback.warning !== '') {
      feedbackWarning.textContent = result.feedback.warning;
    }

    // Show suggestions (suggestions array is always defined as per zxcvbn types)
    if (feedbackSuggestions !== null && result.feedback.suggestions.length > 0) {
      const suggestionsHTML = result.feedback.suggestions
        .map((suggestion) => `<li>${escapeHtml(suggestion)}</li>`)
        .join('');
      setHTML(feedbackSuggestions, suggestionsHTML);
      feedbackSuggestions.classList.remove('u-hidden');
    } else if (feedbackSuggestions !== null) {
      feedbackSuggestions.classList.add('u-hidden');
    }
  } else {
    feedbackContainer.classList.add('u-hidden');
  }
}

/**
 * Count character categories in password
 * @param password - Password to check
 * @returns Number of categories present
 */
function countPasswordCategories(password: string): number {
  let count = 0;
  if (/[A-Z]/.test(password)) count++; // Uppercase
  if (/[a-z]/.test(password)) count++; // Lowercase
  if (/\d/.test(password)) count++; // Numbers
  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) count++; // Special chars
  return count;
}

/**
 * Get password validation error message
 * @param password - Password to validate
 * @param hasEnoughCategories - Whether password has enough categories
 * @returns Error message or empty string
 */
function getPasswordErrorMessage(password: string, hasEnoughCategories: boolean): string {
  if (password.length < 12) {
    return 'Passwort muss mindestens 12 Zeichen lang sein';
  }
  if (password.length > 72) {
    return 'Passwort darf maximal 72 Zeichen lang sein (BCrypt-Limit)';
  }
  if (!hasEnoughCategories) {
    return 'Passwort muss Zeichen aus mind. 3 Kategorien enthalten: Groß-/Kleinbuchstaben, Zahlen, Sonderzeichen (!@#$%^&*)';
  }
  return '';
}

/**
 * Validate password against basic requirements
 * @param password - Password to validate
 * @returns Object with validation status and error message
 */
function validateBasicPasswordRequirements(password: string): {
  isValid: boolean;
  errorMessage: string;
  isValidLength: boolean;
  hasEnoughCategories: boolean;
} {
  const isValidLength = password.length >= 12 && password.length <= 72;
  const categoriesPresent = countPasswordCategories(password);
  const hasEnoughCategories = categoriesPresent >= 3;

  const errorMessage =
    !isValidLength || !hasEnoughCategories ? getPasswordErrorMessage(password, hasEnoughCategories) : '';

  return {
    isValid: isValidLength && hasEnoughCategories,
    errorMessage,
    isValidLength,
    hasEnoughCategories,
  };
}

/**
 * Highlight password field with error state temporarily
 * @param fieldId - Field ID (e.g., 'new_password')
 * @param errorMessageId - Error message element ID (e.g., 'new-password-error')
 * @param message - Optional custom error message
 * @param duration - Duration in ms to show error (default: 5000ms)
 */
function highlightPasswordFieldError(
  fieldId: string,
  errorMessageId: string,
  message?: string,
  duration: number = 5000,
): void {
  const field = $$id(fieldId) as HTMLInputElement | null;
  const errorElement = $$id(errorMessageId);

  if (field !== null) {
    field.classList.add('is-error');
    field.focus();

    // Update error message if provided
    if (message !== undefined && errorElement !== null) {
      errorElement.textContent = message;
      errorElement.classList.remove('u-hidden');
    }

    // Remove error state after duration
    setTimeout(() => {
      field.classList.remove('is-error');
      if (errorElement !== null) {
        errorElement.classList.add('u-hidden');
      }
    }, duration);
  }
}

/**
 * Handle password form submission
 * @param e - Form submit event
 * @param newPasswordInput - New password input element
 * @param confirmPasswordInput - Confirm password input element
 * @param passwordMismatchError - Password mismatch error element
 * @param newPasswordError - New password error element
 */
async function handlePasswordFormSubmit(
  e: SubmitEvent,
  newPasswordInput: HTMLInputElement,
  confirmPasswordInput: HTMLInputElement,
  passwordMismatchError: HTMLElement | null,
  newPasswordError: HTMLElement | null,
): Promise<void> {
  e.preventDefault();

  const currentPasswordInput = $$id('current_password') as HTMLInputElement | null;

  if (currentPasswordInput === null) {
    showErrorAlert('Formularfehler: Felder nicht gefunden');
    return;
  }

  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;
  const currentPassword = currentPasswordInput.value;

  // Frontend validation: Password match
  if (newPassword !== confirmPassword) {
    showErrorAlert('Die Passwörter stimmen nicht überein');
    confirmPasswordInput.classList.add('is-error');
    if (passwordMismatchError !== null) {
      passwordMismatchError.classList.remove('u-hidden');
    }
    return;
  }

  // Frontend validation: Password strength (MODERN 2024 Standards - matches backend)
  const basicValidation = validateBasicPasswordRequirements(newPassword);

  if (!basicValidation.isValid) {
    showErrorAlert(basicValidation.errorMessage);
    newPasswordInput.classList.add('is-error');
    if (newPasswordError !== null) {
      newPasswordError.textContent = basicValidation.errorMessage;
      newPasswordError.classList.remove('u-hidden');
    }
    return;
  }

  const data: PasswordChangeData = {
    currentPassword,
    newPassword,
    confirmPassword,
  };

  try {
    await handleChangePassword(data);
    showSuccessAlert('Passwort erfolgreich geändert. Sie werden aus Sicherheitsgründen abgemeldet...');

    // Reset form and error states
    (e.target as HTMLFormElement).reset();
    confirmPasswordInput.classList.remove('is-error');
    if (passwordMismatchError !== null) {
      passwordMismatchError.classList.add('u-hidden');
    }
    newPasswordInput.classList.remove('is-error');
    if (newPasswordError !== null) {
      newPasswordError.classList.add('u-hidden');
    }

    // Logout after 2 seconds to let user see the success message
    setTimeout(() => {
      const sessionManager = SessionManager.getInstance();
      sessionManager.logout(false);
    }, 2000);
  } catch (error) {
    // Use field-specific error handling
    handlePasswordChangeError(error);
  }
}

/**
 * Handle password change API errors with field-specific feedback
 * @param error - API error object
 */
function handlePasswordChangeError(error: unknown): void {
  console.error('[EmployeeProfile] Password change error:', error);

  const errorObj = error as {
    code?: string;
    message?: string;
    error?: string;
    field?: string;
    details?: { field: string; message: string }[];
  };

  const errorMessage = errorObj.message ?? errorObj.error ?? 'Fehler beim Ändern des Passworts';
  const errorField = errorObj.field;

  // Handle Zod validation errors with details array
  if (errorObj.details !== undefined && errorObj.details.length > 0) {
    const firstError = errorObj.details[0];
    if (firstError.field === 'newPassword') {
      highlightPasswordFieldError('new_password', 'new-password-error', firstError.message);
      showErrorAlert(firstError.message);
      return;
    }
    if (firstError.field === 'confirmPassword') {
      highlightPasswordFieldError('confirm_password', 'password-mismatch-error', firstError.message);
      showErrorAlert(firstError.message);
      return;
    }
  }

  // Handle field-specific errors
  if (errorField === 'newPassword') {
    highlightPasswordFieldError('new_password', 'new-password-error', errorMessage);
    showErrorAlert(errorMessage);
    return;
  }

  if (errorField === 'currentPassword' || errorMessage.toLowerCase().includes('current password')) {
    highlightPasswordFieldError('current_password', 'current-password-error', 'Aktuelles Passwort ist falsch');
    showErrorAlert('Aktuelles Passwort ist falsch');
    return;
  }

  // Check error message content for password validation issues (2024 Standards)
  const lowerMessage = errorMessage.toLowerCase();
  if (
    lowerMessage.includes('uppercase') ||
    lowerMessage.includes('lowercase') ||
    lowerMessage.includes('number') ||
    lowerMessage.includes('special') ||
    lowerMessage.includes('12 characters') ||
    lowerMessage.includes('72 characters') ||
    lowerMessage.includes('bcrypt limit') ||
    lowerMessage.includes('3 of the following') ||
    lowerMessage.includes('categories')
  ) {
    highlightPasswordFieldError('new_password', 'new-password-error', errorMessage);
    showErrorAlert(errorMessage);
    return;
  }

  // Generic error fallback
  showErrorAlert(errorMessage);
}

/**
 * Clear password validation UI states
 */
function clearPasswordValidationUI(
  passwordInput: HTMLInputElement,
  errorElement: HTMLElement | null,
  strengthContainer: HTMLElement | null,
  feedbackContainer: HTMLElement | null,
): void {
  passwordInput.classList.remove('is-error');
  if (errorElement !== null) {
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
 * Get user context inputs for zxcvbn analysis
 */
function getUserContextInputs(
  firstNameInput: HTMLInputElement | null,
  lastNameInput: HTMLInputElement | null,
  emailInput: HTMLInputElement | null,
): string[] {
  const userInputs: string[] = [];

  if (firstNameInput !== null && firstNameInput.value !== '') {
    userInputs.push(firstNameInput.value.toLowerCase());
  }
  if (lastNameInput !== null && lastNameInput.value !== '') {
    userInputs.push(lastNameInput.value.toLowerCase());
  }
  if (emailInput !== null && emailInput.value !== '') {
    const emailLocalPart = emailInput.value.split('@')[0];
    userInputs.push(emailLocalPart.toLowerCase());
  }

  return userInputs;
}

/**
 * Update password field error state
 */
function updatePasswordErrorState(
  passwordInput: HTMLInputElement,
  errorElement: HTMLElement | null,
  isValid: boolean,
  errorMessage: string,
): void {
  if (isValid) {
    passwordInput.classList.remove('is-error');
    if (errorElement !== null) {
      errorElement.classList.add('u-hidden');
    }
  } else {
    passwordInput.classList.add('is-error');
    if (errorElement !== null && errorMessage !== '') {
      errorElement.textContent = errorMessage;
      errorElement.classList.remove('u-hidden');
    }
  }
}

/**
 * Setup real-time password strength validation
 */
function setupRealTimePasswordValidation(
  passwordInput: HTMLInputElement,
  errorElement: HTMLElement | null,
  strengthContainer: HTMLElement | null,
  feedbackContainer: HTMLElement | null,
  strengthBar: HTMLElement | null,
  strengthLabel: HTMLElement | null,
  strengthTime: HTMLElement | null,
  feedbackWarning: HTMLElement | null,
  feedbackSuggestions: HTMLElement | null,
  firstNameInput: HTMLInputElement | null,
  lastNameInput: HTMLInputElement | null,
  emailInput: HTMLInputElement | null,
): void {
  const validatePasswordStrength = async (): Promise<void> => {
    const password = passwordInput.value;

    // Clear state if empty
    // eslint-disable-next-line security/detect-possible-timing-attacks -- Not a timing attack: checking empty string, not comparing secrets
    if (password === '') {
      clearPasswordValidationUI(passwordInput, errorElement, strengthContainer, feedbackContainer);
      return;
    }

    // Show strength container
    if (strengthContainer !== null) {
      strengthContainer.classList.remove('u-hidden');
    }

    // Basic validation and UI update
    const basicValidation = validateBasicPasswordRequirements(password);
    updatePasswordErrorState(passwordInput, errorElement, basicValidation.isValid, basicValidation.errorMessage);

    // Get user context and run zxcvbn
    const userInputs = getUserContextInputs(firstNameInput, lastNameInput, emailInput);
    const result = await checkPasswordStrength(password, userInputs);

    // Update UI
    updateStrengthUI(result, strengthBar, strengthLabel, strengthTime);
    updateFeedbackUI(result, feedbackContainer, feedbackWarning, feedbackSuggestions);

    // Handle very weak passwords
    if (result !== null && result.score === 0 && basicValidation.isValid) {
      updatePasswordErrorState(
        passwordInput,
        errorElement,
        false,
        'Passwort ist zu schwach - bitte wählen Sie ein sichereres Passwort',
      );
    }
  };

  // Debounced validation
  let validationTimeout: NodeJS.Timeout | null = null;
  passwordInput.addEventListener('input', () => {
    if (validationTimeout !== null) {
      clearTimeout(validationTimeout);
    }
    validationTimeout = setTimeout(() => {
      void validatePasswordStrength();
    }, 300);
  });
}

/**
 * Setup password match validation between new and confirm password fields
 */
function setupPasswordMatchValidation(
  newPasswordInput: HTMLInputElement | null,
  confirmPasswordInput: HTMLInputElement | null,
  passwordMismatchError: HTMLElement | null,
): void {
  if (newPasswordInput === null || confirmPasswordInput === null || passwordMismatchError === null) {
    return;
  }

  const validatePasswordMatch = (): void => {
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // Only validate if confirm field has content
    if (confirmPassword === '') {
      confirmPasswordInput.classList.remove('is-error');
      passwordMismatchError.classList.add('u-hidden');
      return;
    }

    // Check if passwords match
    if (newPassword !== confirmPassword) {
      confirmPasswordInput.classList.add('is-error');
      passwordMismatchError.classList.remove('u-hidden');
    } else {
      confirmPasswordInput.classList.remove('is-error');
      passwordMismatchError.classList.add('u-hidden');
    }
  };

  // Attach validation to both fields
  newPasswordInput.addEventListener('input', validatePasswordMatch);
  confirmPasswordInput.addEventListener('input', validatePasswordMatch);
}

/**
 * Setup password form submission handler with validation
 * INCLUDES: Password toggle buttons + real-time password match validation
 */
export function setupPasswordForm(): void {
  const passwordForm = $$id('password-form') as HTMLFormElement | null;
  if (passwordForm === null) {
    return;
  }

  // Setup password toggle buttons for all 3 fields
  setupPasswordToggles([
    { input: '#current_password', toggle: '#current-password-toggle' },
    { input: '#new_password', toggle: '#new-password-toggle' },
    { input: '#confirm_password', toggle: '#confirm-password-toggle' },
  ]);

  // Get form elements
  const newPasswordInput = $$id('new_password') as HTMLInputElement | null;
  const confirmPasswordInput = $$id('confirm_password') as HTMLInputElement | null;
  const passwordMismatchError = $$id('password-mismatch-error');
  const newPasswordError = $$id('new-password-error');

  // Get zxcvbn UI elements
  const strengthContainer = $$id('password-strength-container');
  const strengthBar = $$id('password-strength-bar');
  const strengthLabel = $$id('password-strength-label');
  const strengthTime = $$id('password-strength-time');
  const feedbackContainer = $$id('password-feedback');
  const feedbackWarning = $$id('password-feedback-warning');
  const feedbackSuggestions = $$id('password-feedback-suggestions');

  // Get user context for zxcvbn
  const firstNameInput = $$id('first_name') as HTMLInputElement | null;
  const lastNameInput = $$id('last_name') as HTMLInputElement | null;
  const emailInput = $$id('email') as HTMLInputElement | null;

  // Initialize zxcvbn on first focus (lazy loading)
  if (newPasswordInput !== null) {
    newPasswordInput.addEventListener(
      'focus',
      () => {
        void initPasswordStrength();
      },
      { once: true },
    );
  }

  // REAL-TIME VALIDATION: Combined traditional + zxcvbn validation
  if (newPasswordInput !== null && newPasswordError !== null) {
    setupRealTimePasswordValidation(
      newPasswordInput,
      newPasswordError,
      strengthContainer,
      feedbackContainer,
      strengthBar,
      strengthLabel,
      strengthTime,
      feedbackWarning,
      feedbackSuggestions,
      firstNameInput,
      lastNameInput,
      emailInput,
    );
  }

  // Setup password match validation
  setupPasswordMatchValidation(newPasswordInput, confirmPasswordInput, passwordMismatchError);

  // Form submission handler
  passwordForm.addEventListener('submit', (e) => {
    if (newPasswordInput === null || confirmPasswordInput === null) {
      showErrorAlert('Formularfehler: Felder nicht gefunden');
      return;
    }

    void handlePasswordFormSubmit(e, newPasswordInput, confirmPasswordInput, passwordMismatchError, newPasswordError);
  });
}

// ===== PROFILE PICTURE SETUP =====

/**
 * Setup profile picture upload handler
 */
export function setupProfilePictureUpload(onSuccess: (url: string) => void): void {
  const pictureInput = $$id('profile-picture-input') as HTMLInputElement | null;
  if (pictureInput === null) {
    return;
  }

  pictureInput.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file === undefined) {
      return;
    }

    void (async () => {
      try {
        const profilePictureUrl = await handleUploadProfilePicture(file);
        onSuccess(profilePictureUrl);
        showSuccessAlert('Profilbild erfolgreich aktualisiert');

        // Reload page after 1 second to sync state
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } catch (error) {
        console.error('[EmployeeProfile] Error uploading profile picture:', error);
        showErrorAlert('Fehler beim Hochladen des Profilbilds');
      }
    })();
  });

  // Setup trigger button
  const triggerBtn = document.querySelector('[data-action="trigger-file-input"]');
  if (triggerBtn !== null) {
    triggerBtn.addEventListener('click', () => {
      pictureInput.click();
    });
  }
}

/**
 * Setup profile picture remove handler
 */
export function setupProfilePictureRemove(): void {
  const removePictureBtn = $$id('remove-picture-btn');
  if (removePictureBtn === null) {
    return;
  }

  removePictureBtn.addEventListener('click', () => {
    void (async () => {
      // Use Design System danger modal instead of native confirm
      const confirmed = await showConfirmDanger(
        'Möchten Sie Ihr Profilbild wirklich entfernen?',
        'Profilbild entfernen',
      );

      if (!confirmed) {
        return;
      }
      try {
        await handleRemoveProfilePicture();
        showSuccessAlert('Profilbild erfolgreich entfernt');

        // Reload page after 1 second to sync state
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } catch (error) {
        console.error('[EmployeeProfile] Error removing profile picture:', error);
        showErrorAlert('Fehler beim Entfernen des Profilbilds');
      }
    })();
  });
}
