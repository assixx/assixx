/**
 * Dropdowns – Custom Dropdowns
 *
 * JavaScript-driven dropdowns for complex layouts (icons, prices, flags).
 * For simple dropdowns, use native <select> from Form Fields.
 */

export default {
  title: 'Design System/Dropdowns',

  parameters: {
    layout: 'padded',
  },

  tags: ['autodocs'],

  argTypes: {
    label: {
      control: 'text',
      description: 'Dropdown label',
    },
    defaultValue: {
      control: 'text',
      description: 'Default selected value',
    },
  },

  globals: {
    backgrounds: {
      value: 'assixx-dark',
    },
  },
};

/**
 * Plan Selector with Pricing
 *
 * Use case: Pricing tiers, subscription plans
 * Pattern: Two-column layout (name + price)
 */
export const PlanSelector = {
  args: {
    label: 'Tarif auswählen',
    defaultPlan: 'enterprise',
    showPrices: true,
  },
  argTypes: {
    label: {
      control: 'text',
      description: 'Dropdown label',
    },
    defaultPlan: {
      control: 'select',
      options: ['enterprise', 'professional', 'basic', 'free'],
      description: 'Default selected plan',
    },
    showPrices: {
      control: 'boolean',
      description: 'Show prices in dropdown',
    },
  },
  render: (args) => {
    const container = document.createElement('div');
    container.style.maxWidth = '400px';

    const plans = {
      enterprise: { name: 'Enterprise', price: '€149/M' },
      professional: { name: 'Professional', price: '€99/M' },
      basic: { name: 'Basic', price: '€49/M' },
      free: { name: 'Free', price: '€0/M' },
    };

    const defaultPlan = plans[args.defaultPlan];

    container.innerHTML = `
      <div class="form-field">
        <label class="form-field__label" for="plan">${args.label}</label>
        <div class="dropdown">
          <div class="dropdown__trigger" id="planTrigger">
            <span>${defaultPlan.name}</span>
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
              <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </div>
          <div class="dropdown__menu" id="planMenu">
            ${Object.entries(plans)
              .map(
                ([key, plan]) => `
              <div class="dropdown__option" data-value="${key}">
                <span>${plan.name}</span>
                ${args.showPrices ? `<span class="dropdown__option-secondary">${plan.price}</span>` : ''}
              </div>
            `,
              )
              .join('')}
          </div>
        </div>
      </div>
    `;

    // Add interactivity
    const trigger = container.querySelector('#planTrigger');
    const menu = container.querySelector('#planMenu');
    const options = container.querySelectorAll('.dropdown__option');

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      trigger.classList.toggle('active');
      menu.classList.toggle('active');
    });

    options.forEach((option) => {
      option.addEventListener('click', () => {
        const text = option.querySelector('span').textContent;
        trigger.querySelector('span').textContent = text;
        trigger.classList.remove('active');
        menu.classList.remove('active');
      });
    });

    // Close on outside click
    document.addEventListener('click', () => {
      trigger.classList.remove('active');
      menu.classList.remove('active');
    });

    return container;
  },
};

/**
 * Country Selector with Flags
 *
 * Use case: Country/Language selection, phone country codes
 * Pattern: Emoji flags + country codes
 */
export const CountrySelector = {
  args: {
    label: 'Land',
    defaultCountry: 'de',
    scrollable: true,
  },
  argTypes: {
    label: {
      control: 'text',
      description: 'Dropdown label',
    },
    defaultCountry: {
      control: 'select',
      options: [
        'de',
        'at',
        'ch',
        'fr',
        'it',
        'es',
        'nl',
        'be',
        'pl',
        'us',
        'gb',
      ],
      description: 'Default selected country',
    },
    scrollable: {
      control: 'boolean',
      description: 'Make dropdown scrollable',
    },
  },
  render: (args) => {
    const container = document.createElement('div');
    container.style.maxWidth = '300px';

    const countries = {
      de: '🇩🇪 Deutschland (+49)',
      at: '🇦🇹 Österreich (+43)',
      ch: '🇨🇭 Schweiz (+41)',
      fr: '🇫🇷 Frankreich (+33)',
      it: '🇮🇹 Italien (+39)',
      es: '🇪🇸 Spanien (+34)',
      nl: '🇳🇱 Niederlande (+31)',
      be: '🇧🇪 Belgien (+32)',
      pl: '🇵🇱 Polen (+48)',
      us: '🇺🇸 USA (+1)',
      gb: '🇬🇧 UK (+44)',
    };

    const scrollableClass = args.scrollable ? 'dropdown__menu--scrollable' : '';

    container.innerHTML = `
      <div class="form-field">
        <label class="form-field__label" for="country">${args.label}</label>
        <div class="dropdown">
          <div class="dropdown__trigger" id="countryTrigger">
            <span>${countries[args.defaultCountry]}</span>
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
              <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </div>
          <div class="dropdown__menu ${scrollableClass}" id="countryMenu">
            ${Object.entries(countries)
              .map(
                ([code, name]) =>
                  `<div class="dropdown__option" data-value="${code}">${name}</div>`,
              )
              .join('')}
          </div>
        </div>
      </div>
    `;

    // Add interactivity
    const trigger = container.querySelector('#countryTrigger');
    const menu = container.querySelector('#countryMenu');
    const options = container.querySelectorAll('.dropdown__option');

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      trigger.classList.toggle('active');
      menu.classList.toggle('active');
    });

    options.forEach((option) => {
      option.addEventListener('click', () => {
        trigger.querySelector('span').textContent = option.textContent;
        trigger.classList.remove('active');
        menu.classList.remove('active');
      });
    });

    document.addEventListener('click', () => {
      trigger.classList.remove('active');
      menu.classList.remove('active');
    });

    return container;
  },
};

/**
 * Department Selector with Icons
 *
 * Use case: Department, team, category selection
 * Pattern: Icon + label
 */
export const DepartmentSelector = {
  args: {
    label: 'Abteilung',
    defaultDepartment: 'production',
    withIcons: true,
  },
  argTypes: {
    label: {
      control: 'text',
      description: 'Dropdown label',
    },
    defaultDepartment: {
      control: 'select',
      options: ['production', 'quality', 'maintenance', 'logistics', 'admin'],
      description: 'Default selected department',
    },
    withIcons: {
      control: 'boolean',
      description: 'Show icons in options',
    },
  },
  render: (args) => {
    const container = document.createElement('div');
    container.style.maxWidth = '400px';

    const departments = {
      production: { icon: 'fa-cogs', name: 'Produktion' },
      quality: { icon: 'fa-check-circle', name: 'Qualitätssicherung' },
      maintenance: { icon: 'fa-tools', name: 'Instandhaltung' },
      logistics: { icon: 'fa-truck', name: 'Logistik' },
      admin: { icon: 'fa-user-tie', name: 'Verwaltung' },
    };

    const defaultDept = departments[args.defaultDepartment];

    container.innerHTML = `
      <div class="form-field">
        <label class="form-field__label" for="department">${args.label}</label>
        <div class="dropdown">
          <div class="dropdown__trigger" id="deptTrigger">
            <span>
              ${args.withIcons ? `<i class="fas ${defaultDept.icon}" style="margin-right: 8px;"></i>` : ''}
              ${defaultDept.name}
            </span>
            <i class="fas fa-chevron-down"></i>
          </div>
          <div class="dropdown__menu" id="deptMenu">
            ${Object.entries(departments)
              .map(
                ([key, dept]) => `
              <div class="dropdown__option" data-value="${key}">
                ${args.withIcons ? `<i class="fas ${dept.icon}"></i>` : ''}
                ${dept.name}
              </div>
            `,
              )
              .join('')}
          </div>
        </div>
      </div>
    `;

    // Add interactivity
    const trigger = container.querySelector('#deptTrigger');
    const menu = container.querySelector('#deptMenu');
    const options = container.querySelectorAll('.dropdown__option');

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      trigger.classList.toggle('active');
      menu.classList.toggle('active');
    });

    options.forEach((option) => {
      option.addEventListener('click', () => {
        const iconElement = option.querySelector('i');
        const triggerSpan = trigger.querySelector('span');

        // Clear existing content safely
        triggerSpan.textContent = '';

        // Create icon element safely (no innerHTML)
        if (iconElement) {
          const newIcon = document.createElement('i');
          newIcon.className = iconElement.className;
          newIcon.style.marginRight = '8px';
          triggerSpan.appendChild(newIcon);
        }

        // Append text safely using createTextNode (XSS-safe)
        triggerSpan.appendChild(
          document.createTextNode(option.textContent.trim()),
        );

        trigger.classList.remove('active');
        menu.classList.remove('active');
      });
    });

    document.addEventListener('click', () => {
      trigger.classList.remove('active');
      menu.classList.remove('active');
    });

    return container;
  },
};

/**
 * Comparison: Native vs Custom
 *
 * Shows when to use which approach
 */
export const NativeVsCustom = {
  args: {
    showNative: true,
    showCustom: true,
    showBenefits: true,
  },
  argTypes: {
    showNative: {
      control: 'boolean',
      description: 'Show native <select> example',
    },
    showCustom: {
      control: 'boolean',
      description: 'Show custom dropdown example',
    },
    showBenefits: {
      control: 'boolean',
      description: 'Show benefit lists',
    },
  },
  render: (args) => {
    const container = document.createElement('div');
    container.style.display = 'grid';
    container.style.gap = '32px';
    container.style.maxWidth = '600px';

    let html = '';

    if (args.showNative) {
      html += `
        <div>
          <h3 style="color: var(--color-text-primary); margin-bottom: 16px; font-size: 0.875rem;">
            ✅ Use Native <code>&lt;select&gt;</code> for:
          </h3>
          <div class="form-field">
            <label class="form-field__label" for="native">Einfache Auswahl</label>
            <select class="form-field__control form-field__control--select" id="native">
              <option>Neueste zuerst</option>
              <option>Älteste zuerst</option>
              <option>Nach Name</option>
              <option>Nach Größe</option>
            </select>
          </div>
          ${
            args.showBenefits ?
              `
          <ul style="color: var(--color-text-secondary); font-size: 0.75rem; margin-top: 12px; padding-left: 20px;">
            <li>Bessere Accessibility</li>
            <li>Native keyboard navigation</li>
            <li>Mobile-optimiert</li>
            <li>Einfacher Code</li>
          </ul>`
            : ''
          }
        </div>
      `;
    }

    if (args.showCustom) {
      html += `
        <div>
          <h3 style="color: var(--color-text-primary); margin-bottom: 16px; font-size: 0.875rem;">
            ⚡ Use Custom Dropdown for:
          </h3>
          <div class="form-field">
            <label class="form-field__label" for="custom">Komplexe Layouts</label>
            <div class="dropdown">
              <div class="dropdown__trigger" id="customTrigger">
                <span>Enterprise</span>
                <span class="dropdown__option-secondary" style="margin-left: auto; margin-right: 8px;">€149/M</span>
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                  <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                </svg>
              </div>
              <div class="dropdown__menu" id="customMenu">
                <div class="dropdown__option" data-value="enterprise">
                  <span>Enterprise</span>
                  <span class="dropdown__option-secondary">€149/M</span>
                </div>
                <div class="dropdown__option" data-value="pro">
                  <span>Professional</span>
                  <span class="dropdown__option-secondary">€99/M</span>
                </div>
              </div>
            </div>
          </div>
          ${
            args.showBenefits ?
              `
          <ul style="color: var(--color-text-secondary); font-size: 0.75rem; margin-top: 12px; padding-left: 20px;">
            <li>Icons, Flaggen, Emojis</li>
            <li>Zweispaltige Layouts (Name + Preis)</li>
            <li>Custom Styling</li>
            <li>Complex interactions</li>
          </ul>`
            : ''
          }
        </div>
      `;
    }

    container.innerHTML = html;

    // Add interactivity to custom dropdown
    const trigger = container.querySelector('#customTrigger');
    const menu = container.querySelector('#customMenu');
    const options = container.querySelectorAll('#customMenu .dropdown__option');

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      trigger.classList.toggle('active');
      menu.classList.toggle('active');
    });

    options.forEach((option) => {
      option.addEventListener('click', () => {
        const name = option.querySelector('span:first-child').textContent;
        const price = option.querySelector(
          '.dropdown__option-secondary',
        ).textContent;
        trigger.querySelector('span:first-child').textContent = name;
        trigger.querySelector('.dropdown__option-secondary').textContent =
          price;
        trigger.classList.remove('active');
        menu.classList.remove('active');
      });
    });

    document.addEventListener('click', () => {
      trigger.classList.remove('active');
      menu.classList.remove('active');
    });

    return container;
  },
};
