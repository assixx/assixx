<script lang="ts">
  import { onMount } from 'svelte';

  import { resolve } from '$app/paths';

  import {
    isDark,
    forceDark,
    restoreUserTheme,
  } from '$lib/stores/theme.svelte';

  // Modal state
  let showSignupModal: boolean = $state(false);

  // Always-dark page + body class for landing page (disables global gradient)
  onMount(() => {
    forceDark();
    document.body.classList.add('landing-page-active');
    return () => {
      document.body.classList.remove('landing-page-active');
      restoreUserTheme();
    };
  });

  function handleReloadPage(): void {
    window.location.reload();
  }

  function closeSignupModal(): void {
    showSignupModal = false;
  }

  function handleModalBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) {
      closeSignupModal();
    }
  }
</script>

<svelte:head>
  <title>Assixx - Enterprise 2.0 für Industriefirmen</title>
</svelte:head>

<!-- Landing Page Container -->
<div class="landing-page">
  <!-- Header -->
  <header class="header">
    <nav class="nav">
      <div class="logo-container u-cursor-pointer">
        <button
          type="button"
          class="logo-button"
          onclick={handleReloadPage}
        >
          <img
            src={isDark() ?
              '/images/logo_darkmode.png'
            : '/images/logo_lightmode.png'}
            alt="Assixx Logo"
            class="logo"
          />
        </button>
      </div>
      <div class="nav-links">
        <a href="#features">Features</a>
        <a href="#security">Sicherheit</a>
        <a href="#pricing">Preise</a>
        <a href={resolve('/login', {})}>Anmelden</a>
        <a
          href={resolve('/signup', {})}
          class="btn btn-primary-first">Registrieren</a
        >
      </div>
    </nav>
  </header>

  <!-- Hero Section -->
  <section class="hero">
    <h1>Enterprise 2.0 für Industriefirmen</h1>
    <p>
      Wissensmanagement, Kommunikation und Kollaboration - von der Produktion
      bis zur Verwaltung. Alles in einer Plattform.
    </p>
    <a
      href={resolve('/signup', {})}
      class="btn btn-primary-first">Jetzt registrieren</a
    >
  </section>

  <!-- Features Section -->
  <section
    class="features"
    id="features"
  >
    <div class="features-grid">
      <div class="feature-card">
        <h3>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"
            />
          </svg>
          Dokumentenverwaltung
        </h3>
        <p>
          Lohnabrechnungen, Bescheinigungen und mehr - digital und sicher
          verwaltet.
        </p>
      </div>
      <div class="feature-card">
        <h3>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M17,19H7V5H17M17,1H7C5.89,1 5,1.89 5,3V21A2,2 0 0,0 7,23H17A2,2 0 0,0 19,21V3C19,1.89 18.1,1 17,1Z"
            />
          </svg>
          Mobile First
        </h3>
        <p>Optimiert für Smartphones - perfekt für Arbeiter ohne PC-Zugang.</p>
      </div>
      <div class="feature-card">
        <h3>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M21,19V20H3V19L5,17V11C5,7.9 7.03,5.17 10,4.29C10,4.19 10,4.1
                10,4A2,2 0 0,1 12,2A2,2 0 0,1 14,4C14,4.1 14,4.19
                14,4.29C16.97,5.17 19,7.9 19,11V17L21,19M14,21A2,2 0 0,1
                12,23A2,2 0 0,1 10,21"
            />
          </svg>
          Benachrichtigungen
        </h3>
        <p>
          Wichtige Infos erreichen jeden Mitarbeiter sofort per
          Push-Notification.
        </p>
      </div>
      <div class="feature-card">
        <h3>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2
                0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1
                4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1
                17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z"
            />
          </svg>
          Sicher & DSGVO-konform
        </h3>
        <p>Verschlüsselte Daten und deutsche Server für maximale Sicherheit.</p>
      </div>
    </div>
  </section>

  <!-- Security Section -->
  <section
    class="security-section"
    id="security"
  >
    <div class="security-section__container">
      <h2 class="security-section__title">Ihre Daten sind bei uns sicher</h2>
      <p class="security-section__subtitle">
        Datenschutz und Sicherheit haben bei uns höchste Priorität. Ihre
        sensiblen Unternehmensdaten sind durch modernste Verschlüsselung und
        strikte Sicherheitsmaßnahmen geschützt.
      </p>

      <div class="security-features-grid">
        <!-- Security Feature Cards -->
        <div class="feature-card u-text-center">
          <div class="u-fs-3xl u-mb-md">🇩🇪</div>
          <h3 class="u-color-primary u-mb-md u-text-center">
            100% Deutsche Server
          </h3>
          <p>
            Alle Daten werden ausschließlich auf Servern in Deutschland
            gespeichert. Kein Datentransfer ins Ausland.
          </p>
        </div>

        <div class="feature-card u-text-center">
          <div class="u-fs-3xl u-mb-md">🔐</div>
          <h3 class="u-color-primary u-mb-md u-text-center">
            Ende-zu-Ende Verschlüsselung
          </h3>
          <p>
            Militärgrade AES-256 Verschlüsselung für alle Daten - sowohl bei der
            Übertragung als auch bei der Speicherung.
          </p>
        </div>

        <div class="feature-card u-text-center">
          <div class="u-fs-3xl u-mb-md">📋</div>
          <h3 class="u-color-primary u-mb-md u-text-center">DSGVO-konform</h3>
          <p>
            Vollständige Compliance mit allen deutschen und europäischen
            Datenschutzgesetzen. Regelmäßige Audits garantiert.
          </p>
        </div>

        <div class="feature-card u-text-center">
          <div class="u-fs-3xl u-mb-md">🔍</div>
          <h3 class="u-color-primary u-mb-md u-text-center">
            Transparente Datenverarbeitung
          </h3>
          <p>
            Sie behalten jederzeit die volle Kontrolle über Ihre Daten.
            Einsicht, Export und Löschung auf Knopfdruck.
          </p>
        </div>

        <div class="feature-card u-text-center">
          <div class="u-fs-3xl u-mb-md">🛡️</div>
          <h3 class="u-color-primary u-mb-md u-text-center">
            ISO 27001 zertifiziert
          </h3>
          <p>
            Unsere Sicherheitsprozesse entsprechen den höchsten internationalen
            Standards für Informationssicherheit.
          </p>
        </div>

        <div class="feature-card u-text-center">
          <div class="u-fs-3xl u-mb-md">🚫</div>
          <h3 class="u-color-primary u-mb-md u-text-center">
            Keine Datenweitergabe
          </h3>
          <p>
            Ihre Daten gehören nur Ihnen. Keine Weitergabe an Dritte, keine
            Werbung, kein Tracking.
          </p>
        </div>
      </div>

      <!-- Enterprise On-Premise Box -->
      <div class="enterprise-box">
        <h3 class="enterprise-box__title">🏢 Enterprise On-Premise Lösung</h3>
        <p class="enterprise-box__description">
          Für Unternehmen mit besonderen Sicherheitsanforderungen bieten wir die
          Möglichkeit, Assixx vollständig auf Ihren eigenen Servern zu
          betreiben.
          <strong
            >100% Ihrer Daten bleiben in Ihrer eigenen Infrastruktur.</strong
          >
        </p>
        <div class="enterprise-features-grid">
          <div>
            <div class="u-fs-xl u-mb-sm">✅</div>
            <p class="u-fw-600">Eigene Server</p>
            <p class="u-fs-09rem u-opacity-80">
              Installation in Ihrem Rechenzentrum
            </p>
          </div>
          <div>
            <div class="u-fs-xl u-mb-sm">✅</div>
            <p class="u-fw-600">Volle Kontrolle</p>
            <p class="u-fs-09rem u-opacity-80">
              Sie behalten alle Zugriffsrechte
            </p>
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
          class="btn btn-index enterprise-box__button"
          >Enterprise-Beratung anfragen</a
        >
        <!-- eslint-enable svelte/no-navigation-without-resolve -->
      </div>

      <!-- Trust Badges -->
      <div class="trust-badges">
        <p class="trust-badges__label">
          Vertraut von führenden Industrieunternehmen
        </p>
        <div class="trust-badges__list">
          <div class="u-fs-09rem">SSL-verschlüsselt</div>
          <div class="u-fs-09rem">✅ DSGVO-konform</div>
          <div class="u-fs-09rem">🇩🇪 Made in Germany</div>
          <div class="u-fs-09rem">🛡️ ISO 27001</div>
        </div>
      </div>
    </div>
  </section>

  <!-- Pricing Section -->
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

  <!-- Footer -->
  <footer class="footer">
    <p>&copy; 2026 Assixx. Alle Rechte vorbehalten.</p>
  </footer>
</div>
<!-- End .landing-page -->

<!-- Signup Modal (kept for compatibility but links go to /signup) -->
{#if showSignupModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="signup-modal"
    style="display: flex"
    onclick={handleModalBackdropClick}
  >
    <div class="modal-content">
      <h2>Jetzt kostenlos testen</h2>
      <p>14 Tage kostenlos - keine Kreditkarte erforderlich</p>
      <p class="u-mb-md">
        Bitte nutzen Sie unser vollständiges Registrierungsformular:
      </p>
      <a
        href={resolve('/signup', {})}
        class="btn btn-index u-w-full">Zur Registrierung</a
      >
      <button
        type="button"
        class="btn btn-secondary btn-cancel--full"
        onclick={closeSignupModal}>Abbrechen</button
      >
    </div>
  </div>
{/if}

<style>
  /* Landing page container - ensures vertical stacking */
  .landing-page {
    display: block;
    width: 100%;
    min-height: 100vh;
  }

  /* Logo button reset */
  .logo-button {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
  }

  /* Navigation */
  .nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 0 auto;
    width: 100%;
    max-width: 1200px;
  }

  .logo-container {
    display: flex;
    align-items: center;
    gap: var(--spacing-4);
    cursor: pointer;
    text-decoration: none;
  }

  .logo {
    display: block;
    transition: transform 0.3s ease;
    cursor: pointer;
    width: 120px;
    height: auto;
  }

  .nav-links {
    display: flex;
    align-items: center;
    gap: 2rem;
  }

  .nav-links a {
    transition: color 0.3s ease;
    color: var(--text-secondary);
    font-weight: 500;
    text-decoration: none;
  }

  .nav-links a:hover {
    color: #fff;
  }

  /* Hero Section */
  .hero {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    margin: 0 auto;
    background-image: url('/images/background_index_1920.jpg');
    background-image: image-set(
      url('/images/background_index.webp') type('image/webp'),
      url('/images/background_index_1920.jpg') type('image/jpeg')
    );
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    padding: calc(var(--spacing-8) * 4) 5% calc(var(--spacing-8) * 2);
    max-width: 100%;
    min-height: 70vh;
    text-align: center;
  }

  .hero::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 0;
    background: linear-gradient(
      to bottom,
      rgb(0 10 20 / 16%) 0%,
      rgb(0 10 20 / 12.6%) 50%,
      rgb(0 10 20 / 83.6%) 100%
    );
  }

  .hero > :global(*) {
    position: relative;
    z-index: 1;
    max-width: 800px;
  }

  .hero h1 {
    margin-bottom: var(--spacing-6);
    color: #fff;
    font-weight: 700;
    font-size: 3rem;
    text-shadow: 0 2px 4px rgb(0 0 0 / 30%);
  }

  .hero p {
    margin-bottom: var(--spacing-6);
    color: rgb(255 255 255 / 85%);
    font-size: 1.25rem;
    line-height: 1.6;
    text-shadow: 0 1px 2px rgb(0 0 0 / 20%);
  }

  /* Features Section */
  .features {
    backdrop-filter: blur(10px);
    border-top: 1px solid rgb(255 255 255 / 10%);
    border-bottom: 1px solid rgb(255 255 255 / 10%);
    background: rgb(255 255 255 / 1%);
    padding: var(--spacing-8) 5%;
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--spacing-6);
    margin: 0 auto;
    max-width: 1400px;
  }

  .landing-page .feature-card {
    backdrop-filter: blur(20px) saturate(180%);
    box-shadow: var(--shadow-sm);
    border: 1px solid hsl(0deg 0% 100% / 10%);
    border-radius: var(--radius-xl);
    background: rgb(255 255 255 / 2%);
    padding: var(--spacing-6);
  }

  .landing-page .feature-card:hover {
    transform: translateY(-4px);
    box-shadow:
      0 10px 40px rgb(33 150 243 / 30%),
      inset 0 1px 0 rgb(255 255 255 / 10%);
    border-color: var(--primary-color);
    background: rgb(255 255 255 / 4%);
  }

  .landing-page .feature-card h3 {
    margin-bottom: var(--spacing-4);
    color: var(--primary-color);
    font-weight: 600;
    white-space: nowrap;
  }

  .landing-page .feature-card p {
    color: var(--text-secondary);
    font-size: 14px;
    line-height: 1.6;
  }

  /* Pricing Section */
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
    backdrop-filter: blur(20px) saturate(180%);
    box-shadow: var(--shadow-sm);
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
    box-shadow: var(--shadow-sm);
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

  /* Footer */
  .footer {
    backdrop-filter: blur(20px);
    box-shadow: 0 -8px 32px rgb(0 0 0 / 40%);
    border-top: 1px solid rgb(255 255 255 / 15%);
    background: rgb(255 255 255 / 2%);
    padding: var(--spacing-6) 5%;
    color: var(--text-secondary);
    text-align: center;
  }

  /* Signup Modal */
  .signup-modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    justify-content: center;
    align-items: center;
    z-index: 2000;
    backdrop-filter: blur(10px);
    background: rgb(0 0 0 / 80%);
    width: 100%;
    height: 100%;
  }

  .modal-content {
    backdrop-filter: blur(20px) saturate(180%);
    box-shadow: var(--shadow-sm);
    border: 1px solid hsl(0deg 0% 100% / 10%);
    border-radius: var(--radius-xl);
    background: rgb(255 255 255 / 2%);
    padding: var(--spacing-6);
    width: 90%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-content h2 {
    margin-bottom: var(--spacing-2);
    color: var(--primary-color);
    font-weight: 600;
  }

  .modal-content p {
    margin-bottom: var(--spacing-6);
    color: var(--text-secondary);
    font-size: 13px;
  }

  /* Feature Comparison Table */
  .feature-comparison {
    margin-top: 4rem;
  }

  .comparison-table-wrapper {
    backdrop-filter: blur(20px) saturate(180%);
    margin-top: 2rem;
    box-shadow: var(--shadow-sm);
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

  .pricing-card__badge {
    position: absolute;
    top: -12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    background: #002033;
    color: #fff;
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

  /* Security Section */
  .security-section {
    backdrop-filter: blur(10px);
    border-top: 1px solid rgb(255 255 255 / 10%);
    border-bottom: 1px solid rgb(255 255 255 / 10%);
    background: rgb(255 255 255 / 1%);
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

  .enterprise-box {
    backdrop-filter: blur(20px);
    box-shadow:
      0 8px 32px rgb(33 150 243 / 20%),
      inset 0 1px 0 rgb(255 255 255 / 10%);
    border: 2px solid rgb(33 150 243 / 30%);
    border-radius: var(--radius-3xl);
    background: rgb(33 150 243 / 5%);
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

  .pricing-subtitle {
    opacity: 80%;
    margin-bottom: calc(var(--spacing-8) * 1.5);
    color: var(--text-secondary);
    font-size: 1.1rem;
    text-align: center;
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

  .feature-comparison__title {
    margin-bottom: 2rem;
    text-align: center;
  }

  .btn-cancel--full {
    margin-top: 1rem;
    width: 100%;
  }

  /* Responsive */
  @media (width < 768px) {
    .header {
      padding: var(--spacing-3);
    }

    .nav {
      flex-direction: column;
      gap: var(--spacing-4);
    }

    .logo-container {
      margin-bottom: var(--spacing-2);
    }

    .nav-links {
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--spacing-4);
    }

    .hero {
      min-height: 50vh;
      padding: calc(var(--spacing-8) * 2) 5% var(--spacing-8);
    }

    .hero h1 {
      font-size: 2rem;
    }

    .hero p {
      font-size: 1rem;
    }

    .pricing h2 {
      font-size: 1.75rem;
    }

    .features-grid,
    .pricing-grid {
      grid-template-columns: 1fr;
    }

    .modal-content {
      padding: var(--spacing-3);
      width: 95%;
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
