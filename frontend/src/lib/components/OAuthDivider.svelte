<!--
  OAuthDivider — horizontal separator between OAuth identity-provider
  buttons and the email/password form. Centered German connector text
  flanked by 1 px lines drawn as ::before/::after pseudo-elements (zero
  decorative DOM nodes → cleaner markup for screen readers).

  The `label` prop lets each page describe *its own* reading direction:
  signup keeps the legacy "oder mit E-Mail" (Microsoft ABOVE form), login
  flipped to "oder" (form ABOVE Microsoft, see login/+page.svelte UI swap).
  Default stays on the legacy value so existing consumers keep rendering
  unchanged without an opt-in flag.

  @see docs/FEAT_MICROSOFT_OAUTH_MASTERPLAN.md §5.2
-->
<script lang="ts">
  interface Props {
    /** Divider connector text. Also becomes the separator's aria-label. */
    label?: string;
  }

  const { label = 'oder mit E-Mail' }: Props = $props();
</script>

<div
  class="oauth-divider"
  role="separator"
  aria-label={label}
>
  <span class="oauth-divider__text">{label}</span>
</div>

<style>
  .oauth-divider {
    display: flex;
    align-items: center;
    margin: 20px 0;
    /* Secondary text token is already used by .login-footer a — proven to
       follow the active theme in both light and dark modes. */
    color: var(--color-text-secondary);
    font-size: 13px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /*
   * Lines drawn via pseudo-elements: background=currentColor so both lines
   * match the theme-derived text colour automatically. opacity=0.25 keeps
   * the divider subtle — the text is the focal point, not the lines.
   */
  .oauth-divider::before,
  .oauth-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: currentColor;
    opacity: 25%;
  }

  .oauth-divider__text {
    padding: 0 12px;
  }
</style>
