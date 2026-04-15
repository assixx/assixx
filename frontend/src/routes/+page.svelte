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
    min-height: max(515px, 65vh);
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
    Hero CTA: white on the dark hero overlay (default / dark mode).
    Light mode swaps in a brighter hero image, so white becomes
    unreadable — light-mode override below forces black.
  */
  .hero :global(.btn) {
    color: var(--color-white);
    animation: fade-in-up var(--duration-slow) var(--ease-out) both;
    animation-delay: 400ms;
  }

  /* Light-mode hero btn: black text for contrast on the light hero image */
  :global(html:not(.dark)) .hero :global(.btn) {
    color: var(--color-black);
  }

  /*
   * Light-mode hero image: softer, lifted-blacks variant of the default dark
   * hero so the section doesn't read as "night mode" when the user toggles
   * light. Dark mode (default) keeps the original asset untouched.
   * Assets generated via ImageMagick from background_index_1920.jpg.
   */
  :global(html:not(.dark)) .hero {
    background-image: url('/images/background_index_light_1920.jpg');
    background-image: image-set(
      url('/images/background_index_light.webp') type('image/webp'),
      url('/images/background_index_light_1920.jpg') type('image/jpeg')
    );
  }

  /*
   * Light-mode overlay: the default hero uses a dark gradient (0% → 83.6%
   * opacity of near-black) to lift white text off the image. On the light
   * hero that overlay muddies the sky-blue image, so swap to a subtle white
   * gradient that preserves image readability while keeping enough haze at
   * the bottom for CTA contrast.
   */
  :global(html:not(.dark)) .hero::before {
    background: linear-gradient(
      to bottom,
      oklch(100% 0 0 / 0%) 0%,
      oklch(100% 0 0 / 0%) 50%,
      oklch(100% 0 0 / 25%) 100%
    );
  }

  /*
   * Light-mode hero typography: source uses hardcoded white to sit on the
   * dark overlay. In light mode we route through the design-system text
   * tokens (see design-system/variables-light.css) so h1/p follow the theme
   * and remain legible on the sky-blue hero.
   */
  :global(html:not(.dark)) .hero h1 {
    color: var(--color-text-primary);
    text-shadow: 0 1px 2px color-mix(in oklch, var(--color-white) 60%, transparent);
  }

  :global(html:not(.dark)) .hero p {
    color: var(--color-text-secondary);
    text-shadow: none;
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
