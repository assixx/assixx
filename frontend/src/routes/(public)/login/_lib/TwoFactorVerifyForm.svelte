<!--
  TwoFactorVerifyForm.svelte — inline 2FA-verify card content for the login
  page (FEAT_2FA_EMAIL_MASTERPLAN Step 5.2 v0.8.1, inline-design revision).

  Rendered inside `(public)/login/+page.svelte`'s `card__body` when the
  parent's `data.stage === 'verify'`. Shares the existing card chrome
  (theme toggle, brand header, glass card, legal footer) with the
  credentials stage; only the body content differs.

  Two server actions on the parent route handle submissions:
    - `?/verify` (default of this child form) — POST { code } → 2FA verify
    - `?/resend` — empty body → resend code on the same challenge

  Auto-submit fires on the 6th character (DD-17, no flag). Resend cooldown
  uses a $state-driven 1 s ticker that cleans up via $effect's return value.

  @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md §5.2
  @see docs/CODE-OF-CONDUCT-SVELTE.md (Svelte 5 runes / no on:event / cleanup)
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import { enhance } from '$app/forms';
  import { resolve } from '$app/paths';

  // Global toast store — same surface the parent login page uses for
  // success messages (e.g. `?logout=success`). Replaces a previous inline
  // `<div class="alert alert--success">` so the resend confirmation lives
  // on the same UX layer as every other success alert in the app.
  import { showSuccessAlert } from '$lib/stores/toast';
  import { buildLoginUrl } from '$lib/utils/build-apex-url';

  import {
    CODE_LENGTH,
    INITIAL_RESENDS_REMAINING,
    LOCKOUT_REDIRECT_DELAY_MS,
    MAX_VERIFY_ATTEMPTS,
    MESSAGES,
    RESEND_COOLDOWN_SEC,
  } from './2fa-constants';

  // ---------------------------------------------------------------------------
  // Reactive state — Svelte 5 runes per CODE-OF-CONDUCT-SVELTE
  // ---------------------------------------------------------------------------

  /** Current code value — controlled by the input filter to enforce alphabet + maxlen. */
  let code = $state('');

  /** Live cooldown countdown in seconds. Decremented by a 1 s $effect ticker. */
  let resendCooldown = $state(RESEND_COOLDOWN_SEC);

  /** Remaining resends on this challenge (mirror of backend `resendsRemaining`, DD-21). */
  let resendsRemaining = $state(INITIAL_RESENDS_REMAINING);

  /**
   * Local wrong-code counter — resets on page reload (acceptable: server-side
   * lockout still triggers correctly after MAX_ATTEMPTS regardless of this).
   */
  let wrongCodeCount = $state(0);

  /** Last error message rendered in the alert; null hides the alert. */
  let errorMessage: string | null = $state(null);

  /** True while the verify request is in flight. Disables input + submit. */
  let submitting = $state(false);

  /** True while the resend request is in flight. Disables resend button. */
  let resending = $state(false);

  /**
   * True after the backend signalled lockout (5 wrong attempts → 15 min lockout
   * per DD-5/DD-6). Triggers the 5 s redirect-to-/login $effect below.
   */
  let locked = $state(false);

  /** Refs — plain `let` per existing login `+page.svelte` convention. */
  let inputEl: HTMLInputElement | undefined;

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

  // Manual-submit only (per user request 2026-04-30): the user must click
  // the "Bestätigen" button to send the code. Auto-submit on 6th character
  // (originally DD-17 in FEAT_2FA_EMAIL_MASTERPLAN) was removed because it
  // (a) felt jumpy in production testing and (b) tangled with the verify-
  // redirect race that caused an early-2026-04-30 POST loop. `canSubmit`
  // already gates the button at `code.length === 6`, so the UX delta is one
  // click — and behaviour is now identical to the credentials form.

  // Lockout-redirect timer — masterplan §5.2 "redirect to /login after 5 s".
  // With the inline-card design /login is also where we are; the redirect
  // serves as a stage-reset (load runs → no challenge cookie → credentials).
  //
  // Apex-hop via `window.location.href = buildLoginUrl()` (NOT `goto()`) per
  // ADR-050 Amendment 2026-04-22: SvelteKit's client router is origin-bound
  // and cannot leave the current host. The rule applies even when the user
  // is already on the apex (defense-in-depth — moving the 2FA challenge
  // behind a tenant subdomain later must not silently re-introduce the
  // bug). No reason discriminator: the in-page ERR_LOCKED alert already
  // conveys the lockout state, so a `?session=expired` toast on top would
  // be redundant noise.
  $effect(() => {
    if (!locked) return;
    const timer = setTimeout(() => {
      window.location.href = buildLoginUrl();
    }, LOCKOUT_REDIRECT_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  });

  // Focus on mount — programmatic to avoid SvelteKit hydration race with
  // HTML `autofocus` (same rationale as parent login page).
  onMount(() => {
    inputEl?.focus();
  });

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  /**
   * Filter input to alphabet + uppercase + max length. Mirrors backend
   * `VerifyCodeSchema` normalisation (`.trim().toUpperCase().regex(...)`)
   * so the user sees only valid characters as they type — no surprise
   * server-side rejection on copy-paste of unicode quotes / lowercase / spaces.
   *
   * The DOM value is re-synced when filtering removed characters so the
   * cursor doesn't jump past invisible-but-rejected input.
   */
  function handleInput(event: Event): void {
    const target = event.currentTarget as HTMLInputElement;
    const cleaned = target.value
      .toUpperCase()
      .replace(/[^A-HJKMNP-Z2-9]/g, '')
      .slice(0, CODE_LENGTH);
    code = cleaned;
    if (target.value !== cleaned) {
      target.value = cleaned;
    }
  }

  /**
   * Type guard for the action-failure payload from the parent `+page.server.ts`.
   * Keeps the call sites readable while staying off `any`.
   */
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
      //
      // Why: the auto-submit `$effect` (line ~115) re-fires `requestSubmit()`
      // the moment `code.length === 6 && !submitting` is true again. If we
      // reset `submitting` first and only THEN start the redirect navigation,
      // the effect re-runs in the same microtask and POSTs a second verify.
      // That second request has no `challengeToken` cookie (verify-action
      // already cleared it on the first hit) → server fail-closes with
      // `redirect(303, '/login')` → its callback overwrites our pending
      // `window.location.href = '/root-dashboard'` with `/login` → user is
      // stuck on /login bouncing between POSTs forever.
      //
      // Keeping `submitting = true` while the navigation is in flight blocks
      // the `$effect` predicate (`!submitting`) and makes the redirect win.
      if (result.type === 'redirect') {
        // Full page reload — login→dashboard is a state boundary
        // (unauthenticated → authenticated). Client-side `update()` / `goto()`
        // fails with NetworkError on this transition. Mirrors the credentials
        // form's `window.location.href` approach (+page.svelte:639–643).
        if (typeof result.location === 'string' && result.location !== '') {
          window.location.href = result.location;
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
          code = '';
          return;
        }
        if (data.wrongCode === true) {
          wrongCodeCount += 1;
          const remaining = Math.max(0, MAX_VERIFY_ATTEMPTS - wrongCodeCount);
          errorMessage = MESSAGES.ERR_WRONG_CODE(remaining);
          code = '';
          inputEl?.focus();
          return;
        }
        errorMessage = data.error ?? MESSAGES.ERR_GENERIC;
        code = '';
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
          // Use the global toast store — same channel the parent login page
          // uses (e.g. logout-success). Replaces a previous inline
          // `<div class="alert alert--success">` so positive feedback for the
          // resend lives on the canonical UX layer (auto-dismiss + stacking).
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
    <label
      class="form-field__label form-field__label--required"
      for="code">{MESSAGES.CODE_LABEL}</label
    >
    <input
      bind:this={inputEl}
      id="code"
      name="code"
      type="text"
      inputmode="text"
      autocapitalize="characters"
      autocomplete="one-time-code"
      spellcheck="false"
      maxlength={CODE_LENGTH}
      pattern="[A-HJKMNP-Z2-9]{'{6}'}"
      value={code}
      oninput={handleInput}
      disabled={submitting || locked}
      required
      aria-describedby="code-hint"
      class="form-field__control"
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

<a
  href={resolve('/login')}
  class="btn btn-link verify-back"
  data-sveltekit-reload>{MESSAGES.BTN_BACK}</a
>

<style>
  .verify-heading {
    /* Override base.css h1 (2.25rem) — page-level size is too large for a
     * card-section heading. 1.5rem matches the h3 scale in base.css and
     * keeps the verify card visually balanced with the surrounding card body. */
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

  .verify-back {
    display: block;
    margin-top: 0.25rem;
    text-align: center;
  }
</style>
