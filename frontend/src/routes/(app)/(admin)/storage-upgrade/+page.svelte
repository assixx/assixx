<!--
  Storage Upgrade Page
  1:1 Migration from frontend/src/pages/storage-upgrade.html

  Uses (app) layout with sidebar and header
  Displays storage plans and allows upgrades
-->
<script lang="ts">
  import {
    showSuccessAlert,
    showErrorAlert,
    showConfirmWarning,
  } from '$lib/utils/alerts';
  import { getApiClient } from '$lib/utils/api-client';
  import { createLogger } from '$lib/utils/logger';

  const log = createLogger('StorageUpgradePage');

  import type { PageData } from './$types';

  // =============================================================================
  // TYPES
  // =============================================================================

  interface StorageInfo {
    used: number;
    total: number;
    percentage: number;
    plan: string;
  }

  // =============================================================================
  // PROPS (SSR Data)
  // =============================================================================

  const { data }: { data: PageData } = $props();

  // =============================================================================
  // STATE (Svelte 5 Runes)
  // =============================================================================

  // Writable $derived: derives from SSR data, can be overwritten locally,
  // re-derives when data.storageInfo changes
  let storageInfo: StorageInfo = $derived(data.storageInfo);
  let isLoading = $state(false);

  // =============================================================================
  // DERIVED
  // =============================================================================

  const usedStorageFormatted = $derived(formatBytes(storageInfo.used));
  const totalStorageFormatted = $derived(formatBytes(storageInfo.total));
  const storagePercentage = $derived(storageInfo.percentage);
  const currentPlan = $derived(storageInfo.plan);

  // Progress bar color based on usage
  const progressBarColor = $derived(
    storagePercentage >= 90 ? 'var(--error-color)'
    : storagePercentage >= 70 ? 'var(--warning-color)'
    : 'var(--success-color)',
  );

  // =============================================================================
  // HELPER FUNCTIONS
  // =============================================================================

  /**
   * Format bytes to human readable string
   */
  function formatBytes(bytes: number): string {
    if (bytes === 0) {
      return '0 GB';
    }

    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    let sizeUnit: string;
    switch (i) {
      case 0:
        sizeUnit = 'B';
        break;
      case 1:
        sizeUnit = 'KB';
        break;
      case 2:
        sizeUnit = 'MB';
        break;
      case 3:
        sizeUnit = 'GB';
        break;
      case 4:
        sizeUnit = 'TB';
        break;
      default:
        sizeUnit = i < 0 ? 'B' : 'TB';
    }

    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizeUnit}`;
  }

  /**
   * Get plan ID from plan code
   */
  function getPlanId(plan: string): number | null {
    switch (plan) {
      case 'basic':
        return 1;
      case 'professional':
        return 2;
      case 'enterprise':
        return 3;
      default:
        return null;
    }
  }

  /**
   * Format plan name for display
   */
  function formatPlanName(plan: string): string {
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  }

  /**
   * Check if plan is current plan
   */
  function isPlanCurrent(plan: string): boolean {
    return currentPlan === plan;
  }

  // =============================================================================
  // API FUNCTIONS
  // =============================================================================

  /**
   * Load storage info from API
   */
  async function loadStorageInfo(): Promise<void> {
    try {
      const apiClient = getApiClient();
      const [currentPlanRes, addonsRes] = await Promise.all([
        apiClient.get('/plans/current'),
        apiClient.get('/plans/addons'),
      ]);

      const addons = addonsRes as { storageGb?: number };
      const plan = currentPlanRes as { plan?: { code?: string } };

      storageInfo = {
        used: 0, // TODO: Get actual used storage from backend
        total: (addons.storageGb ?? 5) * 1024 * 1024 * 1024,
        percentage: 0,
        plan: plan.plan?.code ?? 'basic',
      };
    } catch (err) {
      log.error({ err }, 'Error loading storage info');
      showErrorAlert('Fehler beim Laden der Speicherinformationen');
    }
  }

  /**
   * Upgrade storage plan
   */
  async function upgradeStorage(plan: string): Promise<void> {
    const formattedPlan = formatPlanName(plan);

    // Show confirmation
    const confirmed = await showConfirmWarning(
      `Möchten Sie wirklich auf den ${formattedPlan} Plan upgraden?`,
      'Plan-Upgrade bestätigen',
    );

    if (!confirmed) {
      return;
    }

    const planId = getPlanId(plan);
    if (planId === null) {
      showErrorAlert('Ungültiger Plan ausgewählt');
      return;
    }

    isLoading = true;

    try {
      const apiClient = getApiClient();
      await apiClient.put('/plans/upgrade', { planId });

      showSuccessAlert(
        'Plan erfolgreich aktualisiert! Die Änderungen werden in Kürze wirksam.',
      );
      await loadStorageInfo();
    } catch (err) {
      log.error({ err }, 'Error upgrading plan');
      showErrorAlert(
        'Fehler beim Plan-Upgrade. Bitte kontaktieren Sie unseren Support.',
      );
    } finally {
      isLoading = false;
    }
  }

  /**
   * Open email to contact sales
   */
  function contactSales(): void {
    window.location.href =
      'mailto:sales@assixx.com?subject=Individueller Speicherplatz Anfrage';
  }
</script>

<svelte:head>
  <title>Speicher erweitern - Assixx</title>
</svelte:head>

<div class="container">
  <!-- Current Usage -->
  <div class="current-usage">
    <div class="usage-header">
      <h3 class="usage-title">Aktueller Speicherverbrauch</h3>
      <div class="usage-text">
        <span>{usedStorageFormatted}</span>
        von
        <span>{totalStorageFormatted}</span>
        belegt
      </div>
    </div>
    <div class="usage-progress">
      <div
        class="usage-progress-bar"
        style="width: {storagePercentage}%; background-color: {progressBarColor};"
      ></div>
    </div>
    <div class="storage-percentage-text">
      <span>{storagePercentage}%</span>
      Ihres Speichers wird genutzt
    </div>
  </div>

  <!-- Storage Plans -->
  <h2 class="mb-6 text-center">Wählen Sie Ihre neue Speichergröße</h2>

  <div class="storage-plans-grid">
    <!-- Basic Plan -->
    <div
      class="storage-plan-card"
      class:current={isPlanCurrent('basic')}
    >
      <h3>Basic</h3>
      <div class="storage-size">5 GB</div>
      <div class="storage-price">
        Inklusive
        <span>im Basic Plan</span>
      </div>
      <ul class="storage-features">
        <li>Für kleine Teams</li>
        <li>Dokumente & Lohnabrechnungen</li>
        <li>Chat-Dateianhänge</li>
        <li>Grundlegende Backups</li>
      </ul>
      <button
        type="button"
        class="btn btn-secondary"
        disabled={isPlanCurrent('basic')}
      >
        {isPlanCurrent('basic') ? 'Aktueller Plan' : 'Downgrade auf 5 GB'}
      </button>
    </div>

    <!-- Professional Plan -->
    <div
      class="storage-plan-card"
      class:current={isPlanCurrent('professional')}
    >
      <h3>Professional</h3>
      <div class="storage-size">25 GB</div>
      <div class="storage-price">
        +20 €
        <span>/Monat</span>
      </div>
      <ul class="storage-features">
        <li>Für mittlere Teams</li>
        <li>Erweiterte Dokumentenverwaltung</li>
        <li>Mehr Speicher für Anhänge</li>
        <li>Erweiterte Backup-Historie</li>
        <li>Priorisierter Support</li>
      </ul>
      {#if isPlanCurrent('professional')}
        <button
          type="button"
          class="btn btn-secondary"
          disabled>Aktueller Plan</button
        >
      {:else}
        <button
          type="button"
          class="btn btn-primary"
          onclick={() => upgradeStorage('professional')}
          disabled={isLoading}
        >
          Upgrade auf 25 GB
        </button>
      {/if}
    </div>

    <!-- Enterprise Plan -->
    <div
      class="storage-plan-card"
      class:current={isPlanCurrent('enterprise')}
    >
      <h3>Enterprise</h3>
      <div class="storage-size">100 GB</div>
      <div class="storage-price">
        +50 €
        <span>/Monat</span>
      </div>
      <ul class="storage-features">
        <li>Für große Unternehmen</li>
        <li>Unbegrenzte Dokumententypen</li>
        <li>Maximale Dateigröße: 1 GB</li>
        <li>Vollständige Backup-Historie</li>
        <li>24/7 Support</li>
        <li>Dedizierter Account Manager</li>
      </ul>
      {#if isPlanCurrent('enterprise')}
        <button
          type="button"
          class="btn btn-secondary"
          disabled>Aktueller Plan</button
        >
      {:else}
        <button
          type="button"
          class="btn btn-primary"
          onclick={() => upgradeStorage('enterprise')}
          disabled={isLoading}
        >
          Upgrade auf 100 GB
        </button>
      {/if}
    </div>
  </div>

  <!-- Custom Storage -->
  <div class="card custom-storage-section">
    <div class="card__header">
      <h3 class="card-title">Individueller Speicherplatz</h3>
    </div>
    <div class="custom-storage-content">
      <p class="custom-storage-description">
        Benötigen Sie mehr als 100 GB Speicherplatz? Kontaktieren Sie uns für
        ein individuelles Angebot.
      </p>
      <button
        type="button"
        class="btn btn-primary"
        onclick={contactSales}
      >
        <i class="fas fa-phone"></i>
        Vertrieb kontaktieren
      </button>
    </div>
  </div>

  <!-- FAQ Section -->
  <div class="faq-section">
    <h2 class="mb-6 text-center">Häufig gestellte Fragen</h2>

    <div class="faq-item">
      <div class="faq-question">
        Was passiert, wenn ich meinen Speicherplatz überschreite?
      </div>
      <div class="faq-answer">
        Sie erhalten rechtzeitig eine Benachrichtigung, wenn Sie 90% Ihres
        Speichers erreichen. Bei Überschreitung können keine neuen Dateien
        hochgeladen werden, bis Sie entweder Speicher freigeben oder upgraden.
      </div>
    </div>

    <div class="faq-item">
      <div class="faq-question">
        Kann ich meinen Speicherplan jederzeit ändern?
      </div>
      <div class="faq-answer">
        Ja, Sie können jederzeit auf einen größeren Speicherplan upgraden.
        Downgrades sind zum Ende des Abrechnungszeitraums möglich.
      </div>
    </div>

    <div class="faq-item">
      <div class="faq-question">
        Werden meine Daten beim Upgrade beeinflusst?
      </div>
      <div class="faq-answer">
        Nein, alle Ihre Daten bleiben beim Upgrade unverändert. Der zusätzliche
        Speicher wird sofort nach der Bestätigung verfügbar.
      </div>
    </div>
  </div>
</div>

<style>
  /* ========================================
     GLASSMORPHISMUS ÜBERSCHREIBUNGEN
     ======================================== */

  /* Storage Plans Grid */
  .storage-plans-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--spacing-8);
    margin: var(--spacing-8) 0;
  }

  /* Storage Plan Card */
  .storage-plan-card {
    display: flex;
    flex-direction: column;

    padding: var(--spacing-8);
    border: var(--glass-border);
    border-radius: var(--radius-xl);

    text-align: center;

    background: var(--glass-bg);
  }

  .storage-plan-card:hover {
    transform: translateY(-4px);
    border-color: var(--primary-color);
    box-shadow:
      0 10px 40px rgb(33 150 243 / 30%),
      inset 0 1px 0 var(--color-glass-border);
  }

  .storage-plan-card.current {
    border-color: rgb(33 150 243 / 50%);
    background: rgb(33 150 243 / 5%);
  }

  .storage-size {
    margin: var(--spacing-6) 0;

    font-size: 3rem;
    font-weight: 700;
    color: var(--primary-color);
    text-shadow: 0 0 10px rgb(33 150 243 / 50%);
  }

  .storage-price {
    margin-bottom: var(--spacing-6);
    font-size: 1.5rem;
    color: var(--text-primary);
  }

  .storage-price span {
    font-size: 1rem;
    color: var(--text-secondary);
  }

  .storage-features {
    flex-grow: 1;

    margin: var(--spacing-6) 0;
    padding: 0;

    text-align: left;
    list-style: none;
  }

  .storage-features li {
    position: relative;
    padding: var(--spacing-2) 0;
    padding-left: var(--spacing-8);
    color: var(--text-secondary);
  }

  .storage-features li::before {
    content: '\2713';

    position: absolute;
    left: 0;

    font-weight: 700;
    color: var(--success-color);
  }

  /* Current Usage */
  .current-usage {
    margin-bottom: var(--spacing-8);
    padding: var(--spacing-8);
    border: var(--glass-border);
    border-radius: var(--radius-xl);

    background: var(--glass-bg);
  }

  .usage-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-4);
  }

  .usage-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--primary-color);
  }

  .usage-text {
    font-size: 1rem;
    color: var(--text-primary);
  }

  .usage-progress {
    overflow: hidden;

    width: 100%;
    height: 20px;
    margin-bottom: var(--spacing-4);
    border-radius: 10px;

    background: var(--accent-color);
    box-shadow: inset 0 1px 3px rgb(0 0 0 / 30%);
  }

  .usage-progress-bar {
    position: relative;

    overflow: hidden;

    height: 100%;
    border-radius: 10px;

    background: var(--success-color);

    transition:
      width 0.5s ease,
      background-color 0.3s ease;
  }

  .usage-progress-bar::after {
    content: '';

    position: absolute;
    inset: 0;

    background: linear-gradient(
      45deg,
      transparent 25%,
      rgb(255 255 255 / 20%) 25%,
      rgb(255 255 255 / 20%) 50%,
      transparent 50%,
      transparent 75%,
      rgb(255 255 255 / 20%) 75%,
      rgb(255 255 255 / 20%)
    );
    background-size: 20px 20px;
  }

  /* FAQ Section */
  .faq-section {
    margin-top: calc(var(--spacing-8) * 2);
  }

  .faq-item {
    margin-bottom: var(--spacing-4);
    padding: var(--spacing-6);
    border: var(--glass-border);
    border-radius: var(--radius-xl);

    background: var(--glass-bg);

    box-shadow:
      0 4px 16px rgb(0 0 0 / 30%),
      inset 0 1px 0 var(--color-glass-border);
  }

  .faq-question {
    margin-bottom: var(--spacing-2);
    font-weight: 600;
    color: var(--primary-color);
  }

  .faq-answer {
    line-height: 1.6;
    color: var(--text-secondary);
  }

  /* Storage Percentage Text */
  .storage-percentage-text {
    color: var(--text-secondary);
    text-align: center;
  }

  /* Custom Storage Section */
  .custom-storage-section {
    margin-top: var(--spacing-8);
  }

  .custom-storage-content {
    padding: var(--spacing-8);
    text-align: center;
  }

  .custom-storage-description {
    margin-bottom: var(--spacing-6);
  }
</style>
