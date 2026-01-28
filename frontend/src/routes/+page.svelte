<script lang="ts">
  import { onMount } from 'svelte';

  import { resolve } from '$app/paths';

  import '../styles/index.css';

  // Modal state
  let showSignupModal: boolean = $state(false);

  // Add class to body for landing page (disables global gradient)
  onMount(() => {
    document.body.classList.add('landing-page-active');
    return () => {
      document.body.classList.remove('landing-page-active');
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
  <title>Assixx - Die SaaS-Lösung für Industriefirmen</title>
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
            src="/images/logo.png"
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
          class="btn btn-primary btn-primary--transparent">Registrieren</a
        >
      </div>
    </nav>
  </header>

  <!-- Hero Section -->
  <section class="hero">
    <h1>Die digitale Lösung für Industriefirmen</h1>
    <p>
      Verbinden Sie Ihre Produktionsarbeiter mit der Verwaltung.
      Dokumentenverwaltung, Kommunikation und mehr - alles in einer Plattform.
    </p>
    <a
      href={resolve('/signup', {})}
      class="btn btn-primary btn-primary--transparent">Jetzt registrieren</a
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
      <h2 class="security-section__title">🔒 Ihre Daten sind bei uns sicher</h2>
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
          class="btn btn-primary enterprise-box__button"
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
          <div class="u-fs-09rem">🔒 SSL-verschlüsselt</div>
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
            class="btn btn-primary pricing-card__button pricing-card__button--transparent"
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
    <p>&copy; 2025 Assixx. Alle Rechte vorbehalten.</p>
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
        class="btn btn-primary u-w-full">Zur Registrierung</a
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

  /* Logo button reset - removes default button styling */
  .logo-button {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
  }
</style>
