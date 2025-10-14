/**
 * Containers – Page Wrappers
 *
 * Glassmorphism containers für ganze Page-Bereiche.
 * Größer als Cards, für Login/Signup/Settings etc.
 */

export default {
  title: 'Design System/Containers',
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'assixx-dark',
    },
  },
  tags: ['autodocs'],
};

/**
 * Page Container
 *
 * Glassmorphism wrapper für Hauptsektionen.
 */
export const PageContainer = {
  args: {
    width: 'default',
    centered: true,
    compact: false,
    borderless: false,
  },
  argTypes: {
    width: {
      control: 'select',
      options: ['narrow', 'default', 'wide'],
      description: 'Container width (narrow=800px, default=1200px, wide=1600px)',
    },
    centered: {
      control: 'boolean',
      description: 'Center horizontally',
    },
    compact: {
      control: 'boolean',
      description: 'Reduced padding (24px)',
    },
    borderless: {
      control: 'boolean',
      description: 'Remove border',
    },
  },
  render: (args) => {
    const modifiers = [
      args.width === 'narrow' && 'page-container--narrow',
      args.width === 'wide' && 'page-container--wide',
      args.centered && 'page-container--centered',
      args.compact && 'page-container--compact',
      args.borderless && 'page-container--borderless',
    ]
      .filter(Boolean)
      .join(' ');

    const container = document.createElement('div');
    container.className = `page-container ${modifiers}`;

    const widthLabel =
      args.width === 'narrow' ? '800px' : args.width === 'wide' ? '1600px' : '1200px';

    container.innerHTML = `
      <h1 style="color: var(--color-text-primary); margin-bottom: var(--spacing-4);">
        Page Container
      </h1>
      <p style="color: var(--color-text-secondary); margin-bottom: var(--spacing-6);">
        Max-width: ${widthLabel} • ${args.centered ? 'Centered' : 'Not centered'}
        ${args.compact ? ' • Compact padding' : ''}
        ${args.borderless ? ' • No border' : ''}
      </p>
      <div class="card">
        <div class="card__header">
          <h2 class="card__title">Card Inside Container</h2>
        </div>
        <div class="card__body">
          <p style="color: var(--color-text-secondary);">
            Cards können innerhalb von Containern platziert werden.
          </p>
        </div>
      </div>
    `;

    return container;
  },
};

/**
 * Login/Signup Box
 *
 * Narrow container für Forms (800px).
 */
export const SignupBox = {
  render: () => {
    const container = document.createElement('div');
    container.className = 'page-container page-container--narrow page-container--centered';

    container.innerHTML = `
      <div style="text-align: center; margin-bottom: var(--spacing-8);">
        <h1 style="color: var(--color-text-primary); margin-bottom: var(--spacing-2);">
          Create Account
        </h1>
        <p style="color: var(--color-text-secondary);">
          Sign up for Assixx Enterprise
        </p>
      </div>

      <form style="display: grid; gap: var(--spacing-4);">
        <div class="form-field">
          <label class="form-field__label form-field__label--required" for="name">
            Full Name
          </label>
          <input
            type="text"
            id="name"
            class="form-field__control"
            placeholder="Max Mustermann"
          />
        </div>

        <div class="form-field">
          <label class="form-field__label form-field__label--required" for="email">
            Email
          </label>
          <input
            type="email"
            id="email"
            class="form-field__control"
            placeholder="max@firma.de"
          />
        </div>

        <div class="form-field">
          <label class="form-field__label form-field__label--required" for="password">
            Password
          </label>
          <input
            type="password"
            id="password"
            class="form-field__control"
            placeholder="••••••••"
          />
        </div>

        <button type="submit" class="btn btn-primary btn-block">
          <i class="fas fa-user-plus"></i>
          Sign Up
        </button>

        <p style="text-align: center; color: var(--color-text-secondary); font-size: 0.875rem; margin-top: var(--spacing-2);">
          Already have an account?
          <a href="#" style="color: var(--color-primary); text-decoration: none;">
            Login
          </a>
        </p>
      </form>
    `;

    return container;
  },
};

/**
 * Settings Page
 *
 * Default width container mit mehreren Cards.
 */
export const SettingsPage = {
  render: () => {
    const container = document.createElement('div');
    container.className = 'page-container page-container--centered';

    container.innerHTML = `
      <h1 style="color: var(--color-text-primary); margin-bottom: var(--spacing-6);">
        Account Settings
      </h1>

      <div class="card" style="margin-bottom: var(--spacing-6);">
        <div class="card__header">
          <h2 class="card__title">
            <i class="fas fa-user" style="margin-right: 8px;"></i>
            Profile
          </h2>
        </div>
        <div class="card__body">
          <div style="display: grid; gap: var(--spacing-4);">
            <div class="form-field">
              <label class="form-field__label" for="displayName">
                Display Name
              </label>
              <input
                type="text"
                id="displayName"
                class="form-field__control"
                value="Max Mustermann"
              />
            </div>
            <div class="form-field">
              <label class="form-field__label" for="email2">
                Email
              </label>
              <input
                type="email"
                id="email2"
                class="form-field__control"
                value="max@firma.de"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card__header">
          <h2 class="card__title">
            <i class="fas fa-lock" style="margin-right: 8px;"></i>
            Security
          </h2>
        </div>
        <div class="card__body">
          <button class="btn btn-secondary">
            <i class="fas fa-key"></i>
            Change Password
          </button>
        </div>
      </div>
    `;

    return container;
  },
};

/**
 * Container vs Card
 *
 * Zeigt den Unterschied zwischen Container und Card.
 */
export const ContainerVsCard = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'grid';
    wrapper.style.gap = '32px';

    wrapper.innerHTML = `
      <div>
        <h3 style="color: var(--color-text-primary); margin-bottom: 16px;">
          ✅ Container (Ganze Seite)
        </h3>
        <div class="page-container page-container--narrow">
          <h2 style="color: var(--color-text-primary); margin-bottom: 12px;">
            Login
          </h2>
          <p style="color: var(--color-text-secondary); font-size: 0.875rem;">
            Max-width: 800px • Padding: 28px 40px • Für ganze Page-Bereiche
          </p>
        </div>
      </div>

      <div>
        <h3 style="color: var(--color-text-primary); margin-bottom: 16px;">
          ✅ Card (Content-Gruppierung)
        </h3>
        <div class="card" style="max-width: 400px;">
          <div class="card__header">
            <h2 class="card__title">Dashboard Widget</h2>
          </div>
          <div class="card__body">
            <p style="color: var(--color-text-secondary); font-size: 0.875rem;">
              Padding: 24px • Für Content-Gruppierung INNERHALB von Containern
            </p>
          </div>
        </div>
      </div>
    `;

    return wrapper;
  },
};
