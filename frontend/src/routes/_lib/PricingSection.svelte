<!--
  PricingSection.svelte
  Landing page pricing section — 3 pricing cards + feature comparison table
  Extracted from routes/+page.svelte for max-lines compliance
-->
<script lang="ts">
  import { resolve } from '$app/paths';
</script>

<section
  class="pricing"
  id="pricing"
>
  <h2>Einfache, transparente Preise</h2>
  <p class="pricing-subtitle">
    Alle Pläne beinhalten 14 Tage kostenlose Testphase
  </p>

  <div class="pricing-grid">
    <!-- Basic Plan -->
    <div class="pricing-card">
      <h3>Basic</h3>
      <div class="price">
        €49
        <span>/Monat</span>
      </div>
      <ul class="feature-list">
        <li>✅ Bis zu 10 Mitarbeiter</li>
        <li>✅ Dokumenten-Upload</li>
        <li>✅ Lohnabrechnungen</li>
        <li>✅ Schwarzes Brett</li>
        <li>✅ Basis-Support</li>
      </ul>
      <div class="pricing-card__footer">
        <!-- eslint-disable svelte/no-navigation-without-resolve -- dynamic query string -->
        <a
          href={`${resolve('/signup', {})}?plan=basic`}
          class="btn btn-secondary pricing-card__button">Jetzt starten</a
        >
        <!-- eslint-enable svelte/no-navigation-without-resolve -->
      </div>
    </div>

    <!-- Professional Plan (Featured) -->
    <div class="pricing-card featured u-relative">
      <span
        class="badge badge--primary badge--lg badge--uppercase pricing-card__badge"
        >Beliebt</span
      >
      <h3>Professional</h3>
      <div class="price">
        €99
        <span>/Monat</span>
      </div>
      <ul class="feature-list">
        <li>✅ Bis zu 50 Mitarbeiter</li>
        <li>✅ Alle Basic Features</li>
        <li>✅ Kalender & Events</li>
        <li>✅ Schichtplanung</li>
        <li>✅ KVP-System</li>
        <li>✅ Chat-System</li>
        <li>✅ Priority Support</li>
      </ul>
      <div class="pricing-card__footer">
        <!-- eslint-disable svelte/no-navigation-without-resolve -- dynamic query string -->
        <a
          href={`${resolve('/signup', {})}?plan=professional`}
          class="btn btn-index pricing-card__button pricing-card__button--transparent"
        >
          Kostenlos testen
        </a>
        <!-- eslint-enable svelte/no-navigation-without-resolve -->
      </div>
    </div>

    <!-- Enterprise Plan -->
    <div class="pricing-card">
      <h3>Enterprise</h3>
      <div class="price">
        €149
        <span>/Monat</span>
      </div>
      <ul class="feature-list">
        <li>✅ Unbegrenzte Mitarbeiter</li>
        <li>✅ Alle Professional Features</li>
        <li>✅ Umfrage-System</li>
        <li>✅ API-Zugang</li>
        <li>✅ Custom Branding</li>
        <li>✅ Automatisierung</li>
        <li>✅ 24/7 Support</li>
        <li>✅ SLA-Garantie</li>
      </ul>
      <div class="pricing-card__footer">
        <!-- eslint-disable svelte/no-navigation-without-resolve -- dynamic query string -->
        <a
          href={`${resolve('/signup', {})}?plan=enterprise`}
          class="btn btn-secondary pricing-card__button">Kontakt aufnehmen</a
        >
        <!-- eslint-enable svelte/no-navigation-without-resolve -->
      </div>
    </div>
  </div>

  <!-- Feature Comparison Table -->
  <div class="feature-comparison">
    <h3 class="feature-comparison__title">Detaillierter Feature-Vergleich</h3>
    <div class="comparison-table-wrapper">
      <table class="comparison-table">
        <thead>
          <tr>
            <th>Features</th>
            <th>Basic</th>
            <th class="highlighted">Professional</th>
            <th>Enterprise</th>
          </tr>
        </thead>
        <tbody>
          <!-- Mitarbeiter-Management -->
          <tr class="category-header">
            <td colspan="4"><strong>Mitarbeiter-Management</strong></td>
          </tr>
          <tr>
            <td>Maximale Mitarbeiteranzahl</td>
            <td>10</td>
            <td class="highlighted">50</td>
            <td>Unbegrenzt</td>
          </tr>
          <tr>
            <td>Dokumenten-Upload</td>
            <td>✅</td>
            <td class="highlighted">✅</td>
            <td>✅</td>
          </tr>
          <tr>
            <td>Lohnabrechnungen</td>
            <td>✅</td>
            <td class="highlighted">✅</td>
            <td>✅</td>
          </tr>
          <tr>
            <td>Mitarbeiter-Profile</td>
            <td>✅</td>
            <td class="highlighted">✅</td>
            <td>✅</td>
          </tr>

          <!-- Kommunikation -->
          <tr class="category-header">
            <td colspan="4"><strong>Kommunikation</strong></td>
          </tr>
          <tr>
            <td>Schwarzes Brett</td>
            <td>✅</td>
            <td class="highlighted">✅</td>
            <td>✅</td>
          </tr>
          <tr>
            <td>Chat-System</td>
            <td>❌</td>
            <td class="highlighted">✅</td>
            <td>✅</td>
          </tr>
          <tr>
            <td>E-Mail-Benachrichtigungen</td>
            <td>Basis</td>
            <td class="highlighted">Erweitert</td>
            <td>Vollständig</td>
          </tr>

          <!-- Planung & Organisation -->
          <tr class="category-header">
            <td colspan="4"><strong>Planung & Organisation</strong></td>
          </tr>
          <tr>
            <td>Kalender & Events</td>
            <td>❌</td>
            <td class="highlighted">✅</td>
            <td>✅</td>
          </tr>
          <tr>
            <td>Schichtplanung</td>
            <td>❌</td>
            <td class="highlighted">✅</td>
            <td>✅</td>
          </tr>
          <tr>
            <td>Urlaubsverwaltung</td>
            <td>❌</td>
            <td class="highlighted">✅</td>
            <td>✅</td>
          </tr>

          <!-- Qualität & Verbesserung -->
          <tr class="category-header">
            <td colspan="4"><strong>Qualität & Verbesserung</strong></td>
          </tr>
          <tr>
            <td>KVP-System</td>
            <td>❌</td>
            <td class="highlighted">✅</td>
            <td>✅</td>
          </tr>
          <tr>
            <td>Umfrage-System</td>
            <td>❌</td>
            <td class="highlighted">❌</td>
            <td>✅</td>
          </tr>
          <tr>
            <td>TPM-System</td>
            <td>❌</td>
            <td class="highlighted">❌</td>
            <td>✅</td>
          </tr>

          <!-- Erweiterte Funktionen -->
          <tr class="category-header">
            <td colspan="4"><strong>Erweiterte Funktionen</strong></td>
          </tr>
          <tr>
            <td>API-Zugang</td>
            <td>❌</td>
            <td class="highlighted">❌</td>
            <td>✅</td>
          </tr>
          <tr>
            <td>Custom Branding</td>
            <td>❌</td>
            <td class="highlighted">❌</td>
            <td>✅</td>
          </tr>
          <tr>
            <td>Automatisierung</td>
            <td>❌</td>
            <td class="highlighted">Basis</td>
            <td>Vollständig</td>
          </tr>
          <tr>
            <td>Berichte & Analytics</td>
            <td>Basis</td>
            <td class="highlighted">Erweitert</td>
            <td>Premium</td>
          </tr>

          <!-- Support & Service -->
          <tr class="category-header">
            <td colspan="4"><strong>Support & Service</strong></td>
          </tr>
          <tr>
            <td>Support</td>
            <td>E-Mail</td>
            <td class="highlighted">E-Mail & Telefon</td>
            <td>24/7 Priority</td>
          </tr>
          <tr>
            <td>Onboarding</td>
            <td>Selbstservice</td>
            <td class="highlighted">Geführt</td>
            <td>Persönlich</td>
          </tr>
          <tr>
            <td>SLA-Garantie</td>
            <td>❌</td>
            <td class="highlighted">❌</td>
            <td>✅ 99.9%</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</section>

<style>
  .pricing {
    margin: 0 auto;
    padding: calc(var(--spacing-8) * 2) 5%;
    max-width: 1400px;
  }

  .pricing h2 {
    margin-bottom: var(--spacing-6);
    color: var(--primary-color);
    font-weight: 700;
    font-size: 3rem;
    letter-spacing: -0.5px;
    text-align: center;
  }

  .pricing-subtitle {
    opacity: 80%;
    margin-bottom: calc(var(--spacing-8) * 1.5);
    color: var(--text-secondary);
    font-size: 1.1rem;
    text-align: center;
  }

  .pricing-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: var(--spacing-8);
    margin: 0 auto;
    max-width: 1200px;
  }

  .pricing-card {
    display: flex;
    position: relative;
    flex-direction: column;

    border: 1px solid hsl(0deg 0% 100% / 10%);
    border-radius: var(--radius-xl);
    background: rgb(255 255 255 / 2%);
    padding: var(--spacing-8);
    min-height: 600px;
    overflow: hidden;
    text-align: center;
  }

  .pricing-card:hover {
    transform: translateY(-5px);
    box-shadow:
      0 12px 40px rgb(33 150 243 / 40%),
      inset 0 1px 0 rgb(255 255 255 / 10%);
    border-color: var(--primary-color);
    background: rgb(255 255 255 / 4%);
  }

  .pricing-card.featured {
    border-color: rgb(33 150 243 / 30%);
    background: rgb(33 150 243 / 5%);
    overflow: visible;
  }

  .pricing-card.featured:hover {
    transform: translateY(-6px);
    box-shadow:
      0 14px 45px rgb(33 150 243 / 50%),
      inset 0 1px 0 rgb(255 255 255 / 10%);
  }

  .pricing-card h3 {
    margin-bottom: var(--spacing-4);
    color: var(--primary-color);
    font-weight: 700;
    font-size: 1.75rem;
    letter-spacing: 0.5px;
  }

  .price {
    margin: var(--spacing-6) 0;
    color: var(--primary-color);
    font-weight: 700;
    font-size: 3.5rem;
    line-height: 1;
    text-shadow: 0 0 10px rgb(33 150 243 / 20%);
  }

  .price span {
    color: var(--text-secondary);
    font-weight: 400;
    font-size: 1.1rem;
  }

  .feature-list {
    flex-grow: 1;
    margin: var(--spacing-8) 0;
    padding: 0;
    list-style: none;
    text-align: left;
  }

  .feature-list li {
    position: relative;
    padding: var(--spacing-2) 0;
    padding-left: var(--spacing-8);
    color: var(--text-secondary);
    font-size: 15px;
    line-height: 1.6;
  }

  .feature-list li::before {
    position: absolute;
    left: 0;
    content: '✓';
    color: var(--success-color);
    font-weight: 700;
  }

  .pricing-card__badge {
    position: absolute;
    top: -12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    background: #002033;
    color: #fff;
  }

  .pricing-card__footer {
    margin-top: auto;
    padding-top: var(--spacing-6);
  }

  .pricing-card__button {
    padding: var(--spacing-4) var(--spacing-8);
    width: 100%;
    font-weight: 600;
    font-size: 16px;
  }

  .pricing-card__button--transparent {
    background: none;
  }

  /* Feature Comparison Table */
  .feature-comparison {
    margin-top: 4rem;
  }

  .feature-comparison__title {
    margin-bottom: 2rem;
    text-align: center;
  }

  .comparison-table-wrapper {
    margin-top: 2rem;

    border: 1px solid hsl(0deg 0% 100% / 10%);
    border-radius: var(--radius-xl);
    background: rgb(255 255 255 / 2%);
    overflow-x: auto;
  }

  .comparison-table {
    border-collapse: collapse;
    width: 100%;
    color: var(--text-primary);
    font-size: 12px;
  }

  .comparison-table th,
  .comparison-table td {
    border-bottom: 1px solid rgb(255 255 255 / 10%);
    padding: var(--spacing-3);
    text-align: left;
  }

  .comparison-table th {
    position: sticky;
    top: 0;
    z-index: 10;
    backdrop-filter: blur(10px);
    background: rgb(255 255 255 / 4%);
    color: var(--primary-color);
    font-weight: 600;
    font-size: 13px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .comparison-table thead tr:first-child th {
    border-bottom: 2px solid rgb(33 150 243 / 30%);
  }

  .comparison-table tbody tr:hover {
    transition: background 0.3s ease;
    background: rgb(255 255 255 / 3%);
  }

  .comparison-table .highlighted {
    border-right: 2px solid var(--primary-color);
    border-left: 2px solid var(--primary-color);
    background: rgb(33 150 243 / 10%) !important;
  }

  .comparison-table .category-header td {
    background: rgb(255 255 255 / 5%);
    padding-top: var(--spacing-6);
    padding-bottom: var(--spacing-2);
    color: var(--primary-color);
    font-weight: 600;
    font-size: 13px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .comparison-table th:nth-child(2),
  .comparison-table td:nth-child(2),
  .comparison-table th:nth-child(3),
  .comparison-table td:nth-child(3),
  .comparison-table th:nth-child(4),
  .comparison-table td:nth-child(4) {
    text-align: center;
  }

  .comparison-table-wrapper::-webkit-scrollbar {
    height: 8px;
  }

  .comparison-table-wrapper::-webkit-scrollbar-track {
    border-radius: 4px;
    background: rgb(255 255 255 / 5%);
  }

  .comparison-table-wrapper::-webkit-scrollbar-thumb {
    border-radius: 4px;
    background: rgb(255 255 255 / 20%);
  }

  .comparison-table-wrapper::-webkit-scrollbar-thumb:hover {
    background: rgb(255 255 255 / 30%);
  }

  @media (width < 768px) {
    .pricing h2 {
      font-size: 1.75rem;
    }

    .pricing-grid {
      grid-template-columns: 1fr;
    }

    .comparison-table {
      font-size: 12px;
    }

    .comparison-table th,
    .comparison-table td {
      padding: var(--spacing-3);
    }

    .feature-comparison h3 {
      font-size: 1.5rem;
    }
  }
</style>
