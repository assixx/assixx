<script lang="ts">
  import { onMount } from 'svelte';

  import { resolve } from '$app/paths';

  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import { isDark } from '$lib/stores/theme.svelte';

  import FeaturesGrid from './_lib/FeaturesGrid.svelte';
  import PricingSection from './_lib/PricingSection.svelte';
  import SecuritySection from './_lib/SecuritySection.svelte';

  // Modal state
  let showSignupModal: boolean = $state(false);

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

  function closeSignupModal(): void {
    showSignupModal = false;
  }

  function handleModalBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) {
      closeSignupModal();
    }
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

<!-- Signup Modal (kept for compatibility but links go to /signup) -->
{#if showSignupModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="signup-modal"
    style="display: flex"
    onclick={handleModalBackdropClick}
  >
    <div class="modal-content">
      <h2>Jetzt kostenlos testen</h2>
      <p>30 Tage kostenlos testen - keine Kreditkarte erforderlich</p>
      <p class="u-mb-md">Bitte nutzen Sie unser vollständiges Registrierungsformular:</p>
      <a
        href={resolve('/signup', {})}
        class="btn btn-index u-w-full">Zur Registrierung</a
      >
      <button
        type="button"
        class="btn btn-secondary btn-cancel--full"
        onclick={closeSignupModal}>Abbrechen</button
      >
    </div>
  </div>
{/if}

<style>
  /* Landing page container */
  .landing-page {
    display: block;
    width: 100%;
    min-height: 100vh;
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
  }

  .hero p {
    margin-bottom: var(--spacing-6);
    color: color-mix(in oklch, var(--color-white) 85%, transparent);
    font-size: 1.25rem;
    line-height: 1.6;
    text-shadow: 0 1px 2px color-mix(in oklch, var(--color-black) 20%, transparent);
  }

  /* Hero CTA button: always white text (sits on dark image overlay in both modes) */
  .hero :global(.btn) {
    color: var(--color-white);
  }

  /* Footer */
  .footer {
    backdrop-filter: blur(20px);
    box-shadow: 0 -8px 32px color-mix(in oklch, var(--color-black) 20%, transparent);
    border-top: 1px solid var(--color-glass-border);
    background: var(--glass-bg);
    padding: var(--spacing-6) 5%;
    color: var(--color-text-secondary);
    text-align: center;
  }

  /* Signup Modal */
  .signup-modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    justify-content: center;
    align-items: center;
    z-index: 2000;
    backdrop-filter: blur(10px);
    background: color-mix(in oklch, var(--color-black) 80%, transparent);
    width: 100%;
    height: 100%;
  }

  .modal-content {
    border: 1px solid var(--color-glass-border);
    border-radius: var(--radius-xl);
    background: var(--glass-bg);
    padding: var(--spacing-6);
    width: 90%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-content h2 {
    margin-bottom: var(--spacing-2);
    color: var(--primary-color);
    font-weight: 600;
  }

  .modal-content p {
    margin-bottom: var(--spacing-6);
    color: var(--text-secondary);
    font-size: 13px;
  }

  .btn-cancel--full {
    margin-top: 1rem;
    width: 100%;
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

    .modal-content {
      padding: var(--spacing-3);
      width: 95%;
    }
  }
</style>
