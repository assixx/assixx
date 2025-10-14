/**
 * Toggle Switch – Binary ON/OFF Controls
 *
 * iOS-style switches for settings, features, and binary states.
 * Uses native checkbox with glassmorphism styling.
 */

export default {
  title: 'Design System/Toggle Switch',
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'assixx-dark',
    },
  },
  tags: ['autodocs'],
};

/**
 * Default Toggle Switch
 *
 * Standard ON/OFF switch with label.
 */
export const Default = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.padding = '40px';
    wrapper.innerHTML = `
      <label class="toggle-switch">
        <input type="checkbox" class="toggle-switch__input" />
        <span class="toggle-switch__slider"></span>
        <span class="toggle-switch__label">Enable notifications</span>
      </label>
    `;

    return wrapper;
  },
};

/**
 * Checked State
 *
 * Switch in ON position.
 */
export const Checked = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.padding = '40px';
    wrapper.innerHTML = `
      <label class="toggle-switch">
        <input type="checkbox" class="toggle-switch__input" checked />
        <span class="toggle-switch__slider"></span>
        <span class="toggle-switch__label">Notifications enabled</span>
      </label>
    `;

    return wrapper;
  },
};

/**
 * Size Variants
 *
 * Small, medium (default), and large sizes.
 */
export const Sizes = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.padding = '40px';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = 'var(--spacing-6)';
    wrapper.innerHTML = `
      <div>
        <h3 style="color: var(--color-text-secondary); margin-bottom: var(--spacing-3); font-size: 0.875rem;">
          Small
        </h3>
        <label class="toggle-switch toggle-switch--sm">
          <input type="checkbox" class="toggle-switch__input" />
          <span class="toggle-switch__slider"></span>
          <span class="toggle-switch__label">Small switch</span>
        </label>
      </div>

      <div>
        <h3 style="color: var(--color-text-secondary); margin-bottom: var(--spacing-3); font-size: 0.875rem;">
          Medium (Default)
        </h3>
        <label class="toggle-switch">
          <input type="checkbox" class="toggle-switch__input" checked />
          <span class="toggle-switch__slider"></span>
          <span class="toggle-switch__label">Medium switch</span>
        </label>
      </div>

      <div>
        <h3 style="color: var(--color-text-secondary); margin-bottom: var(--spacing-3); font-size: 0.875rem;">
          Large
        </h3>
        <label class="toggle-switch toggle-switch--lg">
          <input type="checkbox" class="toggle-switch__input" />
          <span class="toggle-switch__slider"></span>
          <span class="toggle-switch__label">Large switch</span>
        </label>
      </div>
    `;

    return wrapper;
  },
};

/**
 * Color Variants
 *
 * Primary (default), success, danger, and warning.
 */
export const Colors = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.padding = '40px';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = 'var(--spacing-5)';
    wrapper.innerHTML = `
      <div>
        <h3 style="color: var(--color-text-secondary); margin-bottom: var(--spacing-3); font-size: 0.875rem;">
          Primary (Default)
        </h3>
        <label class="toggle-switch">
          <input type="checkbox" class="toggle-switch__input" checked />
          <span class="toggle-switch__slider"></span>
          <span class="toggle-switch__label">Primary color</span>
        </label>
      </div>

      <div>
        <h3 style="color: var(--color-text-secondary); margin-bottom: var(--spacing-3); font-size: 0.875rem;">
          Success
        </h3>
        <label class="toggle-switch toggle-switch--success">
          <input type="checkbox" class="toggle-switch__input" checked />
          <span class="toggle-switch__slider"></span>
          <span class="toggle-switch__label">Feature activated</span>
        </label>
      </div>

      <div>
        <h3 style="color: var(--color-text-secondary); margin-bottom: var(--spacing-3); font-size: 0.875rem;">
          Danger
        </h3>
        <label class="toggle-switch toggle-switch--danger">
          <input type="checkbox" class="toggle-switch__input" checked />
          <span class="toggle-switch__slider"></span>
          <span class="toggle-switch__label">Debug mode enabled</span>
        </label>
      </div>

      <div>
        <h3 style="color: var(--color-text-secondary); margin-bottom: var(--spacing-3); font-size: 0.875rem;">
          Warning
        </h3>
        <label class="toggle-switch toggle-switch--warning">
          <input type="checkbox" class="toggle-switch__input" checked />
          <span class="toggle-switch__slider"></span>
          <span class="toggle-switch__label">Test mode active</span>
        </label>
      </div>
    `;

    return wrapper;
  },
};

/**
 * Label Positions
 *
 * Label on right (default) or left.
 */
export const LabelPosition = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.padding = '40px';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = 'var(--spacing-5)';
    wrapper.innerHTML = `
      <div>
        <h3 style="color: var(--color-text-secondary); margin-bottom: var(--spacing-3); font-size: 0.875rem;">
          Label Right (Default)
        </h3>
        <label class="toggle-switch">
          <input type="checkbox" class="toggle-switch__input" checked />
          <span class="toggle-switch__slider"></span>
          <span class="toggle-switch__label">Email notifications</span>
        </label>
      </div>

      <div>
        <h3 style="color: var(--color-text-secondary); margin-bottom: var(--spacing-3); font-size: 0.875rem;">
          Label Left
        </h3>
        <label class="toggle-switch toggle-switch--label-left">
          <input type="checkbox" class="toggle-switch__input" checked />
          <span class="toggle-switch__slider"></span>
          <span class="toggle-switch__label">Push notifications</span>
        </label>
      </div>

      <div>
        <h3 style="color: var(--color-text-secondary); margin-bottom: var(--spacing-3); font-size: 0.875rem;">
          No Label
        </h3>
        <label class="toggle-switch toggle-switch--no-label">
          <input type="checkbox" class="toggle-switch__input" checked />
          <span class="toggle-switch__slider"></span>
          <span class="toggle-switch__label">Hidden label</span>
        </label>
      </div>
    `;

    return wrapper;
  },
};

/**
 * Disabled State
 *
 * Switches in disabled state (both ON and OFF).
 */
export const Disabled = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.padding = '40px';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = 'var(--spacing-5)';
    wrapper.innerHTML = `
      <div>
        <h3 style="color: var(--color-text-secondary); margin-bottom: var(--spacing-3); font-size: 0.875rem;">
          Disabled OFF
        </h3>
        <label class="toggle-switch">
          <input type="checkbox" class="toggle-switch__input" disabled />
          <span class="toggle-switch__slider"></span>
          <span class="toggle-switch__label">Cannot be changed</span>
        </label>
      </div>

      <div>
        <h3 style="color: var(--color-text-secondary); margin-bottom: var(--spacing-3); font-size: 0.875rem;">
          Disabled ON
        </h3>
        <label class="toggle-switch">
          <input type="checkbox" class="toggle-switch__input" checked disabled />
          <span class="toggle-switch__slider"></span>
          <span class="toggle-switch__label">Always enabled</span>
        </label>
      </div>
    `;

    return wrapper;
  },
};

/**
 * Settings Panel Example
 *
 * Real-world usage in a settings panel.
 */
export const SettingsPanel = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.padding = '40px';
    wrapper.innerHTML = `
      <div class="card" style="max-width: 500px;">
        <div class="card__header">
          <h3 class="card__title">
            <i class="fas fa-cog"></i>
            Notification Settings
          </h3>
        </div>
        <div class="card__body" style="display: flex; flex-direction: column; gap: var(--spacing-5);">

          <div style="display: flex; flex-direction: column; gap: var(--spacing-2);">
            <label class="toggle-switch">
              <input type="checkbox" class="toggle-switch__input" checked />
              <span class="toggle-switch__slider"></span>
              <span class="toggle-switch__label">Email notifications</span>
            </label>
            <small style="color: var(--color-text-secondary); margin-left: 64px;">
              Receive updates via email
            </small>
          </div>

          <div style="display: flex; flex-direction: column; gap: var(--spacing-2);">
            <label class="toggle-switch toggle-switch--success">
              <input type="checkbox" class="toggle-switch__input" checked />
              <span class="toggle-switch__slider"></span>
              <span class="toggle-switch__label">Push notifications</span>
            </label>
            <small style="color: var(--color-text-secondary); margin-left: 64px;">
              Get instant alerts on your device
            </small>
          </div>

          <div style="display: flex; flex-direction: column; gap: var(--spacing-2);">
            <label class="toggle-switch">
              <input type="checkbox" class="toggle-switch__input" />
              <span class="toggle-switch__slider"></span>
              <span class="toggle-switch__label">SMS notifications</span>
            </label>
            <small style="color: var(--color-text-secondary); margin-left: 64px;">
              Receive text messages for critical updates
            </small>
          </div>

          <hr style="border: none; border-top: 1px solid rgba(255, 255, 255, 0.1); margin: var(--spacing-2) 0;" />

          <div style="display: flex; flex-direction: column; gap: var(--spacing-2);">
            <label class="toggle-switch toggle-switch--warning">
              <input type="checkbox" class="toggle-switch__input" />
              <span class="toggle-switch__slider"></span>
              <span class="toggle-switch__label">Marketing emails</span>
            </label>
            <small style="color: var(--color-text-secondary); margin-left: 64px;">
              Receive promotional offers and updates
            </small>
          </div>

        </div>
      </div>
    `;

    return wrapper;
  },
};

/**
 * Feature Toggles Example
 *
 * Admin panel feature activation.
 */
export const FeatureToggles = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.padding = '40px';
    wrapper.innerHTML = `
      <div class="card" style="max-width: 600px;">
        <div class="card__header">
          <h3 class="card__title">
            <i class="fas fa-toggle-on"></i>
            Feature Flags
          </h3>
        </div>
        <div class="card__body">
          <div style="display: grid; gap: var(--spacing-5);">

            <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--spacing-3); background: rgba(255, 255, 255, 0.02); border-radius: 8px;">
              <div>
                <div style="color: var(--color-text-primary); font-weight: 500; margin-bottom: var(--spacing-1);">
                  Chat System
                </div>
                <small style="color: var(--color-text-secondary);">
                  Real-time messaging for users
                </small>
              </div>
              <label class="toggle-switch toggle-switch--success toggle-switch--no-label">
                <input type="checkbox" class="toggle-switch__input" checked />
                <span class="toggle-switch__slider"></span>
                <span class="toggle-switch__label">Chat enabled</span>
              </label>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--spacing-3); background: rgba(255, 255, 255, 0.02); border-radius: 8px;">
              <div>
                <div style="color: var(--color-text-primary); font-weight: 500; margin-bottom: var(--spacing-1);">
                  File Sharing
                </div>
                <small style="color: var(--color-text-secondary);">
                  Allow users to upload and share files
                </small>
              </div>
              <label class="toggle-switch toggle-switch--no-label">
                <input type="checkbox" class="toggle-switch__input" checked />
                <span class="toggle-switch__slider"></span>
                <span class="toggle-switch__label">File sharing enabled</span>
              </label>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--spacing-3); background: rgba(255, 255, 255, 0.02); border-radius: 8px;">
              <div>
                <div style="color: var(--color-text-primary); font-weight: 500; margin-bottom: var(--spacing-1);">
                  Advanced Analytics
                </div>
                <small style="color: var(--color-text-secondary);">
                  Detailed usage statistics and insights
                </small>
              </div>
              <label class="toggle-switch toggle-switch--no-label">
                <input type="checkbox" class="toggle-switch__input" />
                <span class="toggle-switch__slider"></span>
                <span class="toggle-switch__label">Analytics enabled</span>
              </label>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--spacing-3); background: rgba(255, 255, 255, 0.02); border-radius: 8px;">
              <div>
                <div style="color: var(--color-text-primary); font-weight: 500; margin-bottom: var(--spacing-1);">
                  Beta Features
                </div>
                <small style="color: var(--color-text-secondary);">
                  <i class="fas fa-exclamation-triangle" style="color: var(--color-warning);"></i>
                  Experimental and unstable
                </small>
              </div>
              <label class="toggle-switch toggle-switch--warning toggle-switch--no-label">
                <input type="checkbox" class="toggle-switch__input" />
                <span class="toggle-switch__slider"></span>
                <span class="toggle-switch__label">Beta enabled</span>
              </label>
            </div>

          </div>
        </div>
      </div>
    `;

    return wrapper;
  },
};

/**
 * All Variants Overview
 *
 * Complete showcase of all variations.
 */
export const AllVariants = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.padding = '40px';
    wrapper.style.display = 'grid';
    wrapper.style.gap = 'var(--spacing-8)';
    wrapper.innerHTML = `
      <!-- Sizes -->
      <div>
        <h2 style="color: var(--color-text-primary); margin-bottom: var(--spacing-4);">Sizes</h2>
        <div style="display: flex; flex-direction: column; gap: var(--spacing-4);">
          <label class="toggle-switch toggle-switch--sm">
            <input type="checkbox" class="toggle-switch__input" checked />
            <span class="toggle-switch__slider"></span>
            <span class="toggle-switch__label">Small</span>
          </label>
          <label class="toggle-switch">
            <input type="checkbox" class="toggle-switch__input" checked />
            <span class="toggle-switch__slider"></span>
            <span class="toggle-switch__label">Medium</span>
          </label>
          <label class="toggle-switch toggle-switch--lg">
            <input type="checkbox" class="toggle-switch__input" checked />
            <span class="toggle-switch__slider"></span>
            <span class="toggle-switch__label">Large</span>
          </label>
        </div>
      </div>

      <!-- Colors -->
      <div>
        <h2 style="color: var(--color-text-primary); margin-bottom: var(--spacing-4);">Colors</h2>
        <div style="display: flex; flex-direction: column; gap: var(--spacing-4);">
          <label class="toggle-switch">
            <input type="checkbox" class="toggle-switch__input" checked />
            <span class="toggle-switch__slider"></span>
            <span class="toggle-switch__label">Primary</span>
          </label>
          <label class="toggle-switch toggle-switch--success">
            <input type="checkbox" class="toggle-switch__input" checked />
            <span class="toggle-switch__slider"></span>
            <span class="toggle-switch__label">Success</span>
          </label>
          <label class="toggle-switch toggle-switch--danger">
            <input type="checkbox" class="toggle-switch__input" checked />
            <span class="toggle-switch__slider"></span>
            <span class="toggle-switch__label">Danger</span>
          </label>
          <label class="toggle-switch toggle-switch--warning">
            <input type="checkbox" class="toggle-switch__input" checked />
            <span class="toggle-switch__slider"></span>
            <span class="toggle-switch__label">Warning</span>
          </label>
        </div>
      </div>

      <!-- States -->
      <div>
        <h2 style="color: var(--color-text-primary); margin-bottom: var(--spacing-4);">States</h2>
        <div style="display: flex; flex-direction: column; gap: var(--spacing-4);">
          <label class="toggle-switch">
            <input type="checkbox" class="toggle-switch__input" />
            <span class="toggle-switch__slider"></span>
            <span class="toggle-switch__label">OFF</span>
          </label>
          <label class="toggle-switch">
            <input type="checkbox" class="toggle-switch__input" checked />
            <span class="toggle-switch__slider"></span>
            <span class="toggle-switch__label">ON</span>
          </label>
          <label class="toggle-switch">
            <input type="checkbox" class="toggle-switch__input" disabled />
            <span class="toggle-switch__slider"></span>
            <span class="toggle-switch__label">Disabled OFF</span>
          </label>
          <label class="toggle-switch">
            <input type="checkbox" class="toggle-switch__input" checked disabled />
            <span class="toggle-switch__slider"></span>
            <span class="toggle-switch__label">Disabled ON</span>
          </label>
        </div>
      </div>
    `;

    return wrapper;
  },
};
