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
  import { cryptoBridge } from '$lib/crypto/crypto-bridge';
  import { setLoginPassword } from '$lib/crypto/login-password-bridge';
  import { isDark } from '$lib/stores/theme.svelte';
  import { showInfoAlert, showSuccessAlert } from '$lib/stores/toast';
  import { setActiveRole } from '$lib/utils/auth';
  import { createLogger } from '$lib/utils/logger';
  import { mapOAuthErrorReason } from '$lib/utils/oauth';
  import { getTokenManager } from '$lib/utils/token-manager';

  const log = createLogger('LoginHandoff');

  import type { ActionData, PageData } from './$types';

  import { env } from '$env/dynamic/public';

  // `data.brand` is populated by `(public)/+layout.server.ts` via
  // `resolveBrand(hostSlug, tenantName)` — ADR-050 subdomain branding.
  // Apex / unknown slug → `data.brand.title === 'Assixx'`.
  const { data, form }: { data: PageData; form: ActionData } = $props();

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
   * Handles: ?timeout=true, ?session=expired, ?session=forbidden (ADR-050),
   *          ?logout=success (ADR-050 Amendment), ?ratelimit=expired,
   *          ?oauth=not-linked (Step 5.2), ?oauth=error&reason=… (Phase 6)
   *
   * ADR-050 Amendment namespaces:
   *   logout=success  — active user action result (success tone)
   *   session=expired — passive JWT expiry (warning tone via showError)
   *   session=forbidden — passive CROSS_TENANT_HOST_MISMATCH (error tone)
   */
  function checkForMessages() {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);

    if (urlParams.get('logout') === 'success') {
      // ADR-050 Amendment: user-initiated logout completed. Success toast
      // via global store (not local `showError`) because the login page's
      // inline toast surface is error-styled (banner + progress bar).
      showSuccessAlert('Sie wurden erfolgreich abgemeldet.');
      replaceState(window.location.pathname, {});
    } else if (urlParams.get('timeout') === 'true' || urlParams.get('session') === 'expired') {
      showError(
        'Ihre Sitzung ist aus Sicherheitsgründen abgelaufen. Bitte melden Sie sich erneut an.',
      );
      // Clean up URL - SvelteKit's replaceState (safe inside afterNavigate)
      replaceState(window.location.pathname, {});
    } else if (urlParams.get('session') === 'forbidden') {
      // ADR-050 §Decision + R15: JWT decoded OK but host ≠ token tenant
      // (CROSS_TENANT_HOST_MISMATCH). User redirected to apex; display as
      // error-toned message — same surface as session=expired.
      showError(
        'Zugriff verweigert — Sitzung passt nicht zum angeforderten Mandanten. Bitte melden Sie sich erneut an.',
      );
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

  /**
   * Session 12c (ADR-050): apex-login → subdomain-handoff result shape.
   *
   * `accessToken` lives in JS heap memory only for the ~1s between login
   * success and the cross-origin redirect, used exclusively to mint the
   * escrow unlock ticket (ADR-050 × ADR-022). It is NEVER persisted here
   * (no localStorage, no cookie on apex). Session tokens/cookies land on
   * the subdomain via the handoff-token swap (Session 12 consumer).
   *
   * `user.id` is required because the Worker scopes IndexedDB per user;
   * without it the wrappingKey could not be bound to the right origin
   * namespace. `tenantId` is for cross-tenant debugging + future-proofing;
   * the backend derives authoritative tenantId from the JWT, not here.
   */
  interface HandoffRedirectData {
    success: true;
    redirectTo: string;
    user: { id: number; role: string; tenantId: number };
    accessToken: string;
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

  /** Default Argon2id params used when bootstrapping an escrow for a brand-new user.
   * Matches the in-Worker `wrapKey` defaults so a same-origin password-change re-encrypt
   * can be done with comparable cost. Stored alongside the blob for future param upgrades. */
  const DEFAULT_ARGON2_PARAMS = { memory: 65536, iterations: 3, parallelism: 1 } as const;

  interface EscrowMetadata {
    encryptedBlob: string;
    argon2Salt: string;
    xchachaNonce: string;
    argon2Params: { memory: number; iterations: number; parallelism: number };
  }

  /** Fetch existing escrow metadata. Returns null on 4xx/5xx OR `data: null`. */
  async function fetchEscrow(accessToken: string): Promise<EscrowMetadata | null> {
    const resp = await fetch('/api/v2/e2e/escrow', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!resp.ok) {
      log.warn(
        { status: resp.status },
        'Escrow fetch failed during handoff — continuing without unlock ticket',
      );
      return null;
    }
    const body = (await resp.json()) as {
      success?: boolean;
      data?: EscrowMetadata | null;
    };
    return body.data ?? null;
  }

  /** Pre-flight check: does the server already hold an active E2E key for this user?
   * Used to distinguish "first-ever login" (no key, no escrow → bootstrap) from
   * "existing user without escrow" (key present, escrow null → admin reset path). */
  async function serverHasActiveKey(accessToken: string): Promise<boolean> {
    const resp = await fetch('/api/v2/e2e/keys/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!resp.ok) {
      return false;
    }
    const body = (await resp.json()) as { success?: boolean; data?: unknown };
    return body.data !== null && body.data !== undefined;
  }

  /** Generate a fresh 32-byte salt as base64. */
  function freshArgon2Salt(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }

  /** Mint the Redis ticket, return the URL with `?unlock=<id>` appended.
   * Returns `redirectTo` unchanged on any failure (silent → fail-closed downstream). */
  async function mintTicketOrFallback(
    redirectTo: string,
    accessToken: string,
    body: Record<string, unknown>,
  ): Promise<string> {
    const resp = await fetch('/api/v2/e2e/escrow/unlock-ticket', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      log.warn({ status: resp.status }, 'Unlock ticket mint failed — continuing without ticket');
      return redirectTo;
    }
    const respBody = (await resp.json()) as {
      success?: boolean;
      data?: { ticketId: string };
    };
    const ticketId = respBody.data?.ticketId;
    if (typeof ticketId !== 'string' || ticketId === '') {
      log.warn({ respBody }, 'Unlock ticket response malformed — continuing without ticket');
      return redirectTo;
    }
    const url = new URL(redirectTo);
    url.searchParams.set('unlock', ticketId);
    return url.toString();
  }

  /**
   * ADR-050 × ADR-022 — cross-origin escrow-unlock-ticket mint.
   *
   * Runs client-side on apex AFTER successful login, BEFORE the redirect to
   * the subdomain. Two branches discriminated by the server's escrow state:
   *
   *  1. **Unlock branch** — escrow exists. Derive wrappingKey from
   *     `(password, escrow.salt, escrow.params)`. Mint a regular unlock
   *     ticket. Subdomain unwraps the existing blob.
   *
   *  2. **Bootstrap branch** (ADR-022 §"New-user scenario") — no escrow yet
   *     AND server has no active key (true first login). Generate a fresh
   *     salt, derive wrappingKey from `(password, fresh_salt, defaults)`,
   *     mint a bootstrap ticket carrying salt + params. Subdomain generates
   *     its first key + creates the user's first escrow blob.
   *
   *  3. **Skip** — no escrow but server already has a key (existing user
   *     who lost local state on this origin). Bootstrap is unsafe (would
   *     409 on the subdomain's `generateAndRegisterKey`); fail-closed
   *     downstream is the correct semantics. Admin reset is the recovery.
   *
   * Fail-closed by design: any failure in network, Worker, or response
   * shape returns `redirectTo` unchanged → subdomain `initialize()` runs
   * normally and either generates a fresh key (if server has none) or
   * fail-closes with `recoveryRequired: true` (if it does).
   *
   * Security: `accessToken` is used ONLY for the authenticated fetches
   * below and never leaves this function's scope. `wrappingKey` is derived
   * inside the Worker and serialised ONCE into the POST body; it lives in
   * this function's local scope until GC'd by the page unload.
   */
  async function mintUnlockTicketOrFallback(
    redirectTo: string,
    accessToken: string,
    userId: number,
    loginPasswordValue: string,
  ): Promise<string> {
    try {
      // Spin up the Worker. On apex this opens a per-user IndexedDB with no
      // existing key — a harmless no-op. The Worker is terminated by the
      // page unload that follows the redirect; nothing persists here.
      await cryptoBridge.init(userId);

      const escrow = await fetchEscrow(accessToken);
      if (escrow !== null) {
        // Unlock branch: derive from the server-stored salt + params.
        const wrappingKey = await cryptoBridge.deriveWrappingKey(
          loginPasswordValue,
          escrow.argon2Salt,
          escrow.argon2Params,
        );
        return await mintTicketOrFallback(redirectTo, accessToken, { wrappingKey });
      }

      // No escrow → check whether the server already has a key. If yes, this
      // is an existing user who lost local state on this origin — bootstrap
      // is unsafe (key already registered, can't reconcile escrow). Skip the
      // ticket and let the subdomain fail-close with `recoveryRequired`.
      if (await serverHasActiveKey(accessToken)) {
        log.info(
          'No escrow but server has key — skipping bootstrap (admin reset required for this user)',
        );
        return redirectTo;
      }

      // Bootstrap branch: true first login. Mint fresh salt + params, derive,
      // mint a bootstrap ticket. Subdomain generates the key and stores the
      // first escrow.
      const argon2Salt = freshArgon2Salt();
      const argon2Params = { ...DEFAULT_ARGON2_PARAMS };
      const wrappingKey = await cryptoBridge.deriveWrappingKey(
        loginPasswordValue,
        argon2Salt,
        argon2Params,
      );
      return await mintTicketOrFallback(redirectTo, accessToken, {
        wrappingKey,
        argon2Salt,
        argon2Params,
      });
    } catch (err: unknown) {
      log.warn(
        { err: err instanceof Error ? err.message : 'unknown' },
        'Unlock ticket flow threw — continuing without ticket',
      );
      return redirectTo;
    }
  }

  /**
   * Type guard for the Session 12c handoff-redirect shape.
   *
   * ADR-050 × ADR-022 (2026-04-22 amendment): this branch now DOES carry
   * `accessToken` + `user.id` — used for the ephemeral apex-side escrow
   * unlock-ticket mint. Distinguishing mark from the normal same-origin
   * login: `refreshToken` is absent (the refresh token stays server-side
   * inside the handoff-token payload, not exposed to apex JS at all).
   */
  function isHandoffRedirectData(data: unknown): data is HandoffRedirectData {
    if (!isObject(data)) return false;
    if (data.success !== true) return false;
    if ('refreshToken' in data) return false;
    if (!hasStringProp(data, 'redirectTo')) return false;
    if (!hasStringProp(data, 'accessToken')) return false;
    if (!isObject(data.user)) return false;
    if (typeof data.user.id !== 'number') return false;
    if (typeof data.user.role !== 'string') return false;
    if (typeof data.user.tenantId !== 'number') return false;
    return true;
  }
</script>

<Seo
  title={`Anmelden - ${data.brand.title}`}
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

            // Session 12c (ADR-050): handoff-redirect branch MUST come FIRST.
            // Refresh tokens land on the subdomain origin via handleHandoff
            // (we don't persist them here). We do use the short-lived access
            // token client-side for ONE purpose: minting the ADR-022 escrow
            // unlock ticket so the subdomain can recover the E2E private key
            // without a password re-prompt (2026-04-22 amendment). See
            // `mintUnlockTicketOrFallback` above for the full rationale +
            // fail-closed semantics.
            //
            // We intentionally skip TokenManager.setTokens(), localStorage,
            // setActiveRole(), setLoginPassword() etc. — the subdomain's own
            // `/signup/oauth-complete` consumer sets all of that on its own
            // origin via Session 12's handleHandoff(). The login-password
            // bridge is moot because this is a cross-origin redirect; module
            // memory dies at `window.location.href`.
            if (result.type === 'success' && isHandoffRedirectData(result.data)) {
              const { redirectTo, accessToken, user: handoffUser } = result.data;
              const finalUrl = await mintUnlockTicketOrFallback(
                redirectTo,
                accessToken,
                handoffUser.id,
                password,
              );
              window.location.href = finalUrl;
              return;
            }

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
            class="btn btn-primary w-full"
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
