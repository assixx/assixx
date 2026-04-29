<!--
  BetaBanner.svelte

  Slim full-width banner above the LandingHeader on every public page
  (Landing, Impressum, Datenschutz, Disclaimer itself).

  WHY visible everywhere on the public surface: user explicitly required
  "ganz wichtig" — first-time visitors must see the beta caveat regardless
  of the page they land on (signup vs. landing vs. legal).

  Visual style mirrors SingleRootWarningBanner.svelte: same warning-triangle
  SVG, same `--banner-warning-*` token set, same layout. Difference: no
  dismiss button — banner is informational/marketing, not session-actionable,
  and the public surface has no auth state to persist a dismiss against.

  Linked from /disclaimer — see FEAT_BETA_HOSTING_MASTERPLAN §7.1 for the
  related post-login Beta-T&C modal (separate, acceptance-tracked UX flow).
-->
<script lang="ts">
  import { resolve } from '$app/paths';
</script>

<div
  class="beta-banner"
  id="beta-banner"
  role="alert"
>
  <div class="beta-banner-content">
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      class="banner-icon"
      aria-hidden="true"
    >
      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
    </svg>
    <span>
      <strong>Beta-Phase:</strong>
      Assixx startet am 01.06.2026 in die offene Beta. Datenverlust ist in seltenen Fällen möglich.
      <a
        href={resolve('/disclaimer')}
        class="beta-banner-link">Disclaimer lesen</a
      >
    </span>
  </div>
</div>

<style>
  /* CSS-Variablen + Layout 1:1 vom SingleRootWarningBanner übernommen,
     damit beide Banner visuell identisch wirken (--banner-warning-*).
     Klassen sind via Svelte component-scoped — keine Kollision. */
  .beta-banner {
    z-index: var(--z-notification);
    background: var(--banner-warning-bg);
    border-bottom: 1px solid var(--banner-warning-border);
    padding: var(--spacing-5) var(--spacing-6);
    width: 100%;
  }

  .beta-banner-content {
    display: flex;
    position: relative;
    justify-content: center;
    align-items: center;
    gap: var(--spacing-2);
    color: var(--banner-warning-text);
    font-size: var(--font-size-sm);
    line-height: var(--line-height-none);
  }

  .beta-banner-content strong {
    color: var(--banner-warning-text-strong);
    font-weight: var(--font-weight-semibold);
  }

  .beta-banner-link {
    margin-left: var(--spacing-2);
    color: var(--banner-warning-text-strong);
    font-weight: var(--font-weight-semibold);
    text-decoration: underline;
  }

  .banner-icon {
    flex-shrink: 0;
    color: var(--banner-warning-icon);
  }
</style>
