/**
 * Multi-Select - Multiple Selection
 *
 * Native <select multiple> with enhanced Design System styling.
 * Used for department selection, permissions, bulk operations.
 *
 * Origin: manage-admins.html Abteilungsberechtigungen modal
 */

export default {
  title: 'Design System/Forms/Multi-Select',
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'assixx-dark',
    },
  },
  tags: ['autodocs'],
};

/**
 * Basic Multi-Select
 *
 * Standard multi-select with departments.
 */
export const Basic = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.maxWidth = '500px';

    wrapper.innerHTML = `
      <div class="form-field">
        <label class="form-field__label" for="departments-basic">
          Abteilungen auswählen
        </label>
        <select id="departments-basic" multiple class="multi-select">
          <option value="1">Produktion</option>
          <option value="2">Logistik</option>
          <option value="3">Qualitätssicherung</option>
          <option value="4">Verwaltung</option>
          <option value="5">IT</option>
          <option value="6">Personalwesen</option>
          <option value="7">Einkauf</option>
          <option value="8">Vertrieb</option>
        </select>
        <span class="multi-select__hint">
          <i class="fas fa-info-circle"></i>
          Halten Sie Strg/Cmd gedrückt für Mehrfachauswahl
        </span>
      </div>
    `;

    return wrapper;
  },
};

/**
 * With Pre-Selected Options
 *
 * Multi-select with some options already selected.
 */
export const WithPreSelected = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.maxWidth = '500px';

    wrapper.innerHTML = `
      <div class="form-field">
        <label class="form-field__label" for="departments-preselected">
          Zugewiesene Abteilungen
        </label>
        <select id="departments-preselected" multiple class="multi-select">
          <option value="1" selected>Produktion</option>
          <option value="2">Logistik</option>
          <option value="3" selected>Qualitätssicherung</option>
          <option value="4">Verwaltung</option>
          <option value="5" selected>IT</option>
          <option value="6">Personalwesen</option>
          <option value="7">Einkauf</option>
          <option value="8">Vertrieb</option>
        </select>
        <span class="multi-select__hint">
          <i class="fas fa-check-circle"></i>
          3 Abteilungen ausgewählt
        </span>
      </div>
    `;

    return wrapper;
  },
};

/**
 * Compact Variant
 *
 * Smaller height for inline forms.
 */
export const Compact = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.maxWidth = '400px';

    wrapper.innerHTML = `
      <div class="form-field">
        <label class="form-field__label" for="departments-compact">
          Filter nach Abteilungen
        </label>
        <select id="departments-compact" multiple class="multi-select multi-select--compact">
          <option value="1">Produktion</option>
          <option value="2">Logistik</option>
          <option value="3">Qualitätssicherung</option>
          <option value="4">Verwaltung</option>
          <option value="5">IT</option>
        </select>
      </div>
    `;

    return wrapper;
  },
};

/**
 * Large Variant
 *
 * More visible items for long lists.
 */
export const Large = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.maxWidth = '600px';

    wrapper.innerHTML = `
      <div class="form-field">
        <label class="form-field__label" for="departments-large">
          Alle Abteilungen
        </label>
        <select id="departments-large" multiple class="multi-select multi-select--lg">
          <option value="1">Produktion</option>
          <option value="2">Logistik</option>
          <option value="3">Qualitätssicherung</option>
          <option value="4">Verwaltung</option>
          <option value="5">IT</option>
          <option value="6">Personalwesen</option>
          <option value="7">Einkauf</option>
          <option value="8">Vertrieb</option>
          <option value="9">Forschung & Entwicklung</option>
          <option value="10">Marketing</option>
          <option value="11">Kundenservice</option>
          <option value="12">Finanzen</option>
        </select>
        <span class="multi-select__hint">
          <i class="fas fa-info-circle"></i>
          Scrollen Sie für weitere Optionen
        </span>
      </div>
    `;

    return wrapper;
  },
};

/**
 * Required Field
 *
 * Multi-select with required indicator.
 */
export const Required = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.maxWidth = '500px';

    wrapper.innerHTML = `
      <div class="form-field">
        <label class="form-field__label" for="departments-required">
          Abteilungen zuordnen
          <span class="text-red-500">*</span>
        </label>
        <select id="departments-required" multiple class="multi-select" required>
          <option value="1">Produktion</option>
          <option value="2">Logistik</option>
          <option value="3">Qualitätssicherung</option>
          <option value="4">Verwaltung</option>
          <option value="5">IT</option>
          <option value="6">Personalwesen</option>
          <option value="7">Einkauf</option>
          <option value="8">Vertrieb</option>
        </select>
        <span class="form-field__message text-[var(--color-text-secondary)]">
          Mindestens 2 Abteilungen erforderlich
        </span>
      </div>
    `;

    return wrapper;
  },
};

/**
 * With Error State
 *
 * Multi-select with validation error.
 */
export const WithError = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.maxWidth = '500px';

    wrapper.innerHTML = `
      <div class="form-field">
        <label class="form-field__label" for="departments-error">
          Abteilungen zuordnen
          <span class="text-red-500">*</span>
        </label>
        <select id="departments-error" multiple class="multi-select error" aria-invalid="true">
          <option value="1">Produktion</option>
          <option value="2">Logistik</option>
          <option value="3">Qualitätssicherung</option>
          <option value="4">Verwaltung</option>
        </select>
        <span class="form-field__message form-field__message--error">
          <i class="fas fa-exclamation-circle"></i>
          Mindestens 2 Abteilungen erforderlich
        </span>
      </div>
    `;

    return wrapper;
  },
};

/**
 * Disabled State
 *
 * Multi-select disabled (read-only context).
 */
export const Disabled = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.maxWidth = '500px';

    wrapper.innerHTML = `
      <div class="form-field">
        <label class="form-field__label" for="departments-disabled">
          Abteilungen (nicht änderbar)
        </label>
        <select id="departments-disabled" multiple class="multi-select" disabled>
          <option value="1" selected>Produktion</option>
          <option value="2">Logistik</option>
          <option value="3" selected>IT</option>
          <option value="4">Verwaltung</option>
        </select>
        <span class="form-field__message text-[var(--color-text-secondary)]">
          Abteilungen können nur vom Administrator geändert werden
        </span>
      </div>
    `;

    return wrapper;
  },
};

/**
 * In Modal Context
 *
 * Real-world example: Department assignment in modal.
 */
export const InModalContext = {
  render: () => {
    const wrapper = document.createElement('div');

    wrapper.innerHTML = `
      <div class="modal-overlay modal-overlay--active">
        <div class="ds-modal ds-modal--md">
          <div class="ds-modal__header">
            <h3 class="ds-modal__title">
              <i class="fas fa-building"></i>
              Abteilungen zuweisen
            </h3>
            <button class="ds-modal__close" data-action="close">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="ds-modal__body">
            <div class="card-accent card-accent--info mb-4">
              <div class="card-accent__body">
                <p>
                  <strong>Gruppe:</strong> Management Team
                </p>
              </div>
            </div>

            <div class="form-field">
              <label class="form-field__label" for="modal-departments">
                Abteilungen zuordnen
                <span class="text-red-500">*</span>
              </label>
              <select id="modal-departments" multiple class="multi-select" required>
                <option value="2801" selected>Stufenfertigung</option>
                <option value="2782">Testabteilung</option>
                <option value="2802" selected>Testgruppezwei</option>
                <option value="2803">Produktion Nord</option>
                <option value="2804">Produktion Süd</option>
                <option value="2805">Logistik</option>
                <option value="2806">Qualitätskontrolle</option>
              </select>
              <span class="multi-select__hint">
                <i class="fas fa-info-circle"></i>
                Halten Sie Strg/Cmd gedrückt für Mehrfachauswahl
              </span>
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
 * With Dynamic Content
 *
 * Shows how to handle dynamic option loading.
 */
export const WithDynamicContent = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.maxWidth = '500px';

    const select = document.createElement('select');
    select.id = 'departments-dynamic';
    select.multiple = true;
    select.className = 'multi-select';

    // Simulate loading departments
    const departments = [
      { id: 1, name: 'Produktion', active: true },
      { id: 2, name: 'Logistik', active: true },
      { id: 3, name: 'IT', active: false },
      { id: 4, name: 'Verwaltung', active: true },
      { id: 5, name: 'Qualitätssicherung', active: true },
    ];

    departments.forEach((dept) => {
      const option = document.createElement('option');
      option.value = dept.id;
      option.textContent = `${dept.name}${!dept.active ? ' (Inaktiv)' : ''}`;
      if (!dept.active) {
        option.disabled = true;
      }
      select.appendChild(option);
    });

    wrapper.innerHTML = `
      <div class="form-field">
        <label class="form-field__label" for="departments-dynamic">
          Aktive Abteilungen
        </label>
      </div>
    `;

    wrapper.querySelector('.form-field').appendChild(select);

    const hint = document.createElement('span');
    hint.className = 'multi-select__hint';
    hint.innerHTML = '<i class="fas fa-sync"></i> Dynamisch geladen aus API';
    wrapper.querySelector('.form-field').appendChild(hint);

    return wrapper;
  },
};

/**
 * Comparison: Multi-Select vs Choice Cards
 *
 * Shows when to use which component.
 */
export const ComparisonWithChoiceCards = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'grid';
    wrapper.style.gridTemplateColumns = '1fr 1fr';
    wrapper.style.gap = '32px';

    wrapper.innerHTML = `
      <div>
        <h3 style="color: var(--color-text-primary); margin-bottom: var(--spacing-2);">
          Multi-Select
        </h3>
        <p style="color: var(--color-text-secondary); font-size: 0.875rem; margin-bottom: var(--spacing-4);">
          ✅ 5-20 items<br>
          ✅ Simple text<br>
          ✅ Compact UI<br>
          ✅ Native scrolling
        </p>
        <div class="form-field">
          <select multiple class="multi-select multi-select--compact">
            <option value="1" selected>Produktion</option>
            <option value="2">Logistik</option>
            <option value="3">QS</option>
            <option value="4">IT</option>
            <option value="5">Verwaltung</option>
          </select>
        </div>
      </div>

      <div>
        <h3 style="color: var(--color-text-primary); margin-bottom: var(--spacing-2);">
          Choice Cards
        </h3>
        <p style="color: var(--color-text-secondary); font-size: 0.875rem; margin-bottom: var(--spacing-4);">
          ✅ 2-5 items<br>
          ✅ Rich content<br>
          ✅ Visual emphasis<br>
          ✅ Icons/descriptions
        </p>
        <div class="choice-group choice-group--compact">
          <label class="choice-card">
            <input type="checkbox" class="choice-card__input" checked>
            <span class="choice-card__text">Produktion</span>
          </label>
          <label class="choice-card">
            <input type="checkbox" class="choice-card__input">
            <span class="choice-card__text">Logistik</span>
          </label>
          <label class="choice-card">
            <input type="checkbox" class="choice-card__input">
            <span class="choice-card__text">QS</span>
          </label>
        </div>
      </div>
    `;

    return wrapper;
  },
};
