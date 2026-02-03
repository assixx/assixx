/**
 * Date/Time Pickers - Storybook Stories
 * Enhanced native HTML5 pickers with glassmorphism design
 */

export default {
  title: 'Design System/Pickers',

  parameters: {
    layout: 'padded',
  },
};

/**
 * Basic Date Picker
 */
export const DatePicker = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px; max-width: 400px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Date Picker</h3>

      <div class="date-picker">
        <i class="date-picker__icon fas fa-calendar"></i>
        <input type="date" class="date-picker__input" value="2025-10-06" />
      </div>
    </div>
  `;
  return wrapper;
};

/**
 * Basic Time Picker
 */
export const TimePicker = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px; max-width: 400px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Time Picker</h3>

      <div class="time-picker">
        <i class="time-picker__icon fas fa-clock"></i>
        <input type="time" class="time-picker__input" value="14:30" />
      </div>
    </div>
  `;
  return wrapper;
};

/**
 * Time Picker with 24h Indicator
 */
export const TimePicker24h = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px; max-width: 400px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Time Picker (24h)</h3>

      <div class="time-picker time-picker--24h">
        <i class="time-picker__icon fas fa-clock"></i>
        <input type="time" class="time-picker__input" value="08:00" />
      </div>
    </div>
  `;
  return wrapper;
};

/**
 * Date Picker - Size Variants
 */
export const DatePickerSizes = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Date Picker Sizes</h3>

      <div style="display: flex; flex-direction: column; gap: 16px; max-width: 400px;">
        <div>
          <label style="display: block; color: #9e9e9e; font-size: 13px; margin-bottom: 8px;">Small</label>
          <div class="date-picker date-picker--sm">
            <i class="date-picker__icon fas fa-calendar"></i>
            <input type="date" class="date-picker__input" value="2025-10-06" />
          </div>
        </div>

        <div>
          <label style="display: block; color: #9e9e9e; font-size: 13px; margin-bottom: 8px;">Medium (Default)</label>
          <div class="date-picker">
            <i class="date-picker__icon fas fa-calendar"></i>
            <input type="date" class="date-picker__input" value="2025-10-06" />
          </div>
        </div>

        <div>
          <label style="display: block; color: #9e9e9e; font-size: 13px; margin-bottom: 8px;">Large</label>
          <div class="date-picker date-picker--lg">
            <i class="date-picker__icon fas fa-calendar"></i>
            <input type="date" class="date-picker__input" value="2025-10-06" />
          </div>
        </div>
      </div>
    </div>
  `;
  return wrapper;
};

/**
 * Date Picker - State Variants
 */
export const DatePickerStates = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Date Picker States</h3>

      <div style="display: flex; flex-direction: column; gap: 16px; max-width: 400px;">
        <div>
          <label style="display: block; color: #9e9e9e; font-size: 13px; margin-bottom: 8px;">Default</label>
          <div class="date-picker">
            <i class="date-picker__icon fas fa-calendar"></i>
            <input type="date" class="date-picker__input" value="2025-10-06" />
          </div>
        </div>

        <div>
          <label style="display: block; color: #9e9e9e; font-size: 13px; margin-bottom: 8px;">Success</label>
          <div class="date-picker date-picker--success">
            <i class="date-picker__icon fas fa-calendar"></i>
            <input type="date" class="date-picker__input" value="2025-12-25" />
          </div>
          <span style="display: block; margin-top: 6px; font-size: 13px; color: #4caf50;">
            <i class="fas fa-check-circle"></i> Datum gültig
          </span>
        </div>

        <div>
          <label style="display: block; color: #9e9e9e; font-size: 13px; margin-bottom: 8px;">Warning</label>
          <div class="date-picker date-picker--warning">
            <i class="date-picker__icon fas fa-calendar"></i>
            <input type="date" class="date-picker__input" value="2026-06-15" />
          </div>
          <span style="display: block; margin-top: 6px; font-size: 13px; color: #ff9800;">
            <i class="fas fa-exclamation-triangle"></i> Datum liegt weit in der Zukunft
          </span>
        </div>

        <div>
          <label style="display: block; color: #9e9e9e; font-size: 13px; margin-bottom: 8px;">Error</label>
          <div class="date-picker date-picker--error">
            <i class="date-picker__icon fas fa-calendar"></i>
            <input type="date" class="date-picker__input" value="2024-01-01" />
          </div>
          <span style="display: block; margin-top: 6px; font-size: 13px; color: #f44336;">
            <i class="fas fa-times-circle"></i> Bitte wählen Sie ein Datum in der Zukunft
          </span>
        </div>

        <div>
          <label style="display: block; color: #9e9e9e; font-size: 13px; margin-bottom: 8px;">Disabled</label>
          <div class="date-picker date-picker--disabled">
            <i class="date-picker__icon fas fa-calendar"></i>
            <input type="date" class="date-picker__input" value="2025-10-06" disabled />
          </div>
        </div>
      </div>
    </div>
  `;
  return wrapper;
};

/**
 * Date Range - Horizontal
 */
export const DateRangeHorizontal = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Date Range (Horizontal)</h3>

      <div class="date-range" style="max-width: 600px;">
        <div class="date-picker">
          <i class="date-picker__icon fas fa-calendar"></i>
          <input type="date" class="date-picker__input" value="2025-10-01" />
        </div>
        <span class="date-range__separator">bis</span>
        <div class="date-picker">
          <i class="date-picker__icon fas fa-calendar"></i>
          <input type="date" class="date-picker__input" value="2025-10-31" />
        </div>
      </div>
    </div>
  `;
  return wrapper;
};

/**
 * Date Range - Vertical
 */
export const DateRangeVertical = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Date Range (Vertical)</h3>

      <div class="date-range date-range--vertical" style="max-width: 400px;">
        <div class="date-picker">
          <i class="date-picker__icon fas fa-calendar"></i>
          <input type="date" class="date-picker__input" value="2025-10-01" />
        </div>
        <span class="date-range__separator">bis</span>
        <div class="date-picker">
          <i class="date-picker__icon fas fa-calendar"></i>
          <input type="date" class="date-picker__input" value="2025-10-31" />
        </div>
      </div>
    </div>
  `;
  return wrapper;
};

/**
 * Date Range - Arrow Separator
 */
export const DateRangeArrow = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Date Range (Arrow)</h3>

      <div class="date-range date-range--arrow" style="max-width: 600px;">
        <div class="date-picker">
          <i class="date-picker__icon fas fa-calendar"></i>
          <input type="date" class="date-picker__input" value="2025-10-01" />
        </div>
        <span class="date-range__separator">→</span>
        <div class="date-picker">
          <i class="date-picker__icon fas fa-calendar"></i>
          <input type="date" class="date-picker__input" value="2025-10-31" />
        </div>
      </div>
    </div>
  `;
  return wrapper;
};

/**
 * Date Range - Compact
 */
export const DateRangeCompact = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Date Range (Compact)</h3>

      <div class="date-range date-range--compact" style="max-width: 500px;">
        <div class="date-picker date-picker--sm">
          <i class="date-picker__icon fas fa-calendar"></i>
          <input type="date" class="date-picker__input" value="2025-10-01" />
        </div>
        <span class="date-range__separator">→</span>
        <div class="date-picker date-picker--sm">
          <i class="date-picker__icon fas fa-calendar"></i>
          <input type="date" class="date-picker__input" value="2025-10-31" />
        </div>
      </div>
    </div>
  `;
  return wrapper;
};

/**
 * With Form Field Integration
 */
export const WithFormField = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px; max-width: 500px;">
      <h3 style="color: #fff; margin-bottom: 24px;">With Form Field</h3>

      <div style="display: flex; flex-direction: column; gap: 20px;">
        <!-- Date Picker with Label -->
        <div class="form-field">
          <label class="form-field__label" for="birth-date">
            Geburtsdatum <span style="color: #f44336;">*</span>
          </label>
          <div class="date-picker">
            <i class="date-picker__icon fas fa-calendar"></i>
            <input type="date" id="birth-date" class="date-picker__input" value="1990-05-15" required />
          </div>
          <span class="form-field__hint">
            Ihr Geburtsdatum wird für die Altersverifikation benötigt
          </span>
        </div>

        <!-- Time Picker with Label -->
        <div class="form-field">
          <label class="form-field__label" for="shift-start">
            Schichtbeginn <span style="color: #f44336;">*</span>
          </label>
          <div class="time-picker time-picker--24h">
            <i class="time-picker__icon fas fa-clock"></i>
            <input type="time" id="shift-start" class="time-picker__input" value="06:00" required />
          </div>
          <span class="form-field__hint">
            Beginn der Frühschicht
          </span>
        </div>
      </div>
    </div>
  `;
  return wrapper;
};

/**
 * Real-World Example: Shift Creation
 */
export const ShiftCreation = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <div class="card" style="max-width: 600px;">
        <div class="card__header">
          <h3 class="card__title">
            <i class="fas fa-calendar-plus"></i> Neue Schicht erstellen
          </h3>
        </div>
        <div class="card__body">
          <div style="display: flex; flex-direction: column; gap: 20px;">
            <!-- Date -->
            <div class="form-field">
              <label class="form-field__label" for="shift-date">
                Schichtdatum <span style="color: #f44336;">*</span>
              </label>
              <div class="date-picker">
                <i class="date-picker__icon fas fa-calendar"></i>
                <input type="date" id="shift-date" class="date-picker__input" value="2025-10-15" required />
              </div>
            </div>

            <!-- Time Range -->
            <div class="form-field">
              <label class="form-field__label">
                Arbeitszeit <span style="color: #f44336;">*</span>
              </label>
              <div style="display: flex; gap: 12px; align-items: center;">
                <div class="time-picker time-picker--24h" style="flex: 1;">
                  <i class="time-picker__icon fas fa-clock"></i>
                  <input type="time" class="time-picker__input" value="06:00" required />
                </div>
                <span style="color: #9e9e9e;">bis</span>
                <div class="time-picker time-picker--24h" style="flex: 1;">
                  <i class="time-picker__icon fas fa-clock"></i>
                  <input type="time" class="time-picker__input" value="14:00" required />
                </div>
              </div>
              <span class="form-field__hint">
                Frühschicht: 06:00 - 14:00 Uhr
              </span>
            </div>
          </div>
        </div>
        <div class="card__footer" style="display: flex; justify-content: flex-end; gap: 12px;">
          <button class="btn btn-cancel">Abbrechen</button>
          <button class="btn btn-primary">Schicht erstellen</button>
        </div>
      </div>
    </div>
  `;
  return wrapper;
};

/**
 * Real-World Example: Feature Activation
 */
export const FeatureActivation = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <div class="card" style="max-width: 700px;">
        <div class="card__header">
          <h3 class="card__title">
            <i class="fas fa-toggle-on"></i> Feature Aktivierung
          </h3>
        </div>
        <div class="card__body">
          <div style="display: flex; flex-direction: column; gap: 20px;">
            <!-- Feature Name -->
            <div class="form-field">
              <label class="form-field__label" for="feature-name">
                Feature Name
              </label>
              <input type="text" id="feature-name" class="form-control" value="Urlaubsplaner" readonly />
            </div>

            <!-- Activation Period -->
            <div class="form-field">
              <label class="form-field__label">
                Aktivierungszeitraum <span style="color: #f44336;">*</span>
              </label>
              <div class="date-range">
                <div class="date-picker">
                  <i class="date-picker__icon fas fa-calendar"></i>
                  <input type="date" class="date-picker__input" value="2025-01-01" required />
                </div>
                <span class="date-range__separator">bis</span>
                <div class="date-picker">
                  <i class="date-picker__icon fas fa-calendar"></i>
                  <input type="date" class="date-picker__input" value="2025-12-31" required />
                </div>
              </div>
              <span class="form-field__hint">
                Feature wird nur in diesem Zeitraum für Mitarbeiter verfügbar sein
              </span>
            </div>
          </div>
        </div>
        <div class="card__footer" style="display: flex; justify-content: space-between; align-items: center;">
          <span class="badge badge--warning">
            <i class="fas fa-exclamation-triangle"></i> Kostenpflichtig
          </span>
          <div style="display: flex; gap: 12px;">
            <button class="btn btn-cancel">Abbrechen</button>
            <button class="btn btn-primary">Feature aktivieren</button>
          </div>
        </div>
      </div>
    </div>
  `;
  return wrapper;
};

/**
 * Real-World Example: Calendar Event
 */
export const CalendarEvent = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <div class="card" style="max-width: 700px;">
        <div class="card__header">
          <h3 class="card__title">
            <i class="fas fa-calendar-day"></i> Neues Event erstellen
          </h3>
        </div>
        <div class="card__body">
          <div style="display: flex; flex-direction: column; gap: 20px;">
            <!-- Event Title -->
            <div class="form-field">
              <label class="form-field__label" for="event-title">
                Event Titel <span style="color: #f44336;">*</span>
              </label>
              <input type="text" id="event-title" class="form-control" placeholder="z.B. Teambesprechung" required />
            </div>

            <!-- Start Date & Time -->
            <div class="form-field">
              <label class="form-field__label">
                Start <span style="color: #f44336;">*</span>
              </label>
              <div style="display: flex; gap: 12px;">
                <div class="date-picker" style="flex: 2;">
                  <i class="date-picker__icon fas fa-calendar"></i>
                  <input type="date" class="date-picker__input" value="2025-10-15" required />
                </div>
                <div class="time-picker" style="flex: 1;">
                  <i class="time-picker__icon fas fa-clock"></i>
                  <input type="time" class="time-picker__input" value="09:00" required />
                </div>
              </div>
            </div>

            <!-- End Date & Time -->
            <div class="form-field">
              <label class="form-field__label">
                Ende <span style="color: #f44336;">*</span>
              </label>
              <div style="display: flex; gap: 12px;">
                <div class="date-picker" style="flex: 2;">
                  <i class="date-picker__icon fas fa-calendar"></i>
                  <input type="date" class="date-picker__input" value="2025-10-15" required />
                </div>
                <div class="time-picker" style="flex: 1;">
                  <i class="time-picker__icon fas fa-clock"></i>
                  <input type="time" class="time-picker__input" value="10:00" required />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="card__footer" style="display: flex; justify-content: flex-end; gap: 12px;">
          <button class="btn btn-cancel">Abbrechen</button>
          <button class="btn btn-primary">Event erstellen</button>
        </div>
      </div>
    </div>
  `;
  return wrapper;
};

/**
 * Without Icons
 */
export const WithoutIcons = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Pickers Without Icons</h3>

      <div style="display: flex; flex-direction: column; gap: 16px; max-width: 400px;">
        <div class="date-picker date-picker--no-icon">
          <input type="date" class="date-picker__input" value="2025-10-06" />
        </div>

        <div class="time-picker time-picker--no-icon">
          <input type="time" class="time-picker__input" value="14:30" />
        </div>
      </div>
    </div>
  `;
  return wrapper;
};
