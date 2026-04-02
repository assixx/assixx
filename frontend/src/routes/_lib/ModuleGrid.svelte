<!--
  ModuleGrid.svelte
  Landing page module section — 4 category cards with unique accent colors
  Updated for addon-based SaaS model (ADR-033)
-->
<section
  class="module-section"
  id="module"
>
  <div class="module-section__container">
    <h2 class="module-section__title">Unsere Module</h2>
    <p class="module-section__subtitle">
      Alles was Ihr Unternehmen braucht — modular und flexibel zusammenstellbar
    </p>

    <div class="module-grid">
      <div
        class="module-card"
        style="

--accent: var(--color-info);"
      >
        <div class="module-card__icon">
          <i class="fas fa-users-cog"></i>
        </div>
        <h3>Organisation & Personal</h3>
        <p>
          Mitarbeiter, Abteilungen, Teams und Organigramm — zentral verwaltet. Unbegrenzte Nutzer
          inklusive.
        </p>
      </div>

      <div
        class="module-card"
        style="

--accent: var(--color-success);"
      >
        <div class="module-card__icon">
          <i class="fas fa-comments"></i>
        </div>
        <h3>Kommunikation</h3>
        <p>
          Schwarzes Brett, Chat, Benachrichtigungen und Umfragen — alle Mitarbeiter erreichen, vom
          Büro bis zur Produktion.
        </p>
      </div>

      <div
        class="module-card"
        style="

--accent: var(--color-warning);"
      >
        <div class="module-card__icon">
          <i class="fas fa-calendar-check"></i>
        </div>
        <h3>Planung & Verwaltung</h3>
        <p>
          Kalender, Schichtplanung, Urlaubsverwaltung und Dokumentenmanagement — Arbeitsabläufe
          digital organisiert.
        </p>
      </div>

      <div
        class="module-card"
        style="

--accent: var(--color-purple);"
      >
        <div class="module-card__icon">
          <i class="fas fa-industry"></i>
        </div>
        <h3>Lean Management</h3>
        <p>
          TPM-Wartung, KVP-Prozess, Arbeitsaufträge und Anlagenverwaltung — Produktivität
          systematisch steigern.
        </p>
      </div>
    </div>
  </div>
</section>

<style>
  .module-section {
    border-top: var(--glass-border);
    border-bottom: var(--glass-border);
    background: var(--glass-bg);
    padding: calc(var(--spacing-8) * 2) 5%;
  }

  .module-section__container {
    margin: 0 auto;
    max-width: 1400px;
  }

  .module-section__title {
    margin-bottom: var(--spacing-4);
    color: var(--primary-color);
    font-weight: 700;
    font-size: 2.5rem;
    text-align: center;
    animation: fade-in-up var(--duration-slow) var(--ease-out) both;
  }

  .module-section__subtitle {
    margin-right: auto;
    margin-bottom: calc(var(--spacing-8) * 1.5);
    margin-left: auto;
    max-width: 600px;
    color: var(--color-text-secondary);
    font-size: 1.1rem;
    line-height: 1.6;
    text-align: center;
    animation: fade-in-up var(--duration-slow) var(--ease-out) both;
    animation-delay: 100ms;
  }

  .module-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--spacing-6);
  }

  .module-card {
    border: var(--glass-border);
    border-radius: var(--glass-card-radius);
    background: var(--glass-bg);
    padding: var(--spacing-6);
    transition: all var(--duration-normal) var(--ease-out);
    animation: fade-in-up var(--duration-slow) var(--ease-out) both;
  }

  .module-card:nth-child(1) {
    animation-delay: 150ms;
  }

  .module-card:nth-child(2) {
    animation-delay: 250ms;
  }

  .module-card:nth-child(3) {
    animation-delay: 350ms;
  }

  .module-card:nth-child(4) {
    animation-delay: 450ms;
  }

  .module-card:hover {
    transform: translateY(-2px);
    border-color: color-mix(in oklch, var(--accent) 40%, transparent);
    background: var(--glass-bg-hover);
  }

  .module-card__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    margin-bottom: var(--spacing-4);
    border-radius: var(--radius-xl);
    background: color-mix(in oklch, var(--accent) 12%, transparent);
    color: var(--accent);
    font-size: 1.25rem;
    transition: all var(--duration-normal) var(--ease-out);
  }

  .module-card:hover .module-card__icon {
    background: color-mix(in oklch, var(--accent) 20%, transparent);
    transform: scale(1.08);
  }

  .module-card h3 {
    margin-bottom: var(--spacing-3);
    color: var(--color-text-primary);
    font-weight: 600;
    font-size: 1.1rem;
  }

  .module-card p {
    color: var(--color-text-secondary);
    font-size: 14px;
    line-height: 1.6;
  }

  @media (width < 768px) {
    .module-section__title {
      font-size: 2rem;
    }

    .module-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
