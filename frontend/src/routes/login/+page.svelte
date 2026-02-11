<script lang="ts">
  import { onMount } from 'svelte';

  import { enhance } from '$app/forms';
  import { goto, replaceState } from '$app/navigation';
  import { resolve } from '$app/paths';

  import { setLoginPassword } from '$lib/crypto/login-password-bridge';
  import {
    isDark,
    forceDark,
    restoreUserTheme,
  } from '$lib/stores/theme.svelte';
  import { showInfoAlert } from '$lib/stores/toast';
  import { getTokenManager } from '$lib/utils/token-manager';

  import type { ActionData } from './$types';

  // API Response types for login endpoint
  interface LoginUser {
    id: number;
    role: 'root' | 'admin' | 'employee';
    email: string;
    tenantId?: number;
  }

  interface LoginApiResponse {
    success: boolean;
    data?: {
      accessToken: string;
      refreshToken: string;
      user: LoginUser;
    };
    error?: {
      message: string;
      code?: string;
    };
  }

  const { form }: { form: ActionData } = $props();

  // Page-specific CSS
  import '../../styles/login.css';

  // =============================================================================
  // SVELTE 5 RUNES - Reactive State
  // =============================================================================

  // Form state with $state() rune
  let email = $state('');
  let password = $state('');
  let loading = $state(false);
  let error: string | null = $state(null);
  let showToast = $state(false);
  let isTimeout = $state(false);

  // Toast auto-dismiss configuration (1:1 like legacy)
  const TOAST_DURATION_SECONDS = 3;

  let toastTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // =============================================================================
  // URL Parameter Check (1:1 like legacy checkForMessages)
  // =============================================================================

  /**
   * Check for URL parameters on mount and show messages
   * Handles: ?timeout=true, ?session=expired, ?ratelimit=expired
   */
  function checkForMessages() {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);

    if (
      urlParams.get('timeout') === 'true' ||
      urlParams.get('session') === 'expired'
    ) {
      showError(
        'Ihre Sitzung ist aus Sicherheitsgründen abgelaufen. Bitte melden Sie sich erneut an.',
      );
      // Clean up URL - SvelteKit's replaceState (safe inside afterNavigate)
      replaceState(window.location.pathname, {});
    } else if (urlParams.get('ratelimit') === 'expired') {
      // Rate limit message - use warning style by setting isTimeout
      isTimeout = false; // Not a timeout, but show as success/info
      error =
        'Die Wartezeit ist abgelaufen. Sie können sich jetzt wieder anmelden.';
      showToast = true;
      // Clean up URL - SvelteKit's replaceState (safe inside afterNavigate)
      replaceState(window.location.pathname, {});
    }
  }

  // Always-dark page + URL parameter check after hydration
  onMount(() => {
    forceDark();
    setTimeout(() => {
      checkForMessages();
    }, 0);
    return () => {
      restoreUserTheme();
    };
  });

  // =============================================================================
  // SVELTE 5 RUNES - Derived/Computed Values
  // =============================================================================

  // Form validation - re-computed automatically when email/password change
  const isEmailValid = $derived(email.includes('@') && email.includes('.'));
  const isPasswordValid = $derived(password.length >= 8);
  const isFormValid = $derived(isEmailValid && isPasswordValid);

  // Button text - computed from loading state
  const buttonText = $derived(loading ? 'Anmelden...' : 'Anmelden');

  // =============================================================================
  // Toast Helpers (1:1 like legacy login-form-controller.ts)
  // =============================================================================

  /**
   * Show error toast with auto-dismiss
   */
  function showError(message: string): void {
    // Clear existing timeout if any
    if (toastTimeoutId !== null) {
      clearTimeout(toastTimeoutId);
    }

    // Check if session timeout message
    isTimeout = message.includes('Sitzung');
    error = message;
    showToast = true;

    // Auto-dismiss after duration (synced with progress bar animation)
    toastTimeoutId = setTimeout(() => {
      dismissToast();
    }, TOAST_DURATION_SECONDS * 1000);
  }

  /**
   * Dismiss toast (for close button)
   */
  function dismissToast() {
    showToast = false;
    error = null;
    if (toastTimeoutId !== null) {
      clearTimeout(toastTimeoutId);
      toastTimeoutId = null;
    }
  }

  // =============================================================================
  // Event Handlers
  // =============================================================================

  // Note: _handleSubmit is kept for potential future use (currently form uses enhance)
  async function _handleSubmit(e: Event): Promise<void> {
    e.preventDefault();
    dismissToast(); // Clear any existing toast
    loading = true;

    try {
      const response = await fetch('/api/v2/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const result: LoginApiResponse =
        (await response.json()) as LoginApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message ?? 'Login fehlgeschlagen');
      }

      // Token speichern - CRITICAL: Use TokenManager to update BOTH memory AND localStorage!
      // Direct localStorage writes don't update the TokenManager singleton's in-memory state
      if (result.data !== undefined) {
        // Use TokenManager to properly set tokens (updates singleton memory + localStorage)
        getTokenManager().setTokens(
          result.data.accessToken,
          result.data.refreshToken,
        );
        // Legacy: token (backward compatibility for old code)
        localStorage.setItem('token', result.data.accessToken);

        // Store user role - Required for permission checks across pages
        const role = result.data.user.role;
        localStorage.setItem('userRole', role);
        localStorage.setItem('activeRole', role); // Legacy compatibility

        // Store user object - Full user data for pages that need more than just role
        localStorage.setItem('user', JSON.stringify(result.data.user));

        // Redirect zum Dashboard basierend auf Rolle
        if (role === 'root') {
          await goto(resolve('/root-dashboard', {}));
        } else if (role === 'admin') {
          await goto(resolve('/admin-dashboard', {}));
        } else {
          await goto(resolve('/employee-dashboard', {}));
        }
      }
    } catch (err) {
      showError(
        err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten',
      );
    } finally {
      loading = false;
    }
  }

  function handlePasswordReset(e: Event): void {
    e.preventDefault();
    showInfoAlert('Passwort zurücksetzen - Coming soon');
  }

  function handleRequestAccess(e: Event): void {
    e.preventDefault();
    showInfoAlert('Zugang beantragen - Coming soon');
  }

  // =============================================================================
  // Type Guards for Form Enhancement
  // =============================================================================

  interface SuccessResultData {
    success: true;
    accessToken: string;
    refreshToken: string;
    user: { role: string };
    redirectTo?: string;
  }

  /** Check if value is a non-null object */
  function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  /** Check if object has a string property */
  function hasStringProp(obj: Record<string, unknown>, key: string): boolean {
    return key in obj && typeof obj[key] === 'string';
  }

  /** Check if object has valid user with role */
  function hasValidUser(obj: Record<string, unknown>): boolean {
    if (!isObject(obj.user)) return false;
    return hasStringProp(obj.user, 'role');
  }

  /**
   * Type guard to validate successful login result data
   */
  function isSuccessResultData(data: unknown): data is SuccessResultData {
    if (!isObject(data)) return false;
    if (data.success !== true) return false;
    if (!hasStringProp(data, 'accessToken')) return false;
    if (!hasStringProp(data, 'refreshToken')) return false;
    return hasValidUser(data);
  }
</script>

<svelte:head>
  <title>Assixx - Login</title>
</svelte:head>

<!-- Back to Homepage Button -->
<a
  href={resolve('/', {})}
  class="back-button"
>
  <span class="icon">←</span>
  <span>Zurück zur Hauptseite</span>
</a>

<!-- Help Button -->
<div class="help-button">?</div>

<div class="login-container">
  <!-- Login Form -->
  <div class="login-card">
    <!-- Logo inside card -->
    <div class="login-card-logo">
      <button
        type="button"
        class="logo-button"
        onclick={() => {
          window.location.reload();
        }}
      >
        <img
          src={isDark() ?
            '/images/logo_darkmode.png'
          : '/images/logo_lightmode.png'}
          alt="Assixx Logo"
          class="login-logo"
        />
      </button>
    </div>

    <!-- Error Toast (Session expired = danger, Login error = error) -->
    {#if showToast && error}
      <div
        class="toast {isTimeout ? 'toast--danger' : 'toast--error'}"
        data-temp-toast="error"
      >
        <div class="toast__icon">
          <i class="fas fa-times-circle"></i>
        </div>
        <div class="toast__content">
          <div class="toast__title">
            {isTimeout ? 'Sitzung abgelaufen' : 'Fehler'}
          </div>
          <div class="toast__message">{error}</div>
        </div>
        <button
          class="toast__close"
          type="button"
          onclick={dismissToast}
          aria-label="Schließen"
        >
          <i class="fas fa-times"></i>
        </button>
        <div class="toast__progress">
          <div
            class="toast__progress-bar"
            style="animation-duration: {TOAST_DURATION_SECONDS}s;"
          ></div>
        </div>
      </div>
    {/if}

    <!-- Form Action Error (from server) -->
    {#if form?.error}
      <div
        class="toast toast--error"
        data-temp-toast="error"
      >
        <div class="toast__icon">
          <i class="fas fa-times-circle"></i>
        </div>
        <div class="toast__content">
          <div class="toast__title">Fehler</div>
          <div class="toast__message">{form.error}</div>
        </div>
      </div>
    {/if}

    <form
      method="POST"
      use:enhance={() => {
        loading = true;
        return async ({ result, update }) => {
          loading = false;

          if (result.type === 'success' && isSuccessResultData(result.data)) {
            const { accessToken, refreshToken, user, redirectTo } = result.data;

            // Store tokens for client-side API calls
            getTokenManager().setTokens(accessToken, refreshToken);
            localStorage.setItem('token', accessToken); // Legacy compatibility

            // Store user data
            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('userRole', user.role);
            localStorage.setItem('activeRole', user.role);

            // Bridge login password for E2E key escrow recovery (ADR-022)
            // Must happen before goto() — consumed by e2e-state.initialize()
            setLoginPassword(password);

            // Redirect to dashboard
            await goto(redirectTo ?? '/admin-dashboard');
            return;
          }

          // On error, update() will populate form.error
          await update();
        };
      }}
    >
      <div class="form-field">
        <label
          class="form-field__label form-field__label--required"
          for="email"
        >
          E-Mail
        </label>
        <!-- svelte-ignore a11y_autofocus -->
        <input
          type="email"
          id="email"
          name="email"
          class="form-field__control"
          required
          autofocus
          autocomplete="email"
          bind:value={email}
          disabled={loading}
        />
      </div>

      <div class="form-field">
        <label
          class="form-field__label form-field__label--required"
          for="password"
        >
          Passwort
        </label>
        <input
          type="password"
          id="password"
          name="password"
          class="form-field__control"
          required
          autocomplete="current-password"
          bind:value={password}
          disabled={loading}
        />
      </div>

      <div class="mt-6 flex justify-end">
        <button
          type="submit"
          class="btn btn-primary"
          disabled={loading || !isFormValid}
        >
          {#if loading}
            <i class="fas fa-spinner fa-spin"></i>
          {/if}
          {buttonText}
        </button>
      </div>
    </form>

    <!-- svelte-ignore a11y_invalid_attribute -->
    <div class="login-footer">
      <a
        href="#"
        onclick={handlePasswordReset}>Passwort vergessen?</a
      ><a
        href="#"
        onclick={handleRequestAccess}>Zugangsdaten beantragen</a
      >
    </div>
  </div>

  <!-- Company Footer -->
  <div class="login-company">
    <p class="text-secondary">
      © 2025 Assixx - Powered by Simon Öztürks Computer Service
    </p>
  </div>
</div>

<!-- Styles kommen aus /styles/login.css (global) -->
