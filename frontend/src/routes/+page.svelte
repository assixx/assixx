<script lang="ts">
  import { resolve } from '$app/paths';

  import LandingFooter from '$lib/components/LandingFooter.svelte';
  import LandingHeader from '$lib/components/LandingHeader.svelte';
  import Seo from '$lib/components/Seo.svelte';

  import ModuleGrid from './_lib/ModuleGrid.svelte';
  import PricingSection from './_lib/PricingSection.svelte';
  import SecuritySection from './_lib/SecuritySection.svelte';

  const STRUCTURED_DATA: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Assixx',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description:
      'Enterprise 2.0 Platform für Industriefirmen — Wissensmanagement, Kommunikation und Kollaboration.',
    url: 'https://www.assixx.com',
    inLanguage: 'de',
    author: {
      '@type': 'Organization',
      name: 'SCS-Technik',
      url: 'https://www.scs-technik.de',
    },
  };
</script>

<Seo
  title="Assixx - Enterprise 2.0 für Industriefirmen"
  description="Multi-Tenant SaaS für Wissensmanagement, Kommunikation und Kollaboration in Industrieunternehmen. Von der Produktion bis zur Verwaltung — alles in einer Plattform."
  canonical="https://www.assixx.com/"
  jsonLd={STRUCTURED_DATA}
/>

<!-- Landing Page Container -->
<div class="landing-page">
  <!-- Header — shared across public surface (Landing + Legal pages). -->
  <LandingHeader />

  <!-- Hero Section -->
  <section class="hero">
    <h1>Enterprise 2.0 für Industriefirmen</h1>
    <p>
      Wissensmanagement, Kommunikation und Kollaboration - von der Produktion bis zur Verwaltung.
      Alles in einer Plattform.
    </p>
    <a
      href={resolve('/signup')}
      class="btn btn-index">Jetzt registrieren</a
    >
  </section>

  <!-- Module Section (Extracted Component) -->
  <ModuleGrid />

  <!-- Security Section (Extracted Component) -->
  <SecuritySection />

  <!-- Pricing Section (Extracted Component) -->
  <PricingSection />

  <!-- Footer -->
  <LandingFooter />
</div>

<!-- End .landing-page -->

<style>
  /* Landing page container */
  .landing-page {
    display: block;
    width: 100%;
    min-height: 100vh;
  }

  /* Header + nav styles now live in LandingHeader.svelte — shared with
   * Legal pages (Impressum, Datenschutz) to guarantee identical markup
   * and styling across the public surface. */

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

    /*
      Hero height: 815px hard floor (guarantees no collapse even on very
      short viewports), grows with 65vh on taller monitors. max() picks
      whichever is larger.
    */
    min-height: max(700px, 65vh);
    text-align: center;
    margin-bottom: 150px;
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

  /*
    Hero CTA: white on the dark hero overlay. Hero uses the same dark
    background asset in both light and dark mode (per product decision
    2026-04-22 — light-mode variant removed), so white stays legible.
  */
  .hero :global(.btn) {
    color: var(--color-white);
    animation: fade-in-up var(--duration-slow) var(--ease-out) both;
    animation-delay: 400ms;
  }

  /* Responsive */
  @media (width < 768px) {
    .hero {
      /* Mobile: tighter clamp, still fluid */
      min-height: clamp(420px, 55vh, 560px);
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
