<!--
  FeaturesGrid.svelte
  Landing page module section — 4 category cards
  Updated for addon-based SaaS model (ADR-033)
-->
<section
  class="module-section"
  id="module"
>
  <div class="module-grid">
    <div class="module-card">
      <h3>
        <i class="fas fa-users-cog"></i>
        Organisation & Personal
      </h3>
      <p>
        Mitarbeiter, Abteilungen, Teams und Organigramm — zentral verwaltet. Unbegrenzte Nutzer
        inklusive.
      </p>
    </div>
    <div class="module-card">
      <h3>
        <i class="fas fa-comments"></i>
        Kommunikation
      </h3>
      <p>
        Schwarzes Brett, Chat, Benachrichtigungen und Umfragen — alle Mitarbeiter erreichen, vom
        Büro bis zur Produktion.
      </p>
    </div>
    <div class="module-card">
      <h3>
        <i class="fas fa-calendar-check"></i>
        Planung & Verwaltung
      </h3>
      <p>
        Kalender, Schichtplanung, Urlaubsverwaltung und Dokumentenmanagement — Arbeitsabläufe
        digital organisiert.
      </p>
    </div>
    <div class="module-card">
      <h3>
        <i class="fas fa-industry"></i>
        Lean Management
      </h3>
      <p>
        TPM-Wartung, KVP-Prozess, Arbeitsaufträge und Anlagenverwaltung — Produktivität systematisch
        steigern.
      </p>
    </div>
  </div>
</section>

<style>
  .module-section {
    backdrop-filter: blur(10px);
    border-top: 1px solid var(--color-glass-border);
    border-bottom: 1px solid var(--color-glass-border);
    background: var(--glass-bg);
    padding: var(--spacing-8) 5%;
  }

  .module-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--spacing-6);
    margin: 0 auto;
    max-width: 1400px;
  }

  .module-card {
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

  .module-card:hover {
    transform: translateY(-4px);
    box-shadow:
      0 10px 40px color-mix(in oklch, var(--color-primary) 30%, transparent),
      inset 0 1px 0 color-mix(in oklch, var(--color-white) 10%, transparent);
    border-color: var(--primary-color);
    background: var(--glass-bg-hover);
  }

  .module-card h3 {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    margin-bottom: var(--spacing-4);
    color: var(--primary-color);
    font-weight: 600;
    font-size: 1.1rem;
  }

  .module-card h3 i {
    font-size: 1.25rem;
    width: 1.5rem;
    text-align: center;
  }

  .module-card p {
    color: var(--color-text-secondary);
    font-size: 14px;
    line-height: 1.6;
  }

  @media (width < 768px) {
    .module-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
