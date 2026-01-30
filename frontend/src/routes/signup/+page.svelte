<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';

  /** Resolve path with base prefix (for dynamic runtime paths) */
  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
  }

  import {
    showWarningAlert,
    showErrorAlert,
    showInfoAlert,
  } from '$lib/stores/toast';

  // Page-specific CSS
  import '../../styles/signup.css';
  import '../../styles/password-strength.css';

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
    getPasswordStrengthScore,
    getPasswordStrengthLabel,
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
  const passwordStrengthScore = $derived(getPasswordStrengthScore(password));
  const passwordStrengthLabel = $derived(
    getPasswordStrengthLabel(passwordStrengthScore),
  );

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

  function handleClickOutside(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target.closest('.custom-country-select')) {
      countryDropdownOpen = false;
    }
    if (!target.closest('.custom-plan-select')) {
      planDropdownOpen = false;
    }
  }
</script>

<svelte:head>
  <title>Registrieren - Assixx</title>
</svelte:head>

<svelte:window onclick={handleClickOutside} />

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
        src="/images/logo.png"
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
            <i class="fas fa-info-circle cursor-help text-sm text-blue-400"></i>
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
      {#if password.length > 0}
        <div class="password-strength-container">
          <div class="password-strength-meter">
            <div
              class="password-strength-bar"
              data-score={passwordStrengthScore}
            ></div>
          </div>
          <div class="password-strength-info">
            <span class="password-strength-label">{passwordStrengthLabel}</span>
          </div>
        </div>
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
          class="btn btn-primary"
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
