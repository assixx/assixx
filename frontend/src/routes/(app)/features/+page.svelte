<script lang="ts">
  /**
   * Features Page - Plan & Feature Management
   * @module features/+page
   *
   * Level 3 SSR: $derived for SSR data, invalidateAll() after mutations.
   */
  import { invalidateAll } from '$app/navigation';

  import { showSuccessAlert, showErrorAlert } from '$lib/stores/toast';
  import { createLogger } from '$lib/utils/logger';

  const log = createLogger('FeaturesPage');

  import '../../../styles/features.css';

  import {
    applyTenantFeaturesToCategories,
    changePlan as apiChangePlan,
    saveAddons as apiSaveAddons,
    toggleFeature as apiToggleFeature,
  } from './_lib/api';
  import { DEFAULT_TENANT_NAME, FEATURE_CATEGORIES } from './_lib/constants';
  import {
    calculateTotalCost,
    canActivateFeature,
    cloneFeatureCategories,
    countActiveFeatures,
    getFeatureCardClasses,
    getFeatureStatusClass,
    getFeatureStatusText,
    getPlanBadge,
    isFeatureIncludedInPlan,
  } from './_lib/utils';

  import type {
    Feature,
    FeatureCategory,
    FeatureFilter,
    Plan,
    TenantAddons,
    TenantFeature,
  } from './_lib/types';

  // =============================================================================
  // SSR DATA - Level 3: $derived from props (single source of truth)
  // =============================================================================

  interface PageData {
    plans: Record<string, Plan | undefined>;
    currentPlanCode: string;
    addons: TenantAddons;
    tenantFeatures: TenantFeature[];
    tenantId: number | null;
  }

  const { data }: { data: PageData } = $props();

  // SSR data via $derived - updates when invalidateAll() is called
  const plans: Record<string, Plan | undefined> = $derived(data.plans);
  const currentPlan: string = $derived(data.currentPlanCode);
  const tenantFeatures: TenantFeature[] = $derived(data.tenantFeatures);
  const currentTenantId: number | null = $derived(data.tenantId);

  // Derived: Feature categories with tenant data applied
  const featureCategories: Record<string, FeatureCategory> = $derived(
    applyTenantFeaturesToCategories(cloneFeatureCategories(FEATURE_CATEGORIES), tenantFeatures),
  );

  // =============================================================================
  // UI STATE - Local state for pending edits before save
  // =============================================================================

  // Addons - writable $derived (Svelte 5.25+): syncs from SSR, can be locally edited
  let pendingAddons: TenantAddons = $derived({ ...data.addons });

  const tenantName = DEFAULT_TENANT_NAME;

  const error: string | null = $state(null);

  let currentFilter: FeatureFilter = $state('all');

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  const currentPlanData = $derived(plans[currentPlan]);
  const currentPlanName = $derived(currentPlanData?.name ?? currentPlan);
  const activeFeatureCount = $derived(countActiveFeatures(featureCategories, currentPlan));
  const totalCost = $derived(calculateTotalCost(currentPlanData, pendingAddons));

  // =============================================================================
  // FILTER LOGIC
  // =============================================================================

  function isFeatureVisible(feature: Feature): boolean {
    switch (currentFilter) {
      case 'active':
        return feature.active;
      case 'included':
        return isFeatureIncludedInPlan(feature.code, currentPlan, plans);
      case 'addons':
        return (
          !isFeatureIncludedInPlan(feature.code, currentPlan, plans) &&
          canActivateFeature(currentPlan, feature.minPlan)
        );
      default:
        return true;
    }
  }

  // =============================================================================
  // API ACTIONS - Level 3: invalidateAll() after mutations
  // =============================================================================

  async function changePlan(newPlanCode: string): Promise<void> {
    if (newPlanCode === currentPlan) return;

    const planData = plans[newPlanCode];
    if (!planData) return;

    if (!confirm(`Möchten Sie wirklich zum ${planData.name} Plan wechseln?`)) return;

    try {
      await apiChangePlan(currentTenantId, newPlanCode);
      // Level 3: Trigger SSR refetch
      await invalidateAll();
    } catch (err) {
      log.error({ err }, 'Error changing plan');
      showErrorAlert('Fehler beim Plan-Wechsel');
    }
  }

  async function toggleFeature(featureCode: string, activate: boolean): Promise<void> {
    try {
      await apiToggleFeature(currentTenantId, featureCode, activate);
      // Level 3: Trigger SSR refetch
      await invalidateAll();
    } catch (err) {
      log.error({ err }, 'Error toggling feature');
      showErrorAlert('Fehler beim Ändern des Features');
    }
  }

  /**
   * Adjust pending addon values (local state, not saved yet)
   */
  function adjustAddon(type: 'employees' | 'admins' | 'storage', change: number): void {
    if (type === 'employees') {
      pendingAddons.employees = Math.max(0, (pendingAddons.employees ?? 0) + change);
    } else if (type === 'admins') {
      pendingAddons.admins = Math.max(0, (pendingAddons.admins ?? 0) + change);
    } else {
      // type === 'storage'
      pendingAddons.storage_gb = Math.max(0, (pendingAddons.storage_gb ?? 0) + change);
    }
    pendingAddons = { ...pendingAddons };
  }

  async function saveChanges(): Promise<void> {
    try {
      await apiSaveAddons(pendingAddons);
      showSuccessAlert('Änderungen erfolgreich gespeichert!');
      // Level 3: Trigger SSR refetch to sync saved values
      await invalidateAll();
    } catch (err) {
      log.error({ err }, 'Error saving changes');
      showErrorAlert('Fehler beim Speichern der Änderungen');
    }
  }

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  function handleFilterChange(filter: FeatureFilter): void {
    currentFilter = filter;
  }

  function handlePlanChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.checked) void changePlan(input.value);
  }

  // =============================================================================
  // LIFECYCLE - SSR: Auth handled by server, data already loaded
  // =============================================================================

  // onMount not needed for initial data - SSR provides everything
  // Auth check is done server-side in +page.server.ts
</script>

<svelte:head>
  <title>Plan & Feature Management - Assixx</title>
</svelte:head>

<div class="container">
  <!-- Page Header Card -->
  <div class="card mb-6">
    <div class="card__header flex items-center justify-between">
      <div>
        <h1 class="card__title text-2xl">
          <i class="fas fa-crown mr-2"></i>
          Plan & Feature Management
        </h1>
        <p class="text-[var(--color-text-secondary)] mt-2">
          Verwalten Sie Ihren Plan und aktivieren Sie Features für
          <strong>{tenantName}</strong>
        </p>
      </div>
      <div class="plan-badge" class:enterprise={currentPlan === 'enterprise'}>
        <i class="fas fa-crown"></i>
        <span>{currentPlanName} Plan</span>
      </div>
    </div>
  </div>

  <!-- Available Plans Section -->
  <div class="card mb-6">
    <div class="card__header">
      <h2 class="card__title">
        <i class="fas fa-th-large mr-2"></i>
        Verfügbare Pläne
      </h2>
      <p class="text-[var(--color-text-secondary)] mt-2">
        Wählen Sie den passenden Plan für Ihr Unternehmen
      </p>
    </div>
    <div class="card__body">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6" id="plans-container">
        {#each ['basic', 'professional', 'enterprise'] as planCode (planCode)}
          {@const plan = plans[planCode]}
          {#if plan}
            {@const isCurrent = planCode === currentPlan}
            {@const isRecommended = planCode === 'professional'}
            <label class="choice-card plan-card" class:plan-card--recommended={isRecommended}>
              <input
                type="radio"
                class="choice-card__input"
                name="plan-selection"
                value={planCode}
                checked={isCurrent}
                onchange={handlePlanChange}
              />
              <div class="plan-card__content">
                <div class="plan-card__header">
                  <h4 class="plan-card__title">{plan.name}</h4>
                  <span class="plan-card__price">{plan.basePrice.toFixed(0)}/Monat</span>
                </div>
                <p class="plan-card__description">Für kleine bis mittlere Teams</p>
                <ul class="plan-card__features">
                  <li class="plan-card__feature">{plan.maxEmployees ?? ''} Mitarbeiter</li>
                  <li class="plan-card__feature">{plan.maxAdmins ?? ''} Admins</li>
                  <li class="plan-card__feature">Alle Basis-Features</li>
                </ul>
              </div>
            </label>
          {/if}
        {/each}
      </div>
    </div>
  </div>

  <!-- Features Section -->
  <div class="card mb-6">
    <div class="card__header flex items-center justify-between flex-wrap gap-4">
      <div>
        <h2 class="card__title">
          <i class="fas fa-puzzle-piece mr-2"></i>
          Verfügbare Features
        </h2>
        <p class="text-[var(--color-text-secondary)] mt-2">
          Aktivieren oder deaktivieren Sie Features
        </p>
      </div>

      <!-- Toggle Group Filter -->
      <div class="toggle-group" id="feature-status-toggle">
        <button
          type="button"
          class="toggle-group__btn"
          class:active={currentFilter === 'all'}
          title="Alle Features anzeigen"
          onclick={() => {
            handleFilterChange('all');
          }}
        >
          <i class="fas fa-th"></i>
          Alle
        </button>
        <button
          type="button"
          class="toggle-group__btn"
          class:active={currentFilter === 'active'}
          title="Nur aktive Features"
          onclick={() => {
            handleFilterChange('active');
          }}
        >
          <i class="fas fa-check-circle"></i>
          Aktiv
        </button>
        <button
          type="button"
          class="toggle-group__btn"
          class:active={currentFilter === 'included'}
          title="Im Plan enthaltene Features"
          onclick={() => {
            handleFilterChange('included');
          }}
        >
          <i class="fas fa-box"></i>
          Im Plan enthalten
        </button>
        {#if currentPlan !== 'enterprise'}
          <button
            type="button"
            class="toggle-group__btn"
            class:active={currentFilter === 'addons'}
            title="Zusätzlich buchbare Features"
            onclick={() => {
              handleFilterChange('addons');
            }}
          >
            <i class="fas fa-plus-circle"></i>
            Zusätzlich buchbar
          </button>
        {/if}
      </div>
    </div>

    <div class="card__body">
      {#if error}
        <div class="text-center p-6">
          <i class="fas fa-exclamation-triangle text-4xl text-[var(--color-danger)] mb-4"></i>
          <p class="text-[var(--color-text-secondary)]">{error}</p>
          <button
            type="button"
            class="btn btn-primary mt-4"
            onclick={() => {
              window.location.reload();
            }}
          >
            Erneut versuchen
          </button>
        </div>
      {:else}
        <div id="features-container">
          {#each Object.entries(featureCategories) as [categoryName, categoryData] (categoryName)}
            {@const visibleFeatures = categoryData.features.filter(isFeatureVisible)}
            {#if visibleFeatures.length > 0}
              <div class="feature-category mb-8" data-category={categoryName}>
                <h3 class="text-xl font-semibold mb-4 flex items-center gap-2">
                  <span class="text-2xl">{categoryData.icon}</span>
                  {categoryName}
                </h3>
                <div class="features-grid">
                  {#each visibleFeatures as feature (feature.code)}
                    {@const canActivate = canActivateFeature(currentPlan, feature.minPlan)}
                    {@const statusClass = getFeatureStatusClass(feature.active, canActivate)}
                    {@const statusText = getFeatureStatusText(feature.active, canActivate)}
                    <div
                      class={getFeatureCardClasses(feature, currentPlan)}
                      data-feature={feature.code}
                      data-min-plan={feature.minPlan}
                    >
                      <span class="feature-status {statusClass}">{statusText}</span>
                      <h4 class="feature-name">{feature.name}</h4>
                      <p class="feature-description">{feature.description}</p>
                      <div class="feature-plan-badge">{getPlanBadge(feature.minPlan)}</div>
                      <div class="feature-actions">
                        {#if !canActivate}
                          <a href="#plans-container" class="btn btn-primary">Plan upgraden</a>
                        {:else if feature.active}
                          <button
                            type="button"
                            class="btn btn-status-active"
                            onclick={() => toggleFeature(feature.code, false)}
                          >
                            Deaktivieren
                          </button>
                        {:else}
                          <button
                            type="button"
                            class="btn btn-status-inactive"
                            onclick={() => toggleFeature(feature.code, true)}
                          >
                            Aktivieren
                          </button>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Add-ons Section -->
  <div class="card mb-24">
    <div class="card__header">
      <h2 class="card__title">
        <i class="fas fa-cubes mr-2"></i>
        Zusätzliche Ressourcen
      </h2>
      <p class="text-[var(--color-text-secondary)] mt-2">
        Erweitern Sie Ihre Kapazitäten nach Bedarf
      </p>
    </div>
    <div class="card__body">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Zusätzliche Mitarbeiter -->
        <div class="addon-card">
          <div class="addon-icon"></div>
          <h3 class="addon-name">Zusätzliche Mitarbeiter</h3>
          <div class="addon-price">5</div>
          <div class="addon-unit">pro Mitarbeiter/Monat</div>
          <div class="addon-current">
            Aktuell: <strong>{pendingAddons.employees ?? 0}</strong> zusätzlich
          </div>
          <div class="addon-controls">
            <button
              type="button"
              class="addon-btn"
              onclick={() => {
                adjustAddon('employees', -1);
              }}
              aria-label="Mitarbeiter reduzieren"
            >
              <i class="fas fa-minus"></i>
            </button>
            <span class="addon-value">{pendingAddons.employees ?? 0}</span>
            <button
              type="button"
              class="addon-btn"
              onclick={() => {
                adjustAddon('employees', 1);
              }}
              aria-label="Mitarbeiter erhöhen"
            >
              <i class="fas fa-plus"></i>
            </button>
          </div>
        </div>

        <!-- Zusätzliche Admins -->
        <div class="addon-card">
          <div class="addon-icon"></div>
          <h3 class="addon-name">Zusätzliche Admins</h3>
          <div class="addon-price">10</div>
          <div class="addon-unit">pro Admin/Monat</div>
          <div class="addon-current">
            Aktuell: <strong>{pendingAddons.admins ?? 0}</strong> zusätzlich
          </div>
          <div class="addon-controls">
            <button
              type="button"
              class="addon-btn"
              onclick={() => {
                adjustAddon('admins', -1);
              }}
              aria-label="Admins reduzieren"
            >
              <i class="fas fa-minus"></i>
            </button>
            <span class="addon-value">{pendingAddons.admins ?? 0}</span>
            <button
              type="button"
              class="addon-btn"
              onclick={() => {
                adjustAddon('admins', 1);
              }}
              aria-label="Admins erhöhen"
            >
              <i class="fas fa-plus"></i>
            </button>
          </div>
        </div>

        <!-- Zusätzlicher Speicher -->
        <div class="addon-card">
          <div class="addon-icon"></div>
          <h3 class="addon-name">Zusätzlicher Speicher</h3>
          <div class="addon-price">10</div>
          <div class="addon-unit">pro 100GB/Monat</div>
          <div class="addon-current">
            Aktuell: <strong>100GB</strong> inklusive
          </div>
          <div class="addon-controls">
            <button
              type="button"
              class="addon-btn"
              onclick={() => {
                adjustAddon('storage', -100);
              }}
              aria-label="Speicher reduzieren"
            >
              <i class="fas fa-minus"></i>
            </button>
            <span class="addon-value">{pendingAddons.storage_gb ?? 0}GB</span>
            <button
              type="button"
              class="addon-btn"
              onclick={() => {
                adjustAddon('storage', 100);
              }}
              aria-label="Speicher erhöhen"
            >
              <i class="fas fa-plus"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Summary Bar -->
<div class="summary-bar">
  <div class="summary-content">
    <div class="summary-items">
      <div class="summary-item">
        <span class="summary-label">Aktueller Plan</span>
        <span class="summary-value">{currentPlanName}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Aktive Features</span>
        <span class="summary-value">{activeFeatureCount.active} / {activeFeatureCount.total}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Monatliche Kosten</span>
        <span class="summary-value">{totalCost.toFixed(2)}</span>
      </div>
    </div>
    <div class="summary-actions">
      <button type="button" class="btn-save" onclick={saveChanges}>
        <i class="fas fa-save mr-2"></i>
        Änderungen speichern
      </button>
    </div>
  </div>
</div>
