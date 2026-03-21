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

    <div class="security-features-grid">
      <!-- Security Feature Cards -->
      <div class="feature-card u-text-center">
        <div class="u-fs-3xl u-mb-md">🇩🇪</div>
        <h3 class="u-color-primary u-mb-md u-text-center">100% Deutsche Server</h3>
        <p>
          Alle Daten werden ausschließlich auf Servern in Deutschland gespeichert. Kein
          Datentransfer ins Ausland.
        </p>
      </div>

      <div class="feature-card u-text-center">
        <div class="u-fs-3xl u-mb-md">🔐</div>
        <h3 class="u-color-primary u-mb-md u-text-center">Ende-zu-Ende Verschlüsselung</h3>
        <p>
          Militärgrade AES-256 Verschlüsselung für alle Daten - sowohl bei der Übertragung als auch
          bei der Speicherung.
        </p>
      </div>

      <div class="feature-card u-text-center">
        <div class="u-fs-3xl u-mb-md">📋</div>
        <h3 class="u-color-primary u-mb-md u-text-center">DSGVO-konform</h3>
        <p>
          Vollständige Compliance mit allen deutschen und europäischen Datenschutzgesetzen.
          Regelmäßige Audits garantiert.
        </p>
      </div>

      <div class="feature-card u-text-center">
        <div class="u-fs-3xl u-mb-md">🔍</div>
        <h3 class="u-color-primary u-mb-md u-text-center">Transparente Datenverarbeitung</h3>
        <p>
          Sie behalten jederzeit die volle Kontrolle über Ihre Daten. Einsicht, Export und Löschung
          auf Knopfdruck.
        </p>
      </div>

      <div class="feature-card u-text-center">
        <div class="u-fs-3xl u-mb-md">🛡️</div>
        <h3 class="u-color-primary u-mb-md u-text-center">ISO 27001 zertifiziert</h3>
        <p>
          Unsere Sicherheitsprozesse entsprechen den höchsten internationalen Standards für
          Informationssicherheit.
        </p>
      </div>

      <div class="feature-card u-text-center">
        <div class="u-fs-3xl u-mb-md">🚫</div>
        <h3 class="u-color-primary u-mb-md u-text-center">Keine Datenweitergabe</h3>
        <p>
          Ihre Daten gehören nur Ihnen. Keine Weitergabe an Dritte, keine Werbung, kein Tracking.
        </p>
      </div>
    </div>

    <!-- Enterprise On-Premise Box -->
    <div class="enterprise-box">
      <h3 class="enterprise-box__title">🏢 Enterprise On-Premise Lösung</h3>
      <p class="enterprise-box__description">
        Für Unternehmen mit besonderen Sicherheitsanforderungen bieten wir die Möglichkeit, Assixx
        vollständig auf Ihren eigenen Servern zu betreiben.
        <strong>100% Ihrer Daten bleiben in Ihrer eigenen Infrastruktur.</strong>
      </p>
      <div class="enterprise-features-grid">
        <div>
          <div class="u-fs-xl u-mb-sm">✅</div>
          <p class="u-fw-600">Eigene Server</p>
          <p class="u-fs-09rem u-opacity-80">Installation in Ihrem Rechenzentrum</p>
        </div>
        <div>
          <div class="u-fs-xl u-mb-sm">✅</div>
          <p class="u-fw-600">Volle Kontrolle</p>
          <p class="u-fs-09rem u-opacity-80">Sie behalten alle Zugriffsrechte</p>
        </div>
        <div>
          <div class="u-fs-xl u-mb-sm">✅</div>
          <p class="u-fw-600">Compliance</p>
          <p class="u-fs-09rem u-opacity-80">Erfüllt strengste Auflagen</p>
        </div>
        <div>
          <div class="u-fs-xl u-mb-sm">✅</div>
          <p class="u-fw-600">Support</p>
          <p class="u-fs-09rem u-opacity-80">Dediziertes Enterprise-Team</p>
        </div>
      </div>
      <!-- eslint-disable svelte/no-navigation-without-resolve -- dynamic query string -->
      <a
        href={`${resolve('/signup', {})}?plan=enterprise`}
        class="btn btn-index enterprise-box__button">Enterprise-Beratung anfragen</a
      >
      <!-- eslint-enable svelte/no-navigation-without-resolve -->
    </div>

    <!-- Trust Badges -->
    <div class="trust-badges">
      <p class="trust-badges__label">Vertraut von führenden Industrieunternehmen</p>
      <div class="trust-badges__list">
        <div class="u-fs-09rem">SSL-verschlüsselt</div>
        <div class="u-fs-09rem">✅ DSGVO-konform</div>
        <div class="u-fs-09rem">🇩🇪 Made in Germany</div>
        <div class="u-fs-09rem">🛡️ ISO 27001</div>
      </div>
    </div>
  </div>
</section>

<style>
  .security-section {
    backdrop-filter: blur(10px);
    border-top: 1px solid var(--color-glass-border);
    border-bottom: 1px solid var(--color-glass-border);
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
  }

  .security-features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--spacing-8);
    margin-bottom: calc(var(--spacing-8) * 2);
  }

  .feature-card {
    border: 1px solid var(--color-glass-border);
    border-radius: var(--radius-xl);
    background: var(--glass-bg);
    padding: var(--spacing-6);
    transition:
      transform 0.3s ease,
      box-shadow 0.3s ease,
      border-color 0.3s ease,
      background 0.3s ease;
  }

  .feature-card:hover {
    transform: translateY(-4px);
    box-shadow:
      0 10px 40px color-mix(in oklch, var(--color-primary) 30%, transparent),
      inset 0 1px 0 color-mix(in oklch, var(--color-white) 10%, transparent);
    border-color: var(--primary-color);
    background: var(--glass-bg-hover);
  }

  .feature-card h3 {
    margin-bottom: var(--spacing-4);
    color: var(--primary-color);
    font-weight: 600;
  }

  .feature-card p {
    color: var(--text-secondary);
    font-size: 14px;
    line-height: 1.6;
  }

  .enterprise-box {
    backdrop-filter: blur(20px);
    box-shadow:
      0 8px 32px color-mix(in oklch, var(--color-primary) 20%, transparent),
      inset 0 1px 0 color-mix(in oklch, var(--color-white) 10%, transparent);
    border: 2px solid color-mix(in oklch, var(--color-primary) 30%, transparent);
    border-radius: var(--radius-3xl);
    background: color-mix(in oklch, var(--color-primary) 5%, transparent);
    padding: calc(var(--spacing-8) * 1.5);
    text-align: center;
  }

  .enterprise-box__title {
    margin-bottom: var(--spacing-6);
    color: var(--primary-color);
    font-size: 2rem;
  }

  .enterprise-box__description {
    margin-right: auto;
    margin-bottom: var(--spacing-6);
    margin-left: auto;
    max-width: 800px;
    font-size: 1.1rem;
    line-height: 1.8;
  }

  .enterprise-features-grid {
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
    gap: calc(var(--spacing-8) * 1.5);
    opacity: 70%;
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
