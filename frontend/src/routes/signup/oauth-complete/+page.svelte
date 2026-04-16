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
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import { setActiveRole } from '$lib/utils/auth';
  import { splitDisplayName } from '$lib/utils/oauth';
  import { getTokenManager } from '$lib/utils/token-manager';

  import { DEFAULT_COUNTRY } from '../_lib/constants';
  import CountryPhoneInput from '../_lib/CountryPhoneInput.svelte';
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

<!-- Top-right theme toggle — matches login/signup page chrome. -->
<div class="top-actions">
  <ThemeToggle />
</div>

<div class="complete-page">
  <main class="complete-container">
    <div class="card complete-card">
      <h1 class="complete-title">Firmendaten abschließen</h1>
      <p class="complete-subtitle">
        Sie sind als <strong>{data.email}</strong> bei Microsoft angemeldet. Ergänzen Sie die fehlenden
        Angaben, um Ihr Assixx-Konto zu erstellen.
      </p>

      {#if form?.error}
        <div
          class="toast toast--error"
          role="alert"
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
              required
              autocomplete="given-name"
              bind:value={firstName}
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
            for="companyName">Firmenname</label
          >
          <input
            type="text"
            id="companyName"
            name="companyName"
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

        <div class="mt-6 flex justify-end">
          <button
            type="submit"
            class="btn btn-index"
            disabled={loading || !isFormValid}
          >
            {#if loading}
              <span class="spinner-ring spinner-ring--sm"></span>
            {/if}
            Registrierung abschließen
          </button>
        </div>
      </form>
    </div>
  </main>

  <LegalFooter compact />
</div>

<style>
  .top-actions {
    display: flex;
    position: fixed;
    top: 20px;
    right: 20px;
    align-items: center;
    gap: 12px;
    z-index: 100;
  }

  .complete-page {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .complete-container {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: var(--spacing-6);
  }

  .complete-card {
    padding: var(--spacing-8);
    width: 100%;
    max-width: 520px;
  }

  .complete-title {
    margin-bottom: var(--spacing-2);
  }

  .complete-subtitle {
    margin-bottom: var(--spacing-6);
    color: var(--color-text-secondary);
    font-size: 14px;
    line-height: 1.5;
  }

  .name-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-4);
  }

  /* Muted hint next to the email label — clarifies why the field is locked. */
  .form-field__hint {
    margin-left: 6px;
    color: var(--color-text-secondary);
    font-size: 12px;
    font-weight: 400;
  }

  .terms-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: var(--spacing-4) 0;
    color: var(--color-text-secondary);
    font-size: 13px;
  }

  .terms-link {
    color: var(--color-primary);
    text-decoration: none;
  }

  .terms-link:hover {
    text-decoration: underline;
  }

  @media (width < 600px) {
    .complete-card {
      padding: var(--spacing-6);
    }

    .name-row {
      grid-template-columns: 1fr;
    }
  }
</style>
