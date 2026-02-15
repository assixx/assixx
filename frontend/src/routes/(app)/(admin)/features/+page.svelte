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

  import {
    applyTenantFeaturesToCategories,
    changePlan as apiChangePlan,
    saveAddons as apiSaveAddons,
    toggleFeature as apiToggleFeature,
  } from './_lib/api';
  import {
    DEFAULT_TENANT_NAME,
    FEATURE_CATEGORIES,
    FEATURE_ICONS,
  } from './_lib/constants';
  import {
    calculateTotalCost,
    canActivateFeature,
    cloneFeatureCategories,
    countActiveFeatures,
    getFeatureCardClasses,
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
    applyTenantFeaturesToCategories(
      cloneFeatureCategories(FEATURE_CATEGORIES),
      tenantFeatures,
    ),
  );

  // =============================================================================
  // UI STATE - Local state for pending edits before save
  // =============================================================================

  // Addons - writable $derived (Svelte 5.25+): syncs from SSR, can be locally edited
  let pendingAddons: TenantAddons = $derived({ ...data.addons });

  const tenantName = DEFAULT_TENANT_NAME;

  const error: string | null = $state(null);

  let currentFilter: FeatureFilter = $state('all');

  // Confirm modal state for plan change
  let showPlanChangeModal = $state(false);
  let pendingPlanCode = $state('');

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  const currentPlanData = $derived(plans[currentPlan]);
  const currentPlanName = $derived(currentPlanData?.name ?? currentPlan);
  const activeFeatureCount = $derived(
    countActiveFeatures(featureCategories, currentPlan),
  );
  const totalCost = $derived(
    calculateTotalCost(currentPlanData, pendingAddons),
  );

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

  /** Request plan change - shows confirmation modal */
  function requestPlanChange(newPlanCode: string): void {
    if (newPlanCode === currentPlan) return;
    if (!plans[newPlanCode]) return;

    pendingPlanCode = newPlanCode;
    showPlanChangeModal = true;
  }

  /** Execute plan change after confirmation */
  async function confirmPlanChange(): Promise<void> {
    showPlanChangeModal = false;

    try {
      await apiChangePlan(currentTenantId, pendingPlanCode);
      await invalidateAll();
    } catch (err) {
      log.error({ err }, 'Error changing plan');
      showErrorAlert('Fehler beim Plan-Wechsel');
    }
  }

  async function toggleFeature(
    featureCode: string,
    activate: boolean,
  ): Promise<void> {
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
  function adjustAddon(
    type: 'employees' | 'admins' | 'storage',
    change: number,
  ): void {
    if (type === 'employees') {
      pendingAddons.employees = Math.max(
        0,
        (pendingAddons.employees ?? 0) + change,
      );
    } else if (type === 'admins') {
      pendingAddons.admins = Math.max(0, (pendingAddons.admins ?? 0) + change);
    } else {
      // type === 'storage'
      pendingAddons.storage_gb = Math.max(
        0,
        (pendingAddons.storage_gb ?? 0) + change,
      );
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
    if (input.checked) requestPlanChange(input.value);
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
  <!-- Page Header -->
  <div class="card mb-6">
    <div class="card__header flex items-center justify-between">
      <div>
        <h1 class="card__title text-2xl">
          <i class="fas fa-crown mr-2"></i>
          Plan & Feature Management
        </h1>
        <p class="mt-2 text-(--color-text-secondary)">
          Verwalten Sie Ihren Plan und aktivieren Sie Features für
          <strong>{tenantName}</strong>
        </p>
      </div>
      <span
        class="badge badge--lg"
        class:badge--primary={currentPlan !== 'enterprise'}
        class:badge--warning={currentPlan === 'enterprise'}
      >
        <i class="fas fa-crown"></i>
        {currentPlanName} Plan
      </span>
    </div>
  </div>

  <!-- Verfügbare Pläne -->
  <div class="card mb-6">
    <div class="card__header">
      <h2 class="card__title">
        <i class="fas fa-th-large mr-2"></i>
        Verfügbare Pläne
      </h2>
      <p class="mt-2 text-(--color-text-secondary)">
        Wählen Sie den passenden Plan für Ihr Unternehmen
      </p>
    </div>
    <div class="card__body">
      <div
        class="grid grid-cols-1 gap-6 md:grid-cols-3"
        id="plans-container"
      >
        {#each ['basic', 'professional', 'enterprise'] as planCode (planCode)}
          {@const plan = plans[planCode]}
          {#if plan}
            {@const isCurrent = planCode === currentPlan}
            {@const isRecommended = planCode === 'professional'}
            <label
              class="choice-card plan-card"
              class:plan-card--recommended={isRecommended}
            >
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
                  <span class="plan-card__price">
                    {plan.basePrice.toFixed(0)}€/Monat
                  </span>
                </div>
                <p class="plan-card__description">
                  {#if planCode === 'basic'}
                    Für kleine Teams zum Einstieg
                  {:else if planCode === 'professional'}
                    Für wachsende Unternehmen
                  {:else}
                    Für große Organisationen
                  {/if}
                </p>
                <ul class="plan-card__features">
                  <li class="plan-card__feature">
                    {plan.maxEmployees ?? 'Unbegrenzt'} Mitarbeiter
                  </li>
                  <li class="plan-card__feature">
                    {plan.maxAdmins ?? 'Unbegrenzt'} Admins
                  </li>
                  <li class="plan-card__feature">
                    {#if planCode === 'basic'}
                      Kern-Features
                    {:else if planCode === 'professional'}
                      Alle Basic + Kommunikation
                    {:else}
                      Alle Features inklusive
                    {/if}
                  </li>
                </ul>
              </div>
            </label>
          {/if}
        {/each}
      </div>
    </div>
  </div>

  <!-- Features -->
  <div class="card mb-6">
    <div class="card__header flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 class="card__title">
          <i class="fas fa-puzzle-piece mr-2"></i>
          Verfügbare Features
        </h2>
        <p class="mt-2 text-(--color-text-secondary)">
          Aktivieren oder deaktivieren Sie Features
        </p>
      </div>

      <div
        class="toggle-group"
        id="feature-status-toggle"
      >
        <button
          type="button"
          class="toggle-group__btn"
          class:active={currentFilter === 'all'}
          title="Alle Features anzeigen"
          onclick={() => {
            handleFilterChange('all');
          }}
        >
          <i class="fas fa-th"></i> Alle
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
          <i class="fas fa-check-circle"></i> Aktiv
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
          <i class="fas fa-box"></i> Im Plan
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
            <i class="fas fa-plus-circle"></i> Zusätzlich
          </button>
        {/if}
      </div>
    </div>

    <div class="card__body">
      {#if error}
        <div class="empty-state">
          <div class="empty-state__icon">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          <h3 class="empty-state__title">Fehler beim Laden</h3>
          <p class="empty-state__description">{error}</p>
          <button
            type="button"
            class="btn btn-primary"
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
            {@const visibleFeatures =
              categoryData.features.filter(isFeatureVisible)}
            {#if visibleFeatures.length > 0}
              <div
                class="mb-8"
                data-category={categoryName}
              >
                <h3
                  class="mb-4 flex items-center gap-2 text-lg font-semibold text-(--color-text-primary)"
                >
                  <span class="text-xl">{categoryData.icon}</span>
                  {categoryName}
                </h3>
                <div class="features-grid">
                  {#each visibleFeatures as feature (feature.code)}
                    {@const canActivate = canActivateFeature(
                      currentPlan,
                      feature.minPlan,
                    )}
                    <div
                      class={getFeatureCardClasses(feature, currentPlan)}
                      data-feature={feature.code}
                    >
                      <!-- Header: Icon + Name + Status -->
                      <div class="feature-card__header">
                        <div
                          class="feature-card__icon"
                          class:feature-card__icon--active={feature.active}
                        >
                          <i
                            class={FEATURE_ICONS[feature.code] ?? 'fas fa-cube'}
                          ></i>
                        </div>
                        <div class="feature-card__title-group">
                          <h4 class="feature-name">{feature.name}</h4>
                          <span
                            class="badge badge--sm"
                            class:badge--success={feature.active}
                            class:badge--secondary={!feature.active &&
                              canActivate}
                            class:badge--warning={!canActivate}
                          >
                            {#if feature.active}
                              Aktiv
                            {:else if !canActivate}
                              Gesperrt
                            {:else}
                              Inaktiv
                            {/if}
                          </span>
                        </div>
                      </div>

                      <!-- Description -->
                      <p class="feature-description">{feature.description}</p>

                      <!-- Footer: Plan Badge + Action -->
                      <div class="feature-card__footer">
                        <span class="feature-plan-badge">
                          {getPlanBadge(feature.minPlan)}
                        </span>
                        {#if !canActivate}
                          <a
                            href="#plans-container"
                            class="btn btn-primary btn--sm"
                          >
                            Upgraden
                          </a>
                        {:else if feature.active}
                          <button
                            type="button"
                            class="btn btn-status-active btn--sm"
                            onclick={() => toggleFeature(feature.code, false)}
                          >
                            Deaktivieren
                          </button>
                        {:else}
                          <button
                            type="button"
                            class="btn btn-status-inactive btn--sm"
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

  <!-- Zusätzliche Ressourcen -->
  <div class="card mb-6">
    <div class="card__header">
      <h2 class="card__title">
        <i class="fas fa-cubes mr-2"></i>
        Zusätzliche Ressourcen
      </h2>
      <p class="mt-2 text-(--color-text-secondary)">
        Erweitern Sie Ihre Kapazitäten nach Bedarf
      </p>
    </div>
    <div class="card__body">
      <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
        <!-- Mitarbeiter -->
        <div class="addon-card">
          <div class="addon-card__icon">
            <i class="fas fa-users"></i>
          </div>
          <h3 class="addon-card__name">Zusätzliche Mitarbeiter</h3>
          <div class="addon-card__price">5€</div>
          <div class="addon-card__unit">pro Mitarbeiter / Monat</div>
          <div class="addon-card__current">
            Aktuell: <strong>{pendingAddons.employees ?? 0}</strong> zusätzlich
          </div>
          <div class="addon-card__controls">
            <button
              type="button"
              class="addon-card__btn"
              onclick={() => {
                adjustAddon('employees', -1);
              }}
              aria-label="Mitarbeiter reduzieren"
            >
              <i class="fas fa-minus"></i>
            </button>
            <span class="addon-card__value">{pendingAddons.employees ?? 0}</span
            >
            <button
              type="button"
              class="addon-card__btn"
              onclick={() => {
                adjustAddon('employees', 1);
              }}
              aria-label="Mitarbeiter erhöhen"
            >
              <i class="fas fa-plus"></i>
            </button>
          </div>
        </div>

        <!-- Admins -->
        <div class="addon-card">
          <div class="addon-card__icon">
            <i class="fas fa-user-shield"></i>
          </div>
          <h3 class="addon-card__name">Zusätzliche Admins</h3>
          <div class="addon-card__price">10€</div>
          <div class="addon-card__unit">pro Admin / Monat</div>
          <div class="addon-card__current">
            Aktuell: <strong>{pendingAddons.admins ?? 0}</strong> zusätzlich
          </div>
          <div class="addon-card__controls">
            <button
              type="button"
              class="addon-card__btn"
              onclick={() => {
                adjustAddon('admins', -1);
              }}
              aria-label="Admins reduzieren"
            >
              <i class="fas fa-minus"></i>
            </button>
            <span class="addon-card__value">{pendingAddons.admins ?? 0}</span>
            <button
              type="button"
              class="addon-card__btn"
              onclick={() => {
                adjustAddon('admins', 1);
              }}
              aria-label="Admins erhöhen"
            >
              <i class="fas fa-plus"></i>
            </button>
          </div>
        </div>

        <!-- Speicher -->
        <div class="addon-card">
          <div class="addon-card__icon">
            <i class="fas fa-hdd"></i>
          </div>
          <h3 class="addon-card__name">Zusätzlicher Speicher</h3>
          <div class="addon-card__price">10€</div>
          <div class="addon-card__unit">pro 100 GB / Monat</div>
          <div class="addon-card__current">
            Aktuell: <strong>100 GB</strong> inklusive
          </div>
          <div class="addon-card__controls">
            <button
              type="button"
              class="addon-card__btn"
              onclick={() => {
                adjustAddon('storage', -100);
              }}
              aria-label="Speicher reduzieren"
            >
              <i class="fas fa-minus"></i>
            </button>
            <span class="addon-card__value"
              >{pendingAddons.storage_gb ?? 0} GB</span
            >
            <button
              type="button"
              class="addon-card__btn"
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
  <!-- Summary -->
  <div class="card summary-card">
    <div class="card__body">
      <div class="summary-card__content">
        <div class="summary-card__items">
          <div class="summary-card__item">
            <span class="summary-card__label">Aktueller Plan</span>
            <span class="summary-card__value">{currentPlanName}</span>
          </div>
          <div class="summary-card__item">
            <span class="summary-card__label">Aktive Features</span>
            <span class="summary-card__value">
              {activeFeatureCount.active} / {activeFeatureCount.total}
            </span>
          </div>
          <div class="summary-card__item">
            <span class="summary-card__label">Monatliche Kosten</span>
            <span class="summary-card__value">{totalCost.toFixed(2)}€</span>
          </div>
        </div>
        <button
          type="button"
          class="btn btn-primary"
          onclick={saveChanges}
        >
          <i class="fas fa-save mr-2"></i>
          Änderungen speichern
        </button>
      </div>
    </div>
  </div>
</div>

<!-- Plan Change Confirmation Modal -->
{#if showPlanChangeModal}
  {@const pendingPlan = plans[pendingPlanCode]}
  <div class="modal-overlay modal-overlay--active">
    <div class="confirm-modal confirm-modal--danger">
      <div class="confirm-modal__icon">
        <i class="fas fa-exchange-alt"></i>
      </div>
      <h3 class="confirm-modal__title">Plan wechseln</h3>
      <p class="confirm-modal__message">
        Möchten Sie wirklich zum
        <strong>{pendingPlan?.name ?? pendingPlanCode}</strong> Plan wechseln?
      </p>
      <div class="confirm-modal__actions confirm-modal__actions--centered">
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--cancel confirm-modal__btn--wide"
          onclick={() => {
            showPlanChangeModal = false;
          }}
        >
          Abbrechen
        </button>
        <button
          type="button"
          class="btn btn-danger confirm-modal__btn--wide"
          onclick={() => void confirmPlanChange()}
        >
          Plan wechseln
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ==========================================================
     ADDON CARDS - BEM, Design System variables, dark/light
     ========================================================== */

  .addon-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-2);

    padding: var(--spacing-6);
    border: 1px solid var(--color-glass-border);
    border-radius: var(--radius-xl);

    background: var(--glass-bg);
    backdrop-filter: blur(10px);

    text-align: center;
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .addon-card:hover {
    border-color: var(--color-glass-border-hover);
    box-shadow: var(--shadow-lg);
  }

  .addon-card__icon {
    display: flex;
    align-items: center;
    justify-content: center;

    width: 48px;
    height: 48px;
    border-radius: var(--radius-lg);

    background: rgb(33 150 243 / 10%);
    color: var(--color-primary);
    font-size: 20px;
  }

  .addon-card__name {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .addon-card__price {
    font-size: 24px;
    font-weight: 700;
    color: var(--color-primary);
  }

  .addon-card__unit {
    font-size: 12px;
    color: var(--color-text-tertiary);
  }

  .addon-card__current {
    font-size: 14px;
    color: var(--color-text-secondary);
  }

  .addon-card__controls {
    display: flex;
    gap: var(--spacing-3);
    align-items: center;
    margin-top: var(--spacing-2);
  }

  .addon-card__btn {
    cursor: pointer;

    display: flex;
    align-items: center;
    justify-content: center;

    width: 36px;
    height: 36px;
    border: 1px solid var(--color-glass-border);
    border-radius: 50%;

    color: var(--color-text-primary);
    background: var(--glass-bg);

    transition:
      border-color 0.15s ease,
      background 0.15s ease;
  }

  .addon-card__btn:hover {
    border-color: var(--color-primary);
    background: rgb(33 150 243 / 10%);
  }

  .addon-card__value {
    min-width: 48px;
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text-primary);
    text-align: center;
  }

  /* ==========================================================
     SUMMARY CARD
     ========================================================== */

  /* No positioning needed - behaves like a regular card in the container */

  .summary-card__content {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .summary-card__items {
    display: flex;
    gap: var(--spacing-8);
  }

  .summary-card__item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .summary-card__label {
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .summary-card__value {
    font-size: 16px;
    font-weight: 700;
    color: var(--color-text-primary);
  }

  /* ==========================================================
     LIGHT MODE OVERRIDES
     ========================================================== */

  :global(html:not(.dark)) .addon-card__icon {
    background: rgb(33 150 243 / 8%);
  }

  /* ==========================================================
     RESPONSIVE
     ========================================================== */

  @media (width < 768px) {
    .summary-card__items {
      gap: var(--spacing-4);
    }

    .summary-card__content {
      flex-direction: column;
      gap: var(--spacing-3);
    }
  }

  /* ==========================================================
     ACCESSIBILITY
     ========================================================== */

  @media (prefers-reduced-motion: reduce) {
    .addon-card,
    .addon-card__btn {
      transition: none;
    }
  }
</style>
