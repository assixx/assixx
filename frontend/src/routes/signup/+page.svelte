<script lang="ts">
  import { onMount } from 'svelte';

  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';

  /** Resolve path with base prefix (for dynamic runtime paths) */
  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
  }

  import PasswordStrengthIndicator from '$lib/components/PasswordStrengthIndicator.svelte';
  import {
    isDark,
    forceDark,
    restoreUserTheme,
  } from '$lib/stores/theme.svelte';
  import {
    showWarningAlert,
    showErrorAlert,
    showInfoAlert,
  } from '$lib/stores/toast';
  import {
    analyzePassword,
    type PasswordStrengthResult,
  } from '$lib/utils/password-strength';

  // Local modules
  import { registerUser, createRegisterPayload } from './_lib/api';
  import {
    COUNTRIES,
    PLANS,
    DEFAULT_COUNTRY,
    DEFAULT_PLAN,
    SUCCESS_REDIRECT_DELAY,
    ERROR_MESSAGES,
    HELP_MESSAGE,
  } from './_lib/constants';
  import {
    isSubdomainValid,
    isEmailValid,
    emailsMatch,
    passwordsMatch,
    isPhoneValid,
    isPasswordValid,
  } from './_lib/validators';

  import type { Country, Plan } from './_lib/types';

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
  let selectedFlag = $state(DEFAULT_COUNTRY.flag);

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
  let selectedPlanName = $state(DEFAULT_PLAN.name);

  // UI State
  let termsAccepted = $state(false);
  let loading = $state(false);
  let showSuccess = $state(false);
  let countryDropdownOpen = $state(false);
  let planDropdownOpen = $state(false);

  // Error messages
  let subdomainError: string | null = $state(null);
  let emailMatchError: string | null = $state(null);
  let phoneError: string | null = $state(null);
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

  function handleSubdomainInput(e: Event): void {
    const target = e.target as HTMLInputElement;
    subdomain = target.value.toLowerCase();
    subdomainError =
      subdomain !== '' && !subdomainValid ?
        ERROR_MESSAGES.subdomainInvalid
      : null;
  }

  function handleEmailConfirmInput(): void {
    emailMatchError =
      emailConfirm !== '' && !emailMatch ? ERROR_MESSAGES.emailMismatch : null;
  }

  function handlePhoneInput(): void {
    phoneError =
      phone !== '' && !phoneValid ? ERROR_MESSAGES.phoneInvalid : null;
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

  function selectCountry(country: Country): void {
    selectedFlag = country.flag;
    countryCode = country.code;
    countryDropdownOpen = false;
  }

  function selectPlanOption(plan: Plan): void {
    selectedPlan = plan.value;
    selectedPlanName = plan.name;
    planDropdownOpen = false;
  }

  function toggleCountryDropdown(): void {
    countryDropdownOpen = !countryDropdownOpen;
    planDropdownOpen = false;
  }

  function togglePlanDropdown(): void {
    planDropdownOpen = !planDropdownOpen;
    countryDropdownOpen = false;
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
        selectedPlan,
      });

      await registerUser(payload);

      showSuccess = true;

      setTimeout(() => {
        void goto(resolvePath('/login'));
      }, SUCCESS_REDIRECT_DELAY);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : ERROR_MESSAGES.unknownError;
      showErrorAlert(message);
    } finally {
      loading = false;
    }
  }

  function showHelp(): void {
    showInfoAlert(HELP_MESSAGE, 10000);
  }

  // Capture-phase click-outside: bypasses stopPropagation
  $effect(() => {
    function handler(event: MouseEvent): void {
      if (!(event.target instanceof HTMLElement)) return;
      if (!event.target.closest('.custom-country-select')) {
        countryDropdownOpen = false;
      }
      if (!event.target.closest('.custom-plan-select')) {
        planDropdownOpen = false;
      }
    }
    document.addEventListener('click', handler, true);
    return () => {
      document.removeEventListener('click', handler, true);
    };
  });
</script>

<svelte:head>
  <title>Registrieren - Assixx</title>
</svelte:head>

<!-- Back to Homepage Button -->
<a
  href={resolvePath('/')}
  class="back-button"
>
  <span class="icon">←</span>
  <span>Zurück zur Hauptseite</span>
</a>

<!-- Help Button -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="help-button"
  onclick={showHelp}
>
  ?
</div>

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

      <div class="form-field">
        <label
          class="form-field__label form-field__label--required"
          for="subdomain">Subdomain</label
        >
        <div class="subdomain-input-group">
          <input
            type="text"
            id="subdomain"
            name="subdomain"
            class="subdomain-input"
            required
            pattern="[a-z0-9\-]+"
            placeholder="ihre-firma"
            value={subdomain}
            oninput={handleSubdomainInput}
            disabled={loading}
          />
          <span class="subdomain-suffix">.assixx.com</span>
        </div>
        {#if subdomainError}
          <p class="form-field__message">{subdomainError}</p>
        {/if}
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

      <div class="form-field">
        <label
          class="form-field__label form-field__label--required"
          for="phone">Telefon</label
        >
        <div class="phone-input-group">
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="custom-country-select">
            <div
              class="country-display"
              class:active={countryDropdownOpen}
              onclick={toggleCountryDropdown}
            >
              <span id="selectedFlag">{selectedFlag}</span>
              <span id="selectedCode">{countryCode}</span>
              <svg
                width="10"
                height="6"
                viewBox="0 0 10 6"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M1 1L5 5L9 1"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                />
              </svg>
            </div>
            <div
              class="country-dropdown"
              class:active={countryDropdownOpen}
            >
              {#each COUNTRIES as country (country.code)}
                <div
                  class="country-option"
                  onclick={() => {
                    selectCountry(country);
                  }}
                >
                  {country.flag}
                  {country.code}
                </div>
              {/each}
            </div>
          </div>
          <input
            type="tel"
            id="phone"
            name="phone"
            class="form-field__control phone-number"
            class:is-error={phoneError}
            placeholder="123 456789"
            autocomplete="tel-national"
            required
            bind:value={phone}
            oninput={handlePhoneInput}
            disabled={loading}
          />
        </div>
        {#if phoneError}
          <p class="form-field__message form-field__message--error">
            {phoneError}
          </p>
        {/if}
      </div>

      <!-- Dritte Zeile -->
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

      <div class="form-field">
        <label
          class="form-field__label"
          for="planValue">Plan</label
        >
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="custom-plan-select">
          <div
            class="plan-display"
            class:active={planDropdownOpen}
            onclick={togglePlanDropdown}
          >
            <span id="selectedPlan">{selectedPlanName}</span>
            <svg
              width="10"
              height="6"
              viewBox="0 0 10 6"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M1 1L5 5L9 1"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg>
          </div>
          <div
            class="plan-dropdown"
            class:active={planDropdownOpen}
          >
            {#each PLANS as plan (plan.value)}
              <div
                class="plan-option"
                onclick={() => {
                  selectPlanOption(plan);
                }}
              >
                <span>{plan.name}</span>
                <span class="plan-price">{plan.price}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>

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
  /* Emoji Font Support */
  :global(.country-option),
  :global(#selectedFlag) {
    font-family:
      Outfit,
      'Noto Color Emoji',
      'Apple Color Emoji',
      'Segoe UI Emoji',
      'Segoe UI Symbol',
      -apple-system,
      BlinkMacSystemFont,
      'Segoe UI',
      Roboto,
      Arial,
      sans-serif;
  }

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
    border-bottom: 1px solid rgb(255 255 255 / 10%);
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

  /* Subdomain Input Group */
  .subdomain-input-group {
    display: flex;
    align-items: stretch;
  }

  .subdomain-input {
    flex: 1;
    backdrop-filter: var(--glass-form-backdrop);
    transition:
      var(--form-field-transition), var(--form-field-transition-shadow);
    border: var(--form-field-border);
    border-right: none;
    border-radius: var(--form-field-radius) 0 0 var(--form-field-radius);
    background: var(--form-field-bg);
    padding: var(--form-field-padding-y) var(--form-field-padding-x);
    min-height: 44px;
    color: var(--form-field-text);
    font-size: var(--form-field-font-size);
    line-height: 1.5;
  }

  .subdomain-input:hover {
    border: var(--form-field-border-hover);
    border-right: none;
    background: var(--form-field-bg-hover);
  }

  .subdomain-input:focus {
    outline: none;
    box-shadow: var(--form-field-focus-ring);
    border: var(--form-field-border-focus);
    border-right: none;
    background: var(--form-field-bg-focus);
  }

  .subdomain-suffix {
    display: flex;
    justify-content: center;
    align-items: center;
    backdrop-filter: blur(5px);
    transition: all 0.2s ease;
    border: 1px solid rgb(255 255 255 / 12%);
    border-left: none;
    border-radius: 0 var(--form-field-radius) var(--form-field-radius) 0;
    background: rgb(255 255 255 / 8%);
    padding: 0 16px;
    color: var(--text-secondary);
    font-size: 14px;
    white-space: nowrap;
  }

  .subdomain-input:focus + .subdomain-suffix {
    border-color: var(--primary-color);
    background: rgb(255 255 255 / 12%);
  }

  /* Phone Input Group */
  .phone-input-group {
    display: flex;
    gap: 8px;
  }

  .custom-country-select {
    position: relative;
    width: 85px;
  }

  .country-display {
    display: flex;
    align-items: center;
    gap: 4px;
    backdrop-filter: var(--glass-form-backdrop);
    transition:
      var(--form-field-transition), var(--form-field-transition-shadow);
    cursor: pointer;
    border: var(--form-field-border);
    border-radius: var(--form-field-radius);
    background: var(--form-field-bg);
    padding: var(--form-field-padding-y) var(--form-field-padding-x);
    min-height: 44px;
    color: var(--form-field-text);
    font-size: var(--form-field-font-size);
  }

  .country-display:hover {
    border: var(--form-field-border-hover);
    background: var(--form-field-bg-hover);
  }

  .country-display svg {
    opacity: 60%;
    margin-left: auto;
  }

  .country-display.active svg {
    transform: rotate(180deg);
  }

  .country-dropdown {
    position: absolute;
    top: calc(100% + 5px);
    right: 0;
    left: 0;
    transform: translateY(-10px);
    visibility: hidden;
    opacity: 0%;
    z-index: 1000;
    backdrop-filter: blur(20px) saturate(180%);
    box-shadow: var(--shadow-sm);
    border: 1px solid hsl(0deg 0% 100% / 10%);
    border-radius: var(--radius-xl);
    background: rgb(18 18 18 / 100%);
    max-height: 200px;
    overflow-y: auto;
  }

  .country-dropdown.active {
    transform: translateY(0);
    visibility: visible;
    opacity: 100%;
  }

  .country-option {
    cursor: pointer;
    border-bottom: 1px solid rgb(255 255 255 / 5%);
    padding: 10px 12px;
    color: var(--text-primary);
    font-size: 13px;
  }

  .country-option:last-child {
    border-bottom: none;
  }

  .country-option:hover {
    background: rgb(33 150 243 / 20%);
    padding-left: 16px;
    color: #fff;
  }

  .country-option:active {
    background: rgb(33 150 243 / 30%);
  }

  /* Scrollbar für Dropdown */
  .country-dropdown::-webkit-scrollbar {
    width: 4px;
  }

  .country-dropdown::-webkit-scrollbar-track {
    background: rgb(255 255 255 / 5%);
  }

  .country-dropdown::-webkit-scrollbar-thumb {
    border-radius: 2px;
    background: rgb(255 255 255 / 20%);
  }

  .country-dropdown::-webkit-scrollbar-thumb:hover {
    background: rgb(255 255 255 / 30%);
  }

  .phone-input-group .phone-number {
    flex: 1;
  }

  /* Custom Plan Select */
  .custom-plan-select {
    position: relative;
    width: 100%;
  }

  .plan-display {
    display: flex;
    justify-content: space-between;
    align-items: center;
    backdrop-filter: var(--glass-form-backdrop);
    transition:
      var(--form-field-transition), var(--form-field-transition-shadow);
    cursor: pointer;
    border: var(--form-field-border);
    border-radius: var(--form-field-radius);
    background: var(--form-field-bg);
    padding: var(--form-field-padding-y) var(--form-field-padding-x);
    min-height: 44px;
    color: var(--form-field-text);
    font-size: var(--form-field-font-size);
  }

  .plan-display:hover {
    border: var(--form-field-border-hover);
    background: var(--form-field-bg-hover);
  }

  .plan-display svg {
    opacity: 60%;
  }

  .plan-display.active svg {
    transform: rotate(180deg);
  }

  .plan-dropdown {
    position: absolute;
    top: calc(100% + 5px);
    right: 0;
    left: 0;
    transform: translateY(-10px);
    visibility: hidden;
    opacity: 0%;
    z-index: 1000;
    backdrop-filter: blur(20px) saturate(180%);
    box-shadow: var(--shadow-sm);
    border: 1px solid hsl(0deg 0% 100% / 10%);
    border-radius: var(--radius-xl);
    background: rgb(18 18 18 / 100%);
  }

  .plan-dropdown.active {
    transform: translateY(0);
    visibility: visible;
    opacity: 100%;
  }

  .plan-option {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    border-bottom: 1px solid rgb(255 255 255 / 5%);
    padding: 10px 16px;
    color: var(--text-primary);
    font-size: 14px;
  }

  .plan-option:last-child {
    border-bottom: none;
  }

  .plan-option:hover {
    background: rgb(33 150 243 / 20%);
    padding-left: 20px;
    color: #fff;
  }

  .plan-option:active {
    background: rgb(33 150 243 / 30%);
  }

  .plan-price {
    color: var(--primary-color);
    font-weight: 500;
    font-size: 12px;
  }

  .plan-option:hover .plan-price {
    color: #fff;
  }

  /* Bottom Section */
  .bottom-section {
    display: flex;
    grid-column: 1 / -1;
    justify-content: space-between;
    align-items: center;
    gap: 24px;
    margin-top: 20px;
    border-top: 1px solid rgb(255 255 255 / 10%);
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

  /* Help Button */
  .help-button {
    display: flex;
    position: fixed;
    top: 20px;
    right: 20px;
    justify-content: center;
    align-items: center;
    z-index: 100;
    backdrop-filter: blur(10px);
    cursor: pointer;
    box-shadow:
      0 4px 12px rgb(0 0 0 / 20%),
      inset 0 1px 0 rgb(255 255 255 / 10%);
    border: 1px solid hsl(0deg 0% 100% / 10%);
    border-radius: 50%;
    background: rgb(255 255 255 / 8%);
    width: 36px;
    height: 36px;
    color: var(--text-secondary);
    font-size: 19px;
  }

  .help-button:hover {
    transform: scale(1.1);
    box-shadow:
      0 6px 16px rgb(33 150 243 / 30%),
      inset 0 1px 0 rgb(255 255 255 / 10%);
    border-color: var(--primary-color);
    background: rgb(33 150 243 / 15%);
    color: var(--primary-color);
  }

  /* Back Button */
  .back-button {
    display: flex;
    position: fixed;
    top: 20px;
    left: 20px;
    align-items: center;
    gap: 10px;
    z-index: 1001;
    backdrop-filter: blur(20px) saturate(180%);
    box-shadow:
      0 4px 16px rgb(0 0 0 / 20%),
      inset 0 1px 0 rgb(255 255 255 / 5%);
    border: 1px solid rgb(255 255 255 / 10%);
    border-radius: 12px;
    background: rgb(255 255 255 / 2%);
    padding: 10px 20px;
    color: var(--text-secondary);
    font-weight: 500;
    font-size: 14px;
    text-decoration: none;
  }

  .back-button:hover {
    transform: translateX(-5px);
    box-shadow:
      0 6px 24px rgb(0 0 0 / 30%),
      inset 0 1px 0 rgb(255 255 255 / 10%);
    border-color: rgb(255 255 255 / 15%);
    background: rgb(255 255 255 / 5%);
    color: var(--text-primary);
  }

  .back-button:active {
    transform: translateX(-3px) scale(0.98);
  }

  .back-button .icon {
    font-size: 18px;
  }

  .back-button:hover .icon {
    transform: translateX(-3px);
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
