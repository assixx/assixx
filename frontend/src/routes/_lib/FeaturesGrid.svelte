<!--
  FeaturesGrid.svelte
  Landing page features section — 4 feature cards
  Extracted from routes/+page.svelte for max-lines compliance
-->
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
        Wichtige Infos erreichen jeden Mitarbeiter sofort per Push-Notification.
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

<style>
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

  .feature-card {
    backdrop-filter: blur(20px) saturate(180%);
    box-shadow: var(--shadow-sm);
    border: 1px solid hsl(0deg 0% 100% / 10%);
    border-radius: var(--radius-xl);
    background: rgb(255 255 255 / 2%);
    padding: var(--spacing-6);
  }

  .feature-card:hover {
    transform: translateY(-4px);
    box-shadow:
      0 10px 40px rgb(33 150 243 / 30%),
      inset 0 1px 0 rgb(255 255 255 / 10%);
    border-color: var(--primary-color);
    background: rgb(255 255 255 / 4%);
  }

  .feature-card h3 {
    margin-bottom: var(--spacing-4);
    color: var(--primary-color);
    font-weight: 600;
    white-space: nowrap;
  }

  .feature-card p {
    color: var(--text-secondary);
    font-size: 14px;
    line-height: 1.6;
  }

  @media (width < 768px) {
    .features-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
