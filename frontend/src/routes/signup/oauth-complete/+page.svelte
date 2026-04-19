<script lang="ts">
  /**
   * /signup/oauth-complete — company-details form for Microsoft OAuth signup.
   *
   * The user has already authenticated with Microsoft and received a ticket
   * id via the callback redirect (Step 2.6). The SSR load (+page.server.ts)
   * peeks at the ticket and pre-fills email + name fields; the user adds
   * the missing company details, accepts terms, and submits. On success the
   * backend issues session cookies and we land on the root dashboard.
   *
   * Design: Mirrors the `/signup` split-screen layout (hero left, form right)
   * so the Microsoft-OAuth continuation feels like a native step of the
   * signup journey (UX alignment 2026-04-19). Hero content is intentionally
   * identical to `/signup` — maximum brand recognition across the flow.
   *
   * Scope (Plan §5.4):
   *   - Email is PRE-FILLED + READ-ONLY (verified by Microsoft).
   *   - adminFirstName / adminLastName are PRE-FILLED (best-effort split of
   *     Microsoft `displayName`) + EDITABLE.
   *   - companyName + subdomain + phone are required, user fills.
   *   - Address fields are OPTIONAL in the DTO → omitted from V1 form to
   *     keep the page short. Can be added later in /settings/company.
   *   - Turnstile intentionally NOT present: Microsoft already provided
   *     bot protection during the OAuth consent step (Plan §0.3).
   *
   * @see docs/FEAT_MICROSOFT_OAUTH_MASTERPLAN.md (Phase 5, Step 5.4)
   */
  import { enhance } from '$app/forms';
  import { resolve } from '$app/paths';

  import LegalFooter from '$lib/components/LegalFooter.svelte';
  import Seo from '$lib/components/Seo.svelte';
  import { setActiveRole } from '$lib/utils/auth';
  import { splitDisplayName } from '$lib/utils/oauth';
  import { getTokenManager } from '$lib/utils/token-manager';

  import { DEFAULT_COUNTRY } from '../_lib/constants';
  import CountryPhoneInput from '../_lib/CountryPhoneInput.svelte';
  import SignupNav from '../_lib/SignupNav.svelte';
  import SubdomainInput from '../_lib/SubdomainInput.svelte';

  import type { ActionData, PageData } from './$types';

  interface Props {
    data: PageData;
    form: ActionData;
  }

  const { data, form }: Props = $props();

  // ─── Form state ──────────────────────────────────────────────────────────
  //
  // `data.displayName` is an SSR-loaded prop captured ONCE to seed form fields.
  // The user edits the inputs thereafter and `data` does not change mid-page.
  // The Svelte 5 warning about prop-reference outside a reactive context
  // guards against MISSING reactivity — here the one-shot read is intentional.

  // svelte-ignore state_referenced_locally
  const prefill = splitDisplayName(data.displayName);
  let firstName = $state(prefill.first);
  let lastName = $state(prefill.last);
  let companyName = $state('');
  let subdomain = $state('');
  let phone = $state('');
  let countryCode = $state(DEFAULT_COUNTRY.code);
  let termsAccepted = $state(false);
  let loading = $state(false);

  // Touched-flags: suppress "empty required" red borders until the user has
  // interacted (same on-blur pattern as /signup — avoids aggressive
  // validation on first render).
  let firstNameTouched = $state(false);
  let lastNameTouched = $state(false);
  let companyNameTouched = $state(false);

  // Enable submit only when all required fields are filled + terms accepted.
  // Subdomain / phone shape validation is delegated to server-side Zod; this
  // gate is UX only (prevents empty submissions from being sent).
  const isFormValid = $derived(
    firstName.trim() !== '' &&
      lastName.trim() !== '' &&
      companyName.trim() !== '' &&
      subdomain.trim() !== '' &&
      phone.trim() !== '' &&
      termsAccepted,
  );

  // Mirrors /signup — text-swap instead of a spinner keeps visual parity
  // between the two signup entry points.
  const buttonText = $derived(loading ? 'Wird abgeschlossen...' : 'Registrierung abschließen');

  // ─── Type guards for form.enhance result ─────────────────────────────────

  interface SuccessResultData {
    success: true;
    accessToken: string;
    user: { role: 'root' };
    redirectTo: string;
  }

  function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  function isSuccessResultData(value: unknown): value is SuccessResultData {
    if (!isObject(value)) return false;
    if (value.success !== true) return false;
    if (typeof value.accessToken !== 'string') return false;
    if (!isObject(value.user)) return false;
    return value.user.role === 'root';
  }
</script>

<Seo
  title="Registrierung abschließen — Assixx"
  description="Schließen Sie Ihre Microsoft-Registrierung bei Assixx ab."
  canonical="https://www.assixx.com/signup/oauth-complete"
/>

<SignupNav />

<div class="signup-layout">
  <div class="signup-page">
    <!-- Left: Hero image + branding — identical to /signup for flow continuity -->
    <div class="signup-hero">
      <div class="signup-hero__overlay"></div>
      <div class="signup-hero__content">
        <img
          src="/images/logo_darkmode.png"
          alt="Assixx Logo"
          class="signup-hero__logo"
        />
        <h1 class="signup-hero__title">Enterprise 2.0 für Industriefirmen</h1>
        <p class="signup-hero__subtitle">
          Wissensmanagement, Kommunikation und Kollaboration — von der Produktion bis zur
          Verwaltung.
        </p>
      </div>
    </div>

    <!-- Right: Form -->
    <div class="signup-form-side">
      <div class="signup-card">
        <h2 class="signup-title">Firmendaten abschließen</h2>
        <p class="signup-subtitle">
          Sie sind als <strong>{data.email}</strong> bei Microsoft angemeldet. Ergänzen Sie die fehlenden
          Angaben.
        </p>

        {#if form?.error}
          <!--
            Inline alert (not a toast) — design-system guidance: `.toast` is
            for dismiss-after-timeout floating notifications, `.alert` is for
            embedded state messages. See design-system/primitives/feedback/README.
          -->
          <div
            class="alert alert--error"
            role="alert"
          >
            <div class="alert__icon">
              <i class="fas fa-times-circle"></i>
            </div>
            <div class="alert__content">
              <div class="alert__title">Fehler</div>
              <div class="alert__message">{form.error}</div>
            </div>
          </div>
        {/if}

        <form
          id="oauthCompleteForm"
          method="POST"
          use:enhance={() => {
            loading = true;
            return async ({ result, update }) => {
              loading = false;

              if (result.type === 'success' && isSuccessResultData(result.data)) {
                const { accessToken, user, redirectTo } = result.data;

                // Mirror the login page's client-side hydration of tokens/role.
                getTokenManager().setTokens(accessToken);
                localStorage.setItem('token', accessToken);
                localStorage.setItem('user', JSON.stringify(user));
                localStorage.setItem('userRole', user.role);
                setActiveRole(user.role);

                // Full-page load — crossing the (app)-layout boundary.
                window.location.href = redirectTo;
                return;
              }

              await update();
            };
          }}
        >
          <input
            type="hidden"
            name="ticket"
            value={data.ticket}
          />

          <!-- Pre-filled block: read-only email + editable names -->
          <div class="form-field">
            <label
              class="form-field__label"
              for="email"
            >
              E-Mail
              <span class="form-field__hint">(von Microsoft, nicht änderbar)</span>
            </label>
            <input
              type="email"
              id="email"
              class="form-field__control"
              value={data.email}
              readonly
              disabled
            />
          </div>

          <div class="name-row">
            <div class="form-field">
              <label
                class="form-field__label form-field__label--required"
                for="adminFirstName">Vorname</label
              >
              <input
                type="text"
                id="adminFirstName"
                name="adminFirstName"
                class="form-field__control"
                class:is-error={firstNameTouched && firstName.trim() === ''}
                required
                autocomplete="given-name"
                bind:value={firstName}
                onblur={() => {
                  firstNameTouched = true;
                }}
                disabled={loading}
              />
            </div>
            <div class="form-field">
              <label
                class="form-field__label form-field__label--required"
                for="adminLastName">Nachname</label
              >
              <input
                type="text"
                id="adminLastName"
                name="adminLastName"
                class="form-field__control"
                class:is-error={lastNameTouched && lastName.trim() === ''}
                required
                autocomplete="family-name"
                bind:value={lastName}
                onblur={() => {
                  lastNameTouched = true;
                }}
                disabled={loading}
              />
            </div>
          </div>

          <div class="section-divider"></div>

          <!-- New data: company, subdomain, phone -->
          <div class="form-field">
            <label
              class="form-field__label form-field__label--required"
              for="companyName">Firmenname</label
            >
            <input
              type="text"
              id="companyName"
              name="companyName"
              class="form-field__control"
              class:is-error={companyNameTouched && companyName.trim() === ''}
              required
              placeholder="Ihre Firma GmbH"
              autocomplete="organization"
              bind:value={companyName}
              onblur={() => {
                companyNameTouched = true;
              }}
              disabled={loading}
            />
          </div>

          <SubdomainInput
            bind:subdomain
            disabled={loading}
          />

          <CountryPhoneInput
            bind:phone
            bind:countryCode
            disabled={loading}
          />

          <!--
            CountryPhoneInput only submits `phone` as a form field. The country
            code is bound in component state; surface it as a hidden input so
            the server action can merge `${countryCode}${phoneDigits}` (same
            shape as the password signup in signup/_lib/api.ts).
          -->
          <input
            type="hidden"
            name="countryCode"
            value={countryCode}
          />

          <!-- Terms & submit — mirrors /signup layout -->
          <label class="terms-checkbox">
            <input
              type="checkbox"
              required
              bind:checked={termsAccepted}
              disabled={loading}
            />
            <span>
              Ich akzeptiere die&nbsp;
              <a
                href={resolve('/TERMS-OF-USE.md')}
                target="_blank"
                rel="noopener noreferrer"
                class="terms-link">Nutzungsbedingungen</a
              >
            </span>
          </label>

          <button
            type="submit"
            class="btn btn-index signup-submit"
            disabled={loading || !isFormValid}
          >
            {buttonText}
          </button>
        </form>
      </div>
    </div>
  </div>
  <LegalFooter compact />
</div>

<style>
  /* =========================================================================
   * Layout mirrors frontend/src/routes/signup/+page.svelte — any future
   * structural changes should be applied in BOTH places (or extracted into a
   * shared SignupLayout component). Duplication is deliberate for now: KISS
   * wins while only two pages share this chrome.
   * ========================================================================= */

  .signup-layout {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .signup-page {
    display: grid;
    grid-template-columns: 1fr 1fr;
    width: 100%;
    min-height: 100vh;
  }

  /* --- Left: Hero ---
     `position: sticky` + `align-self: start` + `height: 100vh` prevent the
     hero from stretching when the right-side form grows. Identical to
     /signup (UX-Bug 2026-04-18). */
  .signup-hero {
    position: sticky;
    top: 0;
    align-self: start;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background-image: url('/images/background_index_1920.jpg');
    background-image: image-set(
      url('/images/background_index.webp') type('image/webp'),
      url('/images/background_index_1920.jpg') type('image/jpeg')
    );
    background-size: cover;
    background-position: center;
    overflow: hidden;
  }

  .signup-hero__overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      135deg,
      color-mix(in oklch, var(--color-black) 60%, transparent) 0%,
      color-mix(in oklch, var(--color-black) 40%, transparent) 100%
    );
  }

  .signup-hero__content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 48px;
    max-width: 480px;
  }

  .signup-hero__logo {
    height: 160px;
    margin-bottom: 36px;
  }

  .signup-hero__title {
    color: var(--color-white);
    font-weight: 700;
    font-size: 2.75rem;
    line-height: 1.2;
    margin-bottom: 20px;
    text-shadow: 0 2px 8px color-mix(in oklch, var(--color-black) 30%, transparent);
  }

  .signup-hero__subtitle {
    color: color-mix(in oklch, var(--color-white) 80%, transparent);
    font-size: 1.25rem;
    line-height: 1.5;
  }

  /* --- Right: Form side --- */
  .signup-form-side {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 60px 120px 115px;
  }

  .signup-card {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 680px;
  }

  .signup-title {
    color: var(--text-primary);
    font-weight: 600;
    font-size: 22px;
    margin-bottom: 4px;
  }

  .signup-subtitle {
    color: var(--text-secondary);
    font-size: 14px;
    margin-bottom: 16px;
  }

  /* Inline alert sits between subtitle and form — keep spacing rhythm. */
  .signup-card :global(.alert) {
    margin-bottom: 16px;
  }

  /* --- Compact form — identical overrides to /signup --- */
  form {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }

  form :global(.form-field) {
    margin-bottom: 0;
  }

  form :global(.form-field__label) {
    margin-bottom: 0;
    font-size: 13px;
  }

  form :global(.form-field__control),
  form :global(.subdomain-input),
  form :global(.country-display) {
    min-height: 38px;
    padding: 6px 12px;
  }

  .name-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .section-divider {
    margin: 0;
    border-top: 1px solid color-mix(in oklch, var(--color-white) 8%, transparent);
  }

  /* Muted hint next to the email label — clarifies why the field is locked. */
  .form-field__hint {
    margin-left: 6px;
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 400;
  }

  /* --- Terms + submit --- */
  .terms-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 2px;
    color: var(--text-secondary);
    font-size: 13px;
  }

  .terms-checkbox input[type='checkbox'] {
    width: 17px;
    height: 17px;
    accent-color: var(--primary-color);
  }

  .terms-link {
    color: var(--primary-color);
    text-decoration: none;
  }

  .terms-link:hover {
    text-decoration: underline;
  }

  .signup-submit {
    margin-top: 4px;
    width: 100%;
  }

  /* --- Body override (scoped via :has() to this page only) --- */
  :global(body:has(#oauthCompleteForm)) {
    display: flex;
    justify-content: center;
    padding: 0;
  }

  /* --- Light mode override for the divider --- */
  :global(html:not(.dark)) .section-divider {
    border-color: color-mix(in oklch, var(--color-black) 10%, transparent);
  }

  /* --- Responsive: stack on narrow screens (mirrors /signup) --- */
  @media (width < 900px) {
    .signup-page {
      grid-template-columns: 1fr;
    }

    .signup-hero {
      position: static;
      align-self: auto;
      height: auto;
      min-height: 200px;
    }

    .signup-hero__content {
      padding: 32px 24px;
    }

    .signup-hero__title {
      font-size: 1.5rem;
    }

    .signup-hero__subtitle {
      font-size: 0.95rem;
    }

    .signup-form-side {
      padding: 24px 16px 16px;
      max-height: none;
    }
  }

  @media (width < 480px) {
    .name-row {
      grid-template-columns: 1fr;
    }

    .signup-card {
      max-width: 100%;
    }
  }
</style>
