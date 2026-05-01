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
      Beta-Phase nicht. Tägliche Datenbank-Backups laufen automatisiert; die Werte
      <strong>RTO &le; 4 Stunden</strong> (maximale Wiederherstellungszeit) und
      <strong>RPO &le; 24 Stunden</strong> (maximaler Datenverlust-Zeitraum) sind interne
      <em>Zielwerte</em> &mdash; <strong>keine vertraglich zugesicherte Verfügbarkeit</strong>.
    </p>
    <p>
      <strong>Verantwortung des Mandanten:</strong> Der Mandant entscheidet eigenverantwortlich,
      welche Daten er auf Assixx speichert. Bei besonderen Kategorien personenbezogener Daten gemäß
      <strong>Art. 9 DSGVO</strong> (z.&thinsp;B. Gesundheits-, Religions-, Gewerkschafts- oder
      biometrische Daten) gelten verschärfte gesetzliche Pflichten. Solche Daten sollten während der
      Beta-Phase grundsätzlich <strong>nicht ohne vorherige Rücksprache</strong> in Assixx verarbeitet
      werden.
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

  <!-- 5. Vertragliche Rahmenbedingungen ======================== -->
  <section>
    <h2>5. Vertragliche Rahmenbedingungen</h2>

    <h3>Auftragsverarbeitung mit dem Mandanten (Art. 28 DSGVO)</h3>
    <p>
      Bei der Verarbeitung von Mitarbeiter- und Plattformdaten unserer Mandanten handeln wir als
      <strong>Auftragsverarbeiter</strong> im Sinne von Art. 28 DSGVO. Mit jedem Mandanten wird vor Produktivnutzung
      ein schriftlicher Vertrag zur Auftragsverarbeitung (AVV) geschlossen. Ein Mustervertrag inklusive
      Anlage zu technisch-organisatorischen Maßnahmen (Art. 32 DSGVO) wird auf Anfrage zugesandt.
    </p>

    <h3>Eingesetzte Subunternehmer (Sub-Processors)</h3>
    <p>Zur Erbringung des Dienstes setzen wir folgende Subunternehmer ein:</p>
    <ul>
      <li>
        <strong>Hetzner Online GmbH</strong>, Industriestr. 25, 91710 Gunzenhausen, Deutschland
        &mdash; Server-Hosting, Datenbank, Object Storage. Standort Falkenstein (Sachsen). Siehe
        Abschnitt&nbsp;4.
      </li>
    </ul>
    <p>
      Änderungen am Subunternehmer-Verzeichnis werden mindestens <strong>30 Tage</strong> vor Wirksamwerden
      angekündigt. Mandanten haben das Recht, einer Änderung aus berechtigten Gründen zu widersprechen;
      in diesem Fall besteht ein außerordentliches Kündigungsrecht.
    </p>

    <h3>Haftungsbegrenzung</h3>
    <p>
      Soweit gesetzlich zulässig, haftet Assixx nur bei <strong
        >Vorsatz und grober Fahrlässigkeit</strong
      >
      unbeschränkt. Bei einfacher Fahrlässigkeit haftet Assixx nur für die Verletzung wesentlicher Vertragspflichten
      (Kardinalpflichten); die Haftung ist in diesem Fall auf den vertragstypischen, bei Vertragsschluss
      vorhersehbaren Schaden begrenzt &mdash; höchstens jedoch auf die im laufenden Vertragsjahr gezahlte
      Vergütung. Eine Haftung für mittelbare Schäden, entgangenen Gewinn und Folgeschäden ist &mdash;
      soweit gesetzlich zulässig &mdash; ausgeschlossen.
    </p>
    <p>
      Die zwingende gesetzliche Haftung (insbesondere nach dem Produkthaftungsgesetz, bei Verletzung
      von Leben, Körper und Gesundheit sowie nach Art. 82 DSGVO) bleibt unberührt. Die konkreten
      Bedingungen ergeben sich aus den Allgemeinen Geschäftsbedingungen (AGB) und dem AVV-Vertrag.
    </p>

    <h3>Anwendbares Recht und Gerichtsstand</h3>
    <p>
      Es gilt das Recht der <strong>Bundesrepublik Deutschland</strong> unter Ausschluss des
      UN-Kaufrechts (CISG). Ausschließlicher Gerichtsstand für sämtliche Streitigkeiten aus oder im
      Zusammenhang mit dem Vertragsverhältnis ist &mdash; soweit der Mandant Kaufmann, juristische
      Person des öffentlichen Rechts oder öffentlich-rechtliches Sondervermögen ist &mdash; der Sitz
      des Anbieters in <strong>Stadtlohn</strong>.
    </p>
  </section>

  <!-- 6. Datenpannen, Kündigung & Datenexport ================= -->
  <section>
    <h2>6. Datenpannen, Kündigung &amp; Datenexport</h2>

    <h3>Meldepflicht bei Datenpannen (Art. 33/34 DSGVO)</h3>
    <p>
      Bei einer Verletzung des Schutzes personenbezogener Daten informieren wir den verantwortlichen
      Mandanten <strong>ohne schuldhaftes Zögern, spätestens innerhalb von 72 Stunden</strong> nach Kenntnisnahme.
      Die Meldung enthält Art und Umfang der Verletzung, die betroffenen Datenkategorien, die voraussichtlichen
      Folgen sowie die eingeleiteten Gegenmaßnahmen.
    </p>

    <h3>Datenexport bei Kündigung (Art. 20 DSGVO)</h3>
    <p>
      Nach Kündigung steht dem Mandanten eine Frist von <strong>30 Tagen</strong> zur Verfügung, um
      seine Daten in einem strukturierten, gängigen und maschinenlesbaren Format (CSV/JSON)
      herunterzuladen. Nach Ablauf dieser Frist werden sämtliche Mandantendaten gemäß Art. 17 DSGVO
      <strong>unwiderruflich gelöscht</strong> &mdash; einschließlich Backups, sobald deren regulärer
      Aufbewahrungszeitraum abgelaufen ist (max. 35 Tage).
    </p>
  </section>

  <!-- 7. Beta-spezifische Bedingungen ========================== -->
  <section>
    <h2>7. Beta-spezifische Bedingungen</h2>

    <h3>Test-Charakter</h3>
    <p>
      Mandanten erkennen ausdrücklich an, dass sich die Plattform in der Beta-Phase befindet und
      <strong>unfertige, fehlerhafte oder veränderliche Funktionen</strong> enthalten kann. Beta-typische
      Mängel begründen keine Mängelansprüche. Die Mitwirkung an der Erprobung (Bug-Reports, Feedback)
      ist Teil des Beta-Charakters.
    </p>

    <h3>Beta-Beendigung durch Assixx</h3>
    <p>
      Wir behalten uns vor, die Beta-Phase, einzelne Funktionen oder den gesamten Dienst mit einer
      Frist von mindestens <strong>60 Tagen</strong> zu beenden oder grundlegend zu verändern. Mandanten
      erhalten in diesem Fall die Möglichkeit zum vollständigen Datenexport (siehe Abschnitt&nbsp;6) sowie
      ggf. eine anteilige Rückerstattung gezahlter Beta-Gebühren.
    </p>

    <h3>Feedback und Verbesserungsvorschläge</h3>
    <p>
      Wenn Mandanten Bug-Reports, Feature-Wünsche oder sonstige Rückmeldungen einreichen, räumen sie
      Assixx ein <strong
        >einfaches, unentgeltliches, übertragbares und zeitlich unbegrenztes Nutzungsrecht</strong
      >
      zur Verwertung dieser Beiträge im Produkt ein. Persönliche Daten werden dabei nicht offengelegt.
    </p>
  </section>

  <!-- 8. Schlussbestimmungen =================================== -->
  <section>
    <h2>8. Schlussbestimmungen</h2>

    <h3>Salvatorische Klausel</h3>
    <p>
      Sollten einzelne Bestimmungen dieses Disclaimers oder der zugehörigen AGB ganz oder teilweise
      unwirksam sein oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt. An die
      Stelle der unwirksamen Bestimmung tritt eine Regelung, die dem wirtschaftlichen Zweck der
      unwirksamen Bestimmung am nächsten kommt.
    </p>

    <h3>Vertragshierarchie</h3>
    <p>
      Dieser Disclaimer dient der öffentlichen Information. Rechtsverbindlich gelten in dieser
      Reihenfolge: <strong>(1) der mit dem Mandanten geschlossene AVV-Vertrag</strong>,
      <strong>(2) die Allgemeinen Geschäftsbedingungen (AGB)</strong> und
      <strong>(3) die Datenschutzerklärung</strong>. Bei Widersprüchen geht die jeweils speziellere
      Regelung vor.
    </p>

    <h3>Kontakt für Datenschutzanfragen</h3>
    <p>
      Anfragen nach Art. 15 ff. DSGVO (Auskunft, Berichtigung, Löschung, Übertragbarkeit) sowie
      Meldungen sicherheitsrelevanter Vorfälle richten Sie bitte an:
      <a href="mailto:info@scs-technik.de">info@scs-technik.de</a>.
    </p>
  </section>

  <p class="legal-updated">
    Stand: April 2026 &mdash; Version 0.2 &mdash; ergänzt um vertragliche Rahmenbedingungen,
    Datenpannen-Meldepflicht, Beta-spezifische Bedingungen und Schlussbestimmungen.
  </p>
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
