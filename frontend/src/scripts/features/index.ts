/**
 * Features Management - Main Controller
 * Orchestrates features and plans management
 */

import { showSuccessAlert, showErrorAlert } from '../utils/alerts';
import { setHTML } from '../../utils/dom-utils';
import {
  loadPlans,
  loadCurrentPlan,
  loadTenantFeatures,
  initializeTenantId,
  changePlan,
  activateFeature,
  deactivateFeature,
  saveAddons,
  adjustAddon,
  currentPlan,
  tenantAddons,
  plans,
} from './data';
import {
  renderFeatureCategories,
  renderPlanCards,
  updatePlanUI,
  updateAddonsDisplay,
  updateSummary,
  filterFeatures,
} from './ui';
import type { FeatureFilter } from './types';

/**
 * Features Manager - Main orchestration class
 */
class FeaturesManager {
  private currentFilter: FeatureFilter = 'all';

  constructor() {
    this.initialize();
  }

  /**
   * Initialize manager
   */
  private initialize(): void {
    // Initialize tenant ID from token
    initializeTenantId();

    // Load initial data
    void this.loadInitialData();

    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Load all initial data
   */
  private async loadInitialData(): Promise<void> {
    try {
      // Show loading state
      this.showLoading();

      // Load plans and current tenant data in parallel
      await Promise.all([loadPlans(), loadCurrentPlan()]);

      // Load tenant features
      await loadTenantFeatures();

      // Render initial UI
      this.renderInitialUI();

      // Hide loading state
      this.hideLoading();
    } catch (error) {
      console.error('Error loading initial data:', error);
      showErrorAlert('Fehler beim Laden der Daten');
      this.hideLoading();
    }
  }

  /**
   * Show loading state
   */
  private showLoading(): void {
    const featuresContainer = document.querySelector('#features-container');
    if (featuresContainer !== null) {
      featuresContainer.innerHTML = `
        <div class="spinner-container">
          <div class="spinner-ring spinner-ring--md"></div>
          <p class="mt-2 text-[var(--color-text-secondary)]">Features werden geladen...</p>
        </div>
      `;
    }
  }

  /**
   * Hide loading state
   */
  private hideLoading(): void {
    // Loading is replaced by actual content in renderInitialUI
  }

  /**
   * Render initial UI
   */
  private renderInitialUI(): void {
    // Render plan cards
    const plansContainer = document.querySelector('#plans-container');
    if (plansContainer !== null) {
      setHTML(plansContainer as HTMLElement, renderPlanCards());
      this.setupPlanSelection(); // Setup radio button listeners after rendering
    }

    // Update plan UI (badge, etc.)
    updatePlanUI();

    // Render features
    this.renderFeatures();

    // Update addons display
    updateAddonsDisplay(tenantAddons);

    // Update summary
    updateSummary(tenantAddons);

    // Hide addons filter for Enterprise
    this.updateAddonsFilterVisibility();
  }

  /**
   * Render features
   */
  private renderFeatures(): void {
    const featuresContainer = document.querySelector('#features-container');
    if (featuresContainer !== null) {
      setHTML(featuresContainer as HTMLElement, renderFeatureCategories());
    }
  }

  /**
   * Setup all event listeners
   */
  private setupEventListeners(): void {
    // Toggle group filter
    this.setupFilterToggle();

    // Event delegation for all actions
    this.setupActionDelegation();
  }

  /**
   * Setup filter toggle group
   */
  private setupFilterToggle(): void {
    const toggleGroup = document.querySelector('#feature-status-toggle');
    if (toggleGroup === null) {
      return;
    }

    toggleGroup.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('.toggle-group__btn');
      if (btn === null) return;

      const filter = btn.dataset.filter as FeatureFilter | undefined;
      if (filter === undefined) return;

      // Update active button
      toggleGroup.querySelectorAll('.toggle-group__btn').forEach((b) => {
        b.classList.remove('active');
      });
      btn.classList.add('active');

      // Update filter state
      this.currentFilter = filter;

      // Apply filter
      filterFeatures(filter);
    });
  }

  /**
   * Setup plan selection radio button listeners
   */
  private setupPlanSelection(): void {
    const planInputs = document.querySelectorAll<HTMLInputElement>('input[name="plan-selection"]');
    planInputs.forEach((input) => {
      input.addEventListener('change', () => {
        const planCode = input.value;
        if (planCode !== '') {
          void this.handlePlanChange(planCode);
        }
      });
    });
  }

  /**
   * Setup action delegation
   */
  private setupActionDelegation(): void {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const actionElement = target.closest<HTMLElement>('[data-action]');

      if (actionElement === null) return;

      const action = actionElement.dataset.action;

      switch (action) {
        case 'toggle-feature': {
          const featureCode = actionElement.dataset.feature;
          const state = actionElement.dataset.state === 'true';
          if (featureCode !== undefined) {
            void this.handleFeatureToggle(featureCode, state);
          }
          break;
        }
        case 'adjust-addon': {
          const addonType = actionElement.dataset.type as 'employees' | 'admins' | 'storage' | undefined;
          const amount = Number.parseInt(actionElement.dataset.amount ?? '0', 10);
          if (addonType !== undefined) {
            this.handleAddonAdjust(addonType, amount);
          }
          break;
        }
        case 'save-changes': {
          void this.handleSaveChanges();
          break;
        }
      }
    });
  }

  /**
   * Handle plan change
   */
  private async handlePlanChange(newPlanCode: string): Promise<void> {
    // Check if same plan
    if (newPlanCode === currentPlan) {
      return;
    }

    // Get plan name (plans is Record<string, Plan>, all keys have Plan values)
    // eslint-disable-next-line security/detect-object-injection -- Safe: newPlanCode comes from data-plan attributes rendered by renderPlanCards(), limited to 'basic'|'professional'|'enterprise'
    const planName = plans[newPlanCode].name;

    // Confirm change
    if (!confirm(`Möchten Sie wirklich zum ${planName} Plan wechseln?`)) {
      // User cancelled - reset radio to current plan
      this.resetPlanRadioSelection();
      return;
    }

    try {
      // Change plan via API
      await changePlan(newPlanCode);

      // Reload features
      await loadTenantFeatures();

      // Update UI
      updatePlanUI();
      this.renderFeatures();
      updateSummary(tenantAddons);
      this.updateAddonsFilterVisibility();

      showSuccessAlert('Plan erfolgreich geändert!');
    } catch (error) {
      console.error('Error changing plan:', error);
      showErrorAlert('Fehler beim Plan-Wechsel');
      // Reset radio to current plan on error
      this.resetPlanRadioSelection();
    }
  }

  /**
   * Reset plan radio selection to current plan
   */
  private resetPlanRadioSelection(): void {
    const currentRadio = document.querySelector<HTMLInputElement>(
      `input[name="plan-selection"][value="${currentPlan}"]`,
    );
    if (currentRadio !== null) {
      currentRadio.checked = true;
    }
  }

  /**
   * Handle feature toggle (activate/deactivate)
   */
  private async handleFeatureToggle(featureCode: string, activate: boolean): Promise<void> {
    try {
      if (activate) {
        await activateFeature(featureCode);
        showSuccessAlert('Feature aktiviert');
      } else {
        await deactivateFeature(featureCode);
        showSuccessAlert('Feature deaktiviert');
      }

      // Re-render features
      this.renderFeatures();

      // Update summary
      updateSummary(tenantAddons);

      // Reapply current filter
      if (this.currentFilter !== 'all') {
        filterFeatures(this.currentFilter);
      }
    } catch (error) {
      console.error('Error toggling feature:', error);
      showErrorAlert('Fehler beim Ändern des Features');
    }
  }

  /**
   * Handle addon adjustment
   */
  private handleAddonAdjust(type: 'employees' | 'admins' | 'storage', change: number): void {
    // Adjust addon in data layer
    adjustAddon(type, change);

    // Update UI
    updateAddonsDisplay(tenantAddons);
    updateSummary(tenantAddons);
  }

  /**
   * Handle save changes
   */
  private async handleSaveChanges(): Promise<void> {
    try {
      const result = await saveAddons();

      // Update cost display if returned from API
      if (result.costs !== undefined) {
        const summaryCost = document.querySelector('#summary-cost');
        if (summaryCost !== null) {
          summaryCost.textContent = `${result.costs.totalCost.toFixed(2)}€`;
        }
      }

      showSuccessAlert('Änderungen erfolgreich gespeichert!');
    } catch (error) {
      console.error('Error saving changes:', error);
      showErrorAlert('Fehler beim Speichern der Änderungen');
    }
  }

  /**
   * Update addons filter visibility based on plan
   */
  private updateAddonsFilterVisibility(): void {
    const addonsFilterBtn = document.querySelector('[data-filter="addons"]');
    if (addonsFilterBtn === null) return;

    if (currentPlan === 'enterprise') {
      (addonsFilterBtn as HTMLElement).style.display = 'none';
      if (addonsFilterBtn.classList.contains('active')) {
        const allFilterBtn = document.querySelector('[data-filter="all"]');
        if (allFilterBtn !== null) {
          (allFilterBtn as HTMLElement).click();
        }
      }
    } else {
      (addonsFilterBtn as HTMLElement).style.display = 'inline-flex';
    }
  }
}

/**
 * Initialize Features Manager
 */
document.addEventListener('DOMContentLoaded', () => {
  // Check auth
  const token = localStorage.getItem('token');
  // eslint-disable-next-line security/detect-possible-timing-attacks -- Not a timing attack: checking token existence, not comparing secret values
  if (token === null) {
    window.location.href = '/login';
    return;
  }

  // Only initialize on root-features page
  if (window.location.pathname === '/root-features' || window.location.pathname.includes('root-features')) {
    new FeaturesManager();
  }
});

export { FeaturesManager };
