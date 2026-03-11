<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';

  import PasswordStrengthIndicator from '$lib/components/PasswordStrengthIndicator.svelte';
  import { showWarningAlert, showErrorAlert } from '$lib/stores/toast';
  import {
    analyzePassword,
    type PasswordStrengthResult,
  } from '$lib/utils/password-strength';

  import { registerUser, createRegisterPayload } from './_lib/api';
  import {
    DEFAULT_COUNTRY,
    SUCCESS_REDIRECT_DELAY,
    ERROR_MESSAGES,
  } from './_lib/constants';
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

  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
  }

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
  let showSuccess = $state(false);
  let emailMatchError: string | null = $state(null);
  let passwordMatchError: string | null = $state(null);

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
      termsAccepted,
  );

  const buttonText = $derived(loading ? 'Wird erstellt...' : 'Konto erstellen');

  // =========================================================================
  // EVENT HANDLERS
  // =========================================================================

  function handleEmailConfirmInput(): void {
    emailMatchError =
      emailConfirm !== '' && !emailMatch ? ERROR_MESSAGES.emailMismatch : null;
  }

  const MIN_STRENGTH_CHECK = 4;

  async function handlePasswordInput(): Promise<void> {
    if (password.length < MIN_STRENGTH_CHECK) {
      passwordStrength = null;
      return;
    }

    strengthLoading = true;
    try {
      const userInputs = [email, firstName, lastName, companyName].filter(
        Boolean,
      );
      passwordStrength = await analyzePassword(password, userInputs);
    } catch {
      // Ignore strength check errors
    } finally {
      strengthLoading = false;
    }
  }

  function handlePasswordConfirmInput(): void {
    passwordMatchError =
      passwordConfirm !== '' && !passwordMatch ?
        ERROR_MESSAGES.passwordMismatch
      : null;
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

      showSuccess = true;

      setTimeout(() => {
        void goto(resolvePath('/login'));
      }, SUCCESS_REDIRECT_DELAY);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : ERROR_MESSAGES.unknownError;
      showErrorAlert(message);
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Registrieren - Assixx</title>
</svelte:head>

<SignupNav />

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
        Wissensmanagement, Kommunikation und Kollaboration — von der Produktion
        bis zur Verwaltung.
      </p>
    </div>
  </div>

  <!-- Right: Form -->
  <div class="signup-form-side">
    <div class="signup-card">
      <h2 class="signup-title">Konto erstellen</h2>
      <p class="signup-subtitle">
        14 Tage kostenlos testen — keine Kreditkarte nötig
      </p>

      <!-- Success Message -->
      {#if showSuccess}
        <div
          class="toast toast--success"
          role="alert"
        >
          <div class="toast__icon">
            <i class="fas fa-check-circle"></i>
          </div>
          <div class="toast__content">
            <div class="toast__title">Erfolgreich registriert!</div>
            <div class="toast__message">
              Sie werden in 5 Sekunden zur Anmeldung weitergeleitet...
            </div>
          </div>
          <div class="toast__progress">
            <div
              class="toast__progress-bar"
              style="animation-duration: 5s"
            ></div>
          </div>
        </div>
      {/if}

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
            required
            placeholder="Ihre Firma GmbH"
            autocomplete="organization"
            bind:value={companyName}
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
              required
              autocomplete="given-name"
              bind:value={firstName}
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
              required
              autocomplete="family-name"
              bind:value={lastName}
              disabled={loading}
            />
          </div>
        </div>

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

        <CountryPhoneInput
          bind:phone
          bind:countryCode
          disabled={loading}
        />

        <div class="section-divider"></div>

        <!-- Password -->
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
                Min. 12 Zeichen, max. 72 Zeichen. Enthält 3 von 4:
                Großbuchstaben, Kleinbuchstaben, Zahlen, Sonderzeichen
                (!@#$%^&*)
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

        {#if passwordStrength !== null || strengthLoading}
          <PasswordStrengthIndicator
            score={passwordStrength?.score ?? -1}
            label={passwordStrength?.label ?? ''}
            crackTime={passwordStrength?.crackTime ?? ''}
            loading={strengthLoading}
            feedback={passwordStrength?.feedback ?? null}
          />
        {/if}

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
              <i class="fas {showPasswordConfirm ? 'fa-eye-slash' : 'fa-eye'}"
              ></i>
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
              href={resolvePath('/TERMS-OF-USE.md')}
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

        <p class="login-link-text">
          Bereits registriert?
          <a
            href={resolvePath('/login')}
            class="login-link">Anmelden</a
          >
        </p>
      </form>
    </div>
  </div>
</div>

<style>
  /* =========================================================================
   * SPLIT LAYOUT — GitHub-style: hero left, form right
   * ========================================================================= */

  .signup-page {
    display: grid;
    grid-template-columns: 1fr 1fr;
    height: 100vh;
    overflow: hidden;
  }

  /* --- Left: Hero with background image --- */
  .signup-hero {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
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
    text-shadow: 0 2px 8px
      color-mix(in oklch, var(--color-black) 30%, transparent);
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
    padding: 75px 255px;
    overflow-y: auto;
  }

  .signup-card {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 520px;
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

  .name-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .section-divider {
    margin: 0;
    border-top: 1px solid
      color-mix(in oklch, var(--color-white) 8%, transparent);
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
  :global(html:not(.dark)) .signup-hero__overlay {
    background: linear-gradient(
      135deg,
      color-mix(in oklch, var(--color-black) 40%, transparent) 0%,
      color-mix(in oklch, var(--color-black) 20%, transparent) 100%
    );
  }

  :global(html:not(.dark)) .section-divider {
    border-color: color-mix(in oklch, var(--color-black) 10%, transparent);
  }

  /* --- Responsive: stack on narrow screens --- */
  @media (width < 900px) {
    .signup-page {
      grid-template-columns: 1fr;
    }

    .signup-hero {
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
    .name-row {
      grid-template-columns: 1fr;
    }

    .signup-card {
      max-width: 100%;
    }
  }
</style>
