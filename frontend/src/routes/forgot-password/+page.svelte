<script lang="ts">
  import { enhance } from '$app/forms';
  import { resolve } from '$app/paths';

  import LegalFooter from '$lib/components/LegalFooter.svelte';
  import Seo from '$lib/components/Seo.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import { isDark } from '$lib/stores/theme.svelte';

  import type { ActionData } from './$types';

  const { form }: { form: ActionData } = $props();

  let email = $state('');
  let loading = $state(false);

  const isEmailValid = $derived(email.includes('@') && email.includes('.'));
</script>

<Seo
  title="Passwort vergessen - Assixx"
  description="Setzen Sie Ihr Assixx-Passwort zurück."
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

<div class="login-page">
  <main class="login-container">
    <div class="card login-card">
      <div class="login-card-logo">
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
      </div>

      {#if form?.success}
        <h1>E-Mail gesendet</h1>
        <p class="subtitle">
          Falls ein Konto mit <strong>{form.email}</strong> existiert, haben wir einen Link gesendet.
          Prüfen Sie auch Ihren Spam-Ordner.
        </p>
        <div class="success-actions">
          <a
            href={resolve('/login')}
            class="btn btn-index">Zurück zum Login</a
          >
        </div>
      {:else}
        <h1>Passwort zurücksetzen</h1>
        <p class="subtitle">E-Mail eingeben — wir senden Ihnen einen Link.</p>

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
          class="inline-form"
          use:enhance={() => {
            loading = true;
            return async ({ update }) => {
              loading = false;
              await update();
            };
          }}
        >
          <input
            type="email"
            name="email"
            class="form-field__control inline-form__input"
            required
            autocomplete="email"
            placeholder="ihre@email.de"
            aria-label="E-Mail-Adresse"
            bind:value={email}
            disabled={loading}
          />
          <button
            type="submit"
            class="btn btn-index inline-form__btn"
            disabled={loading || !isEmailValid}
          >
            {#if loading}
              <span class="spinner-ring spinner-ring--sm"></span>
            {/if}
            {loading ? 'Sende...' : 'Senden'}
          </button>
        </form>
      {/if}
    </div>
  </main>
  <LegalFooter compact />
</div>

<style>
  /* Back Button — identisch zu login */
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

  /* Top Right Actions — identisch zu login */
  .top-actions {
    display: flex;
    position: fixed;
    top: 20px;
    right: 20px;
    align-items: center;
    gap: 12px;
    z-index: 100;
  }

  /* Login Page Wrapper — identisch zu login */
  .login-page {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  /* Login Container — identisch zu login */
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

    width: 120px;
    height: auto;
  }

  .login-card {
    transform: translateY(-5vh);
    padding: var(--spacing-8);
    width: 100%;
    max-width: 450px;
  }

  /* Forgot-Password-spezifisch — Headline + inline form */
  h1 {
    margin: var(--spacing-4) 0 var(--spacing-2);
    text-align: center;
    font-size: 1.375rem;
  }

  .subtitle {
    margin-bottom: var(--spacing-5);
    color: var(--color-text-secondary);
    text-align: center;
    font-size: 0.875rem;
    line-height: 1.5;
  }

  .inline-form {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-3);
    align-items: stretch;
  }

  .inline-form__input {
    flex: 1 1 240px;
    min-width: 0;
  }

  .inline-form__btn {
    flex: 0 0 auto;
    white-space: nowrap;
  }

  .success-actions {
    display: flex;
    justify-content: center;
    margin-top: var(--spacing-4);
  }

  @media (width < 768px) {
    .login-card {
      padding: var(--spacing-6);
    }
  }
</style>
