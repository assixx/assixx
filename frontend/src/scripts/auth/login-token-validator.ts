/**
 * Login Token Validator Module
 * Validates existing tokens to prevent showing login when already authenticated
 * This is a fallback validation in case redirect failed
 */

import { BrowserFingerprint } from '../utils/browser-fingerprint.js';

/**
 * Validate existing token with the server
 */
async function validateToken(token: string, fingerprint: string): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/validate', {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Browser-Fingerprint': fingerprint,
      },
    });

    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as { valid?: boolean };
    return data.valid === true;
  } catch (error) {
    console.error('[LoginTokenValidator] Validation error:', error);
    return false;
  }
}

/**
 * Clear invalid authentication data
 */
function clearInvalidAuth(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('userRole');
  localStorage.removeItem('user');
  sessionStorage.clear();
}

/**
 * Main validation function that runs after DOM is ready
 */
export async function validateIfNeeded(): Promise<void> {
  const token = localStorage.getItem('token') ?? localStorage.getItem('accessToken');
  const userRole = localStorage.getItem('userRole');

  // If we still have token/role but are on login page, validate
  if (token !== null && token !== '' && userRole !== null && userRole !== '') {
    try {
      const fingerprint = await BrowserFingerprint.generate();
      const isValid = await validateToken(token, fingerprint);

      if (!isValid) {
        // Token is invalid, clear and show login
        clearInvalidAuth();
        document.documentElement.style.visibility = 'visible';
      }
      // If valid, redirect should have already happened in pre-check
    } catch (error) {
      // On error, show login page
      console.error('[LoginTokenValidator] Error during validation:', error);
      document.documentElement.style.visibility = 'visible';
    }
  } else {
    // No token, show login page
    document.documentElement.style.visibility = 'visible';
  }
}

// Auto-run validation when module is imported
void validateIfNeeded();
