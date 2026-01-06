/**
 * Login Page - Server Actions
 * @module login/+page.server
 *
 * Handles login form submission server-side to set httpOnly cookies.
 * This enables SSR pages to access the auth token via cookies.
 */
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

/** API base URL for server-side fetching */
const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

/** Cookie options for auth tokens */
const COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
};

/** Access token expiry: 30 minutes */
const ACCESS_TOKEN_MAX_AGE = 30 * 60;

/** Refresh token expiry: 7 days */
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60;

interface LoginResponse {
  success: boolean;
  data?: {
    accessToken: string;
    refreshToken: string;
    user: {
      id: number;
      email: string;
      firstName: string;
      lastName: string;
      role: 'root' | 'admin' | 'employee';
      tenantId: number;
    };
  };
  error?: {
    message: string;
    code?: string;
  };
}

export const actions: Actions = {
  /**
   * Default action: Handle login form submission
   */
  default: async ({ request, cookies, fetch }) => {
    const formData = await request.formData();
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    // Validation
    if (!email || !password) {
      return fail(400, {
        error: 'E-Mail und Passwort sind erforderlich',
        email,
      });
    }

    try {
      // Call backend login API
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const result = (await response.json()) as LoginResponse;

      if (!response.ok || !result.success) {
        const errorMessage = result.error?.message ?? 'Login fehlgeschlagen';

        // Handle rate limiting
        if (response.status === 429) {
          return fail(429, {
            error: 'Zu viele Anmeldeversuche. Bitte warten Sie.',
            email,
          });
        }

        return fail(401, {
          error: errorMessage,
          email,
        });
      }

      // Set httpOnly cookies for SSR auth
      if (result.data?.accessToken) {
        cookies.set('accessToken', result.data.accessToken, {
          ...COOKIE_OPTIONS,
          maxAge: ACCESS_TOKEN_MAX_AGE,
        });
      }

      if (result.data?.refreshToken) {
        cookies.set('refreshToken', result.data.refreshToken, {
          ...COOKIE_OPTIONS,
          maxAge: REFRESH_TOKEN_MAX_AGE,
        });
      }

      // Store user role in non-httpOnly cookie (for client-side routing)
      if (result.data?.user?.role) {
        cookies.set('userRole', result.data.user.role, {
          ...COOKIE_OPTIONS,
          httpOnly: false, // Accessible by client JS
          maxAge: ACCESS_TOKEN_MAX_AGE,
        });
      }

      // Determine redirect path based on role
      const role = result.data?.user?.role ?? 'employee';
      const redirectTo =
        role === 'root'
          ? '/root-dashboard'
          : role === 'admin'
            ? '/admin-dashboard'
            : '/employee-dashboard';

      // Return success with tokens for client-side storage
      // Client will store in localStorage and redirect
      return {
        success: true,
        accessToken: result.data?.accessToken,
        refreshToken: result.data?.refreshToken,
        user: result.data?.user,
        redirectTo,
      };
    } catch (error) {
      console.error('[Login] Server error:', error);
      return fail(500, {
        error: 'Ein Serverfehler ist aufgetreten',
        email,
      });
    }
  },
};
