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
  render: () => {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.gap = '16px';
    container.style.alignItems = 'center';

    const small = createButton({ variant: 'primary', label: 'Small', size: 'sm' });
    const medium = createButton({ variant: 'primary', label: 'Medium', size: 'md' });
    const large = createButton({ variant: 'primary', label: 'Large', size: 'lg' });

    container.appendChild(small);
    container.appendChild(medium);
    container.appendChild(large);

    return container;
  },
};

/**
 * WITH ICONS
 * Buttons with FontAwesome icons
 */
export const WithIcons = {
  render: () => {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.gap = '12px';
    container.style.flexWrap = 'wrap';

    const save = createButton({ variant: 'primary', label: 'Save', icon: 'fa-save' });
    const upload = createButton({ variant: 'primary', label: 'Upload', icon: 'fa-upload' });
    const download = createButton({ variant: 'secondary', label: 'Download', icon: 'fa-download' });
    const trash = createButton({ variant: 'danger', label: 'Delete', icon: 'fa-trash' });

    container.appendChild(save);
    container.appendChild(upload);
    container.appendChild(download);
    container.appendChild(trash);

    return container;
  },
};

/**
 * LOADING STATES
 * Buttons with loading spinner
 */
export const Loading = {
  render: () => {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.gap = '12px';

    const loading1 = createButton({ variant: 'primary', label: 'Saving...', loading: true });
    const loading2 = createButton({ variant: 'danger', label: 'Deleting...', loading: true });

    container.appendChild(loading1);
    container.appendChild(loading2);

    return container;
  },
};

/**
 * DISABLED STATES
 * Disabled buttons
 */
export const Disabled = {
  render: () => {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.gap = '12px';

    const disabled1 = createButton({ variant: 'primary', label: 'Disabled', disabled: true });
    const disabled2 = createButton({ variant: 'secondary', label: 'Disabled', disabled: true });
    const disabled3 = createButton({ variant: 'danger', label: 'Disabled', disabled: true });

    container.appendChild(disabled1);
    container.appendChild(disabled2);
    container.appendChild(disabled3);

    return container;
  },
};

/**
 * ALL VARIANTS
 * Complete overview of all button variants
 */
export const AllVariants = {
  render: () => {
    const container = document.createElement('div');
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(3, 1fr)';
    container.style.gap = '24px';
    container.style.padding = '20px';

    const variants = [
      { variant: 'primary', label: 'Primary' },
      { variant: 'primary-first', label: 'Primary First' },
      { variant: 'secondary', label: 'Secondary' },
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

      const title = document.createElement('div');
      title.textContent = label;
      title.style.color = 'var(--color-text-secondary)';
      title.style.fontSize = '12px';
      title.style.marginBottom = '12px';
      title.style.textTransform = 'uppercase';
      title.style.letterSpacing = '1px';

      const button = createButton({ variant, label });

      card.appendChild(title);
      card.appendChild(button);
      container.appendChild(card);
    });

    return container;
  },
};
