/**
 * Password Strength Analysis Module
 * 1:1 Copy from frontend/src/utils/password-strength-core.ts
 *
 * Uses zxcvbn-ts for intelligent password strength estimation
 * Implements lazy loading to minimize bundle impact
 */

import { createLogger } from './logger';

import type { ZxcvbnResult } from '@zxcvbn-ts/core';

const log = createLogger('PasswordStrength');

// Module state - lazy loaded
let zxcvbnInstance:
  | ((password: string, userInputs?: string[]) => ZxcvbnResult)
  | null = null;
let isLoading = false;
let loadPromise: Promise<void> | null = null;

/**
 * Initialize zxcvbn with German language support
 * Lazy loads all required modules on first use
 */
export async function initPasswordStrength(): Promise<void> {
  // Return existing promise if already loading
  if (loadPromise !== null) {
    await loadPromise;
    return;
  }

  // Already loaded
  if (zxcvbnInstance !== null) {
    await Promise.resolve();
    return;
  }

  isLoading = true;

  // Create and store the loading promise
  loadPromise = (async () => {
    try {
      // Dynamic imports for code splitting
      const [{ zxcvbn, zxcvbnOptions }, zxcvbnCommonPackage, zxcvbnDePackage] =
        await Promise.all([
          import('@zxcvbn-ts/core'),
          import('@zxcvbn-ts/language-common'),
          import('@zxcvbn-ts/language-de'),
        ]);

      // Configure German language
      const options = {
        translations: zxcvbnDePackage.translations,
        graphs: zxcvbnCommonPackage.adjacencyGraphs,
        dictionary: {
          ...zxcvbnCommonPackage.dictionary,
          ...zxcvbnDePackage.dictionary,
        },
      };

      zxcvbnOptions.setOptions(options);
      zxcvbnInstance = zxcvbn;
    } catch (error) {
      log.error({ err: error }, 'Failed to load modules');
      throw error;
    } finally {
      isLoading = false;
    }
  })();

  await loadPromise;
}

/**
 * Check password strength with user context
 * Automatically initializes on first use
 *
 * @param password - Password to analyze
 * @param userInputs - User-specific context (name, email, etc.)
 * @returns Password strength result or null if not loaded
 */
export async function checkPasswordStrength(
  password: string,
  userInputs: string[] = [],
): Promise<ZxcvbnResult | null> {
  // Skip empty passwords
  if (password === '') {
    return null;
  }

  // Initialize if needed
  if (zxcvbnInstance === null) {
    try {
      await initPasswordStrength();
    } catch {
      return null;
    }
  }

  // Still not loaded somehow
  if (zxcvbnInstance === null) {
    return null;
  }

  // Add Assixx-specific context to prevent company-related passwords
  const context = [
    'assixx',
    'scs',
    'technik',
    'scs-technik',
    ...userInputs.filter((input) => input !== ''),
  ];

  try {
    return zxcvbnInstance(password, context);
  } catch (error) {
    log.error({ err: error }, 'Error analyzing password');
    return null;
  }
}

/**
 * Get strength label in German
 *
 * @param score - zxcvbn score (0-4)
 * @returns German strength label
 */
export function getStrengthLabel(score: number): string {
  switch (score) {
    case 0:
      return 'Sehr schwach';
    case 1:
      return 'Schwach';
    case 2:
      return 'Mittelmäßig';
    case 3:
      return 'Stark';
    case 4:
      return 'Sehr stark';
    default:
      return 'Unbekannt';
  }
}

/**
 * Get strength color for UI (CSS variable names)
 *
 * @param score - zxcvbn score (0-4)
 * @returns CSS color value
 */
export function getStrengthColor(score: number): string {
  switch (score) {
    case 0:
      return '#d32f2f'; // Red
    case 1:
      return '#f57c00'; // Orange
    case 2:
      return '#fbc02d'; // Yellow
    case 3:
      return '#689f38'; // Light green
    case 4:
      return '#388e3c'; // Green
    default:
      return '#e0e0e0'; // Grey
  }
}

/**
 * Get strength CSS class for styling
 *
 * @param score - zxcvbn score (0-4)
 * @returns CSS class name
 */
export function getStrengthClass(score: number): string {
  switch (score) {
    case 0:
      return 'strength-very-weak';
    case 1:
      return 'strength-weak';
    case 2:
      return 'strength-fair';
    case 3:
      return 'strength-strong';
    case 4:
      return 'strength-very-strong';
    default:
      return 'strength-unknown';
  }
}

/**
 * Format crack time for display in German
 *
 * @param crackTimeDisplay - Crack time from zxcvbn
 * @returns Formatted string for UI
 */
export function formatCrackTime(crackTimeDisplay: string): string {
  if (crackTimeDisplay === '') {
    return '';
  }
  return `Knackzeit: ${crackTimeDisplay}`;
}

/**
 * Check if loading is in progress
 */
export function isPasswordStrengthLoading(): boolean {
  return isLoading;
}

/**
 * Check if password strength module is ready
 */
export function isPasswordStrengthReady(): boolean {
  return zxcvbnInstance !== null;
}

/**
 * Password strength result interface for Svelte components
 */
export interface PasswordStrengthResult {
  score: number;
  label: string;
  color: string;
  className: string;
  crackTime: string;
  feedback: {
    warning: string;
    suggestions: string[];
  };
}

/**
 * Analyze password and return formatted result for UI
 * Convenience function that combines all helpers
 *
 * @param password - Password to analyze
 * @param userInputs - User context (name, email, etc.)
 * @returns Formatted result or null
 */
export async function analyzePassword(
  password: string,
  userInputs: string[] = [],
): Promise<PasswordStrengthResult | null> {
  const result = await checkPasswordStrength(password, userInputs);

  if (result === null) {
    return null;
  }

  return {
    score: result.score,
    label: getStrengthLabel(result.score),
    color: getStrengthColor(result.score),
    className: getStrengthClass(result.score),
    crackTime: formatCrackTime(
      result.crackTimesDisplay.offlineSlowHashing1e4PerSecond,
    ),
    feedback: {
      warning: result.feedback.warning ?? '',
      suggestions: result.feedback.suggestions,
    },
  };
}
