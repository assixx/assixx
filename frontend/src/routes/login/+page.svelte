<script lang="ts">
  import { onMount } from 'svelte';

  import { enhance } from '$app/forms';
  import { replaceState } from '$app/navigation';
  import { resolve } from '$app/paths';

  import LegalFooter from '$lib/components/LegalFooter.svelte';
  import MicrosoftSignInButton from '$lib/components/MicrosoftSignInButton.svelte';
  import OAuthDivider from '$lib/components/OAuthDivider.svelte';
  import Seo from '$lib/components/Seo.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import Turnstile from '$lib/components/Turnstile.svelte';
  import { setLoginPassword } from '$lib/crypto/login-password-bridge';
  import { isDark } from '$lib/stores/theme.svelte';
  import { showInfoAlert } from '$lib/stores/toast';
  import { setActiveRole } from '$lib/utils/auth';
  import { mapOAuthErrorReason } from '$lib/utils/oauth';
  import { getTokenManager } from '$lib/utils/token-manager';

  import type { ActionData } from './$types';

  import { env } from '$env/dynamic/public';

  const { form }: { form: ActionData } = $props();

  // Cloudflare Turnstile — cast through a plain index-signature Record so
  // the absent-key case survives svelte-kit sync (see lib/server/turnstile.ts).
  const publicEnv = env as Record<string, string | undefined>;
  const turnstileEnabled = (publicEnv.PUBLIC_TURNSTILE_SITE_KEY ?? '') !== '';
  let turnstileToken = $state('');
  let turnstileRef: { reset: () => void } | undefined;

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
  let emailRef: HTMLInputElement | undefined;

  // Toast auto-dismiss configuration (1:1 like legacy)
  const TOAST_DURATION_SECONDS = 3;

  let toastTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // =============================================================================
  // URL Parameter Check (1:1 like legacy checkForMessages)
  // =============================================================================

  /**
   * Check for URL parameters on mount and show messages
   * Handles: ?timeout=true, ?session=expired, ?ratelimit=expired,
   *          ?oauth=not-linked (Step 5.2), ?oauth=error&reason=… (Phase 6)
   */
  function checkForMessages() {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);

    if (urlParams.get('timeout') === 'true' || urlParams.get('session') === 'expired') {
      showError(
        'Ihre Sitzung ist aus Sicherheitsgründen abgelaufen. Bitte melden Sie sich erneut an.',
      );
      // Clean up URL - SvelteKit's replaceState (safe inside afterNavigate)
      replaceState(window.location.pathname, {});
    } else if (urlParams.get('oauth') === 'not-linked') {
      // Backend 302s here when an OAuth login succeeds at Microsoft but no
      // `user_oauth_accounts` row exists for that provider_user_id.
      // Plan §5.2: "Display server-returned banner 'Kein verknüpftes Assixx-Konto gefunden'".
      // Reusing showError() matches the established ?timeout=/?session= pattern
      // — URL-param-driven messages all flow through the same toast surface.
      showError('Kein verknüpftes Assixx-Konto gefunden.');
      replaceState(window.location.pathname, {});
    } else if (urlParams.get('oauth') === 'error') {
      // Phase 6 error-path UX (Plan §6 integrations). Backend 302s to
      //   /login?oauth=error&reason=already_linked     (R3 — duplicate MS account)
      //   /login?oauth=error&reason=callback_failed    (state replay, expired state, id-token verify fail)
      //   /login?oauth=error&reason=missing_code       (provider returned no authorization code)
      //   /login?oauth=error&reason=<sanitised MS code>(user denied consent, tenant mismatch, etc.)
      //
      // Reason slugs are whitelisted + URL-encoded by OAuthController.sanitiseErrorReason;
      // we display a mapped German message to avoid leaking Microsoft error strings verbatim
      // (Plan §6: "never expose Microsoft error strings verbatim").
      const reason = urlParams.get('reason') ?? '';
      showError(mapOAuthErrorReason(reason));
      replaceState(window.location.pathname, {});
    } else if (urlParams.get('ratelimit') === 'expired') {
      // Rate limit message - use warning style by setting isTimeout
      isTimeout = false; // Not a timeout, but show as success/info
      error = 'Die Wartezeit ist abgelaufen. Sie können sich jetzt wieder anmelden.';
      showToast = true;
      // Clean up URL - SvelteKit's replaceState (safe inside afterNavigate)
      replaceState(window.location.pathname, {});
    }
  }

  // Focus email input + URL parameter check after hydration
  // Programmatic focus replaces HTML autofocus attribute which races
  // with SvelteKit hydration → "Autofocus processing was blocked"
  onMount(() => {
    emailRef?.focus();
    setTimeout(() => {
      checkForMessages();
    }, 0);
  });

  // =============================================================================
  // SVELTE 5 RUNES - Derived/Computed Values
  // =============================================================================

  // Form validation - re-computed automatically when email/password/turnstile change
  const isEmailValid = $derived(email.includes('@') && email.includes('.'));
  const isPasswordValid = $derived(password.length >= 8);
  const isFormValid = $derived(
    isEmailValid && isPasswordValid && (!turnstileEnabled || turnstileToken !== ''),
  );

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

  function handlePasswordReset(_e: Event): void {
    window.location.href = resolve('/forgot-password');
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

<Seo
  title="Anmelden - Assixx"
  description="Melden Sie sich bei Assixx an — der Enterprise-Plattform für Industrieunternehmen."
  canonical="https://www.assixx.com/login"
/>

<!-- Back to Homepage Button -->
<a
  href={resolve('/')}
  class="back-button"
>
  <span class="icon">←</span>
  <span>Zurück zur Hauptseite</span>
</a>

<!-- Top Right Actions -->
<div class="top-actions">
  <ThemeToggle />
  <div class="help-button">?</div>
</div>

<div class="login-page">
  <main class="login-container">
    <!-- Login Form -->
    <div class="card login-card">
      <!-- Logo inside card -->
      <div class="login-card-logo">
        <button
          type="button"
          class="logo-button"
          onclick={() => {
            window.location.reload();
          }}
        >
          <picture>
            <source
              srcset={isDark() ? '/images/logo_darkmode.webp' : '/images/logo_lightmode.webp'}
              type="image/webp"
            />
            <img
              src={isDark() ? '/images/logo_darkmode.png' : '/images/logo_lightmode.png'}
              alt="Assixx Logo"
              class="login-logo"
              width="180"
              height="87"
            />
          </picture>
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
              const { accessToken, user, redirectTo } = result.data;

              // Store tokens for client-side API calls
              getTokenManager().setTokens(accessToken);
              localStorage.setItem('token', accessToken); // Legacy compatibility

              // Store user data
              localStorage.setItem('user', JSON.stringify(user));
              localStorage.setItem('userRole', user.role);
              setActiveRole(user.role);

              // Bridge login password for E2E key escrow recovery (ADR-022)
              // Must happen before redirect — consumed by e2e-state.initialize()
              setLoginPassword(password);

              // Full page load — login is a state boundary (unauthenticated → authenticated).
              // Client-side goto() fails with Vite 8 SSR: when navigating from /login (outside
              // (app) group) to dashboard (inside (app) group), the intermediate (app)-layout
              // insertion doesn't clean up the old SSR-rendered login DOM nodes.
              window.location.href = redirectTo ?? '/admin-dashboard';
              return;
            }

            // Reset Turnstile for retry (token is single-use)
            turnstileRef?.reset();

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
          <input
            bind:this={emailRef}
            type="email"
            id="email"
            name="email"
            class="form-field__control"
            required
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

        <!-- Cloudflare Turnstile -->
        <input
          type="hidden"
          name="turnstileToken"
          value={turnstileToken}
        />
        <Turnstile
          bind:this={turnstileRef}
          bind:token={turnstileToken}
          action="login"
        />

        <div class="mt-6">
          <button
            type="submit"
            class="btn btn-index w-full"
            disabled={loading || !isFormValid}
          >
            {#if loading}
              <span class="spinner-ring spinner-ring--sm"></span>
            {/if}
            {buttonText}
          </button>
        </div>
      </form>

      <!--
        Microsoft OAuth entry point (UI swap — previously ABOVE the form).
        New reading order per UX request 2026-04-16: email/password is the
        primary path, OAuth is the alternative. Hence:
        (1) Divider first — connector "oder" after the submit button,
        (2) Microsoft button second — the alternative identity option.
        `disabled` stays tied to `loading` so a password submit in flight
        cannot race with an OAuth redirect (same guarantee as §5.2 before).
      -->
      <div class="oauth-section">
        <OAuthDivider label="oder" />
        <MicrosoftSignInButton
          mode="login"
          disabled={loading}
        />
      </div>

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
  </main>

  <LegalFooter compact />
</div>

<style>
  /* Back Button */
  .back-button {
    display: flex;
    position: fixed;
    top: 20px;
    left: 20px;
    align-items: center;
    gap: 10px;
    z-index: 1001;

    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: var(--glass-card-shadow);
    border: var(--glass-border);
    border-radius: 12px;

    background: var(--glass-bg);

    padding: 10px 20px;
    color: var(--color-text-primary);
    font-weight: 500;

    font-size: 14px;
    text-decoration: none;
  }

  .back-button:hover {
    transform: translateX(-5px);
    border-color: var(--color-glass-border-hover);

    background: var(--glass-bg-hover);

    color: var(--color-text-primary);
  }

  .back-button:active {
    transform: translateX(-3px) scale(0.98);
  }

  .back-button .icon {
    transition: transform 0.3s ease;
    font-size: 18px;
  }

  .back-button:hover .icon {
    transform: translateX(-3px);
  }

  /* Login Container */
  .login-page {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .login-container {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: var(--spacing-6);
  }

  .login-card-logo {
    display: flex;
    justify-content: center;
  }

  .login-logo {
    display: block;

    transition: transform 0.3s ease;
    cursor: pointer;

    width: 120px;
    height: auto;
  }

  .login-logo:hover {
    transform: scale(1.05);
  }

  .login-card {
    transform: translateY(-5vh);
    padding: var(--spacing-8);
    width: 100%;
    max-width: 450px;
  }

  .login-footer {
    margin-top: var(--spacing-3);
    padding-top: var(--spacing-3);
    text-align: center;
  }

  .login-footer a {
    transition: color 0.3s ease;

    /* WHY: war hardcoded `#fff` → unsichtbar im Light Mode (weiß auf weiß).
     * Token folgt Theme: dunkel im Light, hell im Dark Mode. */
    color: var(--color-text-secondary);
    font-size: 13px;
    font-weight: 400;
    text-decoration: none;
  }

  .login-footer a + a {
    margin-left: 20px;
  }

  .login-footer a:hover {
    color: var(--primary-light);
    text-decoration: underline;
  }

  /* Top Right Actions (ThemeToggle + Help) */
  .top-actions {
    display: flex;
    position: fixed;
    top: 20px;
    right: 20px;
    align-items: center;
    gap: 12px;
    z-index: 100;
  }

  /* Help Button */
  .help-button {
    display: flex;
    justify-content: center;
    align-items: center;
    backdrop-filter: blur(10px);
    cursor: pointer;
    box-shadow: var(--glass-card-shadow);
    border: var(--glass-border);
    border-radius: 50%;

    background: var(--glass-bg-active);

    width: 36px;
    height: 36px;
    color: var(--text-secondary);

    font-size: 19px;
  }

  .help-button:hover {
    transform: scale(1.1);
    border-color: var(--primary-color);

    background: color-mix(in oklch, var(--color-primary) 15%, transparent);

    color: var(--primary-color);
  }

  @media (width < 768px) {
    .login-card {
      padding: var(--spacing-6);
    }

    .login-logo {
      width: 60px;
      height: 60px;
    }
  }
</style>
