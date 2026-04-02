<!--
  PricingSection.svelte
  Landing page pricing section — addon-based SaaS model (ADR-033)
  Replaces legacy 3-tier plan pricing with Core + à-la-carte addons.
-->
<script lang="ts">
  import { resolve } from '$app/paths';
</script>

<section
  class="pricing"
  id="pricing"
>
  <h2>Einfach. Transparent. Modular.</h2>
  <p class="pricing-subtitle">
    Core-Paket + nur die Module die Sie brauchen — 30 Tage kostenlos testen
  </p>

  <div class="pricing-grid">
    <!-- Core Package -->
    <div class="pricing-card">
      <h3>Core-Paket</h3>
      <div class="price">
        €39
        <span>/Monat</span>
      </div>
      <div class="unlimited-badge">
        <i class="fas fa-infinity"></i>
        Unbegrenzte Lizenzen inklusive
      </div>
      <ul class="plan-list">
        <li>
          <strong>Unbegrenzt</strong> Mitarbeiter
        </li>
        <li>
          <strong>Unbegrenzt</strong> Abteilungsleiter (Admins)
        </li>
        <li>
          <strong>Unbegrenzt</strong> Geschäftsführer (Root-User)
        </li>
        <li>100 GB Speicher</li>
        <li>8 Core-Module inklusive</li>
        <li>Dashboard & Kalender</li>
        <li>Schwarzes Brett</li>
        <li>Benachrichtigungen</li>
        <li>Mitarbeiter & Teams</li>
      </ul>
      <div class="pricing-card__footer">
        <a
          href={resolve('/signup', {})}
          class="btn btn-secondary pricing-card__button">Jetzt starten</a
        >
      </div>
    </div>

    <!-- Addon Store (Featured) -->
    <div class="pricing-card featured u-relative">
      <span class="badge badge--primary badge--lg badge--uppercase pricing-card__badge"
        >Flexibel</span
      >
      <h3>Modul-Baukasten</h3>
      <div class="price">
        €10
        <span>/Modul/Monat</span>
      </div>
      <ul class="plan-list">
        <li>12 Zusatz-Module verfügbar</li>
        <li>30 Tage kostenlos testen</li>
        <li>Jederzeit aktivieren/deaktivieren</li>
        <li>Berechtigungen bleiben erhalten</li>
        <li>Dokumente & Chat</li>
        <li>Schichtplanung & Urlaub</li>
        <li>TPM & Arbeitsaufträge</li>
        <li>Umfragen & KVP</li>
      </ul>
      <div class="pricing-card__footer">
        <a
          href={resolve('/signup', {})}
          class="btn btn-index pricing-card__button pricing-card__button--transparent"
        >
          Kostenlos testen
        </a>
      </div>
    </div>

    <!-- Enterprise -->
    <div class="pricing-card">
      <h3>Enterprise</h3>
      <div class="price">
        Individuell
        <span>auf Anfrage</span>
      </div>
      <ul class="plan-list">
        <li>On-Premise Installation</li>
        <li>Eigene Server-Infrastruktur</li>
        <li>Dedizierter Support</li>
        <li>SLA-Garantie 99.9%</li>
        <li>Custom Branding</li>
        <li>API-Zugang</li>
        <li>Persönliches Onboarding</li>
        <li>Compliance & Audit</li>
      </ul>
      <div class="pricing-card__footer">
        <!-- eslint-disable svelte/no-navigation-without-resolve -- dynamic query string -->
        <a
          href={`${resolve('/signup', {})}?plan=enterprise`}
          class="btn btn-secondary pricing-card__button">Beratung anfragen</a
        >
        <!-- eslint-enable svelte/no-navigation-without-resolve -->
      </div>
    </div>
  </div>

  <!-- Module Catalog -->
  <div class="module-catalog">
    <h3 class="module-catalog__title">Alle 20 Module im Überblick</h3>
    <div class="catalog-columns">
      <!-- Core Modules -->
      <div class="catalog-group">
        <h4 class="catalog-group__heading">
          <i class="fas fa-shield-alt"></i>
          Core-Module
          <span class="catalog-group__badge catalog-group__badge--core">Inklusive</span>
        </h4>
        <ul class="catalog-list">
          <li>
            <i class="fas fa-tachometer-alt"></i>
            <span class="catalog-list__name">Dashboard</span>
            <span class="catalog-list__desc">Zentrale Übersicht mit Kennzahlen</span>
          </li>
          <li>
            <i class="fas fa-calendar-alt"></i>
            <span class="catalog-list__name">Kalender</span>
            <span class="catalog-list__desc">Gemeinsamer Unternehmenskalender</span>
          </li>
          <li>
            <i class="fas fa-chalkboard"></i>
            <span class="catalog-list__name">Schwarzes Brett</span>
            <span class="catalog-list__desc">Digitales schwarzes Brett für Ankündigungen</span>
          </li>
          <li>
            <i class="fas fa-cog"></i>
            <span class="catalog-list__name">Einstellungen</span>
            <span class="catalog-list__desc">Mandanten-Konfiguration</span>
          </li>
          <li>
            <i class="fas fa-bell"></i>
            <span class="catalog-list__name">Benachrichtigungen</span>
            <span class="catalog-list__desc">Push & SSE-Streaming</span>
          </li>
          <li>
            <i class="fas fa-users"></i>
            <span class="catalog-list__name">Mitarbeiterverwaltung</span>
            <span class="catalog-list__desc">Benutzer anlegen und verwalten</span>
          </li>
          <li>
            <i class="fas fa-sitemap"></i>
            <span class="catalog-list__name">Abteilungen</span>
            <span class="catalog-list__desc">Organisationsstruktur</span>
          </li>
          <li>
            <i class="fas fa-user-friends"></i>
            <span class="catalog-list__name">Teams</span>
            <span class="catalog-list__desc">Teams und Mitglieder zuordnen</span>
          </li>
        </ul>
      </div>

      <!-- Purchasable Addons -->
      <div class="catalog-group">
        <h4 class="catalog-group__heading">
          <i class="fas fa-cubes"></i>
          Zusatz-Module
          <span class="catalog-group__badge catalog-group__badge--addon">€10/Monat</span>
        </h4>
        <ul class="catalog-list">
          <li>
            <i class="fas fa-folder-open"></i>
            <span class="catalog-list__name">Dokumente</span>
            <span class="catalog-list__desc">Dokumentenverwaltung mit Upload und Archiv</span>
          </li>
          <li>
            <i class="fas fa-user-secret"></i>
            <span class="catalog-list__name">Platzhalter-Benutzer</span>
            <span class="catalog-list__desc">Anonyme Accounts für Fabrik-Bildschirme</span>
          </li>
          <li>
            <i class="fas fa-umbrella-beach"></i>
            <span class="catalog-list__name">Urlaubsverwaltung</span>
            <span class="catalog-list__desc">Anträge, Genehmigung, Kapazitätsprüfung</span>
          </li>
          <li>
            <i class="fas fa-clock"></i>
            <span class="catalog-list__name">Schichtplanung</span>
            <span class="catalog-list__desc">Schichtpläne, Tauschbörse, Rotation</span>
          </li>
          <li>
            <i class="fas fa-comments"></i>
            <span class="catalog-list__name">Chat</span>
            <span class="catalog-list__desc">Team-Chat mit Gesprächen und Nachrichten</span>
          </li>
          <li>
            <i class="fas fa-poll"></i>
            <span class="catalog-list__name">Umfragen</span>
            <span class="catalog-list__desc">Erstellen, durchführen und auswerten</span>
          </li>
          <li>
            <i class="fas fa-clipboard-list"></i>
            <span class="catalog-list__name">Arbeitsaufträge</span>
            <span class="catalog-list__desc">Mängelbeseitigung und Aufgabenverwaltung</span>
          </li>
          <li>
            <i class="fas fa-cogs"></i>
            <span class="catalog-list__name">Anlagen & Maschinen</span>
            <span class="catalog-list__desc">Verwaltung und Verfügbarkeitstracking</span>
          </li>
          <li>
            <i class="fas fa-chart-bar"></i>
            <span class="catalog-list__name">Berichte</span>
            <span class="catalog-list__desc">Analytics und Datenexporte</span>
          </li>
          <li>
            <i class="fas fa-lightbulb"></i>
            <span class="catalog-list__name">KVP</span>
            <span class="catalog-list__desc">Kontinuierlicher Verbesserungsprozess</span>
          </li>
          <li>
            <i class="fas fa-tools"></i>
            <span class="catalog-list__name">TPM / Wartung</span>
            <span class="catalog-list__desc">Kamishibai Board und Wartungspläne</span>
          </li>
          <li>
            <i class="fas fa-file-signature"></i>
            <span class="catalog-list__name">Protokoll & Audit</span>
            <span class="catalog-list__desc">Audit-Protokollierung, Compliance-Berichte</span>
          </li>
        </ul>
      </div>
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
    animation: fade-in-up var(--duration-slow) var(--ease-out) both;
  }

  .pricing-subtitle {
    opacity: 80%;
    margin-bottom: calc(var(--spacing-8) * 1.5);
    color: var(--color-text-secondary);
    font-size: 1.1rem;
    text-align: center;
    animation: fade-in-up var(--duration-slow) var(--ease-out) both;
    animation-delay: 100ms;
  }

  .pricing-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--spacing-8);
    margin: 0 auto;
    max-width: 1200px;
  }

  .pricing-card {
    display: flex;
    position: relative;
    flex-direction: column;
    border: var(--glass-border);
    border-radius: var(--glass-card-radius);
    background: var(--glass-bg);
    padding: var(--spacing-8);
    min-height: 550px;
    overflow: hidden;
    text-align: center;
    transition: all var(--duration-normal) var(--ease-out);
    animation: fade-in-up var(--duration-slow) var(--ease-out) both;
  }

  .pricing-card:nth-child(1) {
    animation-delay: 200ms;
  }

  .pricing-card:nth-child(2) {
    animation-delay: 350ms;
  }

  .pricing-card:nth-child(3) {
    animation-delay: 500ms;
  }

  .pricing-card:hover {
    transform: translateY(-2px);
    border-color: var(--color-border-hover);
    background: var(--glass-bg-hover);
  }

  .pricing-card.featured {
    border-color: color-mix(in oklch, var(--color-primary) 30%, transparent);
    background: color-mix(in oklch, var(--color-primary) 5%, transparent);
    overflow: visible;
  }

  .pricing-card.featured:hover {
    transform: translateY(-3px);
    border-color: color-mix(in oklch, var(--color-primary) 50%, transparent);
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
  }

  .unlimited-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-4);
    padding: var(--spacing-2) var(--spacing-4);
    border-radius: var(--radius-full);
    background: color-mix(in oklch, var(--success-color) 15%, transparent);
    color: var(--success-color);
    font-weight: 600;
    font-size: 13px;
    letter-spacing: 0.3px;
  }

  .price span {
    display: block;
    margin-top: var(--spacing-2);
    color: var(--color-text-secondary);
    font-weight: 400;
    font-size: 1rem;
  }

  .plan-list {
    flex-grow: 1;
    margin: var(--spacing-8) 0;
    padding: 0;
    list-style: none;
    text-align: left;
  }

  .plan-list li {
    position: relative;
    padding: var(--spacing-2) 0;
    padding-left: var(--spacing-8);
    color: var(--color-text-secondary);
    font-size: 15px;
    line-height: 1.6;
  }

  .plan-list li::before {
    position: absolute;
    left: 0;
    content: '\2713';
    color: var(--success-color);
    font-weight: 700;
  }

  .pricing-card__badge {
    position: absolute;
    top: -12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    background: oklch(17.92% 0.0441 230.72);
    color: var(--color-white);
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

  /* =========================================================
     MODULE CATALOG
     ========================================================= */

  .module-catalog {
    margin-top: 4rem;
  }

  .module-catalog__title {
    margin-bottom: 2rem;
    color: var(--primary-color);
    font-weight: 700;
    font-size: 1.75rem;
    text-align: center;
  }

  .catalog-columns {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: var(--spacing-8);
  }

  .catalog-group {
    border: var(--glass-border);
    border-radius: var(--glass-card-radius);
    background: var(--glass-bg);
    padding: var(--spacing-6);
    animation: fade-in-up var(--duration-slow) var(--ease-out) both;
  }

  .catalog-group:nth-child(1) {
    animation-delay: 200ms;
  }

  .catalog-group:nth-child(2) {
    animation-delay: 400ms;
  }

  .catalog-group__heading {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    margin-bottom: var(--spacing-6);
    padding-bottom: var(--spacing-4);
    border-bottom: var(--glass-border);
    color: var(--primary-color);
    font-weight: 600;
    font-size: 1.1rem;
  }

  .catalog-group__badge {
    margin-left: auto;
    border-radius: var(--radius-full);
    padding: var(--spacing-1) var(--spacing-3);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .catalog-group__badge--core {
    background: color-mix(in oklch, var(--success-color) 15%, transparent);
    color: var(--success-color);
  }

  .catalog-group__badge--addon {
    background: color-mix(in oklch, var(--color-primary) 15%, transparent);
    color: var(--primary-color);
  }

  .catalog-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .catalog-list li {
    display: grid;
    grid-template-columns: 1.5rem 1fr;
    grid-template-rows: auto auto;
    gap: 0 var(--spacing-3);
    padding: var(--spacing-3) 0;
    border-bottom: 1px solid color-mix(in oklch, var(--color-glass-border) 50%, transparent);
  }

  .catalog-list li:last-child {
    border-bottom: none;
  }

  .catalog-list li > i {
    grid-row: 1 / -1;
    align-self: center;
    color: var(--primary-color);
    font-size: 14px;
    text-align: center;
  }

  .catalog-list__name {
    color: var(--color-text-primary);
    font-weight: 500;
    font-size: 14px;
  }

  .catalog-list__desc {
    color: var(--color-text-tertiary);
    font-size: 12px;
    line-height: 1.4;
  }

  /* =========================================================
     RESPONSIVE
     ========================================================= */

  @media (width < 768px) {
    .pricing h2 {
      font-size: 1.75rem;
    }

    .pricing-grid {
      grid-template-columns: 1fr;
    }

    .catalog-columns {
      grid-template-columns: 1fr;
    }
  }
</style>
