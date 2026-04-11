<!--
  SecuritySection.svelte
  Landing page security section — 6 security cards + enterprise box + trust badges
  Extracted from routes/+page.svelte for max-lines compliance
-->
<script lang="ts">
  import { resolve } from '$app/paths';
</script>

<section
  class="security-section"
  id="security"
>
  <div class="security-section__container">
    <h2 class="security-section__title">Ihre Daten sind bei uns sicher</h2>
    <p class="security-section__subtitle">
      Datenschutz und Sicherheit haben bei uns höchste Priorität. Ihre sensiblen Unternehmensdaten
      sind durch modernste Verschlüsselung und strikte Sicherheitsmaßnahmen geschützt.
    </p>

    <div class="security-grid">
      <!-- Security Feature Cards -->
      <div class="security-card u-text-center">
        <span class="material-symbols-outlined security-icon">dns</span>
        <h3 class="u-color-primary u-mb-md u-text-center">100% Deutsche Server</h3>
        <p>
          Alle Daten werden ausschließlich auf Servern in Deutschland gespeichert. Kein
          Datentransfer ins Ausland.
        </p>
      </div>

      <div class="security-card u-text-center">
        <span class="material-symbols-outlined security-icon">lock</span>
        <h3 class="u-color-primary u-mb-md u-text-center">Ende-zu-Ende Verschlüsselung</h3>
        <p>
          Modernste Verschlüsselung (XChaCha20-Poly1305) für alle Daten — sowohl bei der Übertragung
          als auch bei der Speicherung.
        </p>
      </div>

      <div class="security-card u-text-center">
        <span class="material-symbols-outlined security-icon">policy</span>
        <h3 class="u-color-primary u-mb-md u-text-center">DSGVO-konform</h3>
        <p>
          Vollständige Compliance mit allen deutschen und europäischen Datenschutzgesetzen.
          Regelmäßige Audits garantiert.
        </p>
      </div>

      <div class="security-card u-text-center">
        <span class="material-symbols-outlined security-icon">visibility</span>
        <h3 class="u-color-primary u-mb-md u-text-center">Transparente Datenverarbeitung</h3>
        <p>
          Sie behalten jederzeit die volle Kontrolle über Ihre Daten. Einsicht, Export und Löschung
          auf Knopfdruck.
        </p>
      </div>

      <div class="security-card u-text-center">
        <span class="material-symbols-outlined security-icon">verified_user</span>
        <h3 class="u-color-primary u-mb-md u-text-center">ISO 27001 zertifiziert</h3>
        <p>
          Unsere Sicherheitsprozesse entsprechen den höchsten internationalen Standards für
          Informationssicherheit.
        </p>
      </div>

      <div class="security-card u-text-center">
        <span class="material-symbols-outlined security-icon">block</span>
        <h3 class="u-color-primary u-mb-md u-text-center">Keine Datenweitergabe</h3>
        <p>
          Ihre Daten gehören nur Ihnen. Keine Weitergabe an Dritte, keine Werbung, kein Tracking.
        </p>
      </div>
    </div>

    <!-- Enterprise On-Premise Box -->
    <div class="enterprise-box">
      <h3 class="enterprise-box__title">
        <span class="material-symbols-outlined enterprise-box__icon">business</span>
        Enterprise On-Premise Lösung
      </h3>
      <p class="enterprise-box__description">
        Für Unternehmen mit besonderen Sicherheitsanforderungen bieten wir die Möglichkeit, Assixx
        vollständig auf Ihren eigenen Servern zu betreiben.
        <strong>100% Ihrer Daten bleiben in Ihrer eigenen Infrastruktur.</strong>
      </p>
      <div class="enterprise-grid">
        <div>
          <span class="material-symbols-outlined enterprise-check">check_circle</span>
          <p class="u-fw-600">Eigene Server</p>
          <p class="u-fs-09rem u-opacity-80">Installation in Ihrem Rechenzentrum</p>
        </div>
        <div>
          <span class="material-symbols-outlined enterprise-check">check_circle</span>
          <p class="u-fw-600">Volle Kontrolle</p>
          <p class="u-fs-09rem u-opacity-80">Sie behalten alle Zugriffsrechte</p>
        </div>
        <div>
          <span class="material-symbols-outlined enterprise-check">check_circle</span>
          <p class="u-fw-600">Compliance</p>
          <p class="u-fs-09rem u-opacity-80">Erfüllt strengste Auflagen</p>
        </div>
        <div>
          <span class="material-symbols-outlined enterprise-check">check_circle</span>
          <p class="u-fw-600">Support</p>
          <p class="u-fs-09rem u-opacity-80">Dediziertes Enterprise-Team</p>
        </div>
      </div>
      <!-- eslint-disable svelte/no-navigation-without-resolve -- dynamic query string -->
      <a
        href={`${resolve('/signup')}?plan=enterprise`}
        class="btn btn-index enterprise-box__button">Enterprise-Beratung anfragen</a
      >
      <!-- eslint-enable svelte/no-navigation-without-resolve -->
    </div>

    <!-- Trust Badges -->
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
  .security-section {
    border-top: var(--glass-border);
    border-bottom: var(--glass-border);
    background: var(--glass-bg);
    padding: calc(var(--spacing-8) * 2) 5%;
  }

  .security-section__container {
    margin: 0 auto;
    max-width: 1200px;
  }

  .security-section__title {
    margin-bottom: var(--spacing-6);
    color: var(--primary-color);
    font-weight: 700;
    font-size: 2.5rem;
    text-align: center;
    animation: fade-in-up var(--duration-slow) var(--ease-out) both;
  }

  .security-section__subtitle {
    margin-right: auto;
    margin-bottom: calc(var(--spacing-8) * 1.5);
    margin-left: auto;
    max-width: 800px;
    color: var(--text-secondary);
    font-size: 1.1rem;
    line-height: 1.8;
    text-align: center;
    animation: fade-in-up var(--duration-slow) var(--ease-out) both;
    animation-delay: 100ms;
  }

  .security-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--spacing-8);
    margin-bottom: calc(var(--spacing-8) * 2);
  }

  .security-card {
    border: var(--glass-border);
    border-radius: var(--glass-card-radius);
    background: var(--glass-bg);
    padding: var(--spacing-6);
    transition: all var(--duration-normal) var(--ease-out);
    animation: fade-in-up var(--duration-slow) var(--ease-out) both;
  }

  .security-card:nth-child(1) {
    animation-delay: 100ms;
  }

  .security-card:nth-child(2) {
    animation-delay: 200ms;
  }

  .security-card:nth-child(3) {
    animation-delay: 300ms;
  }

  .security-card:nth-child(4) {
    animation-delay: 400ms;
  }

  .security-card:nth-child(5) {
    animation-delay: 500ms;
  }

  .security-card:nth-child(6) {
    animation-delay: 600ms;
  }

  .security-card:hover {
    transform: translateY(-2px);
    border-color: var(--color-border-hover);
    background: var(--glass-bg-hover);
  }

  .security-icon {
    display: block;
    margin-bottom: var(--spacing-4);
    color: var(--color-text-secondary);
    font-size: 32px;
  }

  .security-card h3 {
    margin-bottom: var(--spacing-4);
    color: var(--primary-color);
    font-weight: 600;
  }

  .security-card p {
    color: var(--text-secondary);
    font-size: 14px;
    line-height: 1.6;
  }

  .enterprise-box {
    border: 1px solid color-mix(in oklch, var(--color-primary) 30%, transparent);
    border-radius: var(--radius-3xl);
    background: color-mix(in oklch, var(--color-primary) 5%, transparent);
    padding: calc(var(--spacing-8) * 1.5);
    text-align: center;
  }

  .enterprise-box__title {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-3);
    margin-bottom: var(--spacing-6);
    color: var(--primary-color);
    font-size: 2rem;
  }

  .enterprise-box__icon {
    font-size: 32px;
  }

  .enterprise-check {
    display: block;
    margin-bottom: var(--spacing-2);
    color: var(--success-color);
    font-size: 24px;
  }

  .enterprise-box__description {
    margin-right: auto;
    margin-bottom: var(--spacing-6);
    margin-left: auto;
    max-width: 800px;
    font-size: 1.1rem;
    line-height: 1.8;
  }

  .enterprise-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-6);
    margin: var(--spacing-8) 0;
  }

  .enterprise-box__button {
    background: none;
    padding: var(--spacing-4) calc(var(--spacing-8) * 1.5);
    font-size: 1.1rem;
  }

  .trust-badges {
    margin-top: calc(var(--spacing-8) * 2);
    text-align: center;
  }

  .trust-badges__label {
    margin-bottom: var(--spacing-6);
    color: var(--text-secondary);
    font-size: 0.9rem;
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
    border: var(--glass-border);
    border-radius: var(--radius-full);
    padding: var(--spacing-2) var(--spacing-4);
    color: var(--color-text-secondary);
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.3px;
  }

  @media (width < 768px) {
    .security-section__title {
      font-size: 2rem;
    }

    .security-section__subtitle {
      font-size: 1rem;
    }

    .enterprise-box__title {
      font-size: 1.5rem;
    }
  }
</style>
