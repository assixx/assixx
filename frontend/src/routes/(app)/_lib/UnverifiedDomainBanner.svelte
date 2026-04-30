<!--
  UnverifiedDomainBanner.svelte

  Global banner shown to root + admin users of a tenant whose company-domain
  has not yet been verified (`data.tenantVerified === false`). Pushes them
  toward `/settings/company-profile/domains` to add a TXT record and unlock
  user-creation across the app.

  Condition-driven: appears when the tenant has zero verified domains,
  disappears the moment one becomes verified (server re-fetches after
  `invalidateAll()` per masterplan §5.1 / v0.3.0 S4). Parent gates render via
  {#if data.tenantVerified === false && ['root','admin'].includes(role)}.

  Dismiss is session-scoped via a session cookie (stirbt beim Browser-Close):
  the X button writes the cookie and hides the banner locally. The gate in
  +layout.svelte reads `data.unverifiedDomainBannerDismissed` (populated from
  the same cookie in +layout.server.ts) — SSR therefore never emits the banner
  after dismiss, eliminating the hydration flash we had with sessionStorage
  (commit 2026-04-30, mirrors SingleRootWarningBanner-Migration 2026-04-22).

  CSS classes are component-scoped (unverified-domain-banner-*); CSS variables
  are shared with SingleRootWarningBanner / RoleSwitchBanner (--banner-warning-*)
  for visual parity with the existing warning-banner stack.

  @see masterplan §5.3 (banner spec), §0.2.5 #16 (Root + Admin readable),
       SingleRootWarningBanner.svelte (cookie-pattern this mirrors)
-->
<script lang="ts">
  import { browser } from '$app/environment';
  import { resolve } from '$app/paths';

  // Cookie name — MUST stay in sync with UNVERIFIED_DOMAIN_BANNER_DISMISS_COOKIE
  // in `(app)/+layout.server.ts`. Session cookie (no Max-Age) so it dies on
  // browser close, mirroring the previous sessionStorage semantics.
  const DISMISS_COOKIE = 'assixx_unverified_domain_banner_dismissed';

  // Local hide — parent gate already honors the cookie on next navigation/SSR.
  // `false` here is always correct: if the cookie was already set, the parent
  // gate would not have mounted us in the first place.
  let dismissed = $state(false);

  function handleDismiss(): void {
    if (browser) {
      // Session cookie: SameSite=Lax survives the OAuth-redirect round-trip,
      // Path=/ so every authenticated route sees it, no Secure flag so it
      // works on http://*.localhost during dev (browser ignores Secure on
      // localhost anyway, but omitting is explicit).
      document.cookie = `${DISMISS_COOKIE}=1; Path=/; SameSite=Lax`;
    }
    dismissed = true;
  }
</script>

{#if !dismissed}
  <div
    class="unverified-domain-banner"
    id="unverified-domain-banner"
    role="alert"
  >
    <div class="unverified-domain-banner-content">
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
        <strong>Domain nicht verifiziert:</strong>
        Du kannst noch keine Benutzer anlegen. Bitte verifiziere zuerst Deine Firmen-Domain per DNS-TXT-Eintrag.
        <a
          href={resolve('/settings/company-profile/domains')}
          class="unverified-domain-banner-link">Jetzt verifizieren</a
        >
      </span>
      <button
        type="button"
        class="unverified-domain-banner-close"
        onclick={handleDismiss}
        title="Banner schließen"
        aria-label="Hinweis ausblenden"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path
            d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
          />
        </svg>
      </button>
    </div>
  </div>
{/if}

<style>
  /* CSS variables mirror SingleRootWarningBanner / RoleSwitchBanner for visual
     consistency. Classes are locally-scoped by Svelte — no collision risk. */
  .unverified-domain-banner {
    z-index: var(--z-notification);
    background: var(--banner-warning-bg);
    border-bottom: 1px solid var(--banner-warning-border);
    padding: var(--spacing-5) var(--spacing-6);
    width: 100%;
  }

  .unverified-domain-banner-content {
    display: flex;
    position: relative;
    justify-content: center;
    align-items: center;
    gap: var(--spacing-2);
    color: var(--banner-warning-text);
    font-size: var(--font-size-sm);
    line-height: var(--line-height-none);
  }

  .unverified-domain-banner-content strong {
    color: var(--banner-warning-text-strong);
    font-weight: var(--font-weight-semibold);
  }

  .unverified-domain-banner-link {
    margin-left: var(--spacing-2);
    color: var(--banner-warning-text-strong);
    font-weight: var(--font-weight-semibold);
    text-decoration: underline;
  }

  .banner-icon {
    flex-shrink: 0;
    color: var(--banner-warning-icon);
  }

  .unverified-domain-banner-close {
    position: absolute;
    right: 0;
    display: flex;
    align-items: center;
    cursor: pointer;
    border: none;
    border-radius: var(--radius);
    background: none;
    padding: var(--spacing-1);
    color: var(--banner-warning-close);
    transition: color 0.15s;
  }

  .unverified-domain-banner-close:hover {
    color: var(--banner-warning-close-hover);
  }
</style>
