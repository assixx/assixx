<script lang="ts">
  /*
   * Public Disclaimer page — standalone informational page reachable from
   * the LandingFooter ("Rechtliches" → "Disclaimer").
   *
   * Layout mirrors /datenschutz + /impressum (shared LandingHeader/Footer)
   * for a consistent public surface. Static content only — no backend.
   *
   * WHY this page exists: communicate the beta caveat (data loss risk,
   * timeline, hosting context) BEFORE signup, in addition to the
   * post-login Beta-T&C modal planned in FEAT_BETA_HOSTING_MASTERPLAN §7.1.
   *
   * The visual 4-phase roadmap lives on its own page at /roadmap. This page
   * only references it — keeping the legal/data-loss focus undiluted.
   */
  import LandingFooter from '$lib/components/LandingFooter.svelte';
  import LandingHeader from '$lib/components/LandingHeader.svelte';
  import Seo from '$lib/components/Seo.svelte';
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

  <!-- 2. Roadmap (Kurzfassung — visuelle Timeline auf /roadmap) -->
  <section>
    <h2>2. Roadmap: Beta &rarr; Alpha &rarr; RC &rarr; Stable</h2>
    <p>Die Plattform durchläuft vier Reifestufen:</p>
    <ul>
      <li>
        <strong>Beta</strong> &mdash; ab 01.06.2026, ca. 24 Monate. Aktive Fehlerbehebung, Umsetzung von
        Kundenwünschen, parallele App-Entwicklung.
      </li>
      <li>
        <strong>Alpha</strong> &mdash; Stabilisierung. Funktionsumfang weitgehend eingefroren, Fokus auf
        Härtung, Performance und Skalierung.
      </li>
      <li>
        <strong>Release Candidate</strong> &mdash; Pre-Release. Funktions-Freeze, finale Validierung,
        SLA-Vorbereitung, Notfall-Übungen.
      </li>
      <li>
        <strong>Stable v1.0</strong> &mdash; produktionsreif, mit verbindlichen SLAs (99,9 % Verfügbarkeit,
        RTO ≤ 5 Min, RPO ≤ 1 Min).
      </li>
    </ul>
    <p>
      Die ausführliche, visuelle Darstellung mit Datums-Pillen, Bullet-Punkten und Phase-Glow
      findest du auf <a href="/roadmap">der Roadmap-Seite</a>.
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
</style>
