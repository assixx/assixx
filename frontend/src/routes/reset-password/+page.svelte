<script lang="ts">
  import { enhance } from '$app/forms';
  import { resolve } from '$app/paths';

  import Seo from '$lib/components/Seo.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import { isDark } from '$lib/stores/theme.svelte';

  import type { ActionData, PageData } from './$types';

  const { data, form }: { data: PageData; form: ActionData } = $props();

  let password = $state('');
  let confirmPassword = $state('');
  let loading = $state(false);
  let showPassword = $state(false);

  const hasToken = $derived(data.token !== '');
  const hasUpperCase = $derived(/[A-Z]/.test(password));
  const hasLowerCase = $derived(/[a-z]/.test(password));
  const hasNumber = $derived(/\d/.test(password));
  const hasSpecial = $derived(/[!@#$%^&*(),.?":{}|<>]/.test(password));
  const categoryCount = $derived(
    [hasUpperCase, hasLowerCase, hasNumber, hasSpecial].filter(Boolean).length,
  );
  const isLongEnough = $derived(password.length >= 12);
  const isNotTooLong = $derived(password.length <= 72);
  const hasEnoughCategories = $derived(categoryCount >= 3);
  const passwordsMatch = $derived(password === confirmPassword && confirmPassword !== '');
  const isFormValid = $derived(
    isLongEnough && isNotTooLong && hasEnoughCategories && passwordsMatch && hasToken,
  );

  const strengthPercent = $derived.by(() => {
    let score = 0;
    if (password.length >= 8) score += 20;
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 10;
    if (hasUpperCase) score += 15;
    if (hasLowerCase) score += 15;
    if (hasNumber) score += 15;
    if (hasSpecial) score += 15;
    return Math.min(score, 100);
  });

  const strengthLabel = $derived.by(() => {
    if (strengthPercent < 40) return 'Schwach';
    if (strengthPercent < 70) return 'Mittel';
    if (strengthPercent < 90) return 'Stark';
    return 'Sehr stark';
  });

  const strengthColor = $derived.by(() => {
    if (strengthPercent < 40) return 'var(--color-danger)';
    if (strengthPercent < 70) return 'var(--color-warning)';
    return 'var(--color-success)';
  });
</script>

<Seo
  title="Passwort zurücksetzen - Assixx"
  description="Setzen Sie Ihr neues Assixx-Passwort."
/>

<a
  href={resolve('/login')}
  class="back-button"
>
  <span class="icon">←</span>
  <span>Zurück zum Login</span>
</a>

<div class="top-actions">
  <ThemeToggle />
</div>

<main class="page-container">
  <div class="card form-card">
    <div class="card-logo">
      <picture>
        <source
          srcset={isDark() ? '/images/logo_darkmode.webp' : '/images/logo_lightmode.webp'}
          type="image/webp"
        />
        <img
          src={isDark() ? '/images/logo_darkmode.png' : '/images/logo_lightmode.png'}
          alt="Assixx Logo"
          class="logo"
          width="120"
          height="58"
        />
      </picture>
    </div>

    {#if !hasToken}
      <div class="error-state">
        <h1>Ungültiger Link</h1>
        <p>Dieser Reset-Link ist ungültig. Bitte fordern Sie einen neuen an.</p>
        <a
          href={resolve('/forgot-password')}
          class="btn btn-index">Neuen Link anfordern</a
        >
      </div>
    {:else if form?.success}
      <div class="success-state">
        <div class="success-icon">✓</div>
        <h1>Passwort geändert</h1>
        <p>Ihr Passwort wurde erfolgreich zurückgesetzt. Sie können sich jetzt anmelden.</p>
        <a
          href={resolve('/login')}
          class="btn btn-index">Zum Login</a
        >
      </div>
    {:else}
      <h1>Neues Passwort</h1>
      <p class="subtitle">Legen Sie ein neues Passwort für Ihr Konto fest.</p>

      {#if form?.error}
        <div class="toast toast--error">
          <div class="toast__content">
            <div class="toast__message">{form.error}</div>
          </div>
        </div>
      {/if}

      <form
        method="POST"
        use:enhance={() => {
          loading = true;
          return async ({ update }) => {
            loading = false;
            await update();
          };
        }}
      >
        <input
          type="hidden"
          name="token"
          value={data.token}
        />

        <div class="form-field">
          <label
            class="form-field__label form-field__label--required"
            for="password"
          >
            Neues Passwort
          </label>
          <div class="password-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              name="password"
              class="form-field__control"
              required
              autocomplete="new-password"
              minlength={12}
              maxlength={72}
              bind:value={password}
              disabled={loading}
            />
            <button
              type="button"
              class="toggle-visibility"
              onclick={() => (showPassword = !showPassword)}
              aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
            >
              {showPassword ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        {#if password.length > 0}
          <div class="strength-meter">
            <div class="strength-bar">
              <div
                class="strength-fill"
                style="width: {strengthPercent}%; background: {strengthColor}"
              ></div>
            </div>
            <span
              class="strength-label"
              style="color: {strengthColor}">{strengthLabel}</span
            >
          </div>

          <ul class="requirements">
            <li class:met={isLongEnough}>Min. 12 Zeichen</li>
            <li class:met={hasUpperCase}>Großbuchstabe (A-Z)</li>
            <li class:met={hasLowerCase}>Kleinbuchstabe (a-z)</li>
            <li class:met={hasNumber}>Zahl (0-9)</li>
            <li class:met={hasSpecial}>Sonderzeichen (!@#$...)</li>
            <li class:met={hasEnoughCategories}>Mind. 3 von 4 Kategorien</li>
          </ul>
        {/if}

        <div class="form-field">
          <label
            class="form-field__label form-field__label--required"
            for="confirmPassword"
          >
            Passwort bestätigen
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            id="confirmPassword"
            class="form-field__control"
            required
            autocomplete="new-password"
            bind:value={confirmPassword}
            disabled={loading}
          />
        </div>

        {#if confirmPassword !== '' && !passwordsMatch}
          <p class="mismatch-hint">Passwörter stimmen nicht überein</p>
        {/if}

        <div class="mt-6 flex justify-end">
          <button
            type="submit"
            class="btn btn-index"
            disabled={loading || !isFormValid}
          >
            {#if loading}
              <span class="spinner-ring spinner-ring--sm"></span>
            {/if}
            {loading ? 'Wird gespeichert...' : 'Passwort speichern'}
          </button>
        </div>
      </form>
    {/if}
  </div>

  <div class="company-footer">
    <p class="text-secondary">&copy; 2026 Assixx - Powered by Simon Öztürks Computer Service</p>
  </div>
</main>

<style>
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
  }

  .back-button .icon {
    transition: transform 0.3s ease;
    font-size: 18px;
  }

  .back-button:hover .icon {
    transform: translateX(-3px);
  }

  .top-actions {
    display: flex;
    position: fixed;
    top: 20px;
    right: 20px;
    align-items: center;
    gap: 12px;
    z-index: 100;
  }

  .page-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: var(--spacing-6);
    min-height: 85vh;
  }

  .card-logo {
    display: flex;
    justify-content: center;
  }

  .logo {
    display: block;
    width: 120px;
    height: auto;
  }

  .form-card {
    padding: var(--spacing-8);
    width: 100%;
    max-width: 450px;
  }

  h1 {
    margin: var(--spacing-4) 0 var(--spacing-2);
    text-align: center;
    font-size: 1.5rem;
  }

  .subtitle {
    margin-bottom: var(--spacing-6);
    color: var(--color-text-secondary);
    text-align: center;
    font-size: 0.9rem;
  }

  /* Password field */
  .password-wrapper {
    position: relative;
  }

  .toggle-visibility {
    position: absolute;
    top: 50%;
    right: 12px;
    transform: translateY(-50%);
    cursor: pointer;
    border: none;
    background: none;
    padding: 4px;
    font-size: 18px;
  }

  /* Strength meter */
  .strength-meter {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 8px 0 16px;
  }

  .strength-bar {
    flex: 1;
    border-radius: 4px;
    background: var(--color-bg-tertiary, #e2e8f0);
    height: 6px;
    overflow: hidden;
  }

  .strength-fill {
    transition:
      width 0.3s ease,
      background 0.3s ease;
    border-radius: 4px;
    height: 100%;
  }

  .strength-label {
    font-size: 0.8rem;
    font-weight: 600;
    white-space: nowrap;
  }

  /* Requirements checklist */
  .requirements {
    margin: 0 0 var(--spacing-4);
    padding: 0;
    list-style: none;
    font-size: 0.85rem;
  }

  .requirements li {
    padding: 2px 0 2px 24px;
    color: var(--color-text-tertiary);
  }

  .requirements li::before {
    content: '○';
    display: inline-block;
    margin-left: -24px;
    width: 24px;
    color: var(--color-text-tertiary);
  }

  .requirements li.met {
    color: var(--color-success);
  }

  .requirements li.met::before {
    content: '●';
    color: var(--color-success);
  }

  .mismatch-hint {
    margin: 4px 0 0;
    color: var(--color-danger);
    font-size: 0.85rem;
  }

  /* States */
  .success-state,
  .error-state {
    text-align: center;
  }

  .success-icon {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    margin: var(--spacing-4) 0;
    border-radius: 50%;
    background: var(--color-success);
    width: 56px;
    height: 56px;
    color: var(--color-white);
    font-size: 28px;
    font-weight: 700;
  }

  .success-state p,
  .error-state p {
    margin-bottom: var(--spacing-6);
    color: var(--color-text-secondary);
    line-height: 1.6;
  }

  .company-footer {
    margin-top: var(--spacing-8);
    text-align: center;
  }

  @media (width < 768px) {
    .form-card {
      padding: var(--spacing-6);
    }
  }
</style>
