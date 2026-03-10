<script lang="ts">
  import { onMount } from 'svelte';

  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';

  import PasswordStrengthIndicator from '$lib/components/PasswordStrengthIndicator.svelte';
  import {
    isDark,
    forceDark,
    restoreUserTheme,
  } from '$lib/stores/theme.svelte';
  import { showWarningAlert, showErrorAlert } from '$lib/stores/toast';
  import {
    analyzePassword,
    type PasswordStrengthResult,
  } from '$lib/utils/password-strength';

  // Local modules
  import { registerUser, createRegisterPayload } from './_lib/api';
  import {
    DEFAULT_COUNTRY,
    DEFAULT_ADDRESS_COUNTRY,
    DEFAULT_PLAN,
    SUCCESS_REDIRECT_DELAY,
    ERROR_MESSAGES,
  } from './_lib/constants';
  import CountryAddressSelect from './_lib/CountryAddressSelect.svelte';
  import CountryPhoneInput from './_lib/CountryPhoneInput.svelte';
  import PlanSelect from './_lib/PlanSelect.svelte';
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

  /** Resolve path with base prefix (for dynamic runtime paths) */
  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
  }

  // =============================================================================
  // SVELTE 5 RUNES - Form State
  // =============================================================================

  // Company & Subdomain
  let companyName = $state('');
  let subdomain = $state('');

  // Email
  let email = $state('');
  let emailConfirm = $state('');

  // Personal Info
  let firstName = $state('');
  let lastName = $state('');
  let phone = $state('');
  let countryCode = $state(DEFAULT_COUNTRY.code);

  // Address
  let street = $state('');
  let houseNumber = $state('');
  let postalCode = $state('');
  let city = $state('');
  let addressCountryCode = $state(DEFAULT_ADDRESS_COUNTRY.iso);

  // Password
  let password = $state('');
  let passwordConfirm = $state('');
  let showPassword = $state(false);
  let showPasswordConfirm = $state(false);

  // Password Strength
  let passwordStrength = $state<PasswordStrengthResult | null>(null);
  let strengthLoading = $state(false);

  // Plan
  let selectedPlan = $state(DEFAULT_PLAN.value);

  // UI State
  let termsAccepted = $state(false);
  let loading = $state(false);
  let showSuccess = $state(false);

  // Error messages
  let emailMatchError: string | null = $state(null);
  let passwordMatchError: string | null = $state(null);

  // =============================================================================
  // SVELTE 5 RUNES - Derived Values
  // =============================================================================

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
      street !== '' &&
      houseNumber !== '' &&
      postalCode !== '' &&
      city !== '' &&
      isPasswordValid(password) &&
      passwordConfirm !== '' &&
      passwordMatch &&
      termsAccepted,
  );

  const buttonText = $derived(
    loading ? '⏳ Wird erstellt...' : 'Jetzt registrieren →',
  );

  // =============================================================================
  // LIFECYCLE - Always-dark page
  // =============================================================================

  onMount(() => {
    forceDark();
    return () => {
      restoreUserTheme();
    };
  });

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  function handleEmailConfirmInput(): void {
    emailMatchError =
      emailConfirm !== '' && !emailMatch ? ERROR_MESSAGES.emailMismatch : null;
  }

  /** Minimum characters before running zxcvbn analysis */
  const MIN_STRENGTH_CHECK = 4;

  async function checkPassword(): Promise<void> {
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

  async function handlePasswordInput(): Promise<void> {
    await checkPassword();
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
        street,
        houseNumber,
        postalCode,
        city,
        addressCountryCode,
        password,
        selectedPlan,
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

<div class="page-container page-container--centered">
  <!-- Header -->
  <div class="signup-header">
    <div class="header-left">
      <img
        src={isDark() ?
          '/images/logo_darkmode.png'
        : '/images/logo_lightmode.png'}
        alt="Assixx Logo"
        class="signup-logo"
      />
    </div>
  </div>

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
    <div class="form-grid">
      <!-- Erste Zeile -->
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

      <!-- Zweite Zeile -->
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
          placeholder=""
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
          placeholder=""
          autocomplete="family-name"
          bind:value={lastName}
          disabled={loading}
        />
      </div>

      <CountryPhoneInput
        bind:phone
        bind:countryCode
        disabled={loading}
      />

      <!-- Adresse -->
      <div class="form-field">
        <label
          class="form-field__label form-field__label--required"
          for="street">Straße</label
        >
        <input
          type="text"
          id="street"
          name="street"
          class="form-field__control"
          required
          placeholder="Musterstraße"
          autocomplete="address-line1"
          bind:value={street}
          disabled={loading}
        />
      </div>

      <div class="form-field">
        <label
          class="form-field__label form-field__label--required"
          for="house_number">Hausnummer</label
        >
        <input
          type="text"
          id="house_number"
          name="house_number"
          class="form-field__control"
          required
          placeholder="42"
          autocomplete="address-line2"
          bind:value={houseNumber}
          disabled={loading}
        />
      </div>

      <div class="form-field">
        <label
          class="form-field__label form-field__label--required"
          for="postal_code">PLZ</label
        >
        <input
          type="text"
          id="postal_code"
          name="postal_code"
          class="form-field__control"
          required
          placeholder="10115"
          autocomplete="postal-code"
          bind:value={postalCode}
          disabled={loading}
        />
      </div>

      <div class="form-field">
        <label
          class="form-field__label form-field__label--required"
          for="city">Stadt</label
        >
        <input
          type="text"
          id="city"
          name="city"
          class="form-field__control"
          required
          placeholder="Berlin"
          autocomplete="address-level2"
          bind:value={city}
          disabled={loading}
        />
      </div>

      <CountryAddressSelect
        bind:countryCode={addressCountryCode}
        disabled={loading}
      />

      <!-- Passwort -->
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

      <!-- Password Strength Indicator -->
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
            placeholder=""
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

      <PlanSelect bind:selectedPlan />

      <!-- Terms und Submit -->
      <div class="bottom-section">
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
          class="btn btn-index"
          disabled={loading || !isFormValid}
        >
          {buttonText}
        </button>
        <a
          href={resolvePath('/login')}
          class="login-link">Bereits registriert?</a
        >
      </div>
    </div>
  </form>
</div>

<style>
  /* Scoped to signup page only */
  :global(body:has(#signupForm)) {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 10px;
  }

  /* Header */
  .signup-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    border-bottom: 1px solid
      color-mix(in oklch, var(--color-white) 10%, transparent);
    padding-bottom: 20px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .signup-logo {
    height: 48px;
  }

  /* Form Grid - 3 columns */
  .form-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px 20px;
    margin-bottom: 20px;
  }

  /* Bottom Section */
  .bottom-section {
    display: flex;
    grid-column: 1 / -1;
    justify-content: space-between;
    align-items: center;
    gap: 24px;
    margin-top: 20px;
    border-top: 1px solid
      color-mix(in oklch, var(--color-white) 10%, transparent);
    padding-top: 20px;
  }

  .terms-checkbox {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 8px;
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

  .login-link {
    color: var(--primary-color);
    font-size: 13px;
    text-decoration: none;
    white-space: nowrap;
  }

  .login-link:hover {
    text-decoration: underline;
  }

  /* Responsive */
  @media (width >= 768px) and (width < 1024px) {
    .form-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (width < 768px) {
    .signup-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    .form-grid {
      grid-template-columns: 1fr;
      gap: 10px;
    }

    .bottom-section {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }
  }
</style>
