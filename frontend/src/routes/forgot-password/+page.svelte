<script lang="ts">
  import { enhance } from '$app/forms';
  import { resolve } from '$app/paths';

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

    {#if form?.success}
      <div class="success-state">
        <div class="success-icon">✓</div>
        <h1>E-Mail gesendet</h1>
        <p>
          Falls ein Konto mit der Adresse <strong>{form.email}</strong> existiert, haben wir Ihnen einen
          Link zum Zurücksetzen gesendet.
        </p>
        <p class="hint">Prüfen Sie auch Ihren Spam-Ordner.</p>
        <a
          href={resolve('/login')}
          class="btn btn-index">Zurück zum Login</a
        >
      </div>
    {:else}
      <h1>Passwort vergessen?</h1>
      <p class="subtitle">
        Geben Sie Ihre E-Mail-Adresse ein. Wir senden Ihnen einen Link zum Zurücksetzen.
      </p>

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
        <div class="form-field">
          <label
            class="form-field__label form-field__label--required"
            for="email"
          >
            E-Mail-Adresse
          </label>
          <input
            type="email"
            id="email"
            name="email"
            class="form-field__control"
            required
            autocomplete="email"
            placeholder="ihre@email.de"
            bind:value={email}
            disabled={loading}
          />
        </div>

        <div class="mt-6 flex justify-end">
          <button
            type="submit"
            class="btn btn-index"
            disabled={loading || !isEmailValid}
          >
            {#if loading}
              <span class="spinner-ring spinner-ring--sm"></span>
            {/if}
            {loading ? 'Wird gesendet...' : 'Link senden'}
          </button>
        </div>
      </form>

      <div class="form-footer">
        <a href={resolve('/login')}>Zurück zum Login</a>
      </div>
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

  .success-state {
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

  .success-state p {
    margin-bottom: var(--spacing-4);
    color: var(--color-text-secondary);
    line-height: 1.6;
  }

  .hint {
    color: var(--color-text-tertiary);
    font-size: 0.85rem;
  }

  .form-footer {
    margin-top: var(--spacing-6);
    border-top: 1px solid var(--border-color);
    padding-top: var(--spacing-6);
    text-align: center;
  }

  .form-footer a {
    color: var(--primary-color);
    text-decoration: none;
  }

  .form-footer a:hover {
    text-decoration: underline;
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
