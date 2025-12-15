/**
 * Login API Client
 * Handles authentication API calls, token storage, and redirects
 */

import { BrowserFingerprint } from '../utils/browser-fingerprint.js';

/**
 * Login request data
 */
export interface LoginData {
  email: string;
  password: string;
}

/**
 * Login API response (V2)
 */
export interface LoginResponse {
  success: boolean;
  data?: {
    accessToken: string;
    refreshToken: string;
    user: {
      id: number;
      email: string;
      role: string;
      firstName?: string;
      lastName?: string;
    };
    role?: string;
  };
  error?: {
    message: string;
    code?: string;
  };
  message?: string;
}

/**
 * Login result after token storage
 */
export interface LoginResult {
  success: boolean;
  role?: string;
  error?: string;
}

/**
 * Prepare API v2 request for login
 */
function prepareApiRequest(
  username: string,
  password: string,
  _fingerprint: string, // Kept for signature compatibility, not used in v2
): {
  url: string;
  body: Record<string, string>;
} {
  return {
    url: '/api/v2/auth/login',
    body: { email: username, password },
  };
}

/**
 * Store V2 tokens in localStorage and cookie
 * Requires data.data to be non-null (checked by caller)
 */
function storeV2Tokens(data: Required<Pick<LoginResponse, 'data'>>): {
  token: string;
  user: NonNullable<LoginResponse['data']>['user'];
  role: string;
} {
  const token = data.data.accessToken;
  const refreshToken = data.data.refreshToken;

  localStorage.setItem('accessToken', token);
  localStorage.setItem('refreshToken', refreshToken);
  localStorage.setItem('token', token); // Compatibility

  // Set cookie for server-side page protection - SYNCHRONOUS (must be before redirect!)
  document.cookie = `token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;

  return {
    token,
    user: data.data.user,
    role: data.data.user.role !== '' ? data.data.user.role : (data.data.role ?? 'employee'),
  };
}

/**
 * Store user data in localStorage
 */
function storeUserData(role: string, user?: NonNullable<LoginResponse['data']>['user']): void {
  localStorage.setItem('userRole', role);
  if (user !== undefined) {
    localStorage.setItem('user', JSON.stringify(user));
  }
  // Clear any stored navigation state
  localStorage.removeItem('activeNavigation');
  localStorage.removeItem('activeRole');
}

/**
 * Redirect to appropriate dashboard based on role
 */
function redirectToDashboard(role: string): void {
  setTimeout(() => {
    switch (role) {
      case 'root':
        window.location.href = '/root-dashboard';
        break;
      case 'admin':
        window.location.href = '/admin-dashboard';
        break;
      case 'employee':
        window.location.href = '/employee-dashboard';
        break;
      default:
        throw new Error('Unknown role');
    }
  }, 0);
}

/**
 * Extract error message from API response
 */
function extractErrorMessage(data: LoginResponse): string {
  return data.error?.message ?? data.message ?? 'Login fehlgeschlagen';
}

/**
 * Handle login API response
 */
function handleLoginResponse(response: Response, data: LoginResponse): LoginResult {
  // Check for rate limiting
  if (response.status === 429) {
    return {
      success: false,
      error: 'Zu viele Anmeldeversuche!\n\nBitte warten Sie einige Minuten und versuchen Sie es erneut.',
    };
  }

  // Check if response is successful
  if (!response.ok && !data.success) {
    return {
      success: false,
      error: extractErrorMessage(data),
    };
  }

  // Handle V2 response - check if we have data
  if (!data.success || !data.data) {
    return {
      success: false,
      error: data.error?.message ?? 'Login fehlgeschlagen',
    };
  }

  // Store tokens and user data (data.data is now guaranteed to be non-null)
  const { user, role } = storeV2Tokens(data as Required<Pick<LoginResponse, 'data'>>);
  storeUserData(role, user);

  // Redirect to dashboard
  redirectToDashboard(role);

  return {
    success: true,
    role,
  };
}

/**
 * Submit login request to API
 */
export async function submitLogin(data: LoginData): Promise<LoginResult> {
  try {
    // Generate browser fingerprint
    const fingerprint = await BrowserFingerprint.generate();
    BrowserFingerprint.store(fingerprint);

    // Prepare API request
    const { url, body } = prepareApiRequest(data.email, data.password, fingerprint);
    console.info(`[Login] Using v2 API at ${url}`);

    // Make API request
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Browser-Fingerprint': fingerprint,
      },
      body: JSON.stringify(body),
    });

    // Parse response
    const responseData = (await response.json()) as LoginResponse;

    // Handle response
    return handleLoginResponse(response, responseData);
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred during login',
    };
  }
}
