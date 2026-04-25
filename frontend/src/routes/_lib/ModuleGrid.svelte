<!--
  ModuleGrid.svelte
  Editorial zig-zag layout for the 4 module categories (ADR-033 addon model).
  Pattern: oversized monospace numerals + accent glow + hairline dividers,
  alternating left/right per row. No glassmorphism cards — pure inline flow.
  Theme-aware: relies on --color-text-primary / --color-text-secondary tokens
  so light & dark modes both stay readable.
-->
<script lang="ts">
  import LandingEyebrow from './LandingEyebrow.svelte';

  interface ModuleEntry {
    num: string;
    icon: string;
    label: string;
    title: string;
    copy: string;
    accent: string;
  }

  const modules: ModuleEntry[] = [
    {
      num: '01',
      icon: 'fa-users-cog',
      label: 'Personal',
      title: 'Organisation & Personal',
      copy: 'Mitarbeiter, Abteilungen, Teams und Organigramm — zentral verwaltet. Unbegrenzte Nutzer inklusive.',
      accent: 'var(--color-info)',
    },
    {
      num: '02',
      icon: 'fa-comments',
      label: 'Dialog',
      title: 'Kommunikation',
      copy: 'Schwarzes Brett, Chat, Benachrichtigungen und Umfragen — alle Mitarbeiter erreichen, vom Büro bis zur Produktion.',
      accent: 'var(--color-success)',
    },
    {
      num: '03',
      icon: 'fa-calendar-check',
      label: 'Workflow',
      title: 'Planung & Verwaltung',
      copy: 'Kalender, Schichtplanung, Urlaubsverwaltung und Dokumentenmanagement — Arbeitsabläufe digital organisiert.',
      accent: 'var(--color-warning)',
    },
    {
      num: '04',
      icon: 'fa-industry',
      label: 'Effizienz',
      title: 'Lean Management',
      copy: 'TPM-Wartung, KVP-Prozess, Arbeitsaufträge und Anlagenverwaltung — Produktivität systematisch steigern.',
      accent: 'var(--color-purple)',
    },
  ];
</script>

<section
  class="module-section"
  id="module"
>
  <div class="module-section__container">
    <LandingEyebrow text="[ MODULE // 01 — 04 ]" />
    <h2 class="module-section__title">Unsere Module</h2>
    <p class="module-section__subtitle">
      Alles was Ihr Unternehmen braucht — modular und flexibel zusammenstellbar.
    </p>

    <div class="modules">
      {#each modules as mod, i (mod.num)}
        <article
          class="module-row"
          class:module-row--reverse={i % 2 === 1}
          style="

--accent: {mod.accent}; --row-delay: {150 + i * 100}ms;"
        >
          <div class="module-row__index">
            <span class="module-row__num">{mod.num}</span>
            <span
              class="module-row__icon"
              aria-hidden="true"
            >
              <i class="fas {mod.icon}"></i>
            </span>
          </div>
          <div class="module-row__body">
            <p class="module-row__label">[ {mod.label} ]</p>
            <h3 class="module-row__title">{mod.title}</h3>
            <p class="module-row__copy">{mod.copy}</p>
          </div>
        </article>
      {/each}
    </div>
  </div>
</section>

<style>
  /*
    Section atmosphere: a subtle radial accent at the top adds depth
    without re-introducing card-style backgrounds. Layered above
    --glass-bg so light & dark modes both keep their base tone.
  */
  /*
    Section is transparent — the global body::after gradient
    (--main-bg-gradient) shows through and provides the atmosphere.
  */
  .module-section {
    position: relative;
    background: transparent;
    padding: calc(var(--spacing-8) * 2.5) 5%;
    overflow: hidden;
  }

  .module-section__container {
    margin: 0 auto;
    max-width: 1200px;
  }

  /*
    Elegant separator at the top of every section container: a short
    centered gradient hairline. Shared pattern across Module, Security
    and Pricing sections for visual rhythm.
  */
  .module-section__container::before {
    content: '';
    display: block;
    width: clamp(220px, 32vw, 420px);
    height: 3px;
    margin: 0 auto calc(var(--spacing-8) * 1.75);
    background: linear-gradient(
      to right,
      transparent 0%,
      color-mix(in oklch, var(--color-primary) 70%, transparent) 50%,
      transparent 100%
    );
  }

  /* Eyebrow moved to shared <LandingEyebrow> — see LandingEyebrow.svelte. */

  .module-section__title {
    margin: 0 0 var(--spacing-4) 0;
    color: var(--color-text-primary);
    font-weight: 700;
    font-size: clamp(2rem, 5vw, 3.5rem);
    letter-spacing: -0.02em;
    line-height: 1.05;
    text-align: center;
    animation: fade-in-up var(--duration-slow) var(--ease-out) both;
    animation-delay: 80ms;
  }

  .module-section__subtitle {
    margin: 0 auto calc(var(--spacing-8) * 2);
    max-width: 600px;
    color: var(--color-text-secondary);
    font-size: 1.125rem;
    line-height: 1.6;
    text-align: center;
    animation: fade-in-up var(--duration-slow) var(--ease-out) both;
    animation-delay: 160ms;
  }

  /* Editorial zig-zag rows — no card chrome, only hairline dividers */
  .modules {
    display: flex;
    flex-direction: column;
  }

  /*
    Flex layout (replaces fixed grid-template-columns): natural widths
    for index + body, gap controls breathing room. No hairline dividers.
  */
  .module-row {
    display: flex;
    align-items: center;
    gap: clamp(var(--spacing-6), 5vw, calc(var(--spacing-8) * 2));
    padding: calc(var(--spacing-8) * 1.5) 0;
    animation: fade-in-up var(--duration-slow) var(--ease-out) both;
    animation-delay: var(--row-delay);
  }

  /* Reverse: index → right, body → left, text-aligns right */
  .module-row--reverse {
    flex-direction: row-reverse;
  }

  .module-row--reverse .module-row__body {
    text-align: right;
  }

  .module-row__index {
    display: flex;
    align-items: baseline;
    gap: var(--spacing-3);
    color: var(--accent);
  }

  .module-row__num {
    font-family: ui-monospace, 'JetBrains Mono', 'Fira Code', monospace;
    font-weight: 700;
    font-size: clamp(3.5rem, 8vw, 6rem);
    line-height: 1;
    letter-spacing: -0.04em;

    /* Soft accent glow under the numeral, theme-agnostic */
    text-shadow: 0 0 32px color-mix(in oklch, var(--accent) 35%, transparent);
  }

  .module-row__icon {
    display: inline-flex;
    font-size: clamp(1.25rem, 2vw, 1.5rem);
    opacity: 70%;
  }

  .module-row__body {
    flex: 1;
    max-width: 56ch;
  }

  .module-row__label {
    margin: 0 0 var(--spacing-2) 0;
    color: var(--accent);
    font-family: ui-monospace, 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 0.75rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }

  .module-row__title {
    margin: 0 0 var(--spacing-3) 0;
    color: var(--color-text-primary);
    font-weight: 700;
    font-size: clamp(1.5rem, 3vw, 2.25rem);
    letter-spacing: -0.015em;
    line-height: 1.15;
  }

  .module-row__copy {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: 1rem;
    line-height: 1.65;
  }

  /* Mobile: collapse to single column, drop the zig-zag swap */
  @media (width < 768px) {
    .module-section {
      padding: calc(var(--spacing-8) * 1.5) 5%;
    }

    .module-section__title {
      font-size: clamp(1.75rem, 8vw, 2.25rem);
    }

    .module-row,
    .module-row--reverse {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--spacing-4);
      padding: var(--spacing-8) 0;
    }

    .module-row--reverse .module-row__body {
      text-align: left;
    }

    .module-row__num {
      font-size: clamp(2.5rem, 12vw, 4rem);
    }
  }
</style>
