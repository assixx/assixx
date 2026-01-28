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
  import '../../../../styles/storage-upgrade.css';

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
  <h2 class="text-center mb-6">Wählen Sie Ihre neue Speichergröße</h2>

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
    <h2 class="text-center mb-6">Häufig gestellte Fragen</h2>

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
