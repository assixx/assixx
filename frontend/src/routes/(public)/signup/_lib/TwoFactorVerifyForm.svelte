<!--
  TwoFactorVerifyForm.svelte — inline 2FA-verify card content for the signup
  page (FEAT_2FA_EMAIL_MASTERPLAN Step 5.3 v0.8.2, inline-design revision).

  Rendered inside `(public)/signup/+page.svelte`'s signup card body when the
  parent's `data.stage === 'verify'`. Twin of the login-flow component at
  `(public)/login/_lib/TwoFactorVerifyForm.svelte` — diverges only in:
    - imports (signup-flavoured MESSAGES + constants)
    - lockout-redirect target (`/signup` instead of apex `/login` via buildLoginUrl)
    - "Zurück" link target (`/signup` instead of `/login`)
    - shape of `result.location` on verify success (cross-origin
      `https://<subdomain>.<apex>/signup/oauth-complete?token=…`, not a
      same-origin dashboard path) — handled by the redirect branch passing
      `result.location` straight to `window.location.href`, which works for
      both same-origin and cross-origin URLs.

  Two server actions on the parent route handle submissions:
    - `?/verify` (default of this child form) — POST { code } → signup verify
    - `?/resend` — empty body → resend code on the same challenge

  @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md §5.3
  @see (public)/login/_lib/TwoFactorVerifyForm.svelte (login twin)
  @see docs/CODE-OF-CONDUCT-SVELTE.md (Svelte 5 runes / no on:event / cleanup)
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import { enhance } from '$app/forms';

  // Global toast store — same surface the parent signup page already uses
  // for success/error alerts. `showSuccessAlert` powers the resend
  // confirmation; `showToast` (full-shape with progress bar) powers the
  // post-verify success toast that precedes the cross-origin handoff hop.
  import { showSuccessAlert, showToast } from '$lib/stores/toast';

  import {
    CODE_LENGTH,
    INITIAL_RESENDS_REMAINING,
    LOCKOUT_REDIRECT_DELAY_MS,
    MAX_VERIFY_ATTEMPTS,
    MESSAGES,
    RESEND_COOLDOWN_SEC,
  } from './2fa-constants';
  // SUCCESS_REDIRECT_DELAY (5 s) lives in the existing signup-form constants
  // file because it predates the 2FA refactor (legacy `handleSubmit` used
  // the same delay before the apex-login redirect). Keeping it there avoids
  // moving an exported constant and breaking nothing — `2fa-constants.ts`
  // owns 2FA-specific UI strings, but the temporal-delay value is a
  // signup-form concern that happens to apply to the post-verify branch.
  import { SUCCESS_REDIRECT_DELAY } from './constants';

  // ---------------------------------------------------------------------------
  // Reactive state — Svelte 5 runes per CODE-OF-CONDUCT-SVELTE
  // ---------------------------------------------------------------------------

  // 6-Box-OTP-Pattern (Stripe/Apple-Style): digits[] hält die Einzelziffern,
  // `code` ist daraus abgeleitet und wird per hidden input an die ?/verify-
  // Action übergeben. Twin der Login-Variante; siehe dort für Rationale.
  /** Per-Box-Zustand. Mutationen einzelner Indizes werden durch $state getrackt. */
  let digits = $state<string[]>(['', '', '', '', '', '']);
  /** Concatenierter 6-Zeichen-Code für canSubmit-Gate + hidden form field. */
  const code = $derived(digits.join(''));

  /** Live cooldown countdown in seconds. Decremented by a 1 s $effect ticker. */
  let resendCooldown = $state(RESEND_COOLDOWN_SEC);

  /** Remaining resends on this challenge (mirror of backend `resendsRemaining`, DD-21). */
  let resendsRemaining = $state(INITIAL_RESENDS_REMAINING);

  /** Local wrong-code counter — resets on page reload. Server-side lockout still enforces. */
  let wrongCodeCount = $state(0);

  /** Last error message rendered in the alert; null hides the alert. */
  let errorMessage: string | null = $state(null);

  /** True while the verify request is in flight. Disables input + submit. */
  let submitting = $state(false);

  /** True while the resend request is in flight. Disables resend button. */
  let resending = $state(false);

  /** True after the backend signalled lockout. Triggers the 5 s redirect $effect. */
  let locked = $state(false);

  // Refs auf alle 6 Boxen — bind:this innerhalb #each schreibt indexbasiert
  // hier rein. `const` reicht (Indizes mutieren, Array-Referenz nicht);
  // siehe Login-Twin für Rationale.
  const inputRefs: HTMLInputElement[] = [];

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const canSubmit = $derived(code.length === CODE_LENGTH && !submitting && !locked);
  const canResend = $derived(
    resendCooldown <= 0 && resendsRemaining > 0 && !resending && !locked && !submitting,
  );

  const submitLabel = $derived(submitting ? MESSAGES.BTN_SUBMITTING : MESSAGES.BTN_SUBMIT);

  function computeResendLabel(cooldown: number, remaining: number, isResending: boolean): string {
    if (isResending) return MESSAGES.BTN_RESENDING;
    if (remaining <= 0) return MESSAGES.ERR_RESEND_LIMIT;
    if (cooldown > 0) return MESSAGES.BTN_RESEND_COOLDOWN(cooldown);
    return MESSAGES.BTN_RESEND;
  }
  const resendLabel = $derived(computeResendLabel(resendCooldown, resendsRemaining, resending));

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // Resend-cooldown ticker. Cleanup via $effect's return is mandatory per
  // CODE-OF-CONDUCT-SVELTE — without it a stale interval would survive
  // navigation and decrement state on a destroyed component.
  $effect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      resendCooldown = Math.max(0, resendCooldown - 1);
    }, 1_000);
    return () => {
      clearInterval(interval);
    };
  });

  // Lockout-redirect timer. Twin of the login version, but the redirect
  // target is `/signup` (same-origin reload — clears the apex challenge
  // cookie via the load function's stage discriminator, swapping back to
  // the credentials view). We use `window.location.href` rather than
  // SvelteKit `goto()` because the load runs server-side on the next
  // request, picking up the cleared cookie cleanly. Note: signup ALWAYS
  // lives on the apex (`www.assixx.com/signup` — no tenant context yet)
  // so a same-origin `/signup` reload is sufficient. No buildApexUrl()
  // needed (the login twin uses `buildLoginUrl()` only because logout
  // can fire from a tenant subdomain — signup never does).
  $effect(() => {
    if (!locked) return;
    const timer = setTimeout(() => {
      window.location.href = '/signup';
    }, LOCKOUT_REDIRECT_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  });

  // Focus on mount — programmatic to avoid SvelteKit hydration race with
  // HTML `autofocus` (same rationale as the login twin). Box 1 ist der
  // Einstieg; autocomplete=one-time-code lebt nur an Box 1.
  onMount(() => {
    inputRefs[0]?.focus();
  });

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  /** Crockford-Subset-Filter — siehe Login-Twin für Rationale. */
  const ALPHABET_RE = /[^A-HJKMNP-Z2-9]/g;

  /** Reset aller Boxen + Fokus auf Box 1 (Wrong-Code-Branch / Lockout). */
  function clearDigits(): void {
    digits = ['', '', '', '', '', ''];
    inputRefs[0]?.focus();
  }

  /**
   * Schreibt eine Zeichenkette ab `startIdx` in die Boxen (Paste oder
   * Multi-Char-Input). Twin-Logik zur Login-Variante.
   */
  function setFromString(input: string, startIdx: number): void {
    const cleaned = input.toUpperCase().replace(ALPHABET_RE, '');
    if (cleaned.length === 0) return;
    const writeCount = Math.min(cleaned.length, CODE_LENGTH - startIdx);
    for (let i = 0; i < writeCount; i++) {
      digits[startIdx + i] = cleaned[i] ?? '';
    }
    const focusIdx = Math.min(startIdx + writeCount, CODE_LENGTH - 1);
    inputRefs[focusIdx]?.focus();
    inputRefs[focusIdx]?.select();
  }

  /** Single-Char → Auto-Advance; Leer → Box leeren; Multi-Char → verteilen. */
  function handleDigitInput(idx: number, event: Event): void {
    const target = event.currentTarget as HTMLInputElement;
    const cleaned = target.value.toUpperCase().replace(ALPHABET_RE, '');

    if (cleaned.length === 0) {
      digits[idx] = '';
      target.value = '';
      return;
    }

    if (cleaned.length === 1) {
      digits[idx] = cleaned;
      target.value = cleaned;
      if (idx < CODE_LENGTH - 1) {
        inputRefs[idx + 1]?.focus();
        inputRefs[idx + 1]?.select();
      }
      return;
    }

    setFromString(cleaned, idx);
  }

  /** Bewegt den Fokus auf eine andere Box (Pfeiltasten-Navigation). */
  function focusBox(targetIdx: number, event: Event): void {
    if (targetIdx < 0 || targetIdx >= CODE_LENGTH) return;
    event.preventDefault();
    inputRefs[targetIdx]?.focus();
    inputRefs[targetIdx]?.select();
  }

  /** Backspace auf leerer Box → vorherige Box leeren + fokussieren. */
  function handleBackspace(idx: number, event: KeyboardEvent): void {
    if (digits[idx] !== '' || idx === 0) return;
    event.preventDefault();
    digits[idx - 1] = '';
    inputRefs[idx - 1]?.focus();
  }

  /**
   * Tastatur-Navigation per Switch — pro Case eine Verantwortung, ESLint-
   * Complexity bleibt gering, Pflege einfacher (siehe Login-Twin).
   */
  function handleDigitKeydown(idx: number, event: KeyboardEvent): void {
    switch (event.key) {
      case 'Backspace':
        handleBackspace(idx, event);
        return;
      case 'ArrowLeft':
        focusBox(idx - 1, event);
        return;
      case 'ArrowRight':
        focusBox(idx + 1, event);
        return;
      default:
        return;
    }
  }

  /** Paste verteilt auf alle Boxen ab Klebe-Position. */
  function handlePaste(idx: number, event: ClipboardEvent): void {
    const pasted = event.clipboardData?.getData('text');
    if (typeof pasted !== 'string' || pasted.length === 0) return;
    event.preventDefault();
    setFromString(pasted, idx);
  }

  /** Type guard for the action-failure payload from the parent `+page.server.ts`. */
  interface FailureShape {
    error?: string;
    wrongCode?: true;
    locked?: true;
    expired?: true;
    cooldown?: true;
    resendLimit?: true;
  }
  function asFailure(data: unknown): FailureShape {
    return typeof data === 'object' && data !== null ? data : {};
  }

  function enhanceVerify() {
    submitting = true;
    errorMessage = null;
    return async ({
      result,
      update,
    }: {
      result: { type: string; data?: unknown; location?: string };
      update: () => Promise<void>;
    }): Promise<void> => {
      // CRITICAL: handle redirects BEFORE flipping `submitting = false`.
      // Same race-prevention rationale as the login twin — a subsequent
      // re-fire could race the in-flight cross-origin navigation.
      //
      // For signup the redirect target is the cross-origin handoff URL
      // (`https://<subdomain>.<apex>/signup/oauth-complete?token=…`). The
      // browser leaves the apex via this navigation; the receiving page
      // (existing OAuth handoff consumer) sets cookies on the correct
      // origin and routes to the role-specific dashboard. Cross-origin
      // navigation REQUIRES `window.location.href` — SvelteKit's client
      // router cannot leave the current origin.
      //
      // UX delay (signup-only): the legacy `handleSubmit` flow showed a 5 s
      // success toast with progress bar before redirecting. We restore it
      // here on the post-verify branch — registration is a multi-step
      // emotional milestone (form → mail → code → activation), so a brief
      // celebratory acknowledgement matters more than the millisecond saved
      // by an immediate hop. `submitting` stays `true` for the full delay
      // so the verify button cannot re-fire (button is disabled while
      // `!canSubmit`, and `canSubmit` requires `!submitting`). The login
      // twin intentionally has NO delay — login is same-origin and the
      // dashboard load handles the "you are logged in" surface.
      if (result.type === 'redirect') {
        if (typeof result.location === 'string' && result.location !== '') {
          showToast({
            type: 'success',
            title: MESSAGES.VERIFY_SUCCESS_TITLE,
            message: MESSAGES.VERIFY_SUCCESS_MESSAGE,
            duration: SUCCESS_REDIRECT_DELAY,
            showProgress: true,
          });
          const redirectTarget = result.location;
          setTimeout(() => {
            window.location.href = redirectTarget;
          }, SUCCESS_REDIRECT_DELAY);
          return;
        }
        // Defensive fallback — SvelteKit always sets `location` on redirect
        // results, but if it ever doesn't, stage-reset by reloading.
        window.location.reload();
        return;
      }

      submitting = false;

      if (result.type === 'failure') {
        const data = asFailure(result.data);
        if (data.locked === true) {
          locked = true;
          errorMessage = MESSAGES.ERR_LOCKED;
          clearDigits();
          return;
        }
        if (data.wrongCode === true) {
          wrongCodeCount += 1;
          const remaining = Math.max(0, MAX_VERIFY_ATTEMPTS - wrongCodeCount);
          errorMessage = MESSAGES.ERR_WRONG_CODE(remaining);
          clearDigits();
          return;
        }
        errorMessage = data.error ?? MESSAGES.ERR_GENERIC;
        clearDigits();
        return;
      }

      // Defensive fallback — apply default behaviour for unhandled types.
      await update();
    };
  }

  interface ResendSuccessShape {
    resent?: true;
    resendsRemaining?: number;
  }
  function asResendSuccess(data: unknown): ResendSuccessShape {
    return typeof data === 'object' && data !== null ? data : {};
  }

  /**
   * Cancel-action callback — handles the "Zurück zur Registrierung" submit.
   * The server action clears the challenge cookie + 303s to /signup; we
   * hard-nav so the next load() runs server-side with the cookie already
   * gone (otherwise SvelteKit's client router could short-circuit and
   * re-render verify before the cookie state catches up).
   */
  function enhanceCancel() {
    return async ({
      result,
      update,
    }: {
      result: { type: string; data?: unknown; location?: string };
      update: () => Promise<void>;
    }): Promise<void> => {
      if (result.type === 'redirect') {
        if (typeof result.location === 'string' && result.location !== '') {
          window.location.href = result.location;
          return;
        }
        // Defensive fallback — shouldn't happen, but reload is a safe
        // stage-reset (cookie was deleted server-side regardless).
        window.location.reload();
        return;
      }
      // Failure path — server-side never returns a failure for a no-arg
      // cookie-delete, but be defensive: full reload guarantees the user
      // escapes the verify stage one way or another.
      await update();
      window.location.reload();
    };
  }

  function enhanceResend() {
    resending = true;
    errorMessage = null;
    return async ({
      result,
      update,
    }: {
      result: { type: string; data?: unknown };
      update: () => Promise<void>;
    }): Promise<void> => {
      resending = false;

      if (result.type === 'success') {
        const data = asResendSuccess(result.data);
        if (data.resent === true) {
          resendCooldown = RESEND_COOLDOWN_SEC;
          if (typeof data.resendsRemaining === 'number') {
            resendsRemaining = data.resendsRemaining;
          }
          showSuccessAlert(MESSAGES.RESEND_SUCCESS);
          return;
        }
      }

      if (result.type === 'failure') {
        const data = asFailure(result.data);
        errorMessage = data.error ?? MESSAGES.ERR_GENERIC;
        return;
      }

      await update();
    };
  }
</script>

<h1 class="verify-heading">{MESSAGES.HEADING}</h1>
<p class="verify-intro">{MESSAGES.INTRO_FALLBACK}</p>

<form
  method="POST"
  action="?/verify"
  use:enhance={enhanceVerify}
  class="verify-form"
  novalidate
>
  <div class="form-field">
    <!-- Gruppen-Label-Pattern (siehe Login-Twin): role="group" + aria-* statt
         <label for>, weil das Steuerungselement aus 6 Boxen besteht. -->
    <span
      id="code-label"
      class="form-field__label form-field__label--required">{MESSAGES.CODE_LABEL}</span
    >
    <div
      class="otp-input"
      role="group"
      aria-labelledby="code-label"
      aria-describedby="code-hint"
    >
      {#each digits as digit, idx (idx)}
        <input
          bind:this={inputRefs[idx]}
          class="form-field__control form-field__control--otp"
          type="text"
          inputmode="text"
          autocapitalize="characters"
          autocomplete={idx === 0 ? 'one-time-code' : 'off'}
          spellcheck="false"
          maxlength="1"
          pattern="[A-HJKMNP-Z2-9]"
          value={digit}
          oninput={(event) => {
            handleDigitInput(idx, event);
          }}
          onkeydown={(event) => {
            handleDigitKeydown(idx, event);
          }}
          onpaste={(event) => {
            handlePaste(idx, event);
          }}
          disabled={submitting || locked}
          aria-label="{MESSAGES.CODE_LABEL} – Stelle {idx + 1} von {CODE_LENGTH}"
        />
      {/each}
    </div>
    <!-- Hidden Field trägt den concatenierten Code an die ?/verify-Action.
         Backend liest weiterhin formData.get('code') — keine Änderung nötig. -->
    <input
      type="hidden"
      name="code"
      value={code}
    />
  </div>

  <button
    type="submit"
    class="btn btn-primary verify-submit"
    disabled={!canSubmit}>{submitLabel}</button
  >

  {#if errorMessage !== null}
    <div
      class="alert alert--error"
      role="alert"
    >
      {errorMessage}
    </div>
  {/if}

  <p
    id="code-hint"
    class="verify-hint"
  >
    {MESSAGES.HINT_SPAM}
  </p>
</form>

<form
  method="POST"
  action="?/resend"
  use:enhance={enhanceResend}
  class="resend-form"
>
  <button
    type="submit"
    class="btn btn-link verify-resend"
    disabled={!canResend}>{resendLabel}</button
  >
</form>

<!--
  "Zurück zur Registrierung" — must POST to `?/cancel` (not just navigate to
  /signup) because the server-side load() reads the still-present
  challengeToken cookie and renders the verify stage again. The cancel
  action server-side deletes the cookie + 303s back, breaking the loop.
  Bug discovered 2026-04-30 evening; same fix applied to the login twin.
-->
<form
  method="POST"
  action="?/cancel"
  use:enhance={enhanceCancel}
  class="cancel-form"
>
  <button
    type="submit"
    class="btn btn-link verify-back">{MESSAGES.BTN_BACK}</button
  >
</form>

<style>
  .verify-heading {
    /* Override base.css h1 (2.25rem) — page-level size is too large for a
     * card-section heading. 1.5rem matches the h3 scale in base.css. */
    margin-bottom: 0.5rem;
    font-size: 1.5rem;
    line-height: 2rem;
    text-align: center;
  }

  .verify-intro {
    margin-bottom: 1.5rem;
    color: var(--color-text-secondary);
    text-align: center;
  }

  .verify-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .verify-submit {
    width: 100%;
  }

  .verify-hint {
    margin-top: 0.25rem;
    color: var(--color-text-muted);
    font-size: 0.875rem;
    text-align: center;
  }

  .resend-form {
    margin-top: 0.5rem;
  }

  .verify-resend {
    width: 100%;
  }

  /* Cancel-form is the wrapper around the "Zurück zur Registrierung" submit
     button (was previously a plain <a>; converted to a form so the server
     action `?/cancel` can clear the apex challenge cookie before the
     redirect — see enhanceCancel above). Spacing migrated from the former
     `.verify-back` rule to keep layout pixel-identical to the pre-bugfix
     state (mirrors the `.resend-form` / `.verify-resend` split). */
  .cancel-form {
    margin-top: 0.25rem;
  }

  .verify-back {
    display: block;
    width: 100%;
    text-align: center;
  }
</style>
