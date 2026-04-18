<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';

  import LegalFooter from '$lib/components/LegalFooter.svelte';
  import MicrosoftSignInButton from '$lib/components/MicrosoftSignInButton.svelte';
  import OAuthDivider from '$lib/components/OAuthDivider.svelte';
  import PasswordStrengthIndicator from '$lib/components/PasswordStrengthIndicator.svelte';
  import Seo from '$lib/components/Seo.svelte';
  import Turnstile from '$lib/components/Turnstile.svelte';
  import { showWarningAlert, showErrorAlert, showToast } from '$lib/stores/toast';
  import { analyzePassword, type PasswordStrengthResult } from '$lib/utils/password-strength';

  import { registerUser, createRegisterPayload } from './_lib/api';
  import { DEFAULT_COUNTRY, SUCCESS_REDIRECT_DELAY, ERROR_MESSAGES } from './_lib/constants';
  import CountryPhoneInput from './_lib/CountryPhoneInput.svelte';
  import SignupNav from './_lib/SignupNav.svelte';
  import SubdomainInput from './_lib/SubdomainInput.svelte';
  import {
    isSubdomainValid,
    isEmailValid,
    emailsMatch,
    passwordsMatch,
    isPhoneValid,
    isPasswordValid,
  } from './_lib/validators';

  import { env } from '$env/dynamic/public';

  // =========================================================================
  // FORM STATE
  // =========================================================================

  let companyName = $state('');
  let subdomain = $state('');
  let email = $state('');
  let emailConfirm = $state('');
  let firstName = $state('');
  let lastName = $state('');
  let phone = $state('');
  let countryCode = $state(DEFAULT_COUNTRY.code);
  let password = $state('');
  let passwordConfirm = $state('');
  let showPassword = $state(false);
  let showPasswordConfirm = $state(false);
  let passwordStrength = $state<PasswordStrengthResult | null>(null);
  let strengthLoading = $state(false);
  let termsAccepted = $state(false);
  let loading = $state(false);
  let emailMatchError: string | null = $state(null);
  let passwordMatchError: string | null = $state(null);

  // Touched-Flag: Feld erst NACH erstem Blur validieren, damit User nicht
  // sofort beim Öffnen der Seite rote Borders sieht. Pattern analog zu
  // emailMatchError/passwordMatchError (nur on-interact) — verhindert
  // "aggressive validation"-Antipattern. Gilt für die Required-Felder die
  // sonst kein Match-Feedback haben.
  let companyNameTouched = $state(false);
  let firstNameTouched = $state(false);
  let lastNameTouched = $state(false);

  // Cloudflare Turnstile — cast through a plain index-signature Record so
  // the absent-key case survives svelte-kit sync (see lib/server/turnstile.ts).
  const publicEnv = env as Record<string, string | undefined>;
  const turnstileEnabled = (publicEnv.PUBLIC_TURNSTILE_SITE_KEY ?? '') !== '';
  let turnstileToken = $state('');
  let turnstileRef: { reset: () => void } | undefined;

  // =========================================================================
  // DERIVED
  // =========================================================================

  const subdomainValid = $derived(isSubdomainValid(subdomain));
  const emailValid = $derived(isEmailValid(email));
  const emailMatch = $derived(emailsMatch(email, emailConfirm));
  const passwordMatch = $derived(passwordsMatch(password, passwordConfirm));
  const phoneValid = $derived(isPhoneValid(phone));

  const isFormValid = $derived(
    companyName !== '' &&
      subdomain !== '' &&
      subdomainValid &&
      email !== '' &&
      emailValid &&
      emailConfirm !== '' &&
      emailMatch &&
      firstName !== '' &&
      lastName !== '' &&
      phone !== '' &&
      phoneValid &&
      isPasswordValid(password) &&
      passwordConfirm !== '' &&
      passwordMatch &&
      termsAccepted &&
      (!turnstileEnabled || turnstileToken !== ''),
  );

  const buttonText = $derived(loading ? 'Wird erstellt...' : 'Konto erstellen');

  // =========================================================================
  // EVENT HANDLERS
  // =========================================================================

  function handleEmailConfirmInput(): void {
    emailMatchError = emailConfirm !== '' && !emailMatch ? ERROR_MESSAGES.emailMismatch : null;
  }

  const MIN_STRENGTH_CHECK = 4;

  async function handlePasswordInput(): Promise<void> {
    if (password.length < MIN_STRENGTH_CHECK) {
      passwordStrength = null;
      return;
    }

    strengthLoading = true;
    try {
      const userInputs = [email, firstName, lastName, companyName].filter(Boolean);
      passwordStrength = await analyzePassword(password, userInputs);
    } catch {
      // Ignore strength check errors
    } finally {
      strengthLoading = false;
    }
  }

  function handlePasswordConfirmInput(): void {
    passwordMatchError =
      passwordConfirm !== '' && !passwordMatch ? ERROR_MESSAGES.passwordMismatch : null;
  }

  function togglePasswordVisibility(field: 'password' | 'confirm'): void {
    if (field === 'password') showPassword = !showPassword;
    if (field === 'confirm') showPasswordConfirm = !showPasswordConfirm;
  }

  async function handleSubmit(e: Event): Promise<void> {
    e.preventDefault();

    if (!isFormValid) {
      showWarningAlert(ERROR_MESSAGES.formIncomplete);
      return;
    }

    loading = true;

    try {
      // Verify Turnstile token server-side before registration
      if (turnstileEnabled) {
        if (turnstileToken === '') {
          showErrorAlert('Bitte warten Sie, bis die Sicherheitsprüfung abgeschlossen ist.');
          return;
        }

        const verifyRes = await fetch('/api/turnstile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: turnstileToken, action: 'signup' }),
        });

        if (!verifyRes.ok) {
          turnstileRef?.reset();
          showErrorAlert('Sicherheitsprüfung fehlgeschlagen. Bitte versuchen Sie es erneut.');
          return;
        }
      }

      const payload = createRegisterPayload({
        companyName,
        subdomain,
        email,
        firstName,
        lastName,
        phone,
        countryCode,
        password,
      });

      await registerUser(payload);

      showToast({
        type: 'success',
        title: 'Erfolg',
        message: 'Erfolgreich registriert! Sie werden zur Anmeldung weitergeleitet...',
        duration: SUCCESS_REDIRECT_DELAY,
        showProgress: true,
      });

      turnstileRef?.reset();

      setTimeout(() => {
        void goto(resolve('/login'));
      }, SUCCESS_REDIRECT_DELAY);
    } catch (err: unknown) {
      turnstileRef?.reset();
      const message = err instanceof Error ? err.message : ERROR_MESSAGES.unknownError;
      showErrorAlert(message);
    } finally {
      loading = false;
    }
  }
</script>

<Seo
  title="Registrieren - Assixx"
  description="Registrieren Sie Ihr Unternehmen bei Assixx. Digitalisieren Sie Ihre Prozesse — von TPM bis Schichtplanung."
  canonical="https://www.assixx.com/signup"
/>

<SignupNav />

<div class="signup-layout">
  <div class="signup-page">
    <!-- Left: Hero image + branding -->
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
        <h2 class="signup-title">Konto erstellen</h2>
        <p class="signup-subtitle">30 Tage kostenlos testen — keine Kreditkarte nötig</p>

        <!--
          Microsoft OAuth entry point. Plan §5.3 requires:
          (1) MicrosoftSignInButton with mode=signup ABOVE the manual signup form,
          (2) On Microsoft signup success the backend redirects to
              /signup/oauth-complete?ticket={uuid} (handled by Step 5.4),
          (3) If R3 duplicate Microsoft account is detected, backend redirects
              to /login?oauth=error&reason=already_linked — the user lands on
              the login page, not here, so no signup-side error handler needed.
          Disabled while the manual form is submitting to prevent parallel
          navigations destabilising mid-request state.
        -->
        <div class="oauth-section">
          <MicrosoftSignInButton
            mode="signup"
            disabled={loading}
          />
          <OAuthDivider />
        </div>

        <!-- Signup Form -->
        <form
          id="signupForm"
          onsubmit={handleSubmit}
        >
          <!-- Company -->
          <div class="form-field">
            <label
              class="form-field__label form-field__label--required"
              for="company_name">Firmenname</label
            >
            <input
              type="text"
              id="company_name"
              name="company_name"
              class="form-field__control"
              class:is-error={companyNameTouched && companyName === ''}
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

          <div class="section-divider"></div>

          <!-- Personal Info -->
          <div class="name-row">
            <div class="form-field">
              <label
                class="form-field__label form-field__label--required"
                for="first_name">Vorname</label
              >
              <input
                type="text"
                id="first_name"
                name="first_name"
                class="form-field__control"
                class:is-error={firstNameTouched && firstName === ''}
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
                for="last_name">Nachname</label
              >
              <input
                type="text"
                id="last_name"
                name="last_name"
                class="form-field__control"
                class:is-error={lastNameTouched && lastName === ''}
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

          <div class="inline-row">
            <div class="form-field">
              <label
                class="form-field__label form-field__label--required"
                for="email">E-Mail</label
              >
              <input
                type="email"
                id="email"
                name="email"
                class="form-field__control"
                required
                placeholder="email@firma.de"
                autocomplete="email"
                bind:value={email}
                oninput={handleEmailConfirmInput}
                disabled={loading}
              />
            </div>

            <div class="form-field">
              <label
                class="form-field__label form-field__label--required"
                for="email_confirm">E-Mail bestätigen</label
              >
              <input
                type="email"
                id="email_confirm"
                name="email_confirm"
                class="form-field__control"
                class:is-error={emailMatchError}
                required
                placeholder="email@firma.de"
                bind:value={emailConfirm}
                oninput={handleEmailConfirmInput}
                disabled={loading}
              />
              {#if emailMatchError}
                <p class="form-field__message form-field__message--error">
                  {emailMatchError}
                </p>
              {/if}
            </div>
          </div>

          <CountryPhoneInput
            bind:phone
            bind:countryCode
            disabled={loading}
          />

          <div class="section-divider"></div>

          <!-- Password -->
          <div class="inline-row">
            <div class="form-field">
              <label
                class="form-field__label form-field__label--required"
                for="password"
              >
                Passwort
                <span class="tooltip ml-1">
                  <i class="fas fa-info-circle"></i>
                  <span
                    class="tooltip__content tooltip__content--info tooltip__content--right"
                    role="tooltip"
                  >
                    Min. 12 Zeichen, max. 72 Zeichen. Enthält 3 von 4: Großbuchstaben,
                    Kleinbuchstaben, Zahlen, Sonderzeichen (!@#$%^&*)
                  </span>
                </span>
              </label>
              <div class="form-field__password-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  class="form-field__control"
                  required
                  minlength="12"
                  maxlength="72"
                  placeholder="Min. 12 Zeichen"
                  autocomplete="new-password"
                  bind:value={password}
                  oninput={handlePasswordInput}
                  disabled={loading}
                />
                <button
                  type="button"
                  class="form-field__password-toggle"
                  aria-label="Passwort anzeigen"
                  onclick={() => {
                    togglePasswordVisibility('password');
                  }}
                >
                  <i class="fas {showPassword ? 'fa-eye-slash' : 'fa-eye'}"></i>
                </button>
              </div>
            </div>

            <div
              class="form-field"
              class:is-error={passwordMatchError}
              class:is-success={passwordConfirm !== '' && passwordMatch}
            >
              <label
                class="form-field__label form-field__label--required"
                for="password_confirm">Passwort bestätigen</label
              >
              <div class="form-field__password-wrapper">
                <input
                  type={showPasswordConfirm ? 'text' : 'password'}
                  id="password_confirm"
                  name="password_confirm"
                  class="form-field__control"
                  class:is-error={passwordMatchError}
                  class:is-success={passwordConfirm !== '' && passwordMatch}
                  required
                  autocomplete="new-password"
                  bind:value={passwordConfirm}
                  oninput={handlePasswordConfirmInput}
                  disabled={loading}
                />
                <button
                  type="button"
                  class="form-field__password-toggle"
                  aria-label="Passwort anzeigen"
                  onclick={() => {
                    togglePasswordVisibility('confirm');
                  }}
                >
                  <i class="fas {showPasswordConfirm ? 'fa-eye-slash' : 'fa-eye'}"></i>
                </button>
              </div>
              {#if passwordMatchError}
                <p class="form-field__message form-field__message--error">
                  {passwordMatchError}
                </p>
              {:else if passwordConfirm !== '' && passwordMatch}
                <p class="form-field__message form-field__message--success">
                  <i class="fas fa-check"></i> Passwörter stimmen überein
                </p>
              {/if}
            </div>
          </div>

          {#if passwordStrength !== null || strengthLoading}
            <PasswordStrengthIndicator
              score={passwordStrength?.score ?? -1}
              label={passwordStrength?.label ?? ''}
              crackTime={passwordStrength?.crackTime ?? ''}
              loading={strengthLoading}
              feedback={passwordStrength?.feedback ?? null}
            />
          {/if}

          <!-- Terms & Submit -->
          <label class="terms-checkbox">
            <input
              type="checkbox"
              id="termsCheckbox"
              name="terms"
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

          <!-- Cloudflare Turnstile -->
          <Turnstile
            bind:this={turnstileRef}
            bind:token={turnstileToken}
            action="signup"
          />

          <button
            type="submit"
            class="btn btn-index signup-submit"
            disabled={loading || !isFormValid}
          >
            {buttonText}
          </button>

          <p class="login-link-text">
            Bereits registriert?
            <a
              href={resolve('/login')}
              class="login-link">Anmelden</a
            >
          </p>
        </form>
      </div>
    </div>
  </div>
  <LegalFooter compact />
</div>

<style>
  /* =========================================================================
   * SPLIT LAYOUT — GitHub-style: hero left, form right
   * ========================================================================= */

  /* Layout wächst mit Content — kein `height: 100vh` mehr, damit der
     Footer natürlich unter die Fold rutscht. signup-page erzwingt
     `min-height: 100vh`, sodass er bei kurzem Form auch den Viewport
     füllt und der Footer erst beim Scrollen sichtbar wird.
     (UX request 2026-04-18 — Footer soll nicht sofort sichtbar sein.) */
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

  /* --- Left: Hero with background image ---
     `position: sticky` + `align-self: start` + `height: 100vh` verhindern
     dass der Hero mit der Grid-Row stretcht, wenn die rechte Form wächst
     (z. B. durch Password-Strength-Indicator). Ohne das würde der
     zentrierte Hero-Content vertikal wandern, sobald sich die Row-Höhe
     ändert (UX-Bug 2026-04-18). Sticky hält den Hero zusätzlich im
     Viewport, während man nach unten zum Footer scrollt. */
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

  /* --- Right: Form side ---
     Kein `overflow-y: auto` mehr — das Dokument selbst scrollt, damit der
     Footer erst bei Scroll erscheint (statt innerhalb der Form-Side). */
  .signup-form-side {
    display: flex;
    justify-content: center;
    align-items: flex-start;

    /* Asymmetric padding: top deliberately lower than bottom so the card
       sits closer to the viewport top (UX request 2026-04-16 — "ein wenig
       hochziehen"). Bottom stays generous because the form is long and
       needs breathing room before the footer on scroll. */
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

  /* --- Form compact layout --- */
  form {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }

  /* Override design-system spacing for compact signup */
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

  .name-row,
  .inline-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .section-divider {
    margin: 0;
    border-top: 1px solid color-mix(in oklch, var(--color-white) 8%, transparent);
  }

  /* --- Terms, submit, login link --- */
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

  .login-link-text {
    margin-top: 2px;
    color: var(--text-secondary);
    font-size: 13px;
    text-align: center;
  }

  .login-link {
    color: var(--primary-color);
    text-decoration: none;
  }

  .login-link:hover {
    text-decoration: underline;
  }

  /* --- Body override --- */
  :global(body:has(#signupForm)) {
    display: flex;
    justify-content: center;
    padding: 0;
  }

  /* --- Light mode overrides --- */
  :global(html:not(.dark)) .section-divider {
    border-color: color-mix(in oklch, var(--color-black) 10%, transparent);
  }

  /* --- Responsive: stack on narrow screens --- */
  @media (width < 900px) {
    .signup-page {
      grid-template-columns: 1fr;
    }

    /* Mobile: Sticky + 100vh Hero würde den Viewport füllen und die Form
       verdecken. Zurück auf natürliches Stacking. */
    .signup-hero {
      position: static;
      align-self: auto;
      height: auto;
      min-height: 200px;
    }

    .signup-hero__content {
      padding: 32px 24px;
      align-items: center;
      text-align: center;
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
    .name-row,
    .inline-row {
      grid-template-columns: 1fr;
    }

    .signup-card {
      max-width: 100%;
    }
  }
</style>
