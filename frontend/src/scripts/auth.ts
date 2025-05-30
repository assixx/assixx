/**
 * Authentication utilities for Assixx
 */

import type { User, JWTPayload } from '../types/api.types';

// Get authentication token from localStorage (compatible with existing system)
export function getAuthToken(): string | null {
  return localStorage.getItem('token') || localStorage.getItem('authToken');
}

// Set authentication token
export function setAuthToken(token: string): void {
  localStorage.setItem('token', token);
  localStorage.setItem('authToken', token);
}

// Remove authentication token
export function removeAuthToken(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('authToken');
  localStorage.removeItem('role');
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  const token = getAuthToken();
  return token !== null && token.length > 0;
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
  } catch (e) {
    console.error('Error parsing JWT:', e);
    return null;
  }
}

// Fetch with authentication
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();

  if (!token) {
    window.location.href = '/pages/login.html';
    throw new Error('No authentication token');
  }

  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // If unauthorized, redirect to login
  if (response.status === 401) {
    removeAuthToken();
    window.location.href = '/pages/login.html';
    throw new Error('Unauthorized');
  }

  return response;
}

// Load user information
export async function loadUserInfo(): Promise<User> {
  try {
    console.log('loadUserInfo: Attempting to fetch user profile...');
    const response = await fetchWithAuth('/api/user/profile');
    console.log('loadUserInfo: Response status:', response.status);

    const data = await response.json();
    console.log('loadUserInfo: Response data:', data);

    if (response.ok) {
      // The API returns the user object directly, not wrapped in data.user
      const user: User = data.user || data;

      // Update user display
      const userName = document.getElementById('userName');
      if (userName) {
        const firstName = user.first_name || 'Admin';
        const lastName = user.last_name || '';
        userName.textContent = `${firstName} ${lastName}`.trim();
      }

      const userRole = document.getElementById('userRole');
      if (userRole) {
        userRole.textContent = user.role || 'Benutzer';
      }

      return user;
    } else {
      throw new Error(data.message || 'Fehler beim Laden der Benutzerdaten');
    }
  } catch (error) {
    console.error('Error loading user info:', error);

    // Fallback: Set default values if API fails
    const userName = document.getElementById('userName');
    if (userName) {
      userName.textContent = 'Benutzer';
    }

    const userRole = document.getElementById('userRole');
    if (userRole) {
      userRole.textContent = localStorage.getItem('role') || 'Benutzer';
    }

    // Don't throw error to prevent redirect loop
    return {
      id: 0,
      username: 'Benutzer',
      email: '',
      first_name: 'Benutzer',
      role: (localStorage.getItem('role') || 'admin') as User['role'],
      tenant_id: 0,
      is_active: true,
      is_archived: false,
      created_at: '',
      updated_at: '',
    } as User;
  }
}

// Logout function
export function logout(): void {
  removeAuthToken();
  window.location.href = '/pages/login.html';
}

// Show success message
export function showSuccess(message: string): void {
  // Simple alert for now, can be enhanced with toast notifications
  alert(`✅ ${message}`);
}

// Show error message
export function showError(message: string): void {
  // Simple alert for now, can be enhanced with toast notifications
  alert(`❌ ${message}`);
}

// Show info message
export function showInfo(message: string): void {
  // Simple alert for now, can be enhanced with toast notifications
  alert(`ℹ️ ${message}`);
}

// Initialize authentication on page load
document.addEventListener('DOMContentLoaded', () => {
  const token = getAuthToken();
  console.log('Auth check - Token found:', !!token);
  console.log('Auth check - Current path:', window.location.pathname);

  // Check if user is authenticated
  if (!isAuthenticated() && !window.location.pathname.includes('login')) {
    console.log('No authentication token found, redirecting to login');
    window.location.href = '/pages/login.html';
    return;
  }

  // Load user info if on authenticated page
  if (isAuthenticated() && !window.location.pathname.includes('login')) {
    console.log('Loading user info...');
    loadUserInfo().catch((error) => {
      console.error('Failed to load user info:', error);
      // Don't redirect immediately, let the user see the error
    });
  }
});

// Export functions to window for backwards compatibility
if (typeof window !== 'undefined') {
  (window as any).getAuthToken = getAuthToken;
  (window as any).setAuthToken = setAuthToken;
  (window as any).removeAuthToken = removeAuthToken;
  (window as any).isAuthenticated = isAuthenticated;
  (window as any).fetchWithAuth = fetchWithAuth;
  (window as any).loadUserInfo = loadUserInfo;
  (window as any).logout = logout;
  (window as any).showSuccess = showSuccess;
  (window as any).showError = showError;
  (window as any).showInfo = showInfo;
  (window as any).parseJwt = parseJwt;
}
