/**
 * Cards – Glassmorphism Containers
 *
 * Container components for grouping content.
 */

export default {
  title: 'Design System/Cards',

  parameters: {
    layout: 'padded',
  },

  tags: ['autodocs'],

  argTypes: {
    clickable: {
      control: 'boolean',
      description: 'Makes card interactive with hover effects',
      table: { defaultValue: { summary: 'false' } },
    },
    compact: {
      control: 'boolean',
      description: 'Reduces padding from 24px to 16px',
      table: { defaultValue: { summary: 'false' } },
    },
    variant: {
      control: 'select',
      options: ['default', 'success', 'warning', 'danger'],
      description: 'Color variant for stat/accent cards',
      table: { defaultValue: { summary: 'default' } },
    },
    hasHeader: {
      control: 'boolean',
      description: 'Show card header',
      table: { defaultValue: { summary: 'true' } },
    },
    hasFooter: {
      control: 'boolean',
      description: 'Show card footer',
      table: { defaultValue: { summary: 'false' } },
    },
  },

  globals: {
    backgrounds: {
      value: 'assixx-dark',
    },
  },
};

/**
 * Base Card
 *
 * Foundation card with header, body, footer structure.
 */
export const BaseCard = {
  args: {
    clickable: false,
    compact: false,
    hasHeader: true,
    hasFooter: true,
  },
  render: (args) => {
    const container = document.createElement('div');
    container.style.maxWidth = '600px';

    const cardClasses = [
      'card',
      args.clickable ? 'card--clickable' : '',
      args.compact ? 'card--compact' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const headerHTML =
      args.hasHeader ?
        `
      <div class="card__header">
        <h2 class="card__title">
          <i class="fas fa-users" style="margin-right: 8px;"></i>
          Mitarbeiter Übersicht
        </h2>
      </div>`
      : '';

    const footerHTML =
      args.hasFooter ?
        `
      <div class="card__footer">
        <p style="color: var(--color-text-secondary); font-size: 0.875rem;">
          Zuletzt aktualisiert: Vor 5 Minuten
        </p>
      </div>`
      : '';

    container.innerHTML = `
      <div class="${cardClasses}">
        ${headerHTML}
        <div class="card__body">
          <p style="color: var(--color-text-secondary); margin-bottom: 16px;">
            Verwalten Sie alle Mitarbeiter, erstellen Sie neue Profile und bearbeiten Sie Berechtigungen.
          </p>
          <div style="display: flex; gap: 12px;">
            <button class="btn btn-primary">
              <i class="fas fa-plus"></i>
              Hinzufügen
            </button>
            <button class="btn btn-cancel">
              <i class="fas fa-cog"></i>
              Einstellungen
            </button>
          </div>
        </div>
        ${footerHTML}
      </div>
    `;

    return container;
  },
};

/**
 * Stat Cards (KPI Metrics)
 *
 * For displaying statistics and key metrics.
 */
export const StatCards = {
  args: {
    variant: 'default',
    showIcon: true,
    value: '247',
    label: 'Mitarbeiter',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'success', 'warning', 'danger'],
    },
    showIcon: {
      control: 'boolean',
    },
    value: {
      control: 'text',
    },
    label: {
      control: 'text',
    },
  },
  render: (args) => {
    const container = document.createElement('div');
    container.style.maxWidth = '300px';

    const variantClass =
      args.variant !== 'default' ? `card-stat--${args.variant}` : '';
    const icons = {
      default: 'fa-users',
      success: 'fa-check-circle',
      warning: 'fa-exclamation-triangle',
      danger: 'fa-times-circle',
    };

    const iconHTML =
      args.showIcon ?
        `
      <div class="card-stat__icon">
        <i class="fas ${icons[args.variant]}"></i>
      </div>`
      : '';

    container.innerHTML = `
      <div class="card-stat ${variantClass}">
        ${iconHTML}
        <div class="card-stat__value">${args.value}</div>
        <div class="card-stat__label">${args.label}</div>
      </div>
    `;

    return container;
  },
};

/**
 * Accent Cards (Feature Cards)
 *
 * Cards with colored top indicator bar.
 */
export const AccentCards = {
  args: {
    variant: 'default',
    title: 'Schichtplanung',
    description: 'Verwalten Sie Schichtpläne für alle Abteilungen.',
    buttonText: 'Planer öffnen',
    icon: 'fa-calendar',
    isStatic: false,
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'success', 'warning', 'danger'],
      description: 'Color variant for top indicator bar',
    },
    title: {
      control: 'text',
      description: 'Card title',
    },
    description: {
      control: 'text',
      description: 'Card description text',
    },
    buttonText: {
      control: 'text',
      description: 'Button label',
    },
    icon: {
      control: 'text',
      description: 'FontAwesome icon class (without fa- prefix)',
    },
    isStatic: {
      control: 'boolean',
      description: 'Remove hover effects (non-clickable)',
      table: { defaultValue: { summary: 'false' } },
    },
  },
  render: (args) => {
    const container = document.createElement('div');
    container.style.maxWidth = '350px';

    const variantClass =
      args.variant !== 'default' ? `card-accent--${args.variant}` : '';
    const staticClass = args.isStatic ? 'card-accent--static' : '';

    container.innerHTML = `
      <div class="card-accent ${variantClass} ${staticClass}">
        <div class="card-accent__header">
          <h3 class="card-accent__title">
            <i class="fas ${args.icon}" style="color: var(--color-icon-primary);"></i>
            ${args.title}
          </h3>
        </div>
        <div class="card-accent__content">
          <p style="color: var(--color-text-secondary); margin-bottom: 12px;">
            ${args.description}
          </p>
          <div style="display: flex; justify-content: center; margin-top: var(--spacing-4);">
            <button class="btn btn-modal" style="width: 80%;">
              ${args.buttonText}
            </button>
          </div>
        </div>
      </div>
    `;

    return container;
  },
};

/**
 * Clickable Cards (Interactive)
 *
 * Cards that act as navigation elements.
 */
export const ClickableCards = {
  args: {
    icon: 'fa-file-alt',
    iconColor: 'var(--color-primary)',
    title: 'Dokumente',
    subtitle: '247 Dateien verfügbar',
    compact: false,
  },
  argTypes: {
    icon: {
      control: 'text',
      description: 'FontAwesome icon class',
    },
    iconColor: {
      control: 'color',
      description: 'Icon color',
    },
    title: {
      control: 'text',
      description: 'Card title',
    },
    subtitle: {
      control: 'text',
      description: 'Card subtitle/description',
    },
    compact: {
      control: 'boolean',
      description: 'Use compact padding',
      table: { defaultValue: { summary: 'false' } },
    },
  },
  render: (args) => {
    const container = document.createElement('div');
    container.style.maxWidth = '300px';

    const compactClass = args.compact ? 'card--compact' : '';

    container.innerHTML = `
      <div class="card card--clickable ${compactClass}">
        <div class="card__body">
          <i class="fas ${args.icon}" style="font-size: 2rem; color: ${args.iconColor}; margin-bottom: 12px;"></i>
          <h3 style="color: var(--color-text-primary); margin-bottom: 8px;">${args.title}</h3>
          <p style="color: var(--color-text-secondary); font-size: 0.875rem;">
            ${args.subtitle}
          </p>
        </div>
      </div>
    `;

    // Add click handler
    const card = container.querySelector('.card--clickable');
    card.addEventListener('click', () => {
      alert(`Navigiere zu: ${args.title}`);
    });

    return container;
  },
};

/**
 * Card Variants Comparison
 *
 * Shows all card variants side by side.
 */
export const AllVariants = {
  args: {
    showBaseCard: true,
    showStatCard: true,
    showAccentCard: true,
    showCompactCard: true,
  },
  argTypes: {
    showBaseCard: {
      control: 'boolean',
      description: 'Show Base Card variant',
      table: { defaultValue: { summary: 'true' } },
    },
    showStatCard: {
      control: 'boolean',
      description: 'Show Stat Card variants',
      table: { defaultValue: { summary: 'true' } },
    },
    showAccentCard: {
      control: 'boolean',
      description: 'Show Accent Card variant',
      table: { defaultValue: { summary: 'true' } },
    },
    showCompactCard: {
      control: 'boolean',
      description: 'Show Compact Card variant',
      table: { defaultValue: { summary: 'true' } },
    },
  },
  render: (args) => {
    const container = document.createElement('div');
    container.style.display = 'grid';
    container.style.gap = '32px';

    let html = '';

    if (args.showBaseCard) {
      html += `
        <div>
          <h3 style="color: var(--color-text-primary); margin-bottom: 16px; font-size: 1rem;">
            Base Card
          </h3>
          <div class="card">
            <div class="card__header">
              <h4 class="card__title">Standard Container</h4>
            </div>
            <div class="card__body">
              <p style="color: var(--color-text-secondary);">
                Use für allgemeine Content-Gruppierung.
              </p>
            </div>
          </div>
        </div>
      `;
    }

    if (args.showStatCard) {
      html += `
        <div>
          <h3 style="color: var(--color-text-primary); margin-bottom: 16px; font-size: 1rem;">
            Stat Card (KPI Metrics)
          </h3>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
            <div class="card-stat">
              <div class="card-stat__value">247</div>
              <div class="card-stat__label">Total</div>
            </div>
            <div class="card-stat card-stat--success">
              <div class="card-stat__value">94%</div>
              <div class="card-stat__label">Success</div>
            </div>
            <div class="card-stat card-stat--danger">
              <div class="card-stat__value">3</div>
              <div class="card-stat__label">Errors</div>
            </div>
          </div>
        </div>
      `;
    }

    if (args.showAccentCard) {
      html += `
        <div>
          <h3 style="color: var(--color-text-primary); margin-bottom: 16px; font-size: 1rem;">
            Accent Card (Feature Modules)
          </h3>
          <div class="card-accent card-accent--static">
            <div class="card-accent__header">
              <h4 class="card-accent__title">
                <i class="fas fa-cube" style="color: var(--color-icon-primary);"></i>
                Mit Icon im Header
              </h4>
            </div>
            <div class="card-accent__content">
              <p style="color: var(--color-text-secondary);">
                Use für Feature Cards und Module mit konsistenter Icon-Farbe.
              </p>
            </div>
          </div>
        </div>
      `;
    }

    if (args.showCompactCard) {
      html += `
        <div>
          <h3 style="color: var(--color-text-primary); margin-bottom: 16px; font-size: 1rem;">
            Compact Card
          </h3>
          <div class="card card--compact">
            <div class="card__body">
              <p style="color: var(--color-text-secondary);">
                Weniger Padding für dichte Layouts.
              </p>
            </div>
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
    return container;
  },
};
