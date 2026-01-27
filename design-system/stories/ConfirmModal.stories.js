/**
 * Confirm Modal Component Stories
 * Glassmorphic confirmation dialogs for critical user actions
 */

export default {
  title: 'Design System/Modals/Confirm Modal',
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0f0f1e' },
        { name: 'light', value: '#f5f5f5' },
      ],
    },
  },
  tags: ['autodocs'],
};

// Template
const Template = (args) => {
  const variantClass = args.variant ? `confirm-modal--${args.variant}` : '';

  const container = document.createElement('div');
  container.className = `confirm-modal ${variantClass}`;

  const icon = document.createElement('div');
  icon.className = 'confirm-modal__icon';
  icon.innerHTML = `<i class="fas ${args.icon}"></i>`;

  const title = document.createElement('h3');
  title.className = 'confirm-modal__title';
  title.textContent = args.title;

  const message = document.createElement('p');
  message.className = 'confirm-modal__message';
  message.textContent = args.message;

  const actions = document.createElement('div');
  actions.className = 'confirm-modal__actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'confirm-modal__btn confirm-modal__btn--cancel';
  cancelBtn.textContent = args.cancelText;

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'confirm-modal__btn confirm-modal__btn--confirm';
  confirmBtn.textContent = args.confirmText;

  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);

  container.appendChild(icon);
  container.appendChild(title);
  container.appendChild(message);
  container.appendChild(actions);

  return container;
};

/**
 * Default confirmation modal with blue styling
 */
export const Default = Template.bind({});
Default.args = {
  variant: '',
  icon: 'fa-question-circle',
  title: 'Confirm Action',
  message: 'Are you sure you want to proceed with this action?',
  cancelText: 'Cancel',
  confirmText: 'Confirm',
};
Default.parameters = {
  docs: {
    description: {
      story:
        'Standard confirmation modal for neutral actions. Uses blue gradient.',
    },
  },
};

/**
 * Warning variant for actions that require caution
 */
export const Warning = Template.bind({});
Warning.args = {
  variant: 'warning',
  icon: 'fa-exclamation-triangle',
  title: 'Archive Suggestion',
  message:
    'This will archive the suggestion and remove it from active items. You can restore it later from the archive.',
  cancelText: 'Cancel',
  confirmText: 'Archive',
};
Warning.parameters = {
  docs: {
    description: {
      story:
        'Warning variant with orange styling for actions requiring caution. Used for archive, bulk operations, or configuration changes.',
    },
  },
};

/**
 * Danger variant for destructive actions
 */
export const Danger = Template.bind({});
Danger.args = {
  variant: 'danger',
  icon: 'fa-trash-alt',
  title: 'Delete User',
  message:
    'This will permanently delete the user "Max Mustermann" and all associated data. This action cannot be undone.',
  cancelText: 'Cancel',
  confirmText: 'Delete User',
};
Danger.parameters = {
  docs: {
    description: {
      story:
        'Danger variant with red styling for destructive actions like deleting users, removing data, or permanent removal operations.',
    },
  },
};

/**
 * Info variant for informational confirmations
 */
export const Info = Template.bind({});
Info.args = {
  variant: 'info',
  icon: 'fa-info-circle',
  title: 'Send Notification',
  message:
    'This will send a notification to all team members (42 users). They will receive an email and in-app notification.',
  cancelText: 'Cancel',
  confirmText: 'Send Notification',
};
Info.parameters = {
  docs: {
    description: {
      story:
        'Info variant with blue styling for informational confirmations like sending notifications or sharing information.',
    },
  },
};

/**
 * Success variant for positive confirmations
 */
export const Success = Template.bind({});
Success.args = {
  variant: 'success',
  icon: 'fa-check-circle',
  title: 'Activate Account',
  message:
    'Your account setup is complete! Ready to activate your account and start using all features?',
  cancelText: 'Not Yet',
  confirmText: 'Activate Now',
};
Success.parameters = {
  docs: {
    description: {
      story:
        'Success variant with green styling for positive confirmations like activating features or completing onboarding.',
    },
  },
};

/**
 * Short Message Example
 */
export const ShortMessage = Template.bind({});
ShortMessage.args = {
  variant: 'danger',
  icon: 'fa-sign-out-alt',
  title: 'Logout',
  message: 'Do you want to logout?',
  cancelText: 'No',
  confirmText: 'Yes, Logout',
};
ShortMessage.parameters = {
  docs: {
    description: {
      story: 'Example with a short, concise message for simple confirmations.',
    },
  },
};

/**
 * Long Message Example
 */
export const LongMessage = Template.bind({});
LongMessage.args = {
  variant: 'warning',
  icon: 'fa-exclamation-triangle',
  title: 'Reset Settings',
  message:
    'This will reset all your custom settings to their default values. This includes theme preferences, notification settings, dashboard layouts, and saved filters. All your data will remain intact. You can reconfigure your settings at any time after the reset.',
  cancelText: 'Keep Settings',
  confirmText: 'Reset to Default',
};
LongMessage.parameters = {
  docs: {
    description: {
      story: 'Example with a longer, detailed message explaining consequences.',
    },
  },
};

/**
 * Disabled State Example
 */
export const DisabledButtons = () => {
  const container = document.createElement('div');
  container.className = 'confirm-modal confirm-modal--danger';
  container.innerHTML = `
    <div class="confirm-modal__icon">
      <i class="fas fa-trash-alt"></i>
    </div>
    <h3 class="confirm-modal__title">Processing...</h3>
    <p class="confirm-modal__message">Please wait while we delete the item.</p>
    <div class="confirm-modal__actions">
      <button class="confirm-modal__btn confirm-modal__btn--cancel" disabled>Cancel</button>
      <button class="confirm-modal__btn confirm-modal__btn--confirm" disabled>
        <i class="fas fa-spinner fa-spin"></i> Deleting...
      </button>
    </div>
  `;
  return container;
};
DisabledButtons.parameters = {
  docs: {
    description: {
      story:
        'Disabled state while an action is in progress. Both buttons are disabled to prevent multiple submissions.',
    },
  },
};

/**
 * With Modal Overlay
 */
export const WithOverlay = () => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay modal-overlay--active';
  overlay.style.position = 'relative';
  overlay.style.minHeight = '400px';
  overlay.innerHTML = `
    <div class="confirm-modal confirm-modal--danger">
      <div class="confirm-modal__icon">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <h3 class="confirm-modal__title">Unsaved Changes</h3>
      <p class="confirm-modal__message">
        You have unsaved changes. If you leave now, your changes will be lost.
      </p>
      <div class="confirm-modal__actions">
        <button class="confirm-modal__btn confirm-modal__btn--cancel">Stay</button>
        <button class="confirm-modal__btn confirm-modal__btn--confirm">Leave</button>
      </div>
    </div>
  `;
  return overlay;
};
WithOverlay.parameters = {
  docs: {
    description: {
      story:
        'Confirm modal displayed within a modal overlay for full-page blocking. Click outside the modal to close (in actual implementation).',
    },
  },
};

/**
 * All Variants Comparison
 */
export const AllVariants = () => {
  const grid = document.createElement('div');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))';
  grid.style.gap = '30px';
  grid.style.maxWidth = '1200px';

  // Helper function to create a variant
  const createVariant = (variant, icon, title, message, confirmText) => {
    const modal = document.createElement('div');
    modal.className =
      variant ? `confirm-modal confirm-modal--${variant}` : 'confirm-modal';

    const iconDiv = document.createElement('div');
    iconDiv.className = 'confirm-modal__icon';
    iconDiv.innerHTML = `<i class="fas ${icon}"></i>`;

    const titleEl = document.createElement('h3');
    titleEl.className = 'confirm-modal__title';
    titleEl.textContent = title;

    const messageEl = document.createElement('p');
    messageEl.className = 'confirm-modal__message';
    messageEl.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'confirm-modal__actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'confirm-modal__btn confirm-modal__btn--cancel';
    cancelBtn.textContent = 'Cancel';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'confirm-modal__btn confirm-modal__btn--confirm';
    confirmBtn.textContent = confirmText;

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);

    modal.appendChild(iconDiv);
    modal.appendChild(titleEl);
    modal.appendChild(messageEl);
    modal.appendChild(actions);

    return modal;
  };

  // Default
  grid.appendChild(
    createVariant(
      '',
      'fa-question-circle',
      'Default',
      'Standard confirmation',
      'Confirm',
    ),
  );

  // Warning
  grid.appendChild(
    createVariant(
      'warning',
      'fa-exclamation-triangle',
      'Warning',
      'Caution required',
      'Proceed',
    ),
  );

  // Danger
  grid.appendChild(
    createVariant(
      'danger',
      'fa-trash-alt',
      'Danger',
      'Destructive action',
      'Delete',
    ),
  );

  // Info
  grid.appendChild(
    createVariant('info', 'fa-info-circle', 'Info', 'Informational', 'Confirm'),
  );

  // Success
  grid.appendChild(
    createVariant(
      'success',
      'fa-check-circle',
      'Success',
      'Positive action',
      'Confirm',
    ),
  );

  return grid;
};
AllVariants.parameters = {
  docs: {
    description: {
      story:
        'Visual comparison of all available variants: Default (Blue), Warning (Orange), Danger (Red), Info (Blue), and Success (Green).',
    },
  },
};
