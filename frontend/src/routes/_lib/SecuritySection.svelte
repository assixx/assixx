<!--
  SecuritySection.svelte
  Magic-UI-style Bento: 3-col × 3-row asymmetric grid, 5 cards with
  varying spans. Cell 01 (Hosting) is the tall center hero (col 2,
  rows 1-3) — the "100 % Deutsche Server" claim is the strongest
  argument for the DSGVO-sensitive industrial target. Remaining 4
  cards: Crypto (1×2 tall left), Compliance (1×1 bottom-left),
  ISO (1×1 top-right), Datensouveränität (1×2 tall right — merges
  the original Transparenz + Privacy items since both express data
  control). Each card has a radial glow blob in its accent colour
  (position + colour vary per cell) + hover-lift. Enterprise block
  and trust badges below remain unchanged.
-->
<script lang="ts">
  import { resolve } from '$app/paths';

  import LandingEyebrow from './LandingEyebrow.svelte';

  /**
   * Grid placement per cell — maps 1:1 to the Magic UI Bento reference
   * structure (see file header). `area` drives a CSS modifier class that
   * positions the card; `accent` drives the per-cell radial-glow colour.
   */
  type CellArea = 'hero' | 'a' | 'b' | 'c' | 'd';

  interface SecurityFeature {
    num: string;
    icon: string;
    label: string;
    title: string;
    copy: string;
    area: CellArea;
    accent: string;
  }

  const features: SecurityFeature[] = [
    {
      num: '01',
      icon: 'dns',
      label: 'Hosting',
      title: '100 % Deutsche Server',
      copy: 'Alle Daten werden ausschließlich auf Servern in Deutschland gespeichert. Kein Datentransfer ins Ausland.',
      area: 'hero',
      accent: 'var(--color-primary)',
    },
    {
      num: '02',
      icon: 'lock',
      label: 'Crypto',
      title: 'Ende-zu-Ende Verschlüsselung',
      copy: 'Modernste Verschlüsselung (XChaCha20-Poly1305) für alle Daten — bei Übertragung und Speicherung.',
      area: 'a',
      accent: 'var(--color-success)',
    },
    {
      num: '03',
      icon: 'policy',
      label: 'Compliance',
      title: 'DSGVO-konform',
      copy: 'Volle Compliance mit allen deutschen und europäischen Datenschutzgesetzen. Regelmäßige Audits.',
      area: 'b',
      accent: 'var(--color-info)',
    },
    {
      num: '04',
      icon: 'verified_user',
      label: 'Zertifiziert',
      title: 'ISO 27001 zertifiziert',
      copy: 'Unsere Sicherheitsprozesse entsprechen den höchsten internationalen Standards.',
      area: 'c',
      accent: 'var(--color-warning)',
    },
    {
      // Merged from original 04 Transparenz + 06 Privacy — both express
      // data-control / sovereignty. One stronger card instead of two
      // overlapping ones.
      num: '05',
      icon: 'shield_person',
      label: 'Datensouveränität',
      title: 'Volle Kontrolle über Ihre Daten',
      copy: 'Einsicht, Export und Löschung auf Knopfdruck. Keine Weitergabe an Dritte, keine Werbung, kein Tracking.',
      area: 'd',
      accent: 'var(--color-purple)',
    },
  ];
</script>

<section
  class="security-section"
  id="security"
>
  <div class="security-section__container">
    <LandingEyebrow text="[ SICHERHEIT // 01 — 05 ]" />
    <h2 class="security-section__title">Ihre Daten sind bei uns sicher</h2>
    <p class="security-section__subtitle">
      Datenschutz und Sicherheit haben bei uns höchste Priorität. Ihre sensiblen Unternehmensdaten
      sind durch modernste Verschlüsselung und strikte Sicherheitsmaßnahmen geschützt.
    </p>

    <!--
      Magic-UI-Bento: 3-col × 3-row asymmetric grid. Hero card (Hosting)
      sits in the tall center column; smaller cards flank left/right
      with one tall card each side. Each `.security-cell--{area}`
      modifier sets grid placement + radial-blob position. Inline
      `--accent` drives the per-cell glow colour.
    -->
    <div class="security-bento">
      {#each features as feat, i (feat.num)}
        <article
          class="security-cell security-cell--{feat.area}"
          style="

--accent: {feat.accent}; --cell-delay: {150 + i * 70}ms;"
        >
          <span
            class="security-cell__blob"
            aria-hidden="true"
          ></span>
          <div class="security-cell__content">
            <span
              class="material-symbols-outlined security-cell__icon"
              aria-hidden="true"
            >
              {feat.icon}
            </span>
            <p class="security-cell__eyebrow">
              <span class="security-cell__num">{feat.num}</span>
              <span class="security-cell__label">[ {feat.label} ]</span>
            </p>
            <h3 class="security-cell__title">{feat.title}</h3>
            <p class="security-cell__copy">{feat.copy}</p>
          </div>
        </article>
      {/each}
    </div>

    <!--
      Enterprise block: asymmetric split layout + oversized typography.
      Visually distinct from the 3×2 tile grid above — intro on the left,
      feature list on the right, full-width container, no card chrome.
    -->
    <div class="enterprise-block">
      <p class="enterprise-block__eyebrow">[ ENTERPRISE // ON-PREMISE ]</p>
      <div class="enterprise-block__split">
        <div class="enterprise-block__intro">
          <span
            class="material-symbols-outlined enterprise-block__icon"
            aria-hidden="true"
          >
            business
          </span>
          <h3 class="enterprise-block__title">Enterprise On-Premise Lösung</h3>
          <p class="enterprise-block__description">
            Für Unternehmen mit besonderen Sicherheitsanforderungen bieten wir die Möglichkeit,
            Assixx vollständig auf Ihren eigenen Servern zu betreiben.
            <strong>100% Ihrer Daten bleiben in Ihrer eigenen Infrastruktur.</strong>
          </p>
          <!-- eslint-disable svelte/no-navigation-without-resolve -- dynamic query string -->
          <a
            href={`${resolve('/signup')}?plan=enterprise`}
            class="btn btn-index enterprise-block__button">Enterprise-Beratung anfragen</a
          >
          <!-- eslint-enable svelte/no-navigation-without-resolve -->
        </div>
        <ul class="enterprise-features">
          <li class="enterprise-feature">
            <span
              class="material-symbols-outlined enterprise-feature__icon"
              aria-hidden="true">check_circle</span
            >
            <div>
              <p class="enterprise-feature__name">Eigene Server</p>
              <p class="enterprise-feature__desc">Installation in Ihrem Rechenzentrum</p>
            </div>
          </li>
          <li class="enterprise-feature">
            <span
              class="material-symbols-outlined enterprise-feature__icon"
              aria-hidden="true">check_circle</span
            >
            <div>
              <p class="enterprise-feature__name">Volle Kontrolle</p>
              <p class="enterprise-feature__desc">Sie behalten alle Zugriffsrechte</p>
            </div>
          </li>
          <li class="enterprise-feature">
            <span
              class="material-symbols-outlined enterprise-feature__icon"
              aria-hidden="true">check_circle</span
            >
            <div>
              <p class="enterprise-feature__name">Compliance</p>
              <p class="enterprise-feature__desc">Erfüllt strengste Auflagen</p>
            </div>
          </li>
          <li class="enterprise-feature">
            <span
              class="material-symbols-outlined enterprise-feature__icon"
              aria-hidden="true">check_circle</span
            >
            <div>
              <p class="enterprise-feature__name">Support</p>
              <p class="enterprise-feature__desc">Dediziertes Enterprise-Team</p>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <div class="trust-badges">
      <p class="trust-badges__label">Entwickelt für die deutsche Industrie</p>
      <div class="trust-badges__list">
        <div class="trust-badge">SSL-verschlüsselt</div>
        <div class="trust-badge">DSGVO-konform</div>
        <div class="trust-badge">Made in Germany</div>
        <div class="trust-badge">ISO 27001</div>
      </div>
    </div>
  </div>
</section>

<style>
  /*
    Mirror of ModuleGrid atmosphere with the radial accent at the bottom
    for visual variety between the two consecutive sections.
  */
  /* Transparent — global --main-bg-gradient shows through */
  .security-section {
    position: relative;
    background: transparent;
    padding: calc(var(--spacing-8) * 2.5) 5%;
    overflow: hidden;
  }

  .security-section__container {
    margin: 0 auto;
    max-width: 1200px;
  }

  /* Elegant top separator — shared pattern across all sections */
  .security-section__container::before {
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

  .security-section__title {
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

  .security-section__subtitle {
    margin: 0 auto calc(var(--spacing-8) * 2);
    max-width: 720px;
    color: var(--color-text-secondary);
    font-size: 1.125rem;
    line-height: 1.7;
    text-align: center;
    animation: fade-in-up var(--duration-slow) var(--ease-out) both;
    animation-delay: 160ms;
  }

  /*
    Magic-UI-Bento: 3-col × 3-row grid with 5 cells, asymmetric spans.
    Grid placements are defined per-area below. Gap between cells is
    deliberate — this is card-based Bento, not a hairline grid.
  */
  .security-bento {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, minmax(150px, 1fr));
    gap: var(--spacing-4);
    min-height: 560px;
  }

  /*
    Card chrome. `isolation: isolate` confines the ::before stacking
    context so the glow blob stays under the content but above the
    card background, without needing z-index on every content element.
  */
  .security-cell {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    overflow: hidden;
    padding: calc(var(--spacing-6) * 1.2);
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-xl);
    cursor: default;
    isolation: isolate;
    transition:
      transform var(--duration-normal) var(--ease-out),
      border-color var(--duration-normal) var(--ease-out),
      box-shadow var(--duration-normal) var(--ease-out);
    animation: fade-in-up var(--duration-slow) var(--ease-out) both;
    animation-delay: var(--cell-delay);
  }

  /*
    Radial glow blob — the Bento "flavour" element. Position + colour
    vary per cell via --accent + --blob-pos. Blob sits BEHIND content
    (z-index -1 inside isolation), so no wrapper div needed.
  */
  .security-cell__blob {
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background: radial-gradient(
      circle at var(--blob-pos, 80% 20%),
      color-mix(in oklch, var(--accent) 26%, transparent) 0%,
      transparent 60%
    );
    opacity: 85%;
    transition: opacity var(--duration-normal) var(--ease-out);
  }

  .security-cell__content {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  .security-cell:hover {
    transform: translateY(-4px);
    border-color: color-mix(in oklch, var(--accent) 40%, var(--glass-border));
    box-shadow: 0 20px 40px -18px color-mix(in oklch, var(--accent) 28%, transparent);
  }

  .security-cell:hover .security-cell__blob {
    opacity: 100%;
  }

  /* --- Grid placements (Magic UI reference mapping) --- */

  /* Center, full-height tall — the hero claim */
  .security-cell--hero {
    --blob-pos: 50% 12%;

    grid-column: 2;
    grid-row: 1 / 4;
    padding: calc(var(--spacing-8) * 1.1);
  }

  /* Left column top (1×2 tall) */
  .security-cell--a {
    --blob-pos: 88% 85%;

    grid-column: 1;
    grid-row: 1 / 3;
  }

  /* Left column bottom (1×1) */
  .security-cell--b {
    --blob-pos: 15% 50%;

    grid-column: 1;
    grid-row: 3;
  }

  /* Right column top (1×1) */
  .security-cell--c {
    --blob-pos: 80% 20%;

    grid-column: 3;
    grid-row: 1;
  }

  /* Right column bottom (1×2 tall) */
  .security-cell--d {
    --blob-pos: 20% 85%;

    grid-column: 3;
    grid-row: 2 / 4;
  }

  /* --- Content --- */

  .security-cell__icon {
    margin-bottom: var(--spacing-2);
    color: var(--accent);
    font-size: clamp(1.75rem, 2.5vw, 2.25rem);
    text-shadow: 0 0 24px color-mix(in oklch, var(--accent) 30%, transparent);
  }

  .security-cell__eyebrow {
    display: flex;
    align-items: baseline;
    gap: var(--spacing-3);
    margin: 0;
    color: var(--accent);
    font-family: ui-monospace, 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 0.75rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }

  .security-cell__num {
    font-weight: 700;
    font-size: 0.8125rem;
    opacity: 85%;
  }

  .security-cell__label {
    color: inherit;
  }

  .security-cell__title {
    margin: 0;
    color: var(--color-text-primary);
    font-weight: 700;
    font-size: clamp(1.125rem, 1.7vw, 1.375rem);
    letter-spacing: -0.01em;
    line-height: 1.25;
  }

  .security-cell__copy {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: 0.9375rem;
    line-height: 1.55;
  }

  /* --- Hero cell: larger typography + stacked eyebrow --- */

  .security-cell--hero .security-cell__icon {
    margin-bottom: var(--spacing-3);
    font-size: clamp(2.5rem, 3.8vw, 3.25rem);
    text-shadow: 0 0 40px color-mix(in oklch, var(--accent) 35%, transparent);
  }

  .security-cell--hero .security-cell__eyebrow {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-2);
  }

  .security-cell--hero .security-cell__num {
    font-size: clamp(2.5rem, 5vw, 3.75rem);
    line-height: 1;
    letter-spacing: -0.04em;
    opacity: 100%;
    text-shadow: 0 0 32px color-mix(in oklch, var(--accent) 35%, transparent);
  }

  .security-cell--hero .security-cell__title {
    font-weight: 800;
    font-size: clamp(1.75rem, 3.2vw, 2.5rem);
    letter-spacing: -0.02em;
    line-height: 1.1;
  }

  .security-cell--hero .security-cell__copy {
    max-width: 42ch;
    font-size: 1.0625rem;
    line-height: 1.65;
  }

  /*
    Enterprise block — asymmetric 2-column split, left-aligned,
    oversized typography. Visually distinct from the 3×2 tile grid.
  */
  .enterprise-block {
    margin: calc(var(--spacing-8) * 3) 0 0;
    padding: calc(var(--spacing-8) * 2.5) 0 calc(var(--spacing-8) * 1.5);
    max-width: 100%;
  }

  .enterprise-block__eyebrow {
    margin: 0 0 var(--spacing-5) 0;
    color: var(--color-primary);
    font-family: ui-monospace, 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 0.8125rem;
    letter-spacing: 0.25em;
    text-transform: uppercase;
  }

  .enterprise-block__split {
    display: grid;
    grid-template-columns: 1.6fr 1fr;
    gap: clamp(var(--spacing-8), 6vw, calc(var(--spacing-8) * 2.5));
    align-items: start;
  }

  .enterprise-block__intro {
    max-width: 56ch;
  }

  .enterprise-block__icon {
    display: block;
    margin-bottom: var(--spacing-5);
    color: var(--color-primary);
    font-size: clamp(2.75rem, 4.5vw, 3.75rem);
    text-shadow: 0 0 40px color-mix(in oklch, var(--color-primary) 30%, transparent);
  }

  .enterprise-block__title {
    margin: 0 0 var(--spacing-5) 0;
    color: var(--color-text-primary);
    font-weight: 800;
    font-size: clamp(2rem, 4.5vw, 3.5rem);
    letter-spacing: -0.02em;
    line-height: 1.05;
  }

  .enterprise-block__description {
    margin: 0 0 var(--spacing-8) 0;
    color: var(--color-text-secondary);
    font-size: 1.125rem;
    line-height: 1.7;
  }

  .enterprise-block__description strong {
    color: var(--color-text-primary);
    font-weight: 600;
  }

  .enterprise-block__button {
    background: none;
    font-weight: 600;
    font-size: 1.0625rem;
  }

  .enterprise-features {
    display: flex;
    flex-direction: column;
    gap: calc(var(--spacing-6) * 1.15);
    justify-self: end;
    margin: var(--spacing-3) 0 0 0;
    padding: 0;
    width: 100%;
    max-width: 360px;
    list-style: none;
  }

  .enterprise-feature {
    display: flex;
    gap: var(--spacing-4);
    align-items: flex-start;
  }

  .enterprise-feature__icon {
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--success-color);
    font-size: 1.75rem;
  }

  .enterprise-feature__name {
    margin: 0 0 var(--spacing-1) 0;
    color: var(--color-text-primary);
    font-weight: 600;
    font-size: 1.125rem;
    letter-spacing: -0.005em;
  }

  .enterprise-feature__desc {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: 0.9375rem;
    line-height: 1.5;
  }

  .trust-badges {
    margin-top: calc(var(--spacing-8) * 1.5);
    text-align: center;
  }

  .trust-badges__label {
    margin: 0 0 var(--spacing-6);
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .trust-badges__list {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: var(--spacing-6);
  }

  .trust-badge {
    border: 1px solid color-mix(in oklch, var(--color-text-primary) 15%, transparent);
    border-radius: var(--radius-full);
    padding: var(--spacing-2) var(--spacing-4);
    color: var(--color-text-secondary);
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.3px;
  }

  /*
    Tablet: drop the 3×3 Bento, switch to 2-col auto-flow. Hero spans
    both top cells, others flow in pairs. Explicit grid resets on
    every modifier so the desktop positions don't bleed through.
  */
  @media (width < 1024px) {
    .security-bento {
      grid-template-columns: repeat(2, 1fr);
      grid-template-rows: auto;
      min-height: 0;
    }

    .security-cell--hero,
    .security-cell--a,
    .security-cell--b,
    .security-cell--c,
    .security-cell--d {
      grid-column: auto;
      grid-row: auto;
    }

    .security-cell--hero {
      grid-column: 1 / 3;
    }

    .enterprise-block__split {
      grid-template-columns: 1fr;
      gap: calc(var(--spacing-8) * 1.5);
    }
  }

  /*
    Mobile: single-column stack. Every card takes full width, hero
    keeps its larger typography but uses the tighter padding so the
    content doesn't dwarf the small viewport.
  */
  @media (width < 640px) {
    .security-section {
      padding: calc(var(--spacing-8) * 1.5) 5%;
    }

    .security-bento {
      grid-template-columns: 1fr;
    }

    .security-cell--hero {
      grid-column: 1;
      padding: calc(var(--spacing-6) * 1.25);
    }

    .security-cell--hero .security-cell__num {
      font-size: clamp(2.5rem, 12vw, 3.5rem);
    }

    .security-cell--hero .security-cell__title {
      font-size: clamp(1.5rem, 7vw, 2rem);
    }

    .enterprise-block__title {
      font-size: clamp(1.75rem, 8vw, 2.5rem);
    }

    .enterprise-block__icon {
      font-size: 2.5rem;
    }
  }
</style>
