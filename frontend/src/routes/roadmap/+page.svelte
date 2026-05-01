<script lang="ts">
  /*
   * Public Roadmap page — visual 4-phase timeline (Beta → Alpha → RC → Stable).
   *
   * Visual design blends two patterns from the existing codebase:
   *   - BTS-style vertical numbered timeline (left column: Border-circle
   *     indicator + gradient vertical connector between phases)
   *   - SecuritySection bento aesthetic (right column: glass card + radial
   *     accent blob + Mono-Eyebrow + Material-Symbols icon + hover-lift)
   *
   * Per-phase accent rotates: primary → info → warning → success, signalling
   * progressive maturity (experimental → hardening → near-release → done).
   *
   * The Disclaimer page (/disclaimer) stays focused on legal/data-loss
   * caveats and links here for the visual breakdown.
   */
  import LandingFooter from '$lib/components/LandingFooter.svelte';
  import LandingHeader from '$lib/components/LandingHeader.svelte';
  import Seo from '$lib/components/Seo.svelte';

  // 'active' = currently running, 'next' = upcoming primary, 'future' = later.
  // Only ONE entry should be 'active'. Flip Beta from 'next' → 'active' on
  // 01.06.2026 (could be derived from a date check; static for transparency).
  type PhaseStatus = 'active' | 'next' | 'future';

  interface Phase {
    num: string;
    id: string;
    label: string;
    title: string;
    icon: string;
    accent: string;
    dateRange: string;
    duration: string;
    status: PhaseStatus;
    summary: string;
    bullets: readonly string[];
  }

  const phases: readonly Phase[] = [
    {
      num: '01',
      id: 'beta',
      label: 'BETA',
      title: 'Beta',
      icon: 'science',
      accent: 'var(--color-primary)',
      dateRange: '01.06.2026 – 01.06.2028',
      duration: 'ca. 24 Monate',
      status: 'next',
      summary:
        'Testbetrieb mit ausgewählten Mandanten. Aktive Fehlerbehebung, Feature-Erweiterungen und parallele App-Entwicklung.',
      bullets: [
        'Direkte Bug-Behebung mit kurzer Reaktionszeit',
        'Umsetzung von Kundenwünschen im laufenden Sprint',
        'Parallele Entwicklung der mobilen Apps (iOS + Android)',
        'Laufende Verbesserungen an UX und Stabilität',
      ],
    },
    {
      num: '02',
      id: 'alpha',
      label: 'ALPHA',
      title: 'Alpha',
      icon: 'shield',
      accent: 'var(--color-info)',
      dateRange: 'ab Mitte 2028',
      duration: 'ca. 6 – 12 Monate',
      status: 'future',
      summary:
        'Stabilisierungsphase. Funktionsumfang weitgehend eingefroren — Fokus auf Härtung, Performance und Skalierung.',
      bullets: [
        'Performance-Optimierung (Datenbank, Caching, Frontend)',
        'Hochverfügbarkeit (Streaming-Replication, Auto-Failover)',
        'Security-Audits und Penetration-Tests',
        'Skalierung auf größere Mandantenzahlen',
      ],
    },
    {
      num: '03',
      id: 'rc',
      label: 'RELEASE CANDIDATE',
      title: 'Release Candidate',
      icon: 'flag_circle',
      accent: 'var(--color-warning)',
      dateRange: 'voraussichtlich Anfang 2029',
      duration: 'ca. 3 Monate',
      status: 'future',
      summary:
        'Pre-Release-Phase. Finale Validierung vor v1.0 — Funktions-Freeze, SLA-Vorbereitung, Notfall-Übungen.',
      bullets: [
        'Vollständiger Funktions-Freeze',
        'Vorbereitung verbindlicher SLAs',
        'Customer-Onboarding-Material wird finalisiert',
        'Disaster-Recovery-Übungen mit Probe-Restore',
      ],
    },
    {
      num: '04',
      id: 'stable',
      label: 'STABLE',
      title: 'Stable v1.0',
      icon: 'verified',
      accent: 'var(--color-success)',
      dateRange: 'voraussichtlich Mitte 2029',
      duration: 'GA',
      status: 'future',
      summary:
        'Produktionsreif. Verbindliche SLAs, etablierter Release-Prozess, internationale Skalierung möglich.',
      bullets: [
        'Verbindliche SLA: 99,9 % Verfügbarkeit',
        'RTO ≤ 5 Minuten · RPO ≤ 1 Minute',
        'Strukturierter Release-Zyklus (Semantic Versioning)',
        'Internationale Skalierung über Deutschland hinaus',
      ],
    },
  ];
</script>

<Seo
  title="Roadmap — Beta · Alpha · RC · Stable | Assixx"
  description="Die vier Phasen von Assixx: Beta startet 01.06.2026, gefolgt von Alpha, Release Candidate und Stable v1.0."
  canonical="https://www.assixx.com/roadmap"
/>

<LandingHeader offLanding />

<main class="roadmap-page">
  <div class="roadmap-page__container">
    <!-- Hero -->
    <header class="roadmap-page__hero">
      <p class="roadmap-page__eyebrow">[ ROADMAP // 01 — 04 ]</p>
      <h1 class="roadmap-page__title">Vier Phasen bis Stable v1.0</h1>
      <p class="roadmap-page__subtitle">
        Assixx wächst in vier definierten Reifestufen — von der Closed Beta mit ausgewählten
        Mandanten bis zur produktionsreifen v1.0 mit verbindlichen SLAs.
      </p>
      <div
        class="roadmap-page__status"
        role="status"
      >
        <span
          class="material-symbols-outlined"
          aria-hidden="true">info</span
        >
        <span>
          Stand 04/2026 — Vorbereitung der Beta-Phase. Beta-Start:
          <strong>01.06.2026</strong>.
        </span>
      </div>
    </header>

    <!-- Vertical timeline: BTS indicator + bento card -->
    <ol
      class="rt-timeline"
      role="list"
    >
      {#each phases as phase, i (phase.id)}
        <li
          class="rt-phase rt-phase--{phase.status}"
          style="

--accent: {phase.accent}; --phase-delay: {200 + i * 120}ms;"
        >
          <!-- Indicator column (BTS-style) -->
          <div
            class="rt-indicator-col"
            aria-hidden="true"
          >
            <div class="rt-indicator">
              <span class="rt-indicator__num">{phase.num}</span>
            </div>
            {#if i < phases.length - 1}
              <div class="rt-connector"></div>
            {/if}
          </div>

          <!-- Card column (security-bento-style) -->
          <article class="rt-card">
            <span
              class="rt-card__blob"
              aria-hidden="true"
            ></span>
            <div class="rt-card__content">
              <span
                class="material-symbols-outlined rt-card__icon"
                aria-hidden="true"
              >
                {phase.icon}
              </span>

              <p class="rt-card__eyebrow">
                <span class="rt-card__num">Phase {phase.num}</span>
                <span class="rt-card__label">[ {phase.label} ]</span>
              </p>

              <h2 class="rt-card__title">{phase.title}</h2>

              <div class="rt-card__meta">
                <span class="rt-meta-pill">
                  <span
                    class="material-symbols-outlined"
                    aria-hidden="true">event</span
                  >
                  {phase.dateRange}
                </span>
                <span class="rt-meta-pill rt-meta-pill--ghost">{phase.duration}</span>
              </div>

              <p class="rt-card__summary">{phase.summary}</p>

              <ul class="rt-card__bullets">
                {#each phase.bullets as bullet (bullet)}
                  <li>
                    <span
                      class="material-symbols-outlined rt-card__bullet-icon"
                      aria-hidden="true">arrow_right</span
                    >
                    <span>{bullet}</span>
                  </li>
                {/each}
              </ul>
            </div>
          </article>
        </li>
      {/each}
    </ol>

    <!-- Footnote -->
    <p class="roadmap-page__footnote">
      Während aller vier Phasen wird die Anwendung kontinuierlich weiterentwickelt — kein
      Stillstand, nur ein abnehmender Anteil an Breaking Changes. Die mobilen Apps (iOS + Android)
      werden parallel zur Beta-Phase entwickelt.
    </p>
    <p class="roadmap-page__footnote">
      Mehr zu Datenverlust-Risiken, RTO/RPO und Hosting siehe
      <a href="/disclaimer">Disclaimer</a>.
    </p>
  </div>
</main>

<LandingFooter />

<style>
  /* ============================================================
   * Roadmap page — atmosphere mirrors the SecuritySection so the
   * page feels native to the existing public surface.
   * ============================================================ */

  .roadmap-page {
    position: relative;
    background: transparent;
    padding: calc(var(--spacing-8) * 2.5) 5%;
    overflow: hidden;
  }

  .roadmap-page__container {
    margin: 0 auto;
    max-width: 1100px;
  }

  /* Top separator line shared with security/module sections. */
  .roadmap-page__container::before {
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

  /* ----- Hero ----- */
  .roadmap-page__hero {
    margin-bottom: calc(var(--spacing-8) * 2);
    text-align: center;
  }

  .roadmap-page__eyebrow {
    margin: 0 0 var(--spacing-4) 0;
    color: var(--color-primary);
    font-family: ui-monospace, 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 0.8125rem;
    letter-spacing: 0.25em;
    text-transform: uppercase;
  }

  .roadmap-page__title {
    margin: 0 0 var(--spacing-4) 0;
    color: var(--color-text-primary);
    font-weight: 800;
    font-size: clamp(2rem, 5vw, 3.5rem);
    letter-spacing: -0.02em;
    line-height: 1.05;
  }

  .roadmap-page__subtitle {
    margin: 0 auto var(--spacing-6);
    max-width: 720px;
    color: var(--color-text-secondary);
    font-size: 1.125rem;
    line-height: 1.7;
  }

  .roadmap-page__status {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
    border: 1px solid color-mix(in oklch, var(--color-primary) 30%, transparent);
    border-radius: 999px;
    background: color-mix(in oklch, var(--color-primary) 8%, transparent);
    padding: var(--spacing-2) var(--spacing-4);
    color: var(--color-text-primary);
    font-size: 0.875rem;
  }

  .roadmap-page__status .material-symbols-outlined {
    color: var(--color-primary);
    font-size: 1rem;
  }

  /* ============================================================
   * Timeline
   * Each phase = 2-column flex: indicator column (fixed) + card.
   * Connector lives inside indicator-col, growing with flex:1 so
   * it always reaches the next phase regardless of card height.
   * ============================================================ */

  .rt-timeline {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .rt-phase {
    display: flex;
    align-items: stretch;
    gap: var(--spacing-6);
    margin: 0;
    padding: 0;
    list-style: none;
    animation: rt-fade-in-up var(--duration-slow, 600ms) var(--ease-out, ease-out) both;
    animation-delay: var(--phase-delay, 0ms);
  }

  /* ----- Indicator column ----- */
  .rt-indicator-col {
    display: flex;
    flex-shrink: 0;
    flex-direction: column;
    align-items: center;
    width: 64px;
  }

  .rt-indicator {
    display: flex;
    position: relative;
    z-index: 2;
    justify-content: center;
    align-items: center;
    transition: all var(--duration-normal, 300ms) var(--ease-out, ease-out);
    border: 3px solid var(--accent);
    border-radius: 50%;
    background: var(--glass-bg);
    width: 56px;
    height: 56px;
    color: var(--accent);
    font-weight: 700;
    font-size: 1rem;
  }

  .rt-indicator__num {
    font-family: ui-monospace, 'JetBrains Mono', 'Fira Code', monospace;
    letter-spacing: 0.05em;
  }

  /* Vertical gradient connector between phases (BTS pattern). */
  .rt-connector {
    flex: 1;
    margin-top: var(--spacing-2);
    background: linear-gradient(
      to bottom,
      color-mix(in oklch, var(--accent) 50%, transparent) 0%,
      color-mix(in oklch, var(--accent) 10%, transparent) 100%
    );
    width: 2px;
  }

  /* ----- Phase states ----- */

  /* Active + next phases: filled indicator with accent glow. */
  .rt-phase--active .rt-indicator,
  .rt-phase--next .rt-indicator {
    background: var(--accent);
    box-shadow: 0 0 24px color-mix(in oklch, var(--accent) 35%, transparent);
    color: #fff;
  }

  /* Active phase: pulse-ring (a11y: hidden under reduced motion). */
  .rt-phase--active .rt-indicator::after {
    content: '';
    position: absolute;
    inset: -8px;
    border: 2px solid var(--accent);
    border-radius: 50%;
    opacity: 40%;
    animation: rt-pulse 2s ease-out infinite;
  }

  @keyframes rt-pulse {
    0% {
      transform: scale(0.95);
      opacity: 50%;
    }

    70% {
      transform: scale(1.15);
      opacity: 0%;
    }

    100% {
      transform: scale(0.95);
      opacity: 0%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rt-phase--active .rt-indicator::after {
      animation: none;
    }

    .rt-phase {
      animation: none;
    }
  }

  /* Future phases — slightly de-emphasised so the eye reads in order. */
  .rt-phase--future .rt-indicator {
    opacity: 70%;
  }

  .rt-phase--future .rt-card {
    opacity: 85%;
  }

  /* ============================================================
   * Card (security-bento style: glass + radial blob + hover-lift)
   * ============================================================ */

  .rt-card {
    flex: 1;
    position: relative;
    margin-bottom: calc(var(--spacing-8) * 1.25);
    padding: calc(var(--spacing-6) * 1.2);
    overflow: hidden;
    transition:
      transform var(--duration-normal, 300ms) var(--ease-out, ease-out),
      border-color var(--duration-normal, 300ms) var(--ease-out, ease-out),
      box-shadow var(--duration-normal, 300ms) var(--ease-out, ease-out);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-xl, 16px);
    background: var(--glass-bg);
    isolation: isolate;
  }

  .rt-card__blob {
    position: absolute;
    inset: 0;
    z-index: -1;
    transition: opacity var(--duration-normal, 300ms) var(--ease-out, ease-out);
    background: radial-gradient(
      circle at 85% 15%,
      color-mix(in oklch, var(--accent) 26%, transparent) 0%,
      transparent 60%
    );
    pointer-events: none;
    opacity: 75%;
  }

  .rt-card:hover {
    transform: translateY(-3px);
    border-color: color-mix(in oklch, var(--accent) 40%, var(--glass-border));
    box-shadow: 0 20px 40px -18px color-mix(in oklch, var(--accent) 28%, transparent);
  }

  .rt-card:hover .rt-card__blob {
    opacity: 100%;
  }

  .rt-card__content {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .rt-card__icon {
    margin-bottom: var(--spacing-1);
    color: var(--accent);
    font-size: clamp(1.75rem, 2.5vw, 2.25rem);
    text-shadow: 0 0 24px color-mix(in oklch, var(--accent) 30%, transparent);
  }

  .rt-card__eyebrow {
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

  .rt-card__num {
    font-weight: 700;
    opacity: 85%;
  }

  .rt-card__title {
    margin: 0;
    color: var(--color-text-primary);
    font-weight: 800;
    font-size: clamp(1.5rem, 2.5vw, 2rem);
    letter-spacing: -0.01em;
    line-height: 1.15;
  }

  /* Date + duration pills sit just below the title. */
  .rt-card__meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
    margin-top: var(--spacing-1);
  }

  .rt-meta-pill {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-1);
    border: 1px solid color-mix(in oklch, var(--accent) 35%, transparent);
    border-radius: 999px;
    background: color-mix(in oklch, var(--accent) 10%, transparent);
    padding: 0.25rem var(--spacing-3);
    color: var(--color-text-primary);
    font-weight: 500;
    font-size: 0.8125rem;
  }

  .rt-meta-pill .material-symbols-outlined {
    color: var(--accent);
    font-size: 0.875rem;
  }

  .rt-meta-pill--ghost {
    border-color: var(--glass-border);
    background: transparent;
    color: var(--color-text-secondary);
    font-weight: 400;
  }

  .rt-card__summary {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: 1rem;
    line-height: 1.6;
  }

  .rt-card__bullets {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
    margin: var(--spacing-2) 0 0 0;
    padding: 0;
    list-style: none;
  }

  .rt-card__bullets li {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-2);
    color: var(--color-text-secondary);
    font-size: 0.9375rem;
    line-height: 1.55;
  }

  .rt-card__bullet-icon {
    flex-shrink: 0;
    color: var(--accent);
    font-size: 1.125rem;
    line-height: 1.3;
  }

  /* ----- Footnote ----- */

  .roadmap-page__footnote {
    margin: var(--spacing-4) 0 0;
    color: var(--color-text-tertiary);
    font-size: 0.875rem;
    line-height: 1.6;
    text-align: center;
  }

  .roadmap-page__footnote a {
    color: var(--color-primary);
    text-decoration: none;
  }

  .roadmap-page__footnote a:hover {
    text-decoration: underline;
  }

  /* ============================================================
   * Mobile
   * ============================================================ */
  @media (width < 640px) {
    .roadmap-page {
      padding: calc(var(--spacing-8) * 1.5) 5%;
    }

    .rt-phase {
      gap: var(--spacing-4);
    }

    .rt-indicator-col {
      width: 48px;
    }

    .rt-indicator {
      border-width: 2px;
      width: 44px;
      height: 44px;
      font-size: 0.875rem;
    }

    .rt-card {
      margin-bottom: var(--spacing-6);
      padding: var(--spacing-5);
    }

    .rt-card__title {
      font-size: 1.375rem;
    }
  }

  @keyframes rt-fade-in-up {
    from {
      transform: translateY(12px);
      opacity: 0%;
    }

    to {
      transform: translateY(0);
      opacity: 100%;
    }
  }
</style>
