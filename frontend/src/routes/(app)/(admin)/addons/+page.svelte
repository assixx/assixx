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

  import type { AddonFilter, AddonWithTenantStatus, TenantAddonsSummary } from './_lib/types';

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
      return status === 'not_activated' || status === 'cancelled' || status === 'expired';
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
      showSuccessAlert(`Modul aktiviert — ${String(days)} Tage Testphase gestartet`);
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
      <p class="mt-2 text-(--color-text-secondary)">Module für Ihre Organisation verwalten</p>
    </div>
    <div class="card__body">
      <div class="summary-stats">
        <div class="stat-item">
          <span class="stat-item__value">{summary.coreAddons}</span>
          <span class="stat-item__label">Kern-Module</span>
        </div>
        <div class="stat-item">
          <span class="stat-item__value">{summary.activeAddons + summary.trialAddons}</span>
          <span class="stat-item__label">Aktive Zusatz-Module</span>
        </div>
        <div class="stat-item">
          <span class="stat-item__value">{summary.trialAddons}</span>
          <span class="stat-item__label">In Testphase</span>
        </div>
        <div class="stat-item">
          <span class="stat-item__value">{summary.monthlyCost.toFixed(0)}€</span>
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
      <p class="mt-2 text-(--color-text-secondary)">Immer aktiv — im Basispaket enthalten</p>
    </div>
    <div class="card__body">
      <div class="core-grid">
        {#each coreAddons as addon, i (addon.code)}
          {@const accents = [
            'var(--color-info)',
            'var(--color-success)',
            'var(--color-warning)',
            'var(--color-purple)',
          ]}
          <div
            class="core-card"
            style="--accent: {accents[i % accents.length]};"
          >
            <div class="core-card__icon">
              <i class={ADDON_ICONS[addon.code] ?? 'fas fa-cube'}></i>
            </div>
            <span class="core-card__name">{addon.name}</span>
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
              class:addon-card--active={status === 'active' || status === 'trial'}
            >
              <!-- Header: Icon + Status Badge -->
              <div class="addon-card__header">
                <div
                  class="addon-card__icon"
                  class:addon-card__icon--active={status === 'active' || status === 'trial'}
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
                {@const daysLeft = getTrialDaysRemaining(addon.tenantStatus.trialEndsAt)}
                <div class="addon-card__trial">
                  <i class="fas fa-hourglass-half"></i>
                  {daysLeft}
                  {daysLeft === 1 ? 'Tag' : 'Tage'} verbleibend
                </div>
              {/if}

              <!-- Footer: Price + Action -->
              <div class="addon-card__footer">
                <span class="badge badge--secondary">
                  {addon.priceMonthly !== undefined ?
                    `${addon.priceMonthly.toFixed(0)}€/Monat`
                  : 'Kostenlos'}
                </span>
                {#if canActivate(addon)}
                  <button
                    type="button"
                    class="btn btn-status-inactive btn--sm"
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
                    class="btn btn-status-active btn--sm"
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
     SUMMARY STATS — minimal glass chips
     ========================================================== */
  .summary-stats {
    display: flex;
    gap: var(--spacing-6);
    flex-wrap: wrap;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
    padding: var(--spacing-4) var(--spacing-5);
    border: 1px solid var(--color-glass-border);
    border-radius: var(--radius-lg);
    background: var(--glass-bg);
    min-width: 120px;
  }

  .stat-item__value {
    font-size: 26px;
    font-weight: 700;
    color: var(--color-text-primary);
    line-height: 1;
  }

  .stat-item__label {
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }

  /* ==========================================================
     CORE ADDONS — landing-page style with accent colors
     ========================================================== */
  .core-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: var(--spacing-3);
  }

  .core-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-4) var(--spacing-3);
    border: var(--glass-border);
    border-radius: var(--glass-card-radius);
    transition: all var(--duration-normal) var(--ease-out);
  }

  .core-card:hover {
    transform: translateY(-2px);
    border-color: color-mix(in oklch, var(--accent) 40%, transparent);
  }

  .core-card__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-lg);
    background: color-mix(in oklch, var(--accent) 12%, transparent);
    color: var(--accent);
    font-size: 15px;
  }

  .core-card:hover .core-card__icon {
    background: color-mix(in oklch, var(--accent) 20%, transparent);
  }

  .core-card__name {
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text-primary);
    text-align: center;
    line-height: 1.3;
  }

  /* ==========================================================
     PURCHASABLE ADDONS GRID — shadcn-minimal
     ========================================================== */
  .addon-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--spacing-5);
  }

  .addon-card {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
    padding: var(--spacing-5);
    border: var(--glass-border);
    border-radius: var(--radius-xl);
    transition:
      border-color var(--duration-normal) var(--ease-out),
      background var(--duration-normal) var(--ease-out);
  }

  .addon-card:hover {
    border-color: var(--color-glass-border-hover);
  }

  .addon-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .addon-card__icon {
    width: 42px;
    height: 42px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-lg);
    background: var(--glass-bg-hover);
    color: var(--color-text-tertiary);
    font-size: 18px;
    transition:
      color var(--duration-normal) var(--ease-out),
      background var(--duration-normal) var(--ease-out);
  }

  .addon-card__icon--active {
    background: var(--glass-bg-active);
    color: var(--color-text-primary);
  }

  .addon-card__name {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .addon-card__description {
    margin: 0;
    font-size: 13px;
    color: var(--color-text-tertiary);
    line-height: 1.5;
  }

  .addon-card__trial {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-1) var(--spacing-3);
    border-radius: var(--radius-md);
    background: var(--glass-bg-hover);
    color: var(--color-text-secondary);
    font-size: 12px;
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

  /* ==========================================================
     RESPONSIVE
     ========================================================== */
  @media (width < 768px) {
    .summary-stats {
      gap: var(--spacing-3);
    }

    .stat-item {
      min-width: 0;
      flex: 1;
      padding: var(--spacing-3) var(--spacing-4);
    }

    .stat-item__value {
      font-size: 22px;
    }

    .core-grid {
      grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    }

    .addon-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .addon-card,
    .addon-card__icon,
    .core-card {
      transition: none;
    }
  }
</style>
