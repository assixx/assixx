<script lang="ts">
  /*
   * Shared top navigation for the public landing surface (Landing page +
   * Legal pages: Impressum, Datenschutz). Extracted from +page.svelte so
   * Legal pages carry the identical header — same structure, same styles,
   * same nav items — instead of their prior minimal logo-only variant.
   *
   * WHY: user explicitly wants "exakt gleich" header/footer on Legal
   * pages (2026-04-15). Extracting prevents style duplication drift.
   */
  import { resolve } from '$app/paths';

  import { isDark } from '$lib/stores/theme.svelte';

  import ThemeToggle from './ThemeToggle.svelte';

  interface Props {
    /**
     * When true, section anchors (#module, #security, #pricing) are
     * prefixed with "/" so they navigate back to the landing page and
     * scroll into view. On the landing page itself, pure hash links
     * scroll within the current document.
     */
    offLanding?: boolean;
  }

  const { offLanding = false }: Props = $props();

  // $derived: `offLanding` is a $props() rune — a plain `const` reads it
  // only at setup and would go stale if the prop ever changes. $derived
  // recomputes reactively and silences Svelte's `state_referenced_locally`
  // warning. See https://svelte.dev/e/state_referenced_locally.
  const modulesHref = $derived(offLanding ? resolve('/') + '#module' : '#module');
  const securityHref = $derived(offLanding ? resolve('/') + '#security' : '#security');
  const pricingHref = $derived(offLanding ? resolve('/') + '#pricing' : '#pricing');
</script>

<header class="header">
  <nav class="nav">
    <div class="logo-container u-cursor-pointer">
      <a
        href={resolve('/')}
        class="logo-link"
        aria-label="Zur Startseite"
      >
        <img
          src={isDark() ? '/images/logo_darkmode.png' : '/images/logo_lightmode.png'}
          alt="Assixx Logo"
          class="logo"
        />
      </a>
    </div>
    <div class="nav-links">
      <a href={modulesHref}>Module</a>
      <a href={securityHref}>Sicherheit</a>
      <a href={pricingHref}>Preise</a>
      <a href={resolve('/login')}>Anmelden</a>
      <a
        href={resolve('/signup')}
        class="btn btn-index">Registrieren</a
      >
      <ThemeToggle />
    </div>
  </nav>
</header>

<style>
  /* Header — mirrors +page.svelte header styling so Legal pages render
   * the identical top nav. Keep in sync if landing header changes. */
  .header {
    border-bottom: var(--glass-border);
    padding: var(--spacing-4) 5%;
  }

  /* Logo link reset — transparent anchor around the logo image. */
  .logo-link {
    display: flex;
    align-items: center;
    text-decoration: none;
  }

  .nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 0 auto;
    width: 100%;
    max-width: 1200px;
  }

  .logo-container {
    display: flex;
    align-items: center;
    gap: var(--spacing-4);
    cursor: pointer;
    text-decoration: none;
  }

  .logo {
    display: block;
    transition: transform 0.3s ease;
    cursor: pointer;
    width: 120px;
    height: auto;
  }

  .nav-links {
    display: flex;
    align-items: center;
    gap: 2rem;
  }

  .nav-links a {
    transition: color 0.3s ease;
    color: var(--text-secondary);
    font-weight: 500;
    text-decoration: none;
  }

  .nav-links a:hover {
    color: var(--color-white);
  }

  /* Light mode: hover color swaps to brand primary (matches landing). */
  :global(html:not(.dark)) .nav-links a:hover {
    color: var(--color-primary);
  }

  @media (width < 768px) {
    .header {
      padding: var(--spacing-3);
    }

    .nav {
      flex-direction: column;
      gap: var(--spacing-4);
    }

    .logo-container {
      margin-bottom: var(--spacing-2);
    }

    .nav-links {
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--spacing-4);
    }
  }
</style>
