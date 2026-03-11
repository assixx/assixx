<script lang="ts">
  /**
   * Addon Management Page
   * @module addons/+page
   *
   * Shows all addons with tenant status. Core addons are always active.
   * Purchasable addons can be activated (trial) or deactivated.
   * Level 3 SSR: $derived for SSR data, invalidateAll() after mutations.
   */
  import { invalidateAll } from '$app/navigation';

  import { showSuccessAlert, showErrorAlert } from '$lib/stores/toast';
  import { createLogger } from '$lib/utils/logger';

  import ConfirmModal from '$design-system/components/confirm-modal/ConfirmModal.svelte';

  import { activateAddon, deactivateAddon } from './_lib/api';
  import { ADDON_ICONS, STATUS_CONFIG } from './_lib/constants';
  import {
    canActivate,
    canDeactivate,
    getEffectiveStatus,
    getTrialDaysRemaining,
  } from './_lib/utils';

  import type {
    AddonFilter,
    AddonWithTenantStatus,
    TenantAddonsSummary,
  } from './_lib/types';

  const log = createLogger('AddonManagement');

  // =============================================================================
  // SSR DATA
  // =============================================================================

  interface PageData {
    addons: AddonWithTenantStatus[];
    summary: TenantAddonsSummary;
    tenantId: number;
  }

  const { data }: { data: PageData } = $props();

  const addons = $derived(data.addons);
  const summary = $derived(data.summary);
  const tenantId = $derived(data.tenantId);

  const coreAddons = $derived(addons.filter((a) => a.isCore));
  const purchasableAddons = $derived(addons.filter((a) => !a.isCore));

  // =============================================================================
  // UI STATE
  // =============================================================================

  let processingAddon = $state<string | null>(null);
  let showDeactivateModal = $state(false);
  let pendingDeactivateCode = $state('');
  let pendingDeactivateName = $state('');
  let currentFilter = $state<AddonFilter>('all');

  const filteredPurchasable = $derived(
    purchasableAddons.filter((addon) => {
      if (currentFilter === 'all') return true;
      const status = getEffectiveStatus(addon);
      if (currentFilter === 'active') {
        return status === 'active' || status === 'trial';
      }
      return (
        status === 'not_activated' ||
        status === 'cancelled' ||
        status === 'expired'
      );
    }),
  );

  // =============================================================================
  // ACTIONS
  // =============================================================================

  async function handleActivate(addonCode: string): Promise<void> {
    processingAddon = addonCode;
    try {
      const result = await activateAddon(tenantId, addonCode);
      const days = result.daysRemaining ?? 30;
      showSuccessAlert(
        `Modul aktiviert — ${String(days)} Tage Testphase gestartet`,
      );
      await invalidateAll();
    } catch (err: unknown) {
      log.error({ err }, 'Error activating addon');
      showErrorAlert('Fehler beim Aktivieren des Moduls');
    } finally {
      processingAddon = null;
    }
  }

  function requestDeactivate(addon: AddonWithTenantStatus): void {
    pendingDeactivateCode = addon.code;
    pendingDeactivateName = addon.name;
    showDeactivateModal = true;
  }

  async function confirmDeactivate(): Promise<void> {
    showDeactivateModal = false;
    processingAddon = pendingDeactivateCode;
    try {
      await deactivateAddon(tenantId, pendingDeactivateCode);
      showSuccessAlert('Modul deaktiviert — Berechtigungen bleiben erhalten');
      await invalidateAll();
    } catch (err: unknown) {
      log.error({ err }, 'Error deactivating addon');
      showErrorAlert('Fehler beim Deaktivieren des Moduls');
    } finally {
      processingAddon = null;
    }
  }

  /** Get button label depending on addon status */
  function getActivateLabel(addon: AddonWithTenantStatus): string {
    const status = addon.tenantStatus?.status ?? 'not_activated';
    return status === 'not_activated' ? 'Testen' : 'Reaktivieren';
  }
</script>

<svelte:head>
  <title>Addon-Verwaltung - Assixx</title>
</svelte:head>

<div class="container">
  <!-- Header + Summary -->
  <div class="card mb-6">
    <div class="card__header">
      <h1 class="card__title text-2xl">
        <i class="fas fa-puzzle-piece mr-2"></i>
        Addon-Verwaltung
      </h1>
      <p class="mt-2 text-(--color-text-secondary)">
        Module für Ihre Organisation verwalten
      </p>
    </div>
    <div class="card__body">
      <div class="summary-stats">
        <div class="stat-item">
          <span class="stat-item__value">{summary.coreAddons}</span>
          <span class="stat-item__label">Kern-Module</span>
        </div>
        <div class="stat-item">
          <span class="stat-item__value"
            >{summary.activeAddons + summary.trialAddons}</span
          >
          <span class="stat-item__label">Aktive Zusatz-Module</span>
        </div>
        <div class="stat-item">
          <span class="stat-item__value">{summary.trialAddons}</span>
          <span class="stat-item__label">In Testphase</span>
        </div>
        <div class="stat-item">
          <span class="stat-item__value">{summary.monthlyCost.toFixed(0)}€</span
          >
          <span class="stat-item__label">Monatliche Kosten</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Core Addons -->
  <div class="card mb-6">
    <div class="card__header">
      <h2 class="card__title">
        <i class="fas fa-shield-alt mr-2"></i>
        Kern-Module
      </h2>
      <p class="mt-2 text-(--color-text-secondary)">
        Immer aktiv — im Basispaket enthalten
      </p>
    </div>
    <div class="card__body">
      <div class="core-grid">
        {#each coreAddons as addon (addon.code)}
          <div class="core-card">
            <div class="core-card__icon">
              <i class={ADDON_ICONS[addon.code] ?? 'fas fa-cube'}></i>
            </div>
            <span class="core-card__name">{addon.name}</span>
            <span class="badge badge--primary badge--sm">
              <i class="fas fa-check"></i> Aktiv
            </span>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- Purchasable Addons -->
  <div class="card mb-6">
    <div class="card__header flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 class="card__title">
          <i class="fas fa-cubes mr-2"></i>
          Zusatz-Module
        </h2>
        <p class="mt-2 text-(--color-text-secondary)">
          Aktivieren Sie Module nach Bedarf — 30 Tage kostenlos testen
        </p>
      </div>
      <div class="toggle-group">
        <button
          type="button"
          class="toggle-group__btn"
          class:active={currentFilter === 'all'}
          onclick={() => {
            currentFilter = 'all';
          }}
        >
          <i class="fas fa-th"></i> Alle
        </button>
        <button
          type="button"
          class="toggle-group__btn"
          class:active={currentFilter === 'active'}
          onclick={() => {
            currentFilter = 'active';
          }}
        >
          <i class="fas fa-check-circle"></i> Aktiv
        </button>
        <button
          type="button"
          class="toggle-group__btn"
          class:active={currentFilter === 'inactive'}
          onclick={() => {
            currentFilter = 'inactive';
          }}
        >
          <i class="fas fa-plus-circle"></i> Verfügbar
        </button>
      </div>
    </div>

    <div class="card__body">
      {#if filteredPurchasable.length === 0}
        <div class="empty-state">
          <div class="empty-state__icon">
            <i class="fas fa-puzzle-piece"></i>
          </div>
          <h3 class="empty-state__title">Keine Module</h3>
          <p class="empty-state__description">
            {#if currentFilter === 'active'}
              Keine aktiven Zusatz-Module gefunden.
            {:else if currentFilter === 'inactive'}
              Alle verfügbaren Module sind bereits aktiviert.
            {:else}
              Keine Zusatz-Module verfügbar.
            {/if}
          </p>
        </div>
      {:else}
        <div class="addon-grid">
          {#each filteredPurchasable as addon (addon.code)}
            {@const status = getEffectiveStatus(addon)}
            {@const statusCfg = STATUS_CONFIG[status]}
            {@const isProcessing = processingAddon === addon.code}
            <div
              class="addon-card"
              class:addon-card--active={status === 'active' ||
                status === 'trial'}
            >
              <!-- Header: Icon + Status Badge -->
              <div class="addon-card__header">
                <div
                  class="addon-card__icon"
                  class:addon-card__icon--active={status === 'active' ||
                    status === 'trial'}
                >
                  <i class={ADDON_ICONS[addon.code] ?? 'fas fa-cube'}></i>
                </div>
                {#if statusCfg}
                  <span class="badge {statusCfg.badgeClass} badge--sm">
                    <i class={statusCfg.icon}></i>
                    {statusCfg.label}
                  </span>
                {/if}
              </div>

              <!-- Content -->
              <h3 class="addon-card__name">{addon.name}</h3>
              {#if addon.description}
                <p class="addon-card__description">{addon.description}</p>
              {/if}

              <!-- Trial countdown -->
              {#if status === 'trial' && addon.tenantStatus?.trialEndsAt}
                {@const daysLeft = getTrialDaysRemaining(
                  addon.tenantStatus.trialEndsAt,
                )}
                <div class="addon-card__trial">
                  <i class="fas fa-hourglass-half"></i>
                  {daysLeft}
                  {daysLeft === 1 ? 'Tag' : 'Tage'} verbleibend
                </div>
              {/if}

              <!-- Footer: Price + Action -->
              <div class="addon-card__footer">
                <span class="addon-card__price">
                  {addon.priceMonthly !== undefined ?
                    `${addon.priceMonthly.toFixed(0)}€/Monat`
                  : 'Kostenlos'}
                </span>
                {#if canActivate(addon)}
                  <button
                    type="button"
                    class="btn btn-primary btn--sm"
                    disabled={isProcessing}
                    onclick={() => void handleActivate(addon.code)}
                  >
                    {#if isProcessing}
                      <span class="spinner-ring spinner-ring--sm mr-1"></span>
                    {:else}
                      <i class="fas fa-play mr-1"></i>
                    {/if}
                    {getActivateLabel(addon)}
                  </button>
                {:else if canDeactivate(addon)}
                  <button
                    type="button"
                    class="btn btn-danger btn--sm"
                    disabled={isProcessing}
                    onclick={() => {
                      requestDeactivate(addon);
                    }}
                  >
                    {#if isProcessing}
                      <span class="spinner-ring spinner-ring--sm mr-1"></span>
                    {:else}
                      <i class="fas fa-stop mr-1"></i>
                    {/if}
                    Deaktivieren
                  </button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Deactivate Confirmation Modal -->
<ConfirmModal
  show={showDeactivateModal}
  id="deactivate-addon-modal"
  title="Modul deaktivieren"
  icon="fa-exclamation-triangle"
  confirmLabel="Deaktivieren"
  centered
  onconfirm={() => void confirmDeactivate()}
  oncancel={() => {
    showDeactivateModal = false;
  }}
>
  Möchten Sie <strong>{pendingDeactivateName}</strong> wirklich deaktivieren?
  <br /><br />
  <small class="text-(--color-text-secondary)">
    <i class="fas fa-info-circle mr-1"></i>
    Berechtigungen bleiben erhalten und das Modul kann jederzeit reaktiviert werden.
  </small>
</ConfirmModal>

<style>
  /* ==========================================================
     SUMMARY STATS
     ========================================================== */
  .summary-stats {
    display: flex;
    gap: var(--spacing-8);
    flex-wrap: wrap;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stat-item__value {
    font-size: 24px;
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .stat-item__label {
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* ==========================================================
     CORE ADDONS GRID
     ========================================================== */
  .core-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: var(--spacing-4);
  }

  .core-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-4);
    border: 1px solid var(--color-glass-border);
    border-radius: var(--radius-lg);
    background: var(--glass-bg);
  }

  .core-card__icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    background: color-mix(in oklch, var(--color-primary) 10%, transparent);
    color: var(--color-primary);
    font-size: 18px;
  }

  .core-card__name {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-primary);
    text-align: center;
  }

  /* ==========================================================
     PURCHASABLE ADDONS GRID
     ========================================================== */
  .addon-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--spacing-6);
  }

  .addon-card {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
    padding: var(--spacing-5);
    border: 1px solid var(--color-glass-border);
    border-radius: var(--radius-xl);
    background: var(--glass-bg);
    backdrop-filter: blur(10px);
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .addon-card:hover {
    border-color: var(--color-glass-border-hover);
    box-shadow: var(--shadow-lg);
  }

  .addon-card--active {
    border-color: color-mix(
      in oklch,
      var(--color-success) 30%,
      var(--color-glass-border)
    );
  }

  .addon-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .addon-card__icon {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-lg);
    background: color-mix(
      in oklch,
      var(--color-text-secondary) 8%,
      transparent
    );
    color: var(--color-text-secondary);
    font-size: 20px;
    transition:
      background 0.2s ease,
      color 0.2s ease;
  }

  .addon-card__icon--active {
    background: color-mix(in oklch, var(--color-primary) 10%, transparent);
    color: var(--color-primary);
  }

  .addon-card__name {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .addon-card__description {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-secondary);
    line-height: 1.4;
  }

  .addon-card__trial {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-2) var(--spacing-3);
    border-radius: var(--radius-md);
    background: color-mix(in oklch, var(--color-warning) 10%, transparent);
    color: var(--color-warning);
    font-size: 13px;
    font-weight: 500;
  }

  .addon-card__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: auto;
    padding-top: var(--spacing-3);
    border-top: 1px solid var(--color-glass-border);
  }

  .addon-card__price {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  /* ==========================================================
     RESPONSIVE
     ========================================================== */
  @media (width < 768px) {
    .summary-stats {
      gap: var(--spacing-4);
    }

    .core-grid {
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    }

    .addon-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .addon-card,
    .addon-card__icon {
      transition: none;
    }
  }
</style>
