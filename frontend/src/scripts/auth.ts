/**
 * Authentication utilities for Assixx
 */

import type { User, JWTPayload } from '../types/api.types';
import { apiClient, ApiError } from '../utils/api-client';

import { BrowserFingerprint } from './utils/browser-fingerprint';
import SessionManager from './utils/session-manager';

// Extend window for auth functions
declare global {
  interface Window {
    getAuthToken: typeof getAuthToken;
    setAuthToken: typeof setAuthToken;
    removeAuthToken: typeof removeAuthToken;
    isAuthenticated: typeof isAuthenticated;
    fetchWithAuth: typeof fetchWithAuth;
    loadUserInfo: typeof loadUserInfo;
    login: typeof login;
    logout: typeof logout;
    showSuccess: typeof showSuccess;
    showError: typeof showError;
    showInfo: typeof showInfo;
    parseJwt: typeof parseJwt;
    FEATURE_FLAGS?: Record<string, boolean | undefined>;
  }
}

// Get authentication token from localStorage (compatible with existing system)
export function getAuthToken(): string | null {
  // Check if v2 is enabled
  const useV2 = window.FEATURE_FLAGS?.USE_API_V2_AUTH;

  if (useV2 === true) {
    // For v2, use accessToken
    return localStorage.getItem('accessToken');
  }

  // For v1, use old token names
  return localStorage.getItem('token') ?? localStorage.getItem('authToken');
}

// Set authentication token
export function setAuthToken(token: string, refreshToken?: string): void {
  // Check if v2 is enabled
  const useV2 = window.FEATURE_FLAGS?.USE_API_V2_AUTH;

  if (useV2 === true) {
    // For v2, store both access and refresh tokens
    localStorage.setItem('accessToken', token);
    if (refreshToken !== undefined && refreshToken.length > 0) {
      localStorage.setItem('refreshToken', refreshToken);
    }
    // Also store in old format for compatibility
    localStorage.setItem('token', token);

    // Set cookie for server-side page protection (temporary compatibility)
    document.cookie = `token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
  } else {
    // For v1, use old token names
    localStorage.setItem('token', token);
    localStorage.setItem('authToken', token);
  }
}

// Remove authentication token
export function removeAuthToken(): void {
  // Clear v2 tokens
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');

  // Clear v1 tokens
  localStorage.removeItem('token');
  localStorage.removeItem('authToken');

  // Clear other auth data
  localStorage.removeItem('role');
  localStorage.removeItem('activeRole'); // Clear role switching state
  localStorage.removeItem('user'); // Clear cached user data
  localStorage.removeItem('userRole'); // Clear cached user role

  // Clear cookie for server-side page protection
  document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax';
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  const token = getAuthToken();
  if (token === null || token.length === 0) {
    return false;
  }

  // Check if token is expired
  const payload = parseJwt(token);
  if (payload?.exp === undefined) {
    return false;
  }

  // Check expiration (exp is in seconds, Date.now() is in milliseconds)
  const now = Date.now() / 1000;
  if (payload.exp < now) {
    console.info('[AUTH] Token expired, clearing auth data');
    removeAuthToken();
    return false;
  }

  return true;
}

// Parse JWT token
export function parseJwt(token: string): JWTPayload | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join(''),
    );
    return JSON.parse(jsonPayload) as JWTPayload;
  } catch (error) {
    console.error('Error parsing JWT:', error);
    return null;
  }
}

// Fetch with authentication
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();

  if (token === null || token.length === 0) {
    window.location.href = '/login';
    throw new Error('No authentication token');
  }

  // Check if v2 is enabled
  const useV2 = window.FEATURE_FLAGS?.USE_API_V2_AUTH;

  if (useV2 === true) {
    // Use the new API client for v2
    try {
      // Extract the path from the URL
      const urlObj = new URL(url, window.location.origin);
      const path = urlObj.pathname.replace('/api/v2', '').replace('/api', '');

      // Determine the HTTP method
      const method = options.method ?? 'GET';

      // Browser fingerprint is handled internally by apiClient

      // Make the request using the API client
      let response: unknown;
      switch (method.toUpperCase()) {
        case 'GET':
          response = await apiClient.get(path);
          break;
        case 'POST': {
          const postBody =
            options.body !== undefined && options.body !== null
              ? (JSON.parse(options.body as string) as unknown)
              : undefined;
          response = await apiClient.post(path, postBody);
          break;
        }
        case 'PUT': {
          const putBody =
            options.body !== undefined && options.body !== null
              ? (JSON.parse(options.body as string) as unknown)
              : undefined;
          response = await apiClient.put(path, putBody);
          break;
        }
        case 'DELETE':
          response = await apiClient.delete(path);
          break;
        default:
          throw new Error(`Unsupported method: ${method}`);
      }

      // Convert response to fetch-compatible format
      return new Response(JSON.stringify(response), {
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'Content-Type': 'application/json' }),
      });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          removeAuthToken();
          window.location.href = '/login';
          throw new Error('Unauthorized');
        }

        if (error.status === 403) {
          const userRole = localStorage.getItem('userRole');
          let redirectUrl = '/pages/login.html';

          // Redirect to appropriate dashboard based on role
          switch (userRole) {
            case 'employee':
              redirectUrl = '/employee-dashboard';
              break;
            case 'admin':
              redirectUrl = '/admin-dashboard';
              break;
            case 'root':
              redirectUrl = '/root-dashboard';
              break;
          }

          console.warn(`Access forbidden. Redirecting to ${redirectUrl}`);
          window.location.href = redirectUrl;
          throw new Error('Forbidden - insufficient permissions');
        }

        // Return error response
        return new Response(JSON.stringify({ error: error.message }), {
          status: error.status,
          statusText: error.message,
          headers: new Headers({ 'Content-Type': 'application/json' }),
        });
      }

      throw error;
    }
  } else {
    // Use traditional fetch for v1
    // Get browser fingerprint
    const fingerprint = await BrowserFingerprint.generate();

    const headers: HeadersInit = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Browser-Fingerprint': fingerprint,
      ...(options.headers ? (options.headers as Record<string, string>) : {}),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle authentication errors
    if (response.status === 401) {
      removeAuthToken();
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    // Handle forbidden errors (wrong role)
    if (response.status === 403) {
      const userRole = localStorage.getItem('userRole');
      let redirectUrl = '/pages/login.html';

      // Redirect to appropriate dashboard based on role
      switch (userRole) {
        case 'employee':
          redirectUrl = '/employee-dashboard';
          break;
        case 'admin':
          redirectUrl = '/admin-dashboard';
          break;
        case 'root':
          redirectUrl = '/root-dashboard';
          break;
      }

      console.warn(`Access forbidden. Redirecting to ${redirectUrl}`);
      window.location.href = redirectUrl;
      throw new Error('Forbidden - insufficient permissions');
    }

    return response;
  }
}

// Load user information
// Cache for user profile to prevent multiple API calls
let userProfileCache: { data: User | null; timestamp: number } = { data: null, timestamp: 0 };
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Promise cache to prevent concurrent requests
let profileLoadingPromise: Promise<User> | null = null;

export async function loadUserInfo(): Promise<User> {
  try {
    // Check if we have cached data that's still fresh
    const now = Date.now();
    if (userProfileCache.data && now - userProfileCache.timestamp < CACHE_DURATION) {
      console.info('loadUserInfo: Returning cached profile data');
      return userProfileCache.data;
    }

    // If there's already a request in progress, wait for it
    if (profileLoadingPromise) {
      console.info('loadUserInfo: Waiting for existing profile request...');
      return await profileLoadingPromise;
    }

    console.info('loadUserInfo: Attempting to fetch user profile...');

    // Create the promise and store it
    profileLoadingPromise = (async () => {
      const useV2 = window.FEATURE_FLAGS?.USE_API_V2_AUTH;
      const profileUrl = useV2 === true ? '/api/v2/users/me' : '/api/user/profile';

      const response = await fetchWithAuth(profileUrl);
      console.info('loadUserInfo: Response status:', response.status);

      const data = (await response.json()) as {
        id?: number;
        username?: string;
        email?: string;
        firstName?: string;
        first_name?: string;
        lastName?: string;
        last_name?: string;
        role?: string;
        tenantId?: number;
        tenant_id?: number;
        isActive?: boolean;
        isArchived?: boolean;
        createdAt?: string;
        created_at?: string;
        updatedAt?: string;
        updated_at?: string;
        user?: User;
        message?: string;
      };
      console.info('loadUserInfo: Response data:', data);

      if (response.ok) {
        let user: User;

        if (useV2 === true) {
          // v2 response has camelCase fields, convert to snake_case for compatibility
          const v2User = data;
          user = {
            id: v2User.id,
            username: v2User.username,
            email: v2User.email,
            first_name: v2User.firstName ?? v2User.first_name,
            last_name: v2User.lastName ?? v2User.last_name,
            role: v2User.role,
            tenant_id: v2User.tenantId ?? v2User.tenant_id,
            is_active: v2User.isActive ?? true,
            is_archived: v2User.isArchived ?? false,
            created_at: v2User.createdAt ?? v2User.created_at,
            updated_at: v2User.updatedAt ?? v2User.updated_at,
          } as User;
        } else {
          // v1 response
          user = data.user ?? (data as User);
        }

        // Update user display - check both element IDs for compatibility
        const userName = document.querySelector('#userName') ?? document.querySelector('#user-name');
        if (userName) {
          const firstName = user.first_name ?? 'Admin';
          const lastName = user.last_name ?? '';
          userName.textContent = `${firstName} ${lastName}`.trim();
        }

        const userRole = document.querySelector('#userRole');
        if (userRole) {
          userRole.textContent = user.role;
        }

        // Update cache with fresh data
        userProfileCache = { data: user, timestamp: Date.now() };
        console.info('loadUserInfo: Profile cached for', CACHE_DURATION / 1000, 'seconds');

        // Clear the loading promise
        profileLoadingPromise = null;
        return user;
      } else {
        // Clear the loading promise on error
        profileLoadingPromise = null;
        throw new Error(data.message ?? 'Fehler beim Laden der Benutzerdaten');
      }
    })();

    return await profileLoadingPromise;
  } catch (error) {
    console.error('Error loading user info:', error);
    profileLoadingPromise = null;

    // Fallback: Set default values if API fails
    const userName = document.querySelector('#userName');
    if (userName) {
      userName.textContent = 'Benutzer';
    }

    const userRole = document.querySelector('#userRole');
    if (userRole) {
      userRole.textContent = localStorage.getItem('role') ?? 'Benutzer';
    }

    // Don't throw error to prevent redirect loop
    return {
      id: 0,
      username: 'Benutzer',
      email: '',
      first_name: 'Benutzer',
      role: (localStorage.getItem('role') ?? 'admin') as User['role'],
      tenant_id: 0,
      is_active: true,
      is_archived: false,
      created_at: '',
      updated_at: '',
    } as User;
  }
}

// Logout function
export async function logout(): Promise<void> {
  const token = getAuthToken();

  // Call logout API to log the action
  if (token !== null && token.length > 0) {
    try {
      const useV2 = window.FEATURE_FLAGS?.USE_API_V2_AUTH;
      const logoutUrl = useV2 === true ? '/api/v2/auth/logout' : '/api/auth/logout';

      if (useV2 === true) {
        // Use API client for v2
        await apiClient.post('/auth/logout', {});
      } else {
        // Use traditional fetch for v1
        const fingerprint = await BrowserFingerprint.generate();
        await fetch(logoutUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Browser-Fingerprint': fingerprint,
          },
          body: JSON.stringify({}), // Empty body to satisfy Content-Type validation
        });
      }
    } catch (error) {
      console.error('Error logging logout:', error);
      // Continue with logout even if API call fails
    }
  }

  // Clear all auth data
  removeAuthToken();
  localStorage.removeItem('userRole');
  localStorage.removeItem('activeRole');
  localStorage.removeItem('tenantId');
  localStorage.removeItem('browserFingerprint');
  localStorage.removeItem('fingerprintTimestamp');
  localStorage.removeItem('sidebarCollapsed'); // Reset sidebar state on logout

  // Clear user profile cache
  userProfileCache = { data: null, timestamp: 0 };
  profileLoadingPromise = null;

  // Clear API client tokens
  if (window.FEATURE_FLAGS?.USE_API_V2_AUTH === true) {
    apiClient.clearTokens();
  }

  // Redirect to login
  window.location.href = '/login';
}

// Login function
export async function login(email: string, password: string): Promise<{ success: boolean; message?: string }> {
  try {
    const useV2 = window.FEATURE_FLAGS?.USE_API_V2_AUTH;
    const loginUrl = useV2 === true ? '/api/v2/auth/login' : '/api/auth/login';

    if (useV2 === true) {
      // Use API client for v2
      try {
        const response = await apiClient.post<{
          accessToken?: string;
          refreshToken?: string;
          user?: User;
        }>('/auth/login', {
          email,
          password,
        }); // No auth needed for login

        // v2 response format
        if (
          response.accessToken !== undefined &&
          response.accessToken.length > 0 &&
          response.refreshToken !== undefined &&
          response.refreshToken.length > 0
        ) {
          // Store tokens
          apiClient.setTokens(response.accessToken, response.refreshToken);
          setAuthToken(response.accessToken, response.refreshToken);

          // Store user info
          if (response.user) {
            localStorage.setItem('user', JSON.stringify(response.user));
            localStorage.setItem('userRole', response.user.role);
          }

          return { success: true };
        } else {
          return { success: false, message: 'Invalid response format' };
        }
      } catch (error) {
        if (error instanceof ApiError) {
          return { success: false, message: error.message };
        }
        return { success: false, message: 'Login failed' };
      }
    } else {
      // Use traditional fetch for v1
      const fingerprint = await BrowserFingerprint.generate();
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Browser-Fingerprint': fingerprint,
        },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json()) as {
        id?: number;
        username?: string;
        email?: string;
        firstName?: string;
        first_name?: string;
        lastName?: string;
        last_name?: string;
        role?: string;
        tenantId?: number;
        tenant_id?: number;
        isActive?: boolean;
        isArchived?: boolean;
        createdAt?: string;
        created_at?: string;
        updatedAt?: string;
        updated_at?: string;
        token?: string;
        user?: User;
        message?: string;
      };

      if (response.ok && data.token !== undefined && data.token.length > 0) {
        // Store token
        setAuthToken(data.token);

        // Store user info
        if (data.user !== undefined) {
          localStorage.setItem('userRole', data.user.role);
        }

        return { success: true };
      } else {
        return { success: false, message: data.message ?? 'Login failed' };
      }
    }
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: 'Network error' };
  }
}

// Show success message
export function showSuccess(message: string): void {
  // Simple console log for now, can be enhanced with toast notifications
  console.info(`✅ ${message}`);
}

// Show error message
export function showError(message: string): void {
  // Simple console log for now, can be enhanced with toast notifications
  console.error(`❌ ${message}`);
}

// Show info message
export function showInfo(message: string): void {
  // Simple console log for now, can be enhanced with toast notifications
  console.info(`ℹ️ ${message}`);
}

// Initialize authentication on page load
document.addEventListener('DOMContentLoaded', () => {
  const token = getAuthToken();
  const userRole = localStorage.getItem('userRole');
  const activeRole = localStorage.getItem('activeRole');

  console.info('[AUTH] Initialization:', {
    token: token !== null && token.length > 0,
    userRole,
    activeRole,
    path: window.location.pathname,
    isEmployeeDashboard: window.location.pathname.includes('employee-dashboard'),
  });

  // Check if user is authenticated
  if (!isAuthenticated() && !window.location.pathname.includes('login')) {
    console.info('[AUTH] No authentication token found, redirecting to login');
    window.location.href = '/login';
    return;
  }

  // Load user info if on authenticated page
  if (isAuthenticated() && !window.location.pathname.includes('login')) {
    console.info('[AUTH] Loading user info...');
    loadUserInfo().catch((error: unknown) => {
      console.error('Failed to load user info:', error);
      // Don't redirect immediately, let the user see the error
    });

    // Initialize session manager for authenticated users
    SessionManager.getInstance();
    console.info('[AUTH] Session manager initialized');

    // Enforce page access based on role - use UnifiedNavigation if available
    if (typeof window.unifiedNav.enforcePageAccess === 'function') {
      window.unifiedNav.enforcePageAccess();
      console.info('[AUTH] Page access enforced via UnifiedNavigation');
    } else {
      // UnifiedNavigation will handle this when it initializes
      console.info('[AUTH] Page access will be enforced by UnifiedNavigation');
    }
  }
});

// Export functions to window for backwards compatibility
if (typeof window !== 'undefined') {
  // These are already declared in global.d.ts
  window.getAuthToken = getAuthToken;
  window.setAuthToken = setAuthToken;
  window.removeAuthToken = removeAuthToken;
  window.isAuthenticated = isAuthenticated;
  window.fetchWithAuth = fetchWithAuth;
  window.loadUserInfo = loadUserInfo;
  window.login = login;
  window.logout = logout;
  window.showSuccess = showSuccess;
  window.showError = showError;
  window.showInfo = showInfo;
  window.parseJwt = parseJwt;
}
