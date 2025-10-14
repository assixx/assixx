/**
 * Choice Cards – Selection Controls
 *
 * Card-style radio buttons and checkboxes.
 * Vertical stacked layout for visual single/multiple choice.
 *
 * Origin: manage-admins.html Berechtigungen Modal
 */

export default {
  title: 'Design System/Choice Cards',
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'assixx-dark',
    },
  },
  tags: ['autodocs'],
};

/**
 * Radio Buttons (Single Choice)
 *
 * Permissions selection from manage-admins modal.
 */
export const RadioButtons = {
  args: {
    compact: false,
    defaultSelected: 'none',
  },
  argTypes: {
    compact: {
      control: 'boolean',
      description: 'Compact spacing (8px gap)',
    },
    defaultSelected: {
      control: 'select',
      options: ['none', 'specific', 'all'],
      description: 'Default selected option',
    },
  },
  render: (args) => {
    const groupClass = args.compact ? 'choice-group choice-group--compact' : 'choice-group';

    const wrapper = document.createElement('div');
    wrapper.style.maxWidth = '500px';

    wrapper.innerHTML = `
      <h3 style="color: var(--color-text-primary); margin-bottom: var(--spacing-4);">
        Berechtigungstyp
      </h3>
      <div class="${groupClass}">
        <label class="choice-card">
          <input
            type="radio"
            class="choice-card__input"
            name="permissions-radio"
            value="none"
            ${args.defaultSelected === 'none' ? 'checked' : ''}
          >
          <span class="choice-card__text">Keine Abteilungen</span>
        </label>
        <label class="choice-card">
          <input
            type="radio"
            class="choice-card__input"
            name="permissions-radio"
            value="specific"
            ${args.defaultSelected === 'specific' ? 'checked' : ''}
          >
          <span class="choice-card__text">Spezifische Abteilungen</span>
        </label>
        <label class="choice-card">
          <input
            type="radio"
            class="choice-card__input"
            name="permissions-radio"
            value="all"
            ${args.defaultSelected === 'all' ? 'checked' : ''}
          >
          <span class="choice-card__text">Alle Abteilungen</span>
        </label>
      </div>
    `;

    return wrapper;
  },
};

/**
 * Checkboxes (Multiple Choice)
 *
 * Feature selection with multiple checkboxes.
 */
export const Checkboxes = {
  args: {
    compact: false,
  },
  argTypes: {
    compact: {
      control: 'boolean',
      description: 'Compact spacing (8px gap)',
    },
  },
  render: (args) => {
    const groupClass = args.compact ? 'choice-group choice-group--compact' : 'choice-group';

    const wrapper = document.createElement('div');
    wrapper.style.maxWidth = '500px';

    wrapper.innerHTML = `
      <h3 style="color: var(--color-text-primary); margin-bottom: var(--spacing-4);">
        Features aktivieren
      </h3>
      <div class="${groupClass}">
        <label class="choice-card">
          <input
            type="checkbox"
            class="choice-card__input"
            name="features"
            value="analytics"
            checked
          >
          <span class="choice-card__text">Analytics Dashboard</span>
        </label>
        <label class="choice-card">
          <input
            type="checkbox"
            class="choice-card__input"
            name="features"
            value="reports"
            checked
          >
          <span class="choice-card__text">Advanced Reports</span>
        </label>
        <label class="choice-card">
          <input
            type="checkbox"
            class="choice-card__input"
            name="features"
            value="api"
          >
          <span class="choice-card__text">API Access</span>
        </label>
        <label class="choice-card">
          <input
            type="checkbox"
            class="choice-card__input"
            name="features"
            value="export"
          >
          <span class="choice-card__text">Data Export</span>
        </label>
      </div>
    `;

    return wrapper;
  },
};

/**
 * With Icons
 *
 * Choice cards with FontAwesome icons.
 */
export const WithIcons = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.maxWidth = '500px';

    wrapper.innerHTML = `
      <h3 style="color: var(--color-text-primary); margin-bottom: var(--spacing-4);">
        Select Notification Channel
      </h3>
      <div class="choice-group">
        <label class="choice-card choice-card--with-icon">
          <input
            type="radio"
            class="choice-card__input"
            name="channel"
            value="email"
            checked
          >
          <span class="choice-card__text">
            <i class="fas fa-envelope"></i>
            Email Notifications
          </span>
        </label>
        <label class="choice-card choice-card--with-icon">
          <input
            type="radio"
            class="choice-card__input"
            name="channel"
            value="sms"
          >
          <span class="choice-card__text">
            <i class="fas fa-sms"></i>
            SMS Notifications
          </span>
        </label>
        <label class="choice-card choice-card--with-icon">
          <input
            type="radio"
            class="choice-card__input"
            name="channel"
            value="push"
          >
          <span class="choice-card__text">
            <i class="fas fa-bell"></i>
            Push Notifications
          </span>
        </label>
      </div>
    `;

    return wrapper;
  },
};

/**
 * Plan Selection (With Descriptions)
 *
 * Large cards with icons and descriptions.
 */
export const PlanSelection = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.maxWidth = '600px';

    wrapper.innerHTML = `
      <h2 style="color: var(--color-text-primary); margin-bottom: var(--spacing-2);">
        Choose Your Plan
      </h2>
      <p style="color: var(--color-text-secondary); margin-bottom: var(--spacing-6);">
        Select the plan that fits your needs
      </p>
      <div class="choice-group">
        <label class="choice-card choice-card--lg">
          <input
            type="radio"
            class="choice-card__input"
            name="plan"
            value="free"
          >
          <span class="choice-card__text" style="flex-direction: column; align-items: flex-start;">
            <span style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <i class="fas fa-gift"></i>
              <strong>Free Plan</strong>
            </span>
            <span class="choice-card__description">
              Up to 5 users • Basic features • Email support
            </span>
          </span>
        </label>
        <label class="choice-card choice-card--lg">
          <input
            type="radio"
            class="choice-card__input"
            name="plan"
            value="pro"
            checked
          >
          <span class="choice-card__text" style="flex-direction: column; align-items: flex-start;">
            <span style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <i class="fas fa-star" style="color: var(--color-primary);"></i>
              <strong>Pro Plan</strong>
              <span style="font-size: 0.75rem; padding: 2px 8px; background: var(--color-primary); border-radius: 4px; color: white;">Popular</span>
            </span>
            <span class="choice-card__description">
              Up to 50 users • Advanced features • Priority support
            </span>
          </span>
        </label>
        <label class="choice-card choice-card--lg">
          <input
            type="radio"
            class="choice-card__input"
            name="plan"
            value="enterprise"
          >
          <span class="choice-card__text" style="flex-direction: column; align-items: flex-start;">
            <span style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <i class="fas fa-building"></i>
              <strong>Enterprise Plan</strong>
            </span>
            <span class="choice-card__description">
              Unlimited users • All features • Dedicated support
            </span>
          </span>
        </label>
      </div>
      <button class="btn btn-primary btn-block" style="margin-top: var(--spacing-6);">
        Continue to Payment
      </button>
    `;

    return wrapper;
  },
};

/**
 * In Modal Context
 *
 * Real-world example: Permissions modal from manage-admins.
 */
export const InModalContext = {
  render: () => {
    const wrapper = document.createElement('div');

    wrapper.innerHTML = `
      <div class="modal-overlay modal-overlay--active">
        <div class="ds-modal ds-modal--md">
          <div class="ds-modal__header">
            <h2 class="ds-modal__title">
              <i class="fas fa-user-shield"></i>
              Abteilungsberechtigungen verwalten
            </h2>
            <button class="ds-modal__close" data-action="close">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="ds-modal__body">
            <div style="padding: var(--spacing-4); background: rgba(33, 150, 243, 0.1); border-radius: var(--radius-lg); margin-bottom: var(--spacing-5); border-left: 4px solid var(--color-primary);">
              <p style="color: var(--color-text-secondary); font-size: 0.875rem; margin: 0;">
                <i class="fas fa-info-circle"></i>
                Admin: <strong>Max Mustermann</strong>
              </p>
            </div>

            <div class="form-field">
              <label class="form-field__label form-field__label--required">
                Berechtigungstyp
              </label>
              <div class="choice-group">
                <label class="choice-card">
                  <input
                    type="radio"
                    class="choice-card__input"
                    name="permission-type-modal"
                    value="none"
                    checked
                  >
                  <span class="choice-card__text">Keine Abteilungen</span>
                </label>
                <label class="choice-card">
                  <input
                    type="radio"
                    class="choice-card__input"
                    name="permission-type-modal"
                    value="specific"
                  >
                  <span class="choice-card__text">Spezifische Abteilungen</span>
                </label>
                <label class="choice-card">
                  <input
                    type="radio"
                    class="choice-card__input"
                    name="permission-type-modal"
                    value="all"
                  >
                  <span class="choice-card__text">Alle Abteilungen</span>
                </label>
              </div>
            </div>
          </div>
          <div class="ds-modal__footer">
            <button class="btn btn-secondary">Abbrechen</button>
            <button class="btn btn-modal">
              <i class="fas fa-save"></i>
              Speichern
            </button>
          </div>
        </div>
      </div>
    `;

    return wrapper;
  },
};

/**
 * Disabled State
 *
 * Shows disabled choice cards.
 */
export const DisabledState = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.maxWidth = '500px';

    wrapper.innerHTML = `
      <h3 style="color: var(--color-text-primary); margin-bottom: var(--spacing-4);">
        Payment Method
      </h3>
      <div class="choice-group">
        <label class="choice-card">
          <input
            type="radio"
            class="choice-card__input"
            name="payment"
            value="card"
            checked
          >
          <span class="choice-card__text">
            <i class="fas fa-credit-card"></i>
            Credit Card
          </span>
        </label>
        <label class="choice-card">
          <input
            type="radio"
            class="choice-card__input"
            name="payment"
            value="paypal"
            disabled
          >
          <span class="choice-card__text">
            <i class="fab fa-paypal"></i>
            PayPal (Coming Soon)
          </span>
        </label>
        <label class="choice-card">
          <input
            type="radio"
            class="choice-card__input"
            name="payment"
            value="invoice"
            disabled
          >
          <span class="choice-card__text">
            <i class="fas fa-file-invoice"></i>
            Invoice (Enterprise Only)
          </span>
        </label>
      </div>
    `;

    return wrapper;
  },
};

/**
 * Comparison: Radio vs Checkbox
 *
 * Shows difference between single and multiple choice.
 */
export const RadioVsCheckbox = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'grid';
    wrapper.style.gridTemplateColumns = '1fr 1fr';
    wrapper.style.gap = '32px';

    wrapper.innerHTML = `
      <div>
        <h3 style="color: var(--color-text-primary); margin-bottom: var(--spacing-3);">
          Radio (Single Choice)
        </h3>
        <p style="color: var(--color-text-secondary); font-size: 0.875rem; margin-bottom: var(--spacing-4);">
          Only one option can be selected
        </p>
        <div class="choice-group choice-group--compact">
          <label class="choice-card">
            <input type="radio" class="choice-card__input" name="single" value="a" checked>
            <span class="choice-card__text">Option A</span>
          </label>
          <label class="choice-card">
            <input type="radio" class="choice-card__input" name="single" value="b">
            <span class="choice-card__text">Option B</span>
          </label>
          <label class="choice-card">
            <input type="radio" class="choice-card__input" name="single" value="c">
            <span class="choice-card__text">Option C</span>
          </label>
        </div>
      </div>

      <div>
        <h3 style="color: var(--color-text-primary); margin-bottom: var(--spacing-3);">
          Checkbox (Multiple Choice)
        </h3>
        <p style="color: var(--color-text-secondary); font-size: 0.875rem; margin-bottom: var(--spacing-4);">
          Multiple options can be selected
        </p>
        <div class="choice-group choice-group--compact">
          <label class="choice-card">
            <input type="checkbox" class="choice-card__input" name="multi" value="a" checked>
            <span class="choice-card__text">Option A</span>
          </label>
          <label class="choice-card">
            <input type="checkbox" class="choice-card__input" name="multi" value="b" checked>
            <span class="choice-card__text">Option B</span>
          </label>
          <label class="choice-card">
            <input type="checkbox" class="choice-card__input" name="multi" value="c">
            <span class="choice-card__text">Option C</span>
          </label>
        </div>
      </div>
    `;

    return wrapper;
  },
};

/**
 * Plan Cards - Feature/Plan Selection
 *
 * Enhanced cards for pricing/feature selection (from root-features page)
 */
export const PlanCards = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.maxWidth = '800px';

    wrapper.innerHTML = `
      <h2 style="color: var(--color-text-primary); margin-bottom: var(--spacing-2);">
        Feature auswählen
      </h2>
      <p style="color: var(--color-text-secondary); margin-bottom: var(--spacing-6);">
        Wählen Sie das Feature zur Aktivierung
      </p>
      <div class="choice-group">
        <label class="choice-card plan-card">
          <input
            type="radio"
            class="choice-card__input"
            name="feature"
            value="urlaubsplaner"
            checked
          >
          <div class="plan-card__content">
            <div class="plan-card__header">
              <h4 class="plan-card__title">Urlaubsplaner</h4>
              <span class="plan-card__price">49.90 €/Monat</span>
            </div>
            <p class="plan-card__description">
              Vollständige Urlaubsverwaltung mit Kalender und Freigabeprozess
            </p>
          </div>
        </label>

        <label class="choice-card plan-card plan-card--recommended">
          <input
            type="radio"
            class="choice-card__input"
            name="feature"
            value="schichtplanung"
          >
          <div class="plan-card__content">
            <div class="plan-card__header">
              <h4 class="plan-card__title">Schichtplanung</h4>
              <span class="plan-card__price">39.90 €/Monat</span>
            </div>
            <p class="plan-card__description">
              Automatische Schichtplanung mit KI-Optimierung
            </p>
          </div>
        </label>

        <label class="choice-card plan-card">
          <input
            type="radio"
            class="choice-card__input"
            name="feature"
            value="zeiterfassung"
          >
          <div class="plan-card__content">
            <div class="plan-card__header">
              <h4 class="plan-card__title">Zeiterfassung</h4>
              <span class="plan-card__price">29.90 €/Monat</span>
            </div>
            <p class="plan-card__description">
              Digitale Zeiterfassung mit Überstunden-Tracking
            </p>
          </div>
        </label>

        <label class="choice-card plan-card">
          <input
            type="radio"
            class="choice-card__input"
            name="feature"
            value="kvp"
          >
          <div class="plan-card__content">
            <div class="plan-card__header">
              <h4 class="plan-card__title">KVP System</h4>
              <span class="plan-card__price">59.90 €/Monat</span>
            </div>
            <p class="plan-card__description">
              Kontinuierlicher Verbesserungsprozess mit Workflow
            </p>
          </div>
        </label>

        <label class="choice-card plan-card">
          <input
            type="radio"
            class="choice-card__input"
            name="feature"
            value="dokumentenverwaltung"
            disabled
          >
          <div class="plan-card__content">
            <div class="plan-card__header">
              <h4 class="plan-card__title">Dokumentenverwaltung</h4>
              <span class="plan-card__price">34.90 €/Monat</span>
            </div>
            <p class="plan-card__description">
              Zentrale Verwaltung aller Unternehmensdokumente
            </p>
          </div>
        </label>
      </div>

      <div style="display: flex; justify-content: flex-end; margin-top: var(--spacing-6);">
        <button class="btn btn-modal">
          <i class="fas fa-toggle-on"></i>
          Feature aktivieren
        </button>
      </div>
    `;

    return wrapper;
  },
};

/**
 * Plan Cards - With Features List
 *
 * Plan cards with bullet-point features
 */
export const PlanCardsWithFeatures = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.maxWidth = '900px';

    wrapper.innerHTML = `
      <h2 style="color: var(--color-text-primary); margin-bottom: var(--spacing-2);">
        Wählen Sie Ihren Plan
      </h2>
      <p style="color: var(--color-text-secondary); margin-bottom: var(--spacing-6);">
        Alle Pläne beinhalten 14 Tage kostenlose Testphase
      </p>
      <div class="choice-group">
        <label class="choice-card plan-card">
          <input
            type="radio"
            class="choice-card__input"
            name="pricing-plan"
            value="starter"
          >
          <div class="plan-card__content">
            <div class="plan-card__header">
              <h4 class="plan-card__title">Starter</h4>
              <span class="plan-card__price">19.90 €/Monat</span>
            </div>
            <p class="plan-card__description">Perfekt für kleine Teams</p>
            <ul class="plan-card__features">
              <li class="plan-card__feature">Bis zu 10 Mitarbeiter</li>
              <li class="plan-card__feature">Basis-Features</li>
              <li class="plan-card__feature">Email Support</li>
            </ul>
          </div>
        </label>

        <label class="choice-card plan-card plan-card--recommended">
          <input
            type="radio"
            class="choice-card__input"
            name="pricing-plan"
            value="professional"
            checked
          >
          <div class="plan-card__content">
            <div class="plan-card__header">
              <h4 class="plan-card__title">Professional</h4>
              <span class="plan-card__price">49.90 €/Monat</span>
            </div>
            <p class="plan-card__description">Für wachsende Unternehmen</p>
            <ul class="plan-card__features">
              <li class="plan-card__feature">Bis zu 50 Mitarbeiter</li>
              <li class="plan-card__feature">Alle Features</li>
              <li class="plan-card__feature">Priority Support</li>
              <li class="plan-card__feature">API Zugang</li>
            </ul>
          </div>
        </label>

        <label class="choice-card plan-card">
          <input
            type="radio"
            class="choice-card__input"
            name="pricing-plan"
            value="enterprise"
          >
          <div class="plan-card__content">
            <div class="plan-card__header">
              <h4 class="plan-card__title">Enterprise</h4>
              <span class="plan-card__price">Individuell</span>
            </div>
            <p class="plan-card__description">Maßgeschneiderte Lösung</p>
            <ul class="plan-card__features">
              <li class="plan-card__feature">Unbegrenzte Mitarbeiter</li>
              <li class="plan-card__feature">Alle Features + Custom</li>
              <li class="plan-card__feature">24/7 Dedicated Support</li>
              <li class="plan-card__feature">On-Premise Option</li>
            </ul>
          </div>
        </label>
      </div>
    `;

    return wrapper;
  },
};

/**
 * Plan Cards - Compact Variant
 *
 * Smaller plan cards for inline selection
 */
export const PlanCardsCompact = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.maxWidth = '600px';

    wrapper.innerHTML = `
      <div class="form-field">
        <label class="form-field__label">Feature auswählen</label>
        <div class="choice-group choice-group--compact">
          <label class="choice-card plan-card plan-card--compact">
            <input type="radio" class="choice-card__input" name="feature-compact" value="1" checked>
            <div class="plan-card__content">
              <div class="plan-card__header">
                <h4 class="plan-card__title">Urlaubsplaner</h4>
                <span class="plan-card__price">49.90 €</span>
              </div>
            </div>
          </label>
          <label class="choice-card plan-card plan-card--compact">
            <input type="radio" class="choice-card__input" name="feature-compact" value="2">
            <div class="plan-card__content">
              <div class="plan-card__header">
                <h4 class="plan-card__title">Schichtplanung</h4>
                <span class="plan-card__price">39.90 €</span>
              </div>
            </div>
          </label>
          <label class="choice-card plan-card plan-card--compact">
            <input type="radio" class="choice-card__input" name="feature-compact" value="3">
            <div class="plan-card__content">
              <div class="plan-card__header">
                <h4 class="plan-card__title">Zeiterfassung</h4>
                <span class="plan-card__price">29.90 €</span>
              </div>
            </div>
          </label>
        </div>
      </div>
    `;

    return wrapper;
  },
};

/**
 * Feature Cards - Feature Management
 *
 * Cards for activating/deactivating features (from root-features page)
 */
export const FeatureCards = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.padding = '24px';

    wrapper.innerHTML = `
      <h2 style="color: var(--color-text-primary); margin-bottom: var(--spacing-2);">
        Feature Verwaltung
      </h2>
      <p style="color: var(--color-text-secondary); margin-bottom: var(--spacing-6);">
        Verwalten Sie die aktivierten Features für diesen Mandanten
      </p>

      <div class="features-grid">
        <div class="feature-card active" data-feature="basic_employees">
          <span class="feature-status status-active">Aktiv</span>
          <h4 class="feature-name">Mitarbeiterverwaltung</h4>
          <p class="feature-description">Verwalten Sie Ihre Mitarbeiter effizient</p>
          <div class="feature-plan-badge">Ab Basic</div>
          <div class="feature-actions">
            <button class="btn btn-status-active">
              <i class="fas fa-times"></i>
              Deaktivieren
            </button>
          </div>
        </div>

        <div class="feature-card active" data-feature="document_upload">
          <span class="feature-status status-active">Aktiv</span>
          <h4 class="feature-name">Dokumentenverwaltung</h4>
          <p class="feature-description">Zentrale Ablage für alle Dokumente</p>
          <div class="feature-plan-badge">Ab Basic</div>
          <div class="feature-actions">
            <button class="btn btn-status-active">
              <i class="fas fa-times"></i>
              Deaktivieren
            </button>
          </div>
        </div>

        <div class="feature-card active" data-feature="shift_management">
          <span class="feature-status status-active">Aktiv</span>
          <h4 class="feature-name">Schichtplanung</h4>
          <p class="feature-description">Automatische Schichtplanung mit KI-Optimierung</p>
          <div class="feature-plan-badge">Ab Professional</div>
          <div class="feature-actions">
            <button class="btn btn-status-active">
              <i class="fas fa-times"></i>
              Deaktivieren
            </button>
          </div>
        </div>

        <div class="feature-card inactive" data-feature="vacation_planner">
          <span class="feature-status status-inactive">Inaktiv</span>
          <h4 class="feature-name">Urlaubsplaner</h4>
          <p class="feature-description">Vollständige Urlaubsverwaltung mit Kalender</p>
          <div class="feature-plan-badge">Ab Professional</div>
          <div class="feature-actions">
            <button class="btn btn-status-inactive">
              <i class="fas fa-check"></i>
              Aktivieren
            </button>
          </div>
        </div>

        <div class="feature-card inactive" data-feature="kvp_system">
          <span class="feature-status status-inactive">Inaktiv</span>
          <h4 class="feature-name">KVP System</h4>
          <p class="feature-description">Kontinuierlicher Verbesserungsprozess</p>
          <div class="feature-plan-badge">Ab Professional</div>
          <div class="feature-actions">
            <button class="btn btn-status-inactive">
              <i class="fas fa-check"></i>
              Aktivieren
            </button>
          </div>
        </div>

        <div class="feature-card feature-card--premium inactive" data-feature="api_access">
          <span class="feature-status status-inactive">Inaktiv</span>
          <h4 class="feature-name">API Zugang</h4>
          <p class="feature-description">REST API für externe Integrationen</p>
          <div class="feature-plan-badge">Ab Enterprise</div>
          <div class="feature-actions">
            <button class="btn btn-status-inactive">
              <i class="fas fa-check"></i>
              Aktivieren
            </button>
          </div>
        </div>
      </div>
    `;

    return wrapper;
  },
};

/**
 * Feature Cards - With Configure Actions
 *
 * Feature cards with both activate/deactivate and configure buttons
 */
export const FeatureCardsWithActions = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.padding = '24px';
    wrapper.style.maxWidth = '1200px';

    wrapper.innerHTML = `
      <div class="features-grid">
        <div class="feature-card active">
          <span class="feature-status status-active">Aktiv</span>
          <h4 class="feature-name">Schichtplanung</h4>
          <p class="feature-description">Automatische Planung und Verwaltung</p>
          <div class="feature-plan-badge">Ab Professional</div>
          <div class="feature-actions">
            <button class="btn btn-secondary">
              <i class="fas fa-cog"></i>
              Konfigurieren
            </button>
            <button class="btn btn-status-active">
              <i class="fas fa-times"></i>
              Deaktivieren
            </button>
          </div>
        </div>

        <div class="feature-card active">
          <span class="feature-status status-active">Aktiv</span>
          <h4 class="feature-name">Urlaubsplaner</h4>
          <p class="feature-description">Urlaubsverwaltung mit Genehmigung</p>
          <div class="feature-plan-badge">Ab Professional</div>
          <div class="feature-actions">
            <button class="btn btn-secondary">
              <i class="fas fa-cog"></i>
              Konfigurieren
            </button>
            <button class="btn btn-status-active">
              <i class="fas fa-times"></i>
              Deaktivieren
            </button>
          </div>
        </div>

        <div class="feature-card inactive">
          <span class="feature-status status-inactive">Inaktiv</span>
          <h4 class="feature-name">Zeiterfassung</h4>
          <p class="feature-description">Digitale Arbeitszeiterfassung</p>
          <div class="feature-plan-badge">Ab Basic</div>
          <div class="feature-actions">
            <button class="btn btn-status-inactive" style="flex: 1 0 100%;">
              <i class="fas fa-check"></i>
              Aktivieren
            </button>
          </div>
        </div>
      </div>
    `;

    return wrapper;
  },
};
