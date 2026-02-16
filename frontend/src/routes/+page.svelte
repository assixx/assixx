<script lang="ts">
  import { onMount } from 'svelte';

  import { resolve } from '$app/paths';

  import {
    isDark,
    forceDark,
    restoreUserTheme,
  } from '$lib/stores/theme.svelte';

  import FeaturesGrid from './_lib/FeaturesGrid.svelte';
  import PricingSection from './_lib/PricingSection.svelte';
  import SecuritySection from './_lib/SecuritySection.svelte';

  // Modal state
  let showSignupModal: boolean = $state(false);

  // Always-dark page + body class for landing page (disables global gradient)
  onMount(() => {
    forceDark();
    document.body.classList.add('landing-page-active');
    return () => {
      document.body.classList.remove('landing-page-active');
      restoreUserTheme();
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
            src={isDark() ?
              '/images/logo_darkmode.png'
            : '/images/logo_lightmode.png'}
            alt="Assixx Logo"
            class="logo"
          />
        </button>
      </div>
      <div class="nav-links">
        <a href="#features">Features</a>
        <a href="#security">Sicherheit</a>
        <a href="#pricing">Preise</a>
        <a href={resolve('/login', {})}>Anmelden</a>
        <a
          href={resolve('/signup', {})}
          class="btn btn-primary-first">Registrieren</a
        >
      </div>
    </nav>
  </header>

  <!-- Hero Section -->
  <section class="hero">
    <h1>Enterprise 2.0 für Industriefirmen</h1>
    <p>
      Wissensmanagement, Kommunikation und Kollaboration - von der Produktion
      bis zur Verwaltung. Alles in einer Plattform.
    </p>
    <a
      href={resolve('/signup', {})}
      class="btn btn-primary-first">Jetzt registrieren</a
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
      <p>14 Tage kostenlos - keine Kreditkarte erforderlich</p>
      <p class="u-mb-md">
        Bitte nutzen Sie unser vollständiges Registrierungsformular:
      </p>
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
    color: #fff;
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
      rgb(0 10 20 / 16%) 0%,
      rgb(0 10 20 / 12.6%) 50%,
      rgb(0 10 20 / 83.6%) 100%
    );
  }

  .hero > :global(*) {
    position: relative;
    z-index: 1;
    max-width: 800px;
  }

  .hero h1 {
    margin-bottom: var(--spacing-6);
    color: #fff;
    font-weight: 700;
    font-size: 3rem;
    text-shadow: 0 2px 4px rgb(0 0 0 / 30%);
  }

  .hero p {
    margin-bottom: var(--spacing-6);
    color: rgb(255 255 255 / 85%);
    font-size: 1.25rem;
    line-height: 1.6;
    text-shadow: 0 1px 2px rgb(0 0 0 / 20%);
  }

  /* Footer */
  .footer {
    backdrop-filter: blur(20px);
    box-shadow: 0 -8px 32px rgb(0 0 0 / 40%);
    border-top: 1px solid rgb(255 255 255 / 15%);
    background: rgb(255 255 255 / 2%);
    padding: var(--spacing-6) 5%;
    color: var(--text-secondary);
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
    background: rgb(0 0 0 / 80%);
    width: 100%;
    height: 100%;
  }

  .modal-content {
    backdrop-filter: blur(20px) saturate(180%);
    box-shadow: var(--shadow-sm);
    border: 1px solid hsl(0deg 0% 100% / 10%);
    border-radius: var(--radius-xl);
    background: rgb(255 255 255 / 2%);
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
