<script lang="ts">
  /*
   * Public Disclaimer page — standalone informational page reachable from
   * the LandingFooter ("Rechtliches" → "Disclaimer") and the BetaBanner.
   *
   * Layout mirrors /datenschutz + /impressum (shared LandingHeader/Footer)
   * for a consistent public surface. Static content only — no backend.
   *
   * WHY this page exists: communicate the beta caveat (data loss risk,
   * timeline, hosting context) BEFORE signup, in addition to the
   * post-login Beta-T&C modal planned in FEAT_BETA_HOSTING_MASTERPLAN §7.1.
   *
   * Section 2 renders a visual horizontal roadmap (Beta → Alpha → RC →
   * Stable). Phase data lives in a typed array to keep the markup
   * declarative and easy to flip from "next" → "active" once Beta starts.
   */
  import LandingFooter from '$lib/components/LandingFooter.svelte';
  import LandingHeader from '$lib/components/LandingHeader.svelte';
  import Seo from '$lib/components/Seo.svelte';

  // 'active' = currently running, 'next' = upcoming primary, 'future' = later.
  // Only ONE phase should be 'active' at a time. After 01.06.2026 the Beta
  // entry should flip from 'next' to 'active'.
  type PhaseStatus = 'active' | 'next' | 'future';

  interface Phase {
    id: string;
    label: string;
    title: string;
    icon: string; // FontAwesome 6 free class
    dateRange: string;
    duration: string;
    status: PhaseStatus;
    summary: string;
    bullets: readonly string[];
  }

  const phases: readonly Phase[] = [
    {
      id: 'beta',
      label: 'Phase 1',
      title: 'Beta',
      icon: 'fa-vial',
      dateRange: '01.06.2026 – 01.06.2028',
      duration: 'ca. 24 Monate',
      status: 'next',
      summary:
        'Testbetrieb mit ausgewählten Mandanten. Aktive Fehlerbehebung, Feature-Erweiterungen, parallele App-Entwicklung.',
      bullets: [
        'Direkte Bug-Behebung mit kurzer Reaktionszeit',
        'Umsetzung von Kundenwünschen im laufenden Sprint',
        'Parallele Entwicklung der mobilen Apps (iOS + Android)',
        'Laufende Verbesserungen an UX und Stabilität',
      ],
    },
    {
      id: 'alpha',
      label: 'Phase 2',
      title: 'Alpha',
      icon: 'fa-shield-halved',
      dateRange: 'ab Mitte 2028',
      duration: 'ca. 6 – 12 Monate',
      status: 'future',
      summary:
        'Stabilisierungsphase. Funktionsumfang weitgehend eingefroren, Fokus auf Härtung und Skalierung.',
      bullets: [
        'Performance-Optimierung (Datenbank, Caching, Frontend)',
        'Hochverfügbarkeit (Streaming-Replication, Auto-Failover)',
        'Security-Audits und Penetration-Tests',
        'Skalierung auf größere Mandantenzahlen',
      ],
    },
    {
      id: 'rc',
      label: 'Phase 3',
      title: 'Release Candidate',
      icon: 'fa-flag-checkered',
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
      id: 'stable',
      label: 'Phase 4',
      title: 'Stable v1.0',
      icon: 'fa-crown',
      dateRange: 'voraussichtlich Mitte 2029',
      duration: 'GA',
      status: 'future',
      summary:
        'Produktionsreif. Verbindliche SLAs, etablierter Release-Prozess, internationale Skalierung möglich.',
      bullets: [
        'Verbindliche SLA: 99,9 % Verfügbarkeit',
        'RTO ≤ 5 Minuten · RPO ≤ 1 Minute',
        'Strukturierter Release-Zyklus (Semantic Versioning)',
        'Internationale Skalierung über DE hinaus',
      ],
    },
  ];
</script>

<Seo
  title="Disclaimer — Beta-Phase & Hosting | Assixx"
  description="Hinweise zur Beta-Phase von Assixx, Roadmap, Datenverlust-Risiken und Hosting in Deutschland (Hetzner, DSGVO-konform)."
  canonical="https://www.assixx.com/disclaimer"
  noindex={true}
/>

<LandingHeader offLanding />

<main class="legal-content">
  <div class="legal-hero">
    <div class="legal-hero__overline">
      <div class="legal-hero__line"></div>
      <span class="legal-hero__label">Rechtliches</span>
    </div>
    <h1>Disclaimer</h1>
    <p class="legal-hero__lead">
      Assixx befindet sich in der aktiven Entwicklung. Bevor du die Plattform produktiv nutzt, lies
      bitte die folgenden Hinweise zur Beta-Phase, möglichen Datenverlusten und unserem Hosting in
      Deutschland.
    </p>
  </div>

  <!-- 1. Beta-Phase ============================================ -->
  <section>
    <h2>1. Beta-Phase</h2>
    <p>
      Die offizielle Beta-Phase von Assixx startet am <strong>01.06.2026</strong> und dauert
      voraussichtlich rund <strong>zwei Jahre</strong>.
    </p>
    <p>
      In dieser Zeit nehmen wir Fehlerberichte und Wünsche der teilnehmenden Mandanten direkt auf,
      beheben Bugs zeitnah, setzen Verbesserungen an der Benutzerführung um und entwickeln neue
      Funktionen weiter. Parallel dazu wird die App fortlaufend ausgebaut.
    </p>
  </section>

  <!-- 2. Roadmap (visuelle Timeline) ========================== -->
  <section
    class="roadmap"
    aria-labelledby="roadmap-heading"
  >
    <h2 id="roadmap-heading">2. Roadmap: Beta &rarr; Alpha &rarr; RC &rarr; Stable</h2>
    <p>Die Plattform durchläuft vier Reifestufen.</p>

    <p
      class="roadmap__status"
      role="status"
    >
      <i
        class="fas fa-circle-info"
        aria-hidden="true"
      ></i>
      <span>
        Stand 04/2026 &mdash; Vorbereitung der Beta-Phase. Beta-Start: <strong>01.06.2026</strong>.
      </span>
    </p>

    <ol
      class="roadmap__timeline"
      role="list"
    >
      {#each phases as phase, i (phase.id)}
        <li
          class="roadmap__phase roadmap__phase--{phase.status}"
          style="--phase-index: {i};"
        >
          <div
            class="roadmap__indicator"
            aria-hidden="true"
          >
            <i class="fas {phase.icon}"></i>
          </div>
          {#if i < phases.length - 1}
            <span
              class="roadmap__connector"
              aria-hidden="true"
            ></span>
          {/if}
          <article class="roadmap__card">
            <header class="roadmap__card-header">
              <span class="roadmap__phase-num">{phase.label}</span>
              <h3 class="roadmap__phase-title">{phase.title}</h3>
              <p class="roadmap__phase-date">
                <i
                  class="fas fa-calendar"
                  aria-hidden="true"
                ></i>
                {phase.dateRange}
              </p>
              <p class="roadmap__phase-duration">{phase.duration}</p>
            </header>
            <p class="roadmap__phase-summary">{phase.summary}</p>
            <ul class="roadmap__phase-bullets">
              {#each phase.bullets as bullet (bullet)}
                <li>{bullet}</li>
              {/each}
            </ul>
          </article>
        </li>
      {/each}
    </ol>

    <p class="roadmap__footnote">
      Während aller vier Phasen wird die Anwendung kontinuierlich weiterentwickelt. Es gibt also
      keinen Stillstand &mdash; nur einen abnehmenden Anteil an Breaking Changes. Die mobilen Apps
      (iOS + Android) werden parallel zur Beta-Phase entwickelt.
    </p>
  </section>

  <!-- 3. Datenverlust-Warnung ================================== -->
  <section class="legal-callout legal-callout--warning">
    <h2>3. Achtung: Datenverlust ist möglich</h2>
    <p>
      Während der Beta-Phase kann es bei Breaking Changes &mdash; insbesondere bei
      Schema-Migrationen &mdash; in seltenen Fällen zu <strong>unwiderruflichem Datenverlust</strong
      >
      kommen. Wir halten dieses Risiko durch tägliche Backups und sorgfältige Migrationen so klein wie
      möglich, können es aber nicht vollständig ausschließen.
    </p>
    <p>
      <strong>
        Bitte lege während der Beta-Phase keine geschäftskritischen oder sensiblen Daten in Assixx
        ab, ohne sie zusätzlich an anderer Stelle zu sichern.
      </strong>
    </p>
    <p>
      Verbindliche Zusagen zu Verfügbarkeit oder Wiederherstellungszeit (SLA) gibt es während der
      Beta-Phase nicht. Tägliche Datenbank-Backups laufen automatisiert; das Wiederherstellungsziel
      liegt bei <strong>RTO &le; 4 Stunden / RPO &le; 24 Stunden</strong>.
    </p>
  </section>

  <!-- 4. Hosting & DSGVO ====================================== -->
  <section>
    <h2>4. Hosting & DSGVO</h2>
    <p>Assixx wird vollständig in Deutschland betrieben:</p>
    <ul>
      <li>
        <strong>Server &amp; Datenbank</strong> bei der Hetzner Online GmbH, Standort Falkenstein (Sachsen).
      </li>
      <li>
        <strong>Datei-Uploads</strong> (Dokumente, Avatare, Anhänge) im Hetzner Object Storage, ebenfalls
        Standort Deutschland.
      </li>
      <li>
        <strong>Auftragsverarbeitung (AVV)</strong> mit Hetzner ist abgeschlossen; alle Daten werden
        gemäß <abbr title="Datenschutz-Grundverordnung">DSGVO</abbr> verarbeitet.
      </li>
      <li>
        <strong>Keine Datenübermittlung in Drittstaaten</strong> &mdash; insbesondere nicht in die USA.
      </li>
    </ul>
    <p>
      Details zur Datenverarbeitung findest du in der
      <a href="/datenschutz">Datenschutzerklärung</a>.
    </p>
  </section>

  <p class="legal-updated">Stand: April 2026 &mdash; Version 0.1</p>
</main>

<LandingFooter />

<style>
  /* Layout-Tokens identisch zu /datenschutz + /impressum, damit der
   * Public-Surface visuell konsistent bleibt. Nur ergänzt um den
   * Warning-Callout für die Datenverlust-Sektion. */
  .legal-content {
    margin: 0 auto;
    padding: var(--spacing-8) 5%;
    max-width: 1200px;
  }

  .legal-hero {
    margin-bottom: var(--spacing-8);
  }

  .legal-hero__overline {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: var(--spacing-4);
  }

  .legal-hero__line {
    width: 48px;
    height: 1px;
    background: var(--color-primary);
  }

  .legal-hero__label {
    color: var(--color-primary);
    font-weight: 600;
    font-size: 0.75rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }

  .legal-hero__lead {
    margin-top: var(--spacing-4);
    max-width: 720px;
    color: var(--color-text-secondary);
    font-size: 1.0625rem;
    line-height: 1.7;
  }

  .legal-content h1 {
    color: var(--color-text-primary);
    font-weight: 800;
    font-size: 2.25rem;
    letter-spacing: -0.025em;
  }

  @media (width >= 640px) {
    .legal-content h1 {
      font-size: 3rem;
    }
  }

  .legal-content h2 {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    margin-top: var(--spacing-8);
    margin-bottom: var(--spacing-3);
    color: var(--color-text-primary);
    font-weight: 600;
    font-size: 1.25rem;
  }

  .legal-content h2::before {
    flex-shrink: 0;
    border-radius: 2px;
    background: linear-gradient(180deg, var(--color-primary), var(--color-primary-light));
    width: 4px;
    height: 24px;
    content: '';
  }

  .legal-content p {
    margin-bottom: var(--spacing-3);
    color: var(--color-text-secondary);
    line-height: 1.7;
  }

  .legal-content ul {
    margin-bottom: var(--spacing-3);
    padding-left: var(--spacing-6);
    list-style: disc;
  }

  .legal-content li {
    margin-bottom: var(--spacing-2);
    color: var(--color-text-secondary);
    line-height: 1.7;
  }

  .legal-content a {
    color: var(--color-primary);
    text-decoration: none;
  }

  .legal-content a:hover {
    text-decoration: underline;
  }

  .legal-content strong {
    color: var(--color-text-primary);
  }

  /* Warning callout — derselbe Glassmorphism-Look wie Cards, nur mit
   * --color-warning als Akzent. Hebt die Datenverlust-Warnung visuell ab,
   * ohne ein Modul des Design-Systems neu zu erfinden. */
  .legal-callout--warning {
    margin-top: var(--spacing-8);
    border: 1px solid color-mix(in oklab, var(--color-warning) 50%, transparent);
    border-left-width: 4px;
    border-radius: 8px;
    background: color-mix(in oklab, var(--color-warning) 8%, transparent);
    padding: var(--spacing-5) var(--spacing-6);
  }

  .legal-callout--warning h2 {
    margin-top: 0;
    color: var(--color-warning);
  }

  .legal-callout--warning h2::before {
    background: var(--color-warning);
  }

  .legal-updated {
    margin-top: var(--spacing-8);
    border-top: var(--glass-border);
    padding-top: var(--spacing-6);
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    opacity: 70%;
  }

  @media (width < 768px) {
    .legal-content {
      padding: var(--spacing-6) var(--spacing-4);
    }

    .legal-content h1 {
      font-size: 1.5rem;
    }

    .legal-callout--warning {
      padding: var(--spacing-4);
    }
  }

  /* ============================================================
   * Roadmap visual — horizontal timeline (desktop), stacked
   * vertical (mobile). All colors come from design-system tokens
   * so the section follows light/dark theme automatically.
   * ============================================================ */

  .roadmap__status {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
    margin: var(--spacing-3) 0 var(--spacing-6);
    border: 1px solid color-mix(in oklab, var(--color-primary) 30%, transparent);
    border-radius: 999px;
    background: color-mix(in oklab, var(--color-primary) 8%, transparent);
    padding: var(--spacing-2) var(--spacing-4);
    color: var(--color-text-primary);
    font-size: 0.875rem;
  }

  .roadmap__status i {
    color: var(--color-primary);
  }

  .roadmap__timeline {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--spacing-6) var(--spacing-4);
    margin: var(--spacing-6) 0 var(--spacing-4);
    padding: 0;
    list-style: none;
  }

  .roadmap__phase {
    display: flex;
    position: relative;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-4);
    margin-bottom: 0;
    padding-top: var(--spacing-2);
    list-style: none;
  }

  .roadmap__indicator {
    display: flex;
    position: relative;
    z-index: 2;
    justify-content: center;
    align-items: center;
    transition: transform 0.3s ease-out;
    border: 2px solid var(--glass-border);
    border-radius: 50%;
    background: var(--glass-bg-hover);
    width: 64px;
    height: 64px;
    color: var(--color-text-secondary);
    font-size: 22px;
  }

  /* Connector line between phases (only visible on desktop where
   * 4 phases sit in one row). top: 32px = vertical center of the
   * 64px indicator (plus 8px section padding). */
  .roadmap__connector {
    position: absolute;
    top: calc(var(--spacing-2) + 32px);
    left: 50%;
    z-index: 1;
    background: linear-gradient(
      90deg,
      var(--color-primary) 0%,
      color-mix(in oklab, var(--color-primary) 30%, transparent) 100%
    );
    width: 100%;
    height: 2px;
  }

  .roadmap__card {
    border: 1px solid var(--glass-border);
    border-radius: 12px;
    background: var(--glass-bg);
    backdrop-filter: blur(10px);
    padding: var(--spacing-4);
    width: 100%;
    text-align: left;
  }

  .roadmap__card-header {
    margin-bottom: var(--spacing-3);
  }

  .roadmap__phase-num {
    color: var(--color-primary);
    font-weight: 600;
    font-size: 0.6875rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  .roadmap__phase-title {
    margin: var(--spacing-1) 0 var(--spacing-2);
    color: var(--color-text-primary);
    font-weight: 700;
    font-size: 1.25rem;
  }

  .roadmap__phase-date {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-1);
    margin: 0;
    color: var(--color-text-primary);
    font-weight: 500;
    font-size: 0.875rem;
  }

  .roadmap__phase-date i {
    color: var(--color-primary);
    font-size: 0.75rem;
  }

  .roadmap__phase-duration {
    margin: var(--spacing-1) 0 0;
    color: var(--color-text-tertiary);
    font-size: 0.8125rem;
  }

  .roadmap__phase-summary {
    margin: 0 0 var(--spacing-3);
    color: var(--color-text-secondary);
    font-size: 0.9375rem;
    line-height: 1.55;
  }

  .roadmap__phase-bullets {
    margin: 0;
    padding-left: var(--spacing-5);
    color: var(--color-text-secondary);
    font-size: 0.8125rem;
    line-height: 1.55;
    list-style: disc;
  }

  .roadmap__phase-bullets li {
    margin-bottom: var(--spacing-1);
  }

  /* ----- Phase states ----- */

  /* Active phase (currently running) — only one at a time.
   * Pulse-ring is a pure decorative ::after; respects reduced-motion. */
  .roadmap__phase--active .roadmap__indicator {
    transform: scale(1.05);
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: #fff;
  }

  .roadmap__phase--active .roadmap__indicator::after {
    content: '';
    position: absolute;
    inset: -8px;
    border: 2px solid var(--color-primary);
    border-radius: 50%;
    opacity: 0.4;
    animation: roadmap-pulse 2s ease-out infinite;
  }

  @keyframes roadmap-pulse {
    0% {
      transform: scale(0.95);
      opacity: 0.5;
    }

    70% {
      transform: scale(1.15);
      opacity: 0;
    }

    100% {
      transform: scale(0.95);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .roadmap__phase--active .roadmap__indicator::after {
      animation: none;
    }
  }

  .roadmap__phase--active .roadmap__card {
    border-color: color-mix(in oklab, var(--color-primary) 40%, transparent);
    box-shadow: 0 0 0 4px color-mix(in oklab, var(--color-primary) 10%, transparent);
  }

  /* Next phase — upcoming primary */
  .roadmap__phase--next .roadmap__indicator {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .roadmap__phase--next .roadmap__card {
    border-color: color-mix(in oklab, var(--color-primary) 25%, transparent);
  }

  /* Future phases — visually de-emphasised */
  .roadmap__phase--future .roadmap__indicator {
    opacity: 0.7;
  }

  .roadmap__phase--future .roadmap__card {
    opacity: 0.85;
  }

  .roadmap__footnote {
    margin: var(--spacing-6) 0 0;
    border-top: 1px solid var(--glass-border);
    padding-top: var(--spacing-4);
    color: var(--color-text-tertiary);
    font-size: 0.8125rem;
    line-height: 1.6;
  }

  /* Tablet: 2 columns, hide connectors (different rows would break visually). */
  @media (width >= 768px) and (width < 1024px) {
    .roadmap__timeline {
      grid-template-columns: repeat(2, 1fr);
    }

    .roadmap__connector {
      display: none;
    }
  }

  /* Mobile: stack vertically, indicator left, card right. */
  @media (width < 768px) {
    .roadmap__timeline {
      grid-template-columns: 1fr;
      gap: var(--spacing-4);
    }

    .roadmap__connector {
      display: none;
    }

    .roadmap__phase {
      flex-direction: row;
      align-items: flex-start;
      gap: var(--spacing-4);
    }

    .roadmap__indicator {
      flex-shrink: 0;
      width: 48px;
      height: 48px;
      font-size: 18px;
    }

    .roadmap__card {
      flex: 1;
    }
  }
</style>
