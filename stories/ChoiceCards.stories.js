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
        <div class="modal modal--md">
          <div class="modal__header">
            <h2 class="modal__title">
              <i class="fas fa-user-shield"></i>
              Abteilungsberechtigungen verwalten
            </h2>
            <button class="modal__close" data-action="close">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="modal__body">
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
          <div class="modal__footer">
            <button class="btn btn-secondary">Abbrechen</button>
            <button class="btn btn-primary">
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
