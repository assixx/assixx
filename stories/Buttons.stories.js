/**
 * Button Components - Assixx Design System
 *
 * Interactive documentation for all button variants
 * Best Practice 2025: Component-driven development with Storybook
 */

export default {
  title: 'Design System/Buttons',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'assixx-dark',
    },
  },
  argTypes: {
    label: {
      control: 'text',
      description: 'Button text',
      defaultValue: 'Button',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Button size',
      defaultValue: 'md',
    },
    disabled: {
      control: 'boolean',
      description: 'Disabled state',
      defaultValue: false,
    },
    loading: {
      control: 'boolean',
      description: 'Loading state',
      defaultValue: false,
    },
    icon: {
      control: 'text',
      description: 'FontAwesome icon class (e.g., fa-save)',
    },
    fullWidth: {
      control: 'boolean',
      description: 'Full width button',
      defaultValue: false,
    },
  },
};

// Helper function to create button HTML
const createButton = ({ variant, label, size, disabled, loading, icon, fullWidth }) => {
  const classes = [
    'btn',
    `btn-${variant}`,
    size && size !== 'md' ? `btn-${size}` : '',
    fullWidth ? 'btn-block' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const button = document.createElement('button');
  button.className = classes;
  button.disabled = disabled;
  if (loading) button.setAttribute('data-loading', 'true');

  // Icon + Text
  if (icon && label) {
    const iconElement = document.createElement('i');
    iconElement.className = `fa ${icon}`;
    button.appendChild(iconElement);
    button.appendChild(document.createTextNode(` ${label}`));
  }
  // Icon only
  else if (icon) {
    button.classList.add('btn-icon');
    const iconElement = document.createElement('i');
    iconElement.className = `fa ${icon}`;
    button.appendChild(iconElement);
  }
  // Text only
  else {
    button.textContent = label;
  }

  return button;
};

/**
 * PRIMARY BUTTON
 * Main call-to-action with gradient background
 * Use for: Save, Submit, Confirm, Create
 */
export const Primary = {
  args: {
    label: 'Save Changes',
    size: 'md',
    disabled: false,
    loading: false,
    fullWidth: false,
  },
  render: (args) => createButton({ ...args, variant: 'primary' }),
};

/**
 * PRIMARY-FIRST BUTTON
 * Transparent hero CTA (no background!)
 * Use for: Landing page CTAs, Login, Register, Sign Up
 */
export const PrimaryFirst = {
  args: {
    label: 'Get Started',
    size: 'md',
    disabled: false,
    loading: false,
    fullWidth: false,
  },
  render: (args) => createButton({ ...args, variant: 'primary-first' }),
};

/**
 * SECONDARY BUTTON
 * Outline style with glassmorphism
 * Use for: Cancel, Back, Close, Secondary actions
 */
export const Secondary = {
  args: {
    label: 'Cancel',
    size: 'md',
    disabled: false,
    loading: false,
    fullWidth: false,
  },
  render: (args) => createButton({ ...args, variant: 'secondary' }),
};

/**
 * DANGER BUTTON
 * Destructive actions with red gradient
 * Use for: Delete, Remove, Logout, Destructive actions
 */
export const Danger = {
  args: {
    label: 'Delete Item',
    size: 'md',
    disabled: false,
    loading: false,
    fullWidth: false,
  },
  render: (args) => createButton({ ...args, variant: 'danger' }),
};

/**
 * SUCCESS BUTTON
 * Success/approval actions with green gradient
 * Use for: Approve, Confirm, Accept, Success actions
 */
export const Success = {
  args: {
    label: 'Approve',
    size: 'md',
    disabled: false,
    loading: false,
    fullWidth: false,
  },
  render: (args) => createButton({ ...args, variant: 'success' }),
};

/**
 * STATUS ACTIVE BUTTON
 * Toggle button for active state (orange = deactivate action)
 * Use for: Showing "Deactivate" when item IS active
 */
export const StatusActive = {
  args: {
    label: 'Deactivate',
    size: 'md',
    disabled: false,
    loading: false,
    fullWidth: false,
  },
  render: (args) => createButton({ ...args, variant: 'status-active' }),
};

/**
 * STATUS INACTIVE BUTTON
 * Toggle button for inactive state (green = activate action)
 * Use for: Showing "Activate" when item IS inactive
 */
export const StatusInactive = {
  args: {
    label: 'Activate',
    size: 'md',
    disabled: false,
    loading: false,
    fullWidth: false,
  },
  render: (args) => createButton({ ...args, variant: 'status-inactive' }),
};

/**
 * WARNING BUTTON
 * Warning/caution actions with orange gradient
 * Use for: Caution, Important notifications, Risky actions
 */
export const Warning = {
  args: {
    label: 'Caution',
    size: 'md',
    disabled: false,
    loading: false,
    fullWidth: false,
  },
  render: (args) => createButton({ ...args, variant: 'warning' }),
};

/**
 * INFO BUTTON
 * Informational actions with cyan gradient
 * Use for: Information, Help, Tooltips, Learn more
 */
export const Info = {
  args: {
    label: 'Information',
    size: 'md',
    disabled: false,
    loading: false,
    fullWidth: false,
  },
  render: (args) => createButton({ ...args, variant: 'info' }),
};

/**
 * LIGHT BUTTON
 * Light theme button with subtle styling
 * Use for: Secondary actions on dark backgrounds
 */
export const Light = {
  args: {
    label: 'Light',
    size: 'md',
    disabled: false,
    loading: false,
    fullWidth: false,
  },
  render: (args) => createButton({ ...args, variant: 'light' }),
};

/**
 * DARK BUTTON
 * Dark theme button with strong contrast
 * Use for: High contrast actions, Dark mode toggles
 */
export const Dark = {
  args: {
    label: 'Dark',
    size: 'md',
    disabled: false,
    loading: false,
    fullWidth: false,
  },
  render: (args) => createButton({ ...args, variant: 'dark' }),
};

/**
 * LINK BUTTON
 * Text-only button that looks like a link
 * Use for: Inline actions, Learn more, Minimal UI
 */
export const Link = {
  args: {
    label: 'Learn More',
    size: 'md',
    disabled: false,
    loading: false,
    fullWidth: false,
  },
  render: (args) => createButton({ ...args, variant: 'link' }),
};

/**
 * SIZE VARIANTS
 * Small, Medium (default), Large
 */
export const Sizes = {
  args: {
    variant: 'primary',
    label: 'Button',
    showSmall: true,
    showMedium: true,
    showLarge: true,
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'danger', 'success', 'warning', 'info'],
      description: 'Button variant',
    },
    label: {
      control: 'text',
      description: 'Button text',
    },
    showSmall: {
      control: 'boolean',
      description: 'Show small size',
    },
    showMedium: {
      control: 'boolean',
      description: 'Show medium size',
    },
    showLarge: {
      control: 'boolean',
      description: 'Show large size',
    },
  },
  render: (args) => {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.gap = '16px';
    container.style.alignItems = 'center';

    if (args.showSmall) {
      const small = createButton({ variant: args.variant, label: args.label, size: 'sm' });
      container.appendChild(small);
    }
    if (args.showMedium) {
      const medium = createButton({ variant: args.variant, label: args.label, size: 'md' });
      container.appendChild(medium);
    }
    if (args.showLarge) {
      const large = createButton({ variant: args.variant, label: args.label, size: 'lg' });
      container.appendChild(large);
    }

    return container;
  },
};

/**
 * WITH ICONS
 * Buttons with FontAwesome icons
 */
export const WithIcons = {
  args: {
    variant: 'primary',
    label: 'Save',
    icon: 'fa-save',
    iconOnly: false,
    size: 'md',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'danger', 'success', 'warning', 'info'],
      description: 'Button variant',
    },
    label: {
      control: 'text',
      description: 'Button text',
    },
    icon: {
      control: 'text',
      description: 'FontAwesome icon class (e.g., fa-save)',
    },
    iconOnly: {
      control: 'boolean',
      description: 'Show only icon without text',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Button size',
    },
  },
  render: (args) => {
    return createButton({
      variant: args.variant,
      label: args.iconOnly ? '' : args.label,
      icon: args.icon,
      size: args.size,
    });
  },
};

/**
 * LOADING STATES
 * Buttons with loading spinner
 */
export const Loading = {
  args: {
    variant: 'primary',
    label: 'Saving...',
    loading: true,
    size: 'md',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'danger', 'success', 'warning', 'info'],
      description: 'Button variant',
    },
    label: {
      control: 'text',
      description: 'Button text',
    },
    loading: {
      control: 'boolean',
      description: 'Show loading spinner',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Button size',
    },
  },
  render: (args) => {
    return createButton({
      variant: args.variant,
      label: args.label,
      loading: args.loading,
      size: args.size,
    });
  },
};

/**
 * DISABLED STATES
 * Disabled buttons
 */
export const Disabled = {
  args: {
    variant: 'primary',
    label: 'Disabled',
    disabled: true,
    size: 'md',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'danger', 'success', 'warning', 'info'],
      description: 'Button variant',
    },
    label: {
      control: 'text',
      description: 'Button text',
    },
    disabled: {
      control: 'boolean',
      description: 'Disabled state',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Button size',
    },
  },
  render: (args) => {
    return createButton({
      variant: args.variant,
      label: args.label,
      disabled: args.disabled,
      size: args.size,
    });
  },
};

/**
 * ALL VARIANTS
 * Complete overview of all button variants
 */
export const AllVariants = {
  parameters: {
    layout: 'padded', // Grid needs space - centered is too restrictive
  },
  args: {
    columns: 3,
    showLabels: true,
    buttonSize: 'md',
  },
  argTypes: {
    columns: {
      control: { type: 'range', min: 1, max: 4, step: 1 },
      description: 'Number of grid columns',
    },
    showLabels: {
      control: 'boolean',
      description: 'Show variant labels above buttons',
    },
    buttonSize: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Size for all buttons',
    },
  },
  render: (args) => {
    const container = document.createElement('div');
    container.style.display = 'grid';
    container.style.gridTemplateColumns = `repeat(${args.columns}, 1fr)`;
    container.style.gap = '24px';
    container.style.padding = '20px';

    const variants = [
      { variant: 'primary', label: 'Primary' },
      { variant: 'primary-first', label: 'Primary First' },
      { variant: 'secondary', label: 'Secondary' },
      { variant: 'modal', label: 'Modal Submit' },
      { variant: 'danger', label: 'Danger' },
      { variant: 'success', label: 'Success' },
      { variant: 'warning', label: 'Warning' },
      { variant: 'info', label: 'Info' },
      { variant: 'light', label: 'Light' },
      { variant: 'dark', label: 'Dark' },
      { variant: 'link', label: 'Link' },
      { variant: 'status-active', label: 'Status Active' },
      { variant: 'status-inactive', label: 'Status Inactive' },
    ];

    variants.forEach(({ variant, label }) => {
      const card = document.createElement('div');
      card.style.padding = '16px';
      card.style.background = 'rgba(255, 255, 255, 0.02)';
      card.style.border = '1px solid rgba(255, 255, 255, 0.1)';
      card.style.borderRadius = '8px';

      if (args.showLabels) {
        const title = document.createElement('div');
        title.textContent = label;
        title.style.color = 'var(--color-text-secondary)';
        title.style.fontSize = '12px';
        title.style.marginBottom = '12px';
        title.style.textTransform = 'uppercase';
        title.style.letterSpacing = '1px';
        card.appendChild(title);
      }

      const button = createButton({ variant, label, size: args.buttonSize });
      card.appendChild(button);
      container.appendChild(card);
    });

    return container;
  },
};

/**
 * MODAL CONTEXT
 * Modal Submit button in realistic modal footer context
 */
export const ModalContext = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="modal-overlay modal-overlay--active">
        <div class="ds-modal ds-modal--md">
          <div class="ds-modal__header">
            <h2 class="ds-modal__title">
              <i class="fas fa-save"></i>
              Save Changes
            </h2>
            <button class="ds-modal__close" data-action="close">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="ds-modal__body">
            <p style="color: var(--color-text-secondary); margin-bottom: var(--spacing-4);">
              This demonstrates the <strong>btn-modal</strong> button in its natural habitat - the modal footer.
            </p>
            <p style="color: var(--color-text-secondary); margin-bottom: var(--spacing-6);">
              Notice the elegant simplicity:
            </p>
            <ul style="color: var(--color-text-secondary); margin-left: 20px; line-height: 1.8;">
              <li><strong>Gradient Border</strong> - The border itself is a gradient (unique!)</li>
              <li><strong>Clean background</strong> - Minimal dark background</li>
              <li><strong>Subtle glow</strong> - Soft blue glow on hover</li>
              <li><strong>Modern & Elegant</strong> - No other button has this effect</li>
            </ul>
          </div>
          <div class="ds-modal__footer">
            <button class="btn btn-secondary">
              Cancel
            </button>
            <button class="btn btn-modal">
              Save Changes
            </button>
          </div>
        </div>
      </div>
    `;

    return wrapper;
  },
};

/**
 * MODAL BUTTON STATES
 * All states of the modal button
 */
export const ModalButtonStates = {
  render: () => {
    const container = document.createElement('div');
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(2, 1fr)';
    container.style.gap = '24px';
    container.style.padding = '20px';

    const states = [
      { label: 'Default', props: {}, text: 'Submit' },
      { label: 'Hover (hover over me)', props: { class: 'hover-simulation' }, text: 'Submit' },
      { label: 'Active (click me)', props: {}, text: 'Submit' },
      { label: 'Disabled', props: { disabled: true }, text: 'Disabled' },
    ];

    states.forEach(({ label, props, text }) => {
      const card = document.createElement('div');
      card.style.padding = '20px';
      card.style.background = 'rgba(255, 255, 255, 0.02)';
      card.style.border = '1px solid rgba(255, 255, 255, 0.1)';
      card.style.borderRadius = '12px';

      const title = document.createElement('div');
      title.textContent = label;
      title.style.color = 'var(--color-text-secondary)';
      title.style.fontSize = '12px';
      title.style.marginBottom = '16px';
      title.style.textTransform = 'uppercase';
      title.style.letterSpacing = '1px';
      card.appendChild(title);

      const button = document.createElement('button');
      button.className = `btn btn-modal ${props.class || ''}`;
      button.disabled = props.disabled || false;
      button.textContent = text;

      card.appendChild(button);
      container.appendChild(card);
    });

    return container;
  },
};
/**
 * FLOATING ACTION BUTTON (FAB)
 * Circular button fixed to bottom-right corner for primary actions
 */
export const FloatingActionButton = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.width = '100%';
    wrapper.style.height = '400px';
    wrapper.style.background = 'rgba(255,255,255,0.02)';
    wrapper.style.border = '1px solid rgba(255,255,255,0.1)';
    wrapper.style.borderRadius = '12px';
    wrapper.style.overflow = 'hidden';

    wrapper.innerHTML = `
      <div style="padding: 24px; color: var(--color-text-secondary);">
        <h4 style="color: #fff; margin-bottom: 12px;">Floating Action Button (FAB)</h4>
        <p>Fixed to bottom-right corner. Hover to see scale effect.</p>
        <p style="margin-top: 12px; font-size: 13px;">
          <strong>Use cases:</strong> Add items, chat, help, scroll to top
        </p>
      </div>

      <!-- Default FAB (Primary) -->
      <button class="btn-float" aria-label="Add item">
        <i class="fas fa-plus"></i>
      </button>
    `;

    return wrapper;
  },
};

/**
 * FAB VARIANTS
 * Different colors and sizes
 */
export const FloatingActionButtonVariants = {
  render: () => {
    const container = document.createElement('div');
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(2, 1fr)';
    container.style.gap = '24px';

    const variants = [
      { title: 'Primary (Default)', class: '', icon: 'fa-plus', label: 'Add' },
      { title: 'Success', class: 'btn-float--success', icon: 'fa-check', label: 'Approve' },
      { title: 'Danger', class: 'btn-float--danger', icon: 'fa-trash', label: 'Delete' },
      { title: 'Warning', class: 'btn-float--warning', icon: 'fa-exclamation', label: 'Warning' },
    ];

    variants.forEach(({ title, class: className, icon, label }) => {
      const card = document.createElement('div');
      card.style.position = 'relative';
      card.style.height = '250px';
      card.style.padding = '20px';
      card.style.background = 'rgba(255,255,255,0.02)';
      card.style.border = '1px solid rgba(255,255,255,0.1)';
      card.style.borderRadius = '12px';
      card.style.overflow = 'hidden';

      card.innerHTML = `
        <div style="color: var(--color-text-secondary);">
          <h5 style="color: #fff; margin-bottom: 8px; font-size: 14px;">${title}</h5>
          <p style="font-size: 12px;">Hover to see effect</p>
        </div>

        <button class="btn-float ${className}" aria-label="${label}" style="position: absolute;">
          <i class="fas ${icon}"></i>
        </button>
      `;

      container.appendChild(card);
    });

    return container;
  },
};

/**
 * FAB SIZES
 * Small, default, and large sizes
 */
export const FloatingActionButtonSizes = {
  render: () => {
    const container = document.createElement('div');
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(3, 1fr)';
    container.style.gap = '24px';

    const sizes = [
      { title: 'Small (48px)', class: 'btn-float--sm', size: '48px' },
      { title: 'Default (60px)', class: '', size: '60px' },
      { title: 'Large (72px)', class: 'btn-float--lg', size: '72px' },
    ];

    sizes.forEach(({ title, class: className, size }) => {
      const card = document.createElement('div');
      card.style.position = 'relative';
      card.style.height = '250px';
      card.style.padding = '20px';
      card.style.background = 'rgba(255,255,255,0.02)';
      card.style.border = '1px solid rgba(255,255,255,0.1)';
      card.style.borderRadius = '12px';
      card.style.overflow = 'hidden';

      card.innerHTML = `
        <div style="color: var(--color-text-secondary);">
          <h5 style="color: #fff; margin-bottom: 8px; font-size: 14px;">${title}</h5>
          <p style="font-size: 12px;">Size: ${size}</p>
        </div>

        <button class="btn-float ${className}" aria-label="Add" style="position: absolute;">
          <i class="fas fa-plus"></i>
        </button>
      `;

      container.appendChild(card);
    });

    return container;
  },
};

/**
 * FAB EXTENDED
 * FAB with text label
 */
export const FloatingActionButtonExtended = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.width = '100%';
    wrapper.style.height = '400px';
    wrapper.style.background = 'rgba(255,255,255,0.02)';
    wrapper.style.border = '1px solid rgba(255,255,255,0.1)';
    wrapper.style.borderRadius = '12px';
    wrapper.style.overflow = 'hidden';

    wrapper.innerHTML = `
      <div style="padding: 24px; color: var(--color-text-secondary);">
        <h4 style="color: #fff; margin-bottom: 12px;">Extended FAB</h4>
        <p>FAB with text label. Auto-collapses to icon-only on mobile.</p>
      </div>

      <!-- Extended FAB -->
      <button class="btn-float btn-float--extended" aria-label="Create new">
        <i class="fas fa-plus btn-float__icon"></i>
        <span class="btn-float__label">Create new</span>
      </button>
    `;

    return wrapper;
  },
};

/**
 * FAB WITH BADGE
 * FAB with notification badge
 */
export const FloatingActionButtonWithBadge = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.width = '100%';
    wrapper.style.height = '400px';
    wrapper.style.background = 'rgba(255,255,255,0.02)';
    wrapper.style.border = '1px solid rgba(255,255,255,0.1)';
    wrapper.style.borderRadius = '12px';
    wrapper.style.overflow = 'hidden';

    wrapper.innerHTML = `
      <div style="padding: 24px; color: var(--color-text-secondary);">
        <h4 style="color: #fff; margin-bottom: 12px;">FAB with Notification Badge</h4>
        <p>Shows unread count or notification indicator.</p>
      </div>

      <!-- FAB with Badge -->
      <button class="btn-float" aria-label="Messages">
        <i class="fas fa-comment"></i>
        <span class="btn-float__badge">3</span>
      </button>
    `;

    return wrapper;
  },
};

/**
 * FAB POSITIONS
 * Different corner positions
 */
export const FloatingActionButtonPositions = {
  render: () => {
    const container = document.createElement('div');
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(2, 1fr)';
    container.style.gap = '24px';

    const positions = [
      { title: 'Bottom-Right (Default)', class: '' },
      { title: 'Bottom-Left', class: 'btn-float--bottom-left' },
      { title: 'Top-Right', class: 'btn-float--top-right' },
      { title: 'Top-Left', class: 'btn-float--top-left' },
    ];

    positions.forEach(({ title, class: className }) => {
      const card = document.createElement('div');
      card.style.position = 'relative';
      card.style.height = '250px';
      card.style.padding = '20px';
      card.style.background = 'rgba(255,255,255,0.02)';
      card.style.border = '1px solid rgba(255,255,255,0.1)';
      card.style.borderRadius = '12px';
      card.style.overflow = 'hidden';

      card.innerHTML = `
        <div style="color: var(--color-text-secondary);">
          <h5 style="color: #fff; margin-bottom: 8px; font-size: 14px;">${title}</h5>
        </div>

        <button class="btn-float ${className}" aria-label="Add" style="position: absolute;">
          <i class="fas fa-plus"></i>
        </button>
      `;

      container.appendChild(card);
    });

    return container;
  },
};
