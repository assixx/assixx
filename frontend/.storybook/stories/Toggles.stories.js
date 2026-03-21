/**
 * Toggles – Button Groups & Switches
 *
 * Mutually exclusive button groups for view modes, filters, and segmented controls.
 */

export default {
  title: 'Design System/Toggles',

  parameters: {
    layout: 'padded',
  },

  tags: ['autodocs'],

  argTypes: {
    withIcons: {
      control: 'boolean',
      description: 'Show icons in toggle buttons',
    },
    defaultActive: {
      control: 'number',
      description: 'Index of default active button (0-based)',
    },
  },
};

/**
 * Toggle Button Group - View Mode Example
 *
 * Use case: Document view modes (Active, Archived, All)
 * Pattern: Radio-like behavior - only one active at a time
 */
export const ViewModeToggle = {
  args: {
    withIcons: true,
    defaultActive: 0,
    buttonCount: 3,
  },
  argTypes: {
    withIcons: {
      control: 'boolean',
      description: 'Show icons in buttons',
    },
    defaultActive: {
      control: { type: 'range', min: 0, max: 2, step: 1 },
      description: 'Default active button (0 = Aktive, 1 = Archiviert, 2 = Alle)',
    },
    buttonCount: {
      control: { type: 'range', min: 2, max: 3, step: 1 },
      description: 'Number of buttons to show',
    },
  },
  render: (args) => {
    const container = document.createElement('div');

    const buttons = [
      { icon: 'fa-folder', label: 'Aktive', mode: 'active' },
      { icon: 'fa-archive', label: 'Archiviert', mode: 'archived' },
      { icon: 'fa-folder-open', label: 'Alle', mode: 'all' },
    ];

    const buttonsToShow = buttons.slice(0, args.buttonCount);

    container.innerHTML = `
      <h3 style="color: var(--color-text-primary); margin-bottom: 16px; font-size: 0.875rem;">
        Document View Mode
      </h3>
      <div class="toggle-group">
        ${buttonsToShow
          .map(
            (btn, index) => `
          <button class="toggle-group__btn ${index === args.defaultActive ? 'active' : ''}" data-mode="${btn.mode}">
            ${args.withIcons ? `<i class="fas ${btn.icon}"></i>` : ''}
            ${btn.label}
          </button>
        `,
          )
          .join('')}
      </div>
    `;

    // Add interactivity
    const group = container.querySelector('.toggle-group');
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('.toggle-group__btn');
      if (!btn) return;

      group.querySelectorAll('.toggle-group__btn').forEach((b) => {
        b.classList.remove('active');
      });
      btn.classList.add('active');
    });

    return container;
  },
};

/**
 * Toggle with Icons Only
 *
 * Compact version for toolbars and limited space
 */
export const IconOnlyToggle = {
  args: {
    defaultView: 'grid',
    showGridView: true,
    showListView: true,
    showTableView: true,
  },
  argTypes: {
    defaultView: {
      control: 'select',
      options: ['grid', 'list', 'table'],
      description: 'Default active view',
    },
    showGridView: {
      control: 'boolean',
      description: 'Show grid view option',
    },
    showListView: {
      control: 'boolean',
      description: 'Show list view option',
    },
    showTableView: {
      control: 'boolean',
      description: 'Show table view option',
    },
  },
  render: (args) => {
    const container = document.createElement('div');

    const views = [
      {
        icon: 'fa-th',
        view: 'grid',
        title: 'Grid View',
        show: args.showGridView,
      },
      {
        icon: 'fa-list',
        view: 'list',
        title: 'List View',
        show: args.showListView,
      },
      {
        icon: 'fa-table',
        view: 'table',
        title: 'Table View',
        show: args.showTableView,
      },
    ].filter((v) => v.show);

    container.innerHTML = `
      <h3 style="color: var(--color-text-primary); margin-bottom: 16px; font-size: 0.875rem;">
        View Type (Icons Only)
      </h3>
      <div class="toggle-group">
        ${views
          .map(
            (v) => `
          <button class="toggle-group__btn ${v.view === args.defaultView ? 'active' : ''}" data-view="${v.view}" title="${v.title}">
            <i class="fas ${v.icon}"></i>
          </button>
        `,
          )
          .join('')}
      </div>
    `;

    // Add interactivity
    const group = container.querySelector('.toggle-group');
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('.toggle-group__btn');
      if (!btn) return;

      group.querySelectorAll('.toggle-group__btn').forEach((b) => {
        b.classList.remove('active');
      });
      btn.classList.add('active');
    });

    return container;
  },
};

/**
 * Disabled State
 *
 * Shows how disabled buttons look
 */
export const WithDisabled = {
  args: {
    withIcons: true,
    disableEnterprise: true,
    defaultPlan: 'free',
  },
  argTypes: {
    withIcons: {
      control: 'boolean',
      description: 'Show icons in buttons',
    },
    disableEnterprise: {
      control: 'boolean',
      description: 'Disable Enterprise option',
    },
    defaultPlan: {
      control: 'select',
      options: ['free', 'pro', 'enterprise'],
      description: 'Default selected plan',
    },
  },
  render: (args) => {
    const container = document.createElement('div');

    const plans = [
      { icon: 'fa-gift', label: 'Free', plan: 'free' },
      { icon: 'fa-star', label: 'Pro', plan: 'pro' },
      { icon: 'fa-building', label: 'Enterprise', plan: 'enterprise' },
    ];

    container.innerHTML = `
      <h3 style="color: var(--color-text-primary); margin-bottom: 16px; font-size: 0.875rem;">
        With Disabled Options
      </h3>
      <div class="toggle-group">
        ${plans
          .map(
            (p) => `
          <button class="toggle-group__btn ${p.plan === args.defaultPlan ? 'active' : ''}"
                  data-plan="${p.plan}"
                  ${p.plan === 'enterprise' && args.disableEnterprise ? 'disabled' : ''}>
            ${args.withIcons ? `<i class="fas ${p.icon}"></i>` : ''}
            ${p.label}
          </button>
        `,
          )
          .join('')}
      </div>
      ${args.disableEnterprise ? '<p style="color: var(--color-text-secondary); font-size: 0.75rem; margin-top: 8px;">Enterprise plan coming soon</p>' : ''}
    `;

    // Add interactivity
    const group = container.querySelector('.toggle-group');
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('.toggle-group__btn');
      if (!btn || btn.disabled) return;

      group.querySelectorAll('.toggle-group__btn').forEach((b) => {
        b.classList.remove('active');
      });
      btn.classList.add('active');
    });

    return container;
  },
};
