<script lang="ts">
  import { resolve } from '$app/paths';

  import { isDark } from '$lib/stores/theme.svelte';

  const year = new Date().getFullYear();
</script>

<footer class="landing-footer">
  <div class="landing-footer__inner">
    <div class="landing-footer__grid">
      <div class="landing-footer__brand">
        <!--
          Footer follows the active theme (see ADR/design decision change).
          Logo flips with theme: dark-mode logo (white mark) on dark bg,
          light-mode logo on light bg.
        -->
        <img
          src={isDark() ? '/images/logo_darkmode.png' : '/images/logo_lightmode.png'}
          alt="Assixx"
          class="landing-footer__logo"
        />
        <p class="landing-footer__tagline">
          Enterprise 2.0 für Industriefirmen — Wissensmanagement, Kommunikation und Kollaboration in
          einer Plattform.
        </p>
      </div>

      <div>
        <h3 class="landing-footer__heading">Kontakt</h3>
        <ul class="landing-footer__list">
          <li class="landing-footer__item">
            <svg
              class="landing-footer__icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M20 10c0 7-8 13-8 13s-8-6-8-13a8 8 0 0 1 16 0Z" />
              <circle
                cx="12"
                cy="10"
                r="3"
              />
            </svg>
            <span>
              Neustraße 13
              <br />
              48703 Stadtlohn
            </span>
          </li>
          <li class="landing-footer__item">
            <svg
              class="landing-footer__icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path
                d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z"
              />
            </svg>
            <a href="tel:+4925639005161">02563 9005161</a>
          </li>
          <li class="landing-footer__item">
            <svg
              class="landing-footer__icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <rect
                width="20"
                height="16"
                x="2"
                y="4"
                rx="2"
              />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
            <a href="mailto:info@scs-technik.de">info@scs-technik.de</a>
          </li>
        </ul>
      </div>

      <div>
        <h3 class="landing-footer__heading">Navigation</h3>
        <ul class="landing-footer__list">
          <li><a href="#module">Module</a></li>
          <li><a href="#security">Sicherheit</a></li>
          <li><a href="#pricing">Preise</a></li>
          <li><a href={resolve('/roadmap')}>Roadmap</a></li>
          <li><a href={resolve('/login')}>Anmelden</a></li>
          <li><a href={resolve('/signup')}>Registrieren</a></li>
        </ul>
      </div>

      <div>
        <h3 class="landing-footer__heading">Rechtliches</h3>
        <ul class="landing-footer__list">
          <li><a href={resolve('/impressum')}>Impressum</a></li>
          <li><a href={resolve('/datenschutz')}>Datenschutz</a></li>
          <li><a href={resolve('/disclaimer')}>Disclaimer</a></li>
        </ul>
      </div>
    </div>
  </div>

  <div class="landing-footer__bottom">
    <p>&copy; {year} Assixx &ndash; Alle Rechte vorbehalten.</p>
  </div>
</footer>

<style>
  /*
    Footer follows active theme via design-system tokens (see
    design-system/variables-light.css + variables-dark.css). Previously
    hardcoded white-on-black; that broke readability in light mode.
    Brand accent (--color-primary) remains theme-neutral — legible on both.
  */
  .landing-footer {
    position: relative;

    /* Transparent — global --main-bg-gradient (body::after, z-index: -100)
     * shows through, matching PricingSection/SecuritySection pattern.
     * WHY: opaque --main-bg here covered the shared background gradient,
     * breaking visual consistency across landing sections. */
    background-color: transparent;
    border-top: 1px solid var(--color-glass-border);
  }

  .landing-footer__inner {
    margin: 0 auto;
    padding: calc(var(--spacing-8) * 2) 5% var(--spacing-8);
    max-width: 1200px;
  }

  .landing-footer__grid {
    display: grid;
    grid-template-columns: 1.4fr 1fr 1fr 1fr;
    gap: var(--spacing-8);
  }

  .landing-footer__brand {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .landing-footer__logo {
    width: 180px;
    height: auto;
  }

  .landing-footer__tagline {
    margin: 0;
    max-width: 280px;
    color: var(--color-text-tertiary);
    font-size: 0.875rem;
    line-height: 1.6;
  }

  .landing-footer__heading {
    margin: 0 0 var(--spacing-5) 0;
    color: var(--color-primary);
    font-weight: 600;
    font-size: 0.75rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
  }

  .landing-footer__list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .landing-footer__item {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-2);
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    line-height: 1.5;
  }

  .landing-footer__icon {
    flex-shrink: 0;
    margin-top: 2px;
    width: 16px;
    height: 16px;
    color: var(--color-primary);
  }

  /* WHY: Hover parity with LegalFooter (compact) — color → --color-primary +
   * animated 1px underline via ::after. Consistent hover feel across all
   * footer links (see LegalFooter.svelte). */
  .landing-footer a {
    position: relative;
    padding-bottom: 1px;
    transition: color 0.2s ease;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    text-decoration: none;
  }

  .landing-footer a::after {
    content: '';
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    transform: scaleX(0);
    transform-origin: center;
    transition: transform 0.25s var(--ease-out, ease-out);
    background: var(--color-primary);
    height: 1px;
  }

  .landing-footer a:hover {
    color: var(--color-primary);
  }

  .landing-footer a:hover::after {
    transform: scaleX(1);
  }

  @media (prefers-reduced-motion: reduce) {
    .landing-footer a::after {
      transition: none;
    }
  }

  .landing-footer__bottom {
    border-top: 1px solid var(--color-glass-border);
    padding: var(--spacing-4) 5%;
    text-align: center;
  }

  .landing-footer__bottom p {
    margin: 0;
    font-size: 0.8125rem;
  }

  @media (width < 768px) {
    .landing-footer__inner {
      padding: var(--spacing-8) 5% var(--spacing-6);
    }

    .landing-footer__grid {
      grid-template-columns: 1fr;
      gap: var(--spacing-6);
    }

    .landing-footer__logo {
      width: 150px;
    }
  }

  @media (width >= 768px) and (width < 1024px) {
    .landing-footer__grid {
      grid-template-columns: 1fr 1fr;
    }

    .landing-footer__brand {
      grid-column: 1 / -1;
    }
  }
</style>
