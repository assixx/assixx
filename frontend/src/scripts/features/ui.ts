/**
 * Features Management - UI Rendering Layer
 * Handles all DOM rendering and HTML generation
 */

import type { Feature, Plan, TenantAddons } from './types';
import { plans, currentPlan, featureCategories } from './data';
import { setHTML } from '../../utils/dom-utils';

/**
 * Check if feature is included in a plan
 */
export function isFeatureIncludedInPlan(featureCode: string, planCode: string): boolean {
  const validPlans = ['basic', 'professional', 'enterprise'];
  if (!validPlans.includes(planCode)) {
    console.warn(`Invalid plan: ${planCode}`);
    return false;
  }

  // eslint-disable-next-line security/detect-object-injection -- Safe: planCode validated against validPlans array above
  const planData = plans[planCode];
  if (planData.features === undefined) {
    console.warn(`Plan data not found for plan: ${planCode}`);
    return false;
  }

  // Enterprise has all features
  if (planCode === 'enterprise') {
    return true;
  }

  return planData.features.some((f) => f.featureCode === featureCode);
}

/**
 * Check if feature can be activated based on current plan
 */
export function canActivateFeature(minPlan: string, currentPlanCode: string): boolean {
  const planOrder = ['basic', 'professional', 'enterprise'];
  return planOrder.indexOf(currentPlanCode) >= planOrder.indexOf(minPlan);
}

/**
 * Get plan badge text
 */
export function getPlanBadge(minPlan: string): string {
  if (minPlan === 'basic') {
    return 'Ab Basic';
  } else if (minPlan === 'professional') {
    return 'Ab Professional';
  } else if (minPlan === 'enterprise') {
    return 'Enterprise Only';
  }
  return minPlan;
}

/**
 * Get feature status text
 */
export function getFeatureStatusText(isActive: boolean, canActivate: boolean): string {
  if (isActive) return 'Aktiv';
  if (!canActivate) return 'Gesperrt';
  return 'Inaktiv';
}

/**
 * Get feature status CSS class
 */
export function getFeatureStatusClass(isActive: boolean, canActivate: boolean): string {
  if (isActive) return 'badge--success';
  if (!canActivate) return 'badge--warning';
  return 'badge--secondary';
}

/**
 * Render feature action buttons using Design System
 * Button variants from choice-card.feature.css:
 * - Activate: .btn.btn-status-inactive
 * - Deactivate: .btn.btn-status-active
 */
export function renderFeatureActions(feature: Feature, isActive: boolean, canActivate: boolean): string {
  if (!canActivate) {
    return `
      <div class="feature-actions">
        <a href="#plans" class="btn btn-primary">Plan upgraden</a>
      </div>
    `;
  }

  if (isActive) {
    return `
      <div class="feature-actions">
        <button class="btn btn-status-active" data-action="toggle-feature" data-feature="${feature.code}" data-state="false">
          Deaktivieren
        </button>
      </div>
    `;
  } else {
    return `
      <div class="feature-actions">
        <button class="btn btn-status-inactive" data-action="toggle-feature" data-feature="${feature.code}" data-state="true">
          Aktivieren
        </button>
      </div>
    `;
  }
}

/**
 * Render a feature card using Design System .feature-card component
 * Pattern: /design-system/primitives/choice-cards/choice-card.feature.css
 */
export function renderFeatureCard(feature: Feature): string {
  const canActivate = canActivateFeature(feature.minPlan, currentPlan);
  const isActive = feature.active;

  // Determine card state classes
  let cardClasses = 'feature-card';
  if (!canActivate) {
    cardClasses += ' feature-card--premium'; // Locked feature (requires upgrade)
  } else if (isActive) {
    cardClasses += ' active';
  } else {
    cardClasses += ' inactive';
  }

  // Status badge (absolute positioned top-right)
  const statusClass = isActive ? 'status-active' : 'status-inactive';
  const statusText = getFeatureStatusText(isActive, canActivate);

  return `
    <div class="${cardClasses}" data-feature="${feature.code}" data-min-plan="${feature.minPlan}">
      <span class="feature-status ${statusClass}">${statusText}</span>
      <h4 class="feature-name">${feature.name}</h4>
      <p class="feature-description">${feature.description}</p>
      <div class="feature-plan-badge">${getPlanBadge(feature.minPlan)}</div>
      ${renderFeatureActions(feature, isActive, canActivate)}
    </div>
  `;
}

/**
 * Render features by category
 * Uses .features-grid from choice-card.feature.css (responsive minmax(300px, 1fr))
 */
export function renderFeatureCategories(): string {
  return Object.entries(featureCategories)
    .map(
      ([categoryName, categoryData]) => `
    <div class="feature-category mb-8" data-category="${categoryName}">
      <h3 class="text-xl font-semibold mb-4 flex items-center gap-2">
        <span class="text-2xl">${categoryData.icon}</span>
        ${categoryName}
      </h3>
      <div class="features-grid">
        ${categoryData.features.map((feature) => renderFeatureCard(feature)).join('')}
      </div>
    </div>
  `,
    )
    .join('');
}

/**
 * Render plan card using Design System .plan-card component
 * Pattern: /design-system/primitives/choice-cards/choice-card.plan.css
 */
export function renderPlanCard(plan: Plan, isCurrent: boolean, isRecommended: boolean): string {
  const maxEmployees = plan.maxEmployees ?? '∞';
  const maxAdmins = plan.maxAdmins ?? '∞';

  // Build class list
  let cardClasses = 'choice-card plan-card';
  if (isRecommended) {
    cardClasses += ' plan-card--recommended'; // ::before "Empfohlen" badge
  }

  return `
    <label class="${cardClasses}">
      <input type="radio"
             class="choice-card__input"
             name="plan-selection"
             value="${plan.code}"
             ${isCurrent ? 'checked' : ''}
             data-plan="${plan.code}" />
      <div class="plan-card__content">
        <div class="plan-card__header">
          <h4 class="plan-card__title">${plan.name}</h4>
          <span class="plan-card__price">${plan.basePrice.toFixed(0)}€/Monat</span>
        </div>
        <p class="plan-card__description">
          Für kleine bis mittlere Teams
        </p>
        <ul class="plan-card__features">
          <li class="plan-card__feature">${maxEmployees} Mitarbeiter</li>
          <li class="plan-card__feature">${maxAdmins} Admins</li>
          <li class="plan-card__feature">Alle Basis-Features</li>
        </ul>
      </div>
    </label>
  `;
}

/**
 * Render all plan cards
 */
export function renderPlanCards(): string {
  const planOrder: ('basic' | 'professional' | 'enterprise')[] = ['basic', 'professional', 'enterprise'];
  return planOrder
    .map((code) => {
      // eslint-disable-next-line security/detect-object-injection -- Safe: code is from planOrder array with literal types
      const plan = plans[code];
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime safety: plans object may not be loaded yet
      if (plan === undefined) return '';
      const isCurrent = code === currentPlan;
      const isRecommended = code === 'professional';
      return renderPlanCard(plan, isCurrent, isRecommended);
    })
    .filter(Boolean)
    .join('');
}

/**
 * Update plan UI elements
 */
export function updatePlanUI(): void {
  // Update plan badge
  const badge = document.querySelector('.plan-badge span');
  if (badge !== null) {
    // eslint-disable-next-line security/detect-object-injection -- Safe: currentPlan is controlled by loadCurrentPlan() and limited to valid plan codes
    const planData = plans[currentPlan];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime safety: plans may not be loaded yet, defensive fallback
    const planName = planData?.name ?? currentPlan;
    badge.textContent = `${planName} Plan`;
  }

  // Re-render plan cards
  const plansContainer = document.querySelector('#plans-container');
  if (plansContainer !== null) {
    setHTML(plansContainer as HTMLElement, renderPlanCards());
  }
}

/**
 * Update addons display
 */
export function updateAddonsDisplay(addons: TenantAddons): void {
  const employeesEl = document.querySelector('#addon-employees');
  const adminsEl = document.querySelector('#addon-admins');
  const storageEl = document.querySelector('#addon-storage');

  if (employeesEl !== null) {
    employeesEl.textContent = String(addons.employees ?? 0);
  }
  if (adminsEl !== null) {
    adminsEl.textContent = String(addons.admins ?? 0);
  }
  if (storageEl !== null) {
    storageEl.textContent = addons.storage_gb !== undefined ? `${addons.storage_gb}GB` : '0GB';
  }
}

/**
 * Update summary bar
 */
export function updateSummary(addons: TenantAddons): void {
  // Count active features
  let activeCount = 0;
  let totalCount = 0;

  Object.values(featureCategories).forEach((category) => {
    category.features.forEach((feature) => {
      if (canActivateFeature(feature.minPlan, currentPlan)) {
        totalCount++;
        if (feature.active) activeCount++;
      }
    });
  });

  // Get plan data
  // eslint-disable-next-line security/detect-object-injection -- Safe: currentPlan is controlled by loadCurrentPlan() and limited to valid plan codes
  const planData = plans[currentPlan];
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime safety: defensive check in case plans not loaded
  if (planData === undefined) {
    console.warn('Plan data not found for:', currentPlan);
    return;
  }

  // Calculate total cost
  let totalCost = planData.basePrice;
  totalCost += (addons.employees ?? 0) * 5;
  totalCost += (addons.admins ?? 0) * 10;
  totalCost += ((addons.storage_gb ?? 0) / 100) * 10;

  // Update UI
  const summaryPlan = document.querySelector('#summary-plan');
  const summaryFeatures = document.querySelector('#summary-features');
  const summaryCost = document.querySelector('#summary-cost');

  if (summaryPlan !== null) {
    summaryPlan.textContent = planData.name;
  }
  if (summaryFeatures !== null) {
    summaryFeatures.textContent = `${activeCount} / ${totalCount}`;
  }
  if (summaryCost !== null) {
    summaryCost.textContent = `${totalCost.toFixed(2)}€`;
  }
}

/**
 * Filter features based on current filter
 */
export function filterFeatures(filter: 'all' | 'active' | 'included' | 'addons'): void {
  const cards = document.querySelectorAll<HTMLElement>('[data-feature]');

  cards.forEach((card) => {
    const featureCode = card.dataset.feature ?? '';
    let show = true;

    switch (filter) {
      case 'active':
        show = card.classList.contains('card-accent--success');
        break;
      case 'included':
        show = isFeatureIncludedInPlan(featureCode, currentPlan);
        break;
      case 'addons':
        show = !isFeatureIncludedInPlan(featureCode, currentPlan) && !card.classList.contains('card-accent--disabled');
        break;
    }

    card.style.display = show ? 'block' : 'none';
  });
}
