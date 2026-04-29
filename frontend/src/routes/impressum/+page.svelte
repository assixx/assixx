<script lang="ts">
  /*
   * Impressum uses the shared LandingHeader + LandingFooter (same markup
   * and styles as the public landing page). Prior minimal "legal-header"
   * was replaced per user request (2026-04-15) for visual consistency.
   */
  import LandingFooter from '$lib/components/LandingFooter.svelte';
  import LandingHeader from '$lib/components/LandingHeader.svelte';
  import Seo from '$lib/components/Seo.svelte';
</script>

<Seo
  title="Impressum - Assixx"
  description="Impressum und Kontaktdaten von Assixx — betrieben durch Simon's Computer Service, Stadtlohn."
  canonical="https://www.assixx.com/impressum"
  noindex={true}
/>

<!-- Shared top navigation (identical to landing page). -->
<LandingHeader offLanding />

<main class="legal-content">
  <div class="legal-hero">
    <div class="legal-hero__overline">
      <div class="legal-hero__line"></div>
      <span class="legal-hero__label">Rechtliches</span>
    </div>
    <h1>Impressum</h1>
  </div>

  <!-- 1. Angaben gemäß § 5 DDG -->
  <section>
    <h2>Angaben gemäß § 5 DDG</h2>
    <p>
      <strong>Simon Öztürk</strong><br />
      Simon's Computer Service<br />
      Neustr. 13<br />
      48703 Stadtlohn
    </p>
  </section>

  <!-- 2. Kontakt -->
  <section>
    <h2>Kontakt</h2>
    <p>
      Telefon: +49 (0) 2563 900 51 61<br />
      Mobil: +49 (0) 178 8 268 423<br />
      E-Mail: info@scs-technik.de<br />
      Website:
      <a
        href="https://www.scs-technik.de"
        target="_blank"
        rel="noopener noreferrer">www.scs-technik.de</a
      >
    </p>
  </section>

  <!-- 3. Umsatzsteuer-ID -->
  <section>
    <h2>Umsatzsteuer-ID</h2>
    <p>
      Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz:<br />
      <strong>DE361497768</strong>
    </p>
  </section>

  <!-- 4. Versicherung -->
  <section>
    <h2>Berufshaftpflichtversicherung</h2>
    <p>
      Berufshaftpflicht- und Cyberversicherung durch:<br />
      <strong>Allianz Versicherungs-Aktiengesellschaft</strong><br />
      Eschstraße 22<br />
      48703 Stadtlohn
    </p>
  </section>

  <!-- 5. Redaktionell verantwortlich -->
  <section>
    <h2>Redaktionell verantwortlich</h2>
    <p>
      Simon Öztürk<br />
      Neustr. 13<br />
      48703 Stadtlohn
    </p>
  </section>

  <!-- 6. EU-Streitschlichtung -->
  <section>
    <h2>EU-Streitschlichtung</h2>
    <p>
      Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:
      <a
        href="https://ec.europa.eu/consumers/odr/"
        target="_blank"
        rel="noopener noreferrer">https://ec.europa.eu/consumers/odr/</a
      >.
    </p>
    <p>Unsere E-Mail-Adresse finden Sie oben im Impressum.</p>
  </section>

  <!-- 7. Verbraucherstreitbeilegung -->
  <section>
    <h2>Verbraucherstreitbeilegung / Universalschlichtungsstelle</h2>
    <p>
      Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
      Verbraucherschlichtungsstelle teilzunehmen.
    </p>
  </section>

  <!-- 8. Haftung für Inhalte -->
  <section>
    <h2>Haftung für Inhalte</h2>
    <p>
      Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach
      den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter
      jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen
      oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
    </p>
    <p>
      Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den
      allgemeinen Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch erst ab
      dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden von
      entsprechenden Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.
    </p>
  </section>

  <!-- 9. Haftung für Links -->
  <section>
    <h2>Haftung für Links</h2>
    <p>
      Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen
      Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für
      die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten
      verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche
      Rechtsverstöße überprüft. Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht
      erkennbar.
    </p>
    <p>
      Eine permanente inhaltliche Kontrolle der verlinkten Seiten ist jedoch ohne konkrete
      Anhaltspunkte einer Rechtsverletzung nicht zumutbar. Bei Bekanntwerden von Rechtsverletzungen
      werden wir derartige Links umgehend entfernen.
    </p>
  </section>

  <!-- 10. Urheberrecht -->
  <section>
    <h2>Urheberrecht</h2>
    <p>
      Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem
      deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der
      Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des
      jeweiligen Autors bzw. Erstellers. Downloads und Kopien dieser Seite sind nur für den
      privaten, nicht kommerziellen Gebrauch gestattet.
    </p>
    <p>
      Soweit die Inhalte auf dieser Seite nicht vom Betreiber erstellt wurden, werden die
      Urheberrechte Dritter beachtet. Insbesondere werden Inhalte Dritter als solche gekennzeichnet.
      Sollten Sie trotzdem auf eine Urheberrechtsverletzung aufmerksam werden, bitten wir um einen
      entsprechenden Hinweis. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Inhalte
      umgehend entfernen.
    </p>
  </section>

  <p class="legal-updated">Stand: April 2026</p>
</main>

<LandingFooter hideRoadmap />

<style>
  /* Content */
  /* WHY: Breite auf 1200px angehoben (vorher 800px), damit Content-Container
   * mit Header/Footer-Breite übereinstimmt — weniger "enge Spalte", mehr Luft.
   * User-Feedback 2026-04-15. */
  .legal-content {
    margin: 0 auto;
    padding: var(--spacing-8) 5%;
    max-width: 1200px;
  }

  /* Hero title section */
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
  }
</style>
