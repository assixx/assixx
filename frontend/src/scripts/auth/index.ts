/**
 * Authentication utilities for Assixx
 */

import type { User, JWTPayload } from '../../types/api.types';
import { apiClient, ApiError } from '../../utils/api-client';
import { getUserRole, setUserRole, clearUserRole, getActiveRole } from '../../utils/auth-helpers';
import { BrowserFingerprint } from '../utils/browser-fingerprint';
import { SessionManager } from '../utils/session-manager';

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

// Get current user's ID
export function getUserId(): number | null {
  const userStr = localStorage.getItem('user');
  if (userStr === null || userStr === '') return null;

  try {
    const user = JSON.parse(userStr) as { id?: number };
    return user.id ?? null;
  } catch {
    return null;
  }
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
  clearUserRole(); // Clear role switching state and user role
  localStorage.removeItem('user'); // Clear cached user data

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
    const decodedBase64 = atob(base64);
    let percentEncoded = '';
    for (let i = 0; i < decodedBase64.length; i++) {
      const charCode = decodedBase64.charCodeAt(i);
      percentEncoded += `%${('00' + charCode.toString(16)).slice(-2)}`;
    }
    const jsonPayload = decodeURIComponent(percentEncoded);
    return JSON.parse(jsonPayload) as JWTPayload;
  } catch (error) {
    console.error('Error parsing JWT:', error);
    return null;
  }
}

// Helper: Get redirect URL based on user role
function getRoleBasedRedirectUrl(): string {
  const userRole = getUserRole();
  switch (userRole) {
    case 'employee':
      return '/employee-dashboard';
    case 'admin':
      return '/admin-dashboard';
    case 'root':
      return '/root-dashboard';
    default:
      return '/pages/login.html';
  }
}

// Helper: Handle unauthorized error
function handleUnauthorized(): never {
  removeAuthToken();
  window.location.assign('/login');
  throw new Error('Unauthorized');
}

// Helper: Handle forbidden error
function handleForbidden(): never {
  const redirectUrl = getRoleBasedRedirectUrl();
  console.warn(`Access forbidden. Redirecting to ${redirectUrl}`);
  window.location.assign(redirectUrl);
  throw new Error('Forbidden - insufficient permissions');
}

// Helper: Make V2 API request
async function makeV2ApiRequest(path: string, method: string, body: string | null | undefined): Promise<unknown> {
  switch (method.toUpperCase()) {
    case 'GET':
      return await apiClient.get(path);
    case 'POST': {
      const postBody = body !== undefined && body !== null ? (JSON.parse(body) as unknown) : undefined;
      return await apiClient.post(path, postBody);
    }
    case 'PUT': {
      const putBody = body !== undefined && body !== null ? (JSON.parse(body) as unknown) : undefined;
      return await apiClient.put(path, putBody);
    }
    case 'DELETE':
      return await apiClient.delete(path);
    default:
      throw new Error(`Unsupported method: ${method}`);
  }
}

// Helper: Handle V2 API request with error handling
async function fetchWithV2Api(url: string, options: RequestInit): Promise<Response> {
  try {
    const urlObj = new URL(url, window.location.origin);
    const path = urlObj.pathname.replace('/api/v2', '').replace('/api', '');
    const method = options.method ?? 'GET';

    const response = await makeV2ApiRequest(path, method, options.body as string | null | undefined);

    return new Response(JSON.stringify(response), {
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) handleUnauthorized();
      if (error.status === 403) handleForbidden();

      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status,
        statusText: error.message,
        headers: new Headers({ 'Content-Type': 'application/json' }),
      });
    }
    throw error;
  }
}

// Helper: Handle V1 API request
async function fetchWithV1Api(url: string, options: RequestInit, token: string): Promise<Response> {
  const fingerprint = await BrowserFingerprint.generate();

  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-Browser-Fingerprint': fingerprint,
    ...(options.headers ? (options.headers as Record<string, string>) : {}),
  };

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) handleUnauthorized();
  if (response.status === 403) handleForbidden();

  return response;
}

// Fetch with authentication
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();

  if (token === null || token.length === 0) {
    window.location.href = '/login';
    throw new Error('No authentication token');
  }

  const useV2 = window.FEATURE_FLAGS?.USE_API_V2_AUTH === true;
  return useV2 ? await fetchWithV2Api(url, options) : await fetchWithV1Api(url, options, token);
}

// Load user information
// Cache for user profile to prevent multiple API calls
let userProfileCache: { data: User | null; timestamp: number } = { data: null, timestamp: 0 };
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Promise cache to prevent concurrent requests
let profileLoadingPromise: Promise<User> | null = null;

// Helper: Check if cache is valid
function isCacheValid(): boolean {
  return userProfileCache.data !== null && Date.now() - userProfileCache.timestamp < CACHE_DURATION;
}

// Helper: Convert API response to User
function convertToUser(
  data: {
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
  },
  useV2: boolean,
): User {
  if (useV2) {
    return {
      id: data.id,
      username: data.username,
      email: data.email,
      first_name: data.firstName ?? data.first_name,
      last_name: data.lastName ?? data.last_name,
      role: data.role,
      tenant_id: data.tenantId ?? data.tenant_id,
      is_active: data.isActive ?? true,
      is_archived: data.isArchived ?? false,
      created_at: data.createdAt ?? data.created_at,
      updated_at: data.updatedAt ?? data.updated_at,
    } as User;
  }
  return data.user ?? (data as User);
}

// Helper: Update DOM elements with user info
function updateUserDisplay(user: User): void {
  const userName = document.querySelector('#userName') ?? document.querySelector('#user-name');
  if (userName !== null) {
    interface UserWithBothFormats extends User {
      firstName?: string;
      lastName?: string;
    }
    const userWithBoth = user as UserWithBothFormats;
    const firstName = userWithBoth.firstName ?? userWithBoth.first_name ?? userWithBoth.username;
    const lastName = userWithBoth.lastName ?? userWithBoth.last_name ?? '';
    const displayName = `${firstName} ${lastName}`.trim();
    if (userName.textContent !== displayName) {
      userName.textContent = displayName;
    }
  }

  const userRole = document.querySelector('#userRole');
  if (userRole) {
    userRole.textContent = user.role;
  }
}

// Helper: Get fallback user on error
function getFallbackUser(): User {
  const userName = document.querySelector('#userName');
  if (userName) userName.textContent = 'Benutzer';

  const userRole = document.querySelector('#userRole');
  if (userRole) userRole.textContent = localStorage.getItem('role') ?? 'Benutzer';

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

// Helper: Fetch user profile from API
async function fetchUserProfile(): Promise<User> {
  const useV2 = window.FEATURE_FLAGS?.USE_API_V2_AUTH === true;

  if (useV2) {
    // Use apiClient for v2 API (already returns User object)
    console.info('loadUserInfo: Using apiClient for v2 API');
    const user = await apiClient.get<User>('/users/me');
    console.info('loadUserInfo: Response data:', user);

    updateUserDisplay(user);
    userProfileCache = { data: user, timestamp: Date.now() };
    console.info('loadUserInfo: Profile cached for', CACHE_DURATION / 1000, 'seconds');

    return user;
  }

  // Legacy v1 API uses fetch
  const profileUrl = '/api/user/profile';
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

  if (!response.ok) {
    throw new Error(data.message ?? 'Fehler beim Laden der Benutzerdaten');
  }

  const user = convertToUser(data, useV2);
  updateUserDisplay(user);

  userProfileCache = { data: user, timestamp: Date.now() };
  console.info('loadUserInfo: Profile cached for', CACHE_DURATION / 1000, 'seconds');

  return user;
}

export async function loadUserInfo(): Promise<User> {
  try {
    if (isCacheValid() && userProfileCache.data) {
      console.info('loadUserInfo: Returning cached profile data');
      return userProfileCache.data;
    }

    if (profileLoadingPromise) {
      console.info('loadUserInfo: Waiting for existing profile request...');
      return await profileLoadingPromise;
    }

    console.info('loadUserInfo: Attempting to fetch user profile...');

    // Create and store promise atomically
    const promise = fetchUserProfile().finally(() => {
      // Clear the promise when done, regardless of success or failure
      if (profileLoadingPromise === promise) {
        profileLoadingPromise = null;
      }
    });

    profileLoadingPromise = promise;
    return await promise;
  } catch (error) {
    console.error('Error loading user info:', error);
    return getFallbackUser();
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
  clearUserRole();
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

// Helper: Login with V2 API
async function loginV2(email: string, password: string): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await apiClient.post<{
      accessToken?: string;
      refreshToken?: string;
      user?: User;
    }>('/auth/login', { email, password });

    if (
      response.accessToken !== undefined &&
      response.accessToken.length > 0 &&
      response.refreshToken !== undefined &&
      response.refreshToken.length > 0
    ) {
      apiClient.setTokens(response.accessToken, response.refreshToken);
      setAuthToken(response.accessToken, response.refreshToken);

      if (response.user) {
        localStorage.setItem('user', JSON.stringify(response.user));
        setUserRole(response.user.role);
      }

      return { success: true };
    }
    return { success: false, message: 'Invalid response format' };
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, message: error.message };
    }
    return { success: false, message: 'Login failed' };
    // eslint-disable-next-line max-lines
  }
}

// Helper: Login with V1 API
async function loginV1(email: string, password: string): Promise<{ success: boolean; message?: string }> {
  const fingerprint = await BrowserFingerprint.generate();
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Browser-Fingerprint': fingerprint,
    },
    body: JSON.stringify({ email, password }),
  });

  const data = (await response.json()) as {
    token?: string;
    user?: User;
    message?: string;
  };

  if (response.ok && data.token !== undefined && data.token.length > 0) {
    setAuthToken(data.token);

    if (data.user !== undefined) {
      setUserRole(data.user.role);
    }

    return { success: true };
  }
  return { success: false, message: data.message ?? 'Login failed' };
}

// Login function
export async function login(email: string, password: string): Promise<{ success: boolean; message?: string }> {
  try {
    const useV2 = window.FEATURE_FLAGS?.USE_API_V2_AUTH === true;
    return useV2 ? await loginV2(email, password) : await loginV1(email, password);
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

// Helper: Check if should redirect to login
function shouldRedirectToLogin(): boolean {
  return !isAuthenticated() && !window.location.pathname.includes('login');
}

// Helper: Check if on authenticated page
function isOnAuthenticatedPage(): boolean {
  return isAuthenticated() && !window.location.pathname.includes('login');
}

// Helper: Initialize session manager
function initializeSessionManager(): void {
  const sessionManager = SessionManager.getInstance();
  sessionManager.setRemoveAuthTokenCallback(removeAuthToken);
  console.info('[AUTH] Session manager initialized');
}

// Helper: Enforce page access
function enforcePageAccess(): void {
  if (window.unifiedNav && typeof window.unifiedNav.enforcePageAccess === 'function') {
    window.unifiedNav.enforcePageAccess();
    console.info('[AUTH] Page access enforced via UnifiedNavigation');
  } else {
    console.info('[AUTH] Page access will be enforced by UnifiedNavigation');
  }
}

// Helper: Initialize authenticated user
async function initializeAuthenticatedUser(): Promise<void> {
  console.info('[AUTH] Loading user info...');
  try {
    await loadUserInfo();
  } catch (error: unknown) {
    console.error('Failed to load user info:', error);
  }

  initializeSessionManager();
  enforcePageAccess();
}

// Initialize authentication on page load
document.addEventListener('DOMContentLoaded', () => {
  // Use IIFE to handle async operations
  void (async () => {
    const token = getAuthToken();
    const userRole = getUserRole();
    const activeRole = getActiveRole();

    console.info('[AUTH] Initialization:', {
      token: token !== null && token.length > 0,
      userRole,
      activeRole,
      path: window.location.pathname,
      isEmployeeDashboard: window.location.pathname.includes('employee-dashboard'),
    });

    if (shouldRedirectToLogin()) {
      console.info('[AUTH] No authentication token found, redirecting to login');
      window.location.href = '/login';
      return;
    }

    if (isOnAuthenticatedPage()) {
      await initializeAuthenticatedUser();
    }
  })();
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
