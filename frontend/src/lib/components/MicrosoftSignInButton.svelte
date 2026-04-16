<!--
  MicrosoftSignInButton — Microsoft OAuth Sign-In Button

  Shell is the design-system `.btn.btn-index` (blue-tinted outline, primary
  glow, translateY hover lift). Per UX request 2026-04-16 the button must
  visually align with the Anmelden submit button (also `btn btn-index`) so
  the login card reads as one coherent surface instead of two mismatched
  design languages.

  We deliberately apply `btn btn-index` *directly* on the <button> element
  (see below) instead of re-implementing the shell locally — that way
  future token / variant changes in button.index.css propagate here
  without a follow-up edit.

  DEVIATION from Microsoft Brand Guidelines (sharp corners, Segoe UI 15 px,
  pure-white / #2F2F2F shell): intentional and scoped to this app. The
  **mandatory** parts of the guideline are preserved: the 4-colour square
  logo is NEVER recoloured, NEVER resized disproportionately, and the
  button label stays "Mit Microsoft anmelden" / "Mit Microsoft
  registrieren". These are the non-negotiable brand-parity elements; the
  shell is ours.

  On click the browser performs a full-page navigation to the backend's
  authorize endpoint, which derives the redirect URI from PUBLIC_APP_URL
  and 302s to login.microsoftonline.com/organizations/... (Phase 2).
  Same-origin path → browser automatically forwards cookies on return.

  @see docs/FEAT_MICROSOFT_OAUTH_MASTERPLAN.md §5.1
  @see https://learn.microsoft.com/en-us/entra/identity-platform/howto-add-branding-in-apps
-->
<script lang="ts">
  interface Props {
    /** Which OAuth flow to initiate — controls label AND authorize query param */
    mode: 'login' | 'signup';
    /** Disabled while an outer form is submitting */
    disabled?: boolean;
  }

  const { mode, disabled = false }: Props = $props();

  // Labels are fixed German strings per Brand Guidelines + Plan §5.1.
  // No Umlaute needed in either phrase (coincidence, not oversight).
  const label = $derived(
    mode === 'login' ? 'Mit Microsoft anmelden' : 'Mit Microsoft registrieren',
  );

  function handleClick(): void {
    // Full-page redirect — NOT SvelteKit goto(). Backend issues 302 to
    // Microsoft, and on return drops httpOnly cookies (login-success path)
    // or 302s to /signup/oauth-complete?ticket={uuid} (signup path).
    // Plan §5.1 mandates window.location.href for same-origin cookie safety.
    window.location.href = `/api/v2/auth/oauth/microsoft/authorize?mode=${mode}`;
  }
</script>

<button
  class="btn btn-index ms-btn"
  type="button"
  aria-label={label}
  {disabled}
  onclick={handleClick}
>
  <!--
    Microsoft 4-colour square — official brand logo. Never recolour, never
    invert in dark mode. aria-hidden because the button's aria-label already
    conveys the intent to assistive tech (double-announcement = anti-pattern).
  -->
  <svg
    class="ms-btn__logo"
    width="21"
    height="21"
    viewBox="0 0 21 21"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    <rect
      x="1"
      y="1"
      width="9"
      height="9"
      fill="#F25022"
    />
    <rect
      x="11"
      y="1"
      width="9"
      height="9"
      fill="#7FBA00"
    />
    <rect
      x="1"
      y="11"
      width="9"
      height="9"
      fill="#00A4EF"
    />
    <rect
      x="11"
      y="11"
      width="9"
      height="9"
      fill="#FFB900"
    />
  </svg>
  <span class="ms-btn__label">{label}</span>
</button>

<style>
  /*
   * Structure-only. The visual shell (background, border, shadow, hover,
   * focus, disabled, active, dark-mode) is inherited from `.btn.btn-index`
   * in the design system (see button.index.css / button.effects.css).
   * Future token changes there propagate here automatically — that's the
   * whole point of using the canonical button class instead of forking it.
   *
   * The overrides below are ONLY things btn-index doesn't cover because
   * they are Microsoft-Brand specifics:
   *   - width: 100%    — MS sign-in must never be narrower than the other
   *                       primary action on the same surface (brand parity).
   *   - gap: 12 px     — Brand Guideline spec for logo-vs-label spacing
   *                       (overrides the base `--spacing-2` = 8 px gap).
   *   - logo sizing    — `.btn svg` base rule sets width/height to 1.25em,
   *                       Brand Guideline pins the 4-colour square at 21 px
   *                       regardless of font size.
   */
  .ms-btn {
    gap: 12px;
    width: 100%;
  }

  .ms-btn__logo {
    flex-shrink: 0;
    display: block;
    width: 21px;
    height: 21px;
  }
</style>
