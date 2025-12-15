/**
 * Password Strength Analysis Module
 * Uses zxcvbn-ts for intelligent password strength estimation
 * Implements lazy loading to minimize bundle impact
 */

import type { ZxcvbnResult } from '@zxcvbn-ts/core';

// Module state - lazy loaded
let zxcvbnInstance: ((password: string, userInputs?: string[]) => ZxcvbnResult) | null = null;
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
      console.info('[PasswordStrength] Lazy loading zxcvbn modules...');

      // Dynamic imports for code splitting
      const [{ zxcvbn, zxcvbnOptions }, zxcvbnCommonPackage, zxcvbnDePackage] = await Promise.all([
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

      console.info('[PasswordStrength] Modules loaded successfully');
    } catch (error) {
      console.error('[PasswordStrength] Failed to load modules:', error);
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
export async function checkPasswordStrength(password: string, userInputs: string[] = []): Promise<ZxcvbnResult | null> {
  // Skip empty passwords
  // eslint-disable-next-line security/detect-possible-timing-attacks -- Not sensitive: just checking for empty input, not comparing secrets
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
  const context = ['assixx', 'scs', 'technik', 'scs-technik', ...userInputs.filter((input) => input !== '')];

  try {
    return zxcvbnInstance(password, context);
  } catch (error) {
    console.error('[PasswordStrength] Error analyzing password:', error);
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
 * Get strength color for UI
 *
 * @param score - zxcvbn score (0-4)
 * @returns Color code for strength indicator
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
 * Format crack time for display in German
 *
 * @param crackTimeDisplay - Crack time from zxcvbn
 * @returns Formatted string for UI
 */
export function formatCrackTime(crackTimeDisplay: string): string {
  // zxcvbn-ts with German language pack already returns German strings
  // Just add prefix for context
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
