<script lang="ts">
  import { onMount } from 'svelte';

  import { resolve } from '$app/paths';

  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import { isDark } from '$lib/stores/theme.svelte';

  import FeaturesGrid from './_lib/FeaturesGrid.svelte';
  import PricingSection from './_lib/PricingSection.svelte';
  import SecuritySection from './_lib/SecuritySection.svelte';

  // Body class for landing page (disables global gradient)
  onMount(() => {
    document.body.classList.add('landing-page-active');
    return () => {
      document.body.classList.remove('landing-page-active');
    };
  });

  function handleReloadPage(): void {
    window.location.reload();
  }
</script>

<svelte:head>
  <title>Assixx - Enterprise 2.0 für Industriefirmen</title>
</svelte:head>

<!-- Landing Page Container -->
<div class="landing-page">
  <!-- Header -->
  <header class="header">
    <nav class="nav">
      <div class="logo-container u-cursor-pointer">
        <button
          type="button"
          class="logo-button"
          onclick={handleReloadPage}
        >
          <img
            src={isDark() ? '/images/logo_darkmode.png' : '/images/logo_lightmode.png'}
            alt="Assixx Logo"
            class="logo"
          />
        </button>
      </div>
      <div class="nav-links">
        <a href="#module">Module</a>
        <a href="#security">Sicherheit</a>
        <a href="#pricing">Preise</a>
        <a href={resolve('/login', {})}>Anmelden</a>
        <a
          href={resolve('/signup', {})}
          class="btn btn-index">Registrieren</a
        >
        <ThemeToggle />
      </div>
    </nav>
  </header>

  <!-- Hero Section -->
  <section class="hero">
    <h1>Enterprise 2.0 für Industriefirmen</h1>
    <p>
      Wissensmanagement, Kommunikation und Kollaboration - von der Produktion bis zur Verwaltung.
      Alles in einer Plattform.
    </p>
    <a
      href={resolve('/signup', {})}
      class="btn btn-index">Jetzt registrieren</a
    >
  </section>

  <!-- Features Section (Extracted Component) -->
  <FeaturesGrid />

  <!-- Security Section (Extracted Component) -->
  <SecuritySection />

  <!-- Pricing Section (Extracted Component) -->
  <PricingSection />

  <!-- Footer -->
  <footer class="footer">
    <p>&copy; 2026 Assixx. Alle Rechte vorbehalten.</p>
  </footer>
</div>

<!-- End .landing-page -->

<style>
  /* Landing page container */
  .landing-page {
    display: block;
    width: 100%;
    min-height: 100vh;
  }

  /* Header - Glass nav bar */
  .header {
    padding: var(--spacing-4) 5%;
    border-bottom: var(--glass-border);
  }

  /* Logo button reset */
  .logo-button {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
  }

  /* Navigation */
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

  /* Hero Section */
  .hero {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    margin: 0 auto;
    background-image: url('/images/background_index_1920.jpg');
    background-image: image-set(
      url('/images/background_index.webp') type('image/webp'),
      url('/images/background_index_1920.jpg') type('image/jpeg')
    );
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    padding: calc(var(--spacing-8) * 4) 5% calc(var(--spacing-8) * 2);
    max-width: 100%;
    min-height: 70vh;
    text-align: center;
  }

  .hero::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 0;
    background: linear-gradient(
      to bottom,
      oklch(13.78% 0.0312 239.33 / 16%) 0%,
      oklch(13.78% 0.0312 239.33 / 12.6%) 50%,
      oklch(13.78% 0.0312 239.33 / 83.6%) 100%
    );
  }

  .hero > :global(*) {
    position: relative;
    z-index: 1;
    max-width: 800px;
  }

  .hero h1 {
    margin-bottom: var(--spacing-6);
    color: var(--color-white);
    font-weight: 700;
    font-size: 3rem;
    text-shadow: 0 2px 4px color-mix(in oklch, var(--color-black) 30%, transparent);
    animation: fade-in-up var(--duration-slow) var(--ease-out) both;
    animation-delay: 100ms;
  }

  .hero p {
    margin-bottom: var(--spacing-6);
    color: color-mix(in oklch, var(--color-white) 85%, transparent);
    font-size: 1.25rem;
    line-height: 1.6;
    text-shadow: 0 1px 2px color-mix(in oklch, var(--color-black) 20%, transparent);
    animation: fade-in-up var(--duration-slow) var(--ease-out) both;
    animation-delay: 250ms;
  }

  /* Hero CTA button: always white text (sits on dark image overlay in both modes) */
  .hero :global(.btn) {
    color: var(--color-white);
    animation: fade-in-up var(--duration-slow) var(--ease-out) both;
    animation-delay: 400ms;
  }

  /* Footer */
  .footer {
    border-top: var(--glass-border);
    padding: var(--spacing-6) 5%;
    color: var(--color-text-secondary);
    text-align: center;
  }

  /* Light mode overrides */
  :global(html:not(.dark)) .nav-links a:hover {
    color: var(--color-primary);
  }

  /* Responsive */
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

    .hero {
      min-height: 50vh;
      padding: calc(var(--spacing-8) * 2) 5% var(--spacing-8);
    }

    .hero h1 {
      font-size: 2rem;
    }

    .hero p {
      font-size: 1rem;
    }
  }
</style>
