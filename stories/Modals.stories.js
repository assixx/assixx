/**
 * Modals – Overlay Dialogs
 *
 * Glassmorphism modals for forms, confirmations, and dialogs.
 * Use ONLY for critical interactions, NOT for complex data entry.
 */

export default {
  title: 'Design System/Modals',
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'assixx-dark',
    },
  },
  tags: ['autodocs'],
};

/**
 * Basic Modal
 *
 * Standard modal with header, body, and footer.
 */
export const BasicModal = {
  args: {
    size: 'md',
    title: 'Modal Title',
    footerAlign: 'right',
    showClose: true,
  },
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl', 'full'],
      description: 'Modal width (sm=500px, md=700px, lg=900px, xl=1200px)',
    },
    title: {
      control: 'text',
      description: 'Modal title',
    },
    footerAlign: {
      control: 'select',
      options: ['left', 'right', 'center', 'spaced'],
      description: 'Footer button alignment',
    },
    showClose: {
      control: 'boolean',
      description: 'Show close button',
    },
  },
  render: (args) => {
    const sizeClass = args.size !== 'md' ? `ds-modal--${args.size}` : '';
    const footerClass =
      args.footerAlign === 'center'
        ? 'ds-modal__footer--centered'
        : args.footerAlign === 'spaced'
          ? 'ds-modal__footer--spaced'
          : '';

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="modal-overlay modal-overlay--active">
        <div class="ds-modal ${sizeClass}">
          <div class="ds-modal__header">
            <h2 class="ds-modal__title">${args.title}</h2>
            ${
              args.showClose
                ? `
            <button class="ds-modal__close" data-action="close">
              <i class="fas fa-times"></i>
            </button>
            `
                : ''
            }
          </div>
          <div class="ds-modal__body">
            <p style="color: var(--color-text-secondary); margin-bottom: var(--spacing-4);">
              This is a basic modal with header, body, and footer.
            </p>
            <p style="color: var(--color-text-secondary);">
              Size: <strong>${args.size}</strong> (max-width: ${
                args.size === 'sm' ? '500px' : args.size === 'lg' ? '900px' : args.size === 'xl' ? '1200px' : args.size === 'full' ? '~100vw' : '700px'
              })
            </p>
          </div>
          <div class="ds-modal__footer ${footerClass}">
            <button class="btn btn-secondary">Cancel</button>
            <button class="btn btn-modal">Confirm</button>
          </div>
        </div>
      </div>
    `;

    return wrapper;
  },
};

/**
 * Confirmation Dialog (Small)
 *
 * Delete confirmation with danger action.
 */
export const ConfirmationDialog = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="modal-overlay modal-overlay--active">
        <div class="ds-modal ds-modal--sm">
          <div class="ds-modal__header">
            <h2 class="ds-modal__title">Delete User</h2>
            <button class="ds-modal__close" data-action="close">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="ds-modal__body">
            <p style="color: var(--color-text-secondary); margin-bottom: var(--spacing-4);">
              Are you sure you want to delete <strong>Max Mustermann</strong>?
            </p>
            <p style="color: var(--color-danger); font-size: 0.875rem;">
              <i class="fas fa-exclamation-triangle"></i> This action cannot be undone.
            </p>
          </div>
          <div class="ds-modal__footer ds-modal__footer--spaced">
            <button class="btn btn-secondary">Cancel</button>
            <button class="btn btn-danger">
              <i class="fas fa-trash"></i>
              Delete
            </button>
          </div>
        </div>
      </div>
    `;

    return wrapper;
  },
};

/**
 * Form Modal with Design System Fields
 *
 * Uses NEW form-field components from Design System.
 */
export const FormModal = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="modal-overlay modal-overlay--active">
        <div class="ds-modal ds-modal--lg">
          <div class="ds-modal__header">
            <h2 class="ds-modal__title">
              <i class="fas fa-calendar-plus"></i>
              Create Event
            </h2>
            <button class="ds-modal__close" data-action="close">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="ds-modal__body">
            <form style="display: grid; gap: var(--spacing-5);">

              <!-- Title Field - Design System -->
              <div class="form-field">
                <label class="form-field__label form-field__label--required" for="eventTitle">
                  Title
                </label>
                <input
                  type="text"
                  id="eventTitle"
                  class="form-field__control"
                  placeholder="Event title"
                  required
                >
              </div>

              <!-- Description Field - Design System -->
              <div class="form-field">
                <label class="form-field__label" for="eventDescription">
                  Description
                </label>
                <textarea
                  id="eventDescription"
                  class="form-field__control"
                  rows="4"
                  placeholder="Event description (optional)"
                ></textarea>
                <small class="form-field__message">
                  Markdown formatting supported
                </small>
              </div>

              <!-- Date & Time Row -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-4);">
                <div class="form-field">
                  <label class="form-field__label form-field__label--required" for="startDate">
                    Start Date
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    class="form-field__control"
                    required
                  >
                </div>
                <div class="form-field">
                  <label class="form-field__label form-field__label--required" for="startTime">
                    Start Time
                  </label>
                  <input
                    type="time"
                    id="startTime"
                    class="form-field__control"
                    required
                  >
                </div>
              </div>

              <!-- Location Field -->
              <div class="form-field">
                <label class="form-field__label" for="location">
                  <i class="fas fa-map-marker-alt"></i> Location
                </label>
                <input
                  type="text"
                  id="location"
                  class="form-field__control"
                  placeholder="e.g. Conference Room 1"
                >
              </div>

            </form>
          </div>
          <div class="ds-modal__footer">
            <button class="btn btn-secondary">
              Cancel
            </button>
            <button class="btn btn-modal">
              <i class="fas fa-save"></i>
              Create Event
            </button>
          </div>
        </div>
      </div>
    `;

    return wrapper;
  },
};

/**
 * Form with Dropdown (Design System)
 *
 * Uses NEW dropdown component from Design System.
 */
export const FormWithDropdown = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="modal-overlay modal-overlay--active">
        <div class="ds-modal ds-modal--md">
          <div class="ds-modal__header">
            <h2 class="ds-modal__title">
              <i class="fas fa-user-plus"></i>
              Add Team Member
            </h2>
            <button class="ds-modal__close" data-action="close">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="ds-modal__body">
            <form style="display: grid; gap: var(--spacing-5);">

              <!-- Name Field - Design System -->
              <div class="form-field">
                <label class="form-field__label form-field__label--required" for="memberName">
                  Full Name
                </label>
                <input
                  type="text"
                  id="memberName"
                  class="form-field__control"
                  placeholder="Max Mustermann"
                  required
                >
              </div>

              <!-- Email Field - Design System -->
              <div class="form-field">
                <label class="form-field__label form-field__label--required" for="memberEmail">
                  Email
                </label>
                <input
                  type="email"
                  id="memberEmail"
                  class="form-field__control"
                  placeholder="max@firma.de"
                  required
                >
              </div>

              <!-- Department Dropdown - Design System (Custom) -->
              <div class="form-field">
                <label class="form-field__label form-field__label--required">
                  Department
                </label>
                <div class="dropdown" style="margin-top: var(--spacing-2);">
                  <button type="button" class="dropdown__trigger" style="width: 100%;">
                    <span style="display: flex; align-items: center; gap: 8px;">
                      <i class="fas fa-sitemap"></i>
                      <span>Engineering</span>
                    </span>
                    <i class="fas fa-chevron-down"></i>
                  </button>
                  <div class="dropdown__menu" style="display: none;">
                    <div class="dropdown__option">
                      <i class="fas fa-code"></i> Engineering
                    </div>
                    <div class="dropdown__option">
                      <i class="fas fa-palette"></i> Design
                    </div>
                    <div class="dropdown__option">
                      <i class="fas fa-chart-line"></i> Sales
                    </div>
                    <div class="dropdown__option">
                      <i class="fas fa-headset"></i> Support
                    </div>
                  </div>
                </div>
              </div>

              <!-- Role Select - Native (preferred for simple cases) -->
              <div class="form-field">
                <label class="form-field__label form-field__label--required" for="memberRole">
                  Role
                </label>
                <select id="memberRole" class="form-field__control" required>
                  <option value="">-- Select role --</option>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="employee">Employee</option>
                </select>
              </div>

            </form>
          </div>
          <div class="ds-modal__footer">
            <button class="btn btn-secondary">
              Cancel
            </button>
            <button class="btn btn-modal">
              <i class="fas fa-user-plus"></i>
              Add Member
            </button>
          </div>
        </div>
      </div>
    `;

    return wrapper;
  },
};

/**
 * Generic Confirm Modal
 *
 * Reusable confirmation modal with customizable text and actions.
 * Use for any yes/no decision that requires user confirmation.
 */
export const ConfirmModal = {
  args: {
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed with this action?',
    icon: 'fa-question-circle',
    iconColor: 'var(--color-primary)',
    confirmText: 'Confirm',
    confirmVariant: 'primary',
    cancelText: 'Cancel',
    showWarning: false,
    warningText: 'This action cannot be undone.',
  },
  argTypes: {
    title: {
      control: 'text',
      description: 'Modal title',
    },
    message: {
      control: 'text',
      description: 'Main confirmation message',
    },
    icon: {
      control: 'select',
      options: [
        'fa-question-circle',
        'fa-exclamation-triangle',
        'fa-info-circle',
        'fa-check-circle',
      ],
      description: 'FontAwesome icon class',
    },
    iconColor: {
      control: 'select',
      options: [
        'var(--color-primary)',
        'var(--color-warning)',
        'var(--color-danger)',
        'var(--color-success)',
      ],
      description: 'Icon color',
    },
    confirmText: {
      control: 'text',
      description: 'Confirm button text',
    },
    confirmVariant: {
      control: 'select',
      options: ['primary', 'danger', 'success'],
      description: 'Confirm button variant',
    },
    cancelText: {
      control: 'text',
      description: 'Cancel button text',
    },
    showWarning: {
      control: 'boolean',
      description: 'Show warning message',
    },
    warningText: {
      control: 'text',
      description: 'Warning message text',
    },
  },
  render: (args) => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="modal-overlay modal-overlay--active">
        <div class="ds-modal ds-modal--sm">
          <div class="ds-modal__header">
            <h2 class="ds-modal__title">
              <i class="fas ${args.icon}" style="color: ${args.iconColor};"></i>
              ${args.title}
            </h2>
            <button class="ds-modal__close" data-action="close">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="ds-modal__body">
            <p style="color: var(--color-text-secondary); margin-bottom: var(--spacing-4);">
              ${args.message}
            </p>
            ${
              args.showWarning
                ? `
            <p style="color: var(--color-${args.confirmVariant === 'danger' ? 'danger' : 'warning'}); font-size: 0.875rem;">
              <i class="fas fa-exclamation-triangle"></i> ${args.warningText}
            </p>
            `
                : ''
            }
          </div>
          <div class="ds-modal__footer ds-modal__footer--spaced">
            <button class="btn btn-secondary">${args.cancelText}</button>
            <button class="btn btn-${args.confirmVariant === 'primary' ? 'modal' : args.confirmVariant}">
              ${args.confirmText}
            </button>
          </div>
        </div>
      </div>
    `;

    return wrapper;
  },
};

/**
 * Info Dialog
 *
 * Simple information modal with centered footer.
 */
export const InfoDialog = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="modal-overlay modal-overlay--active">
        <div class="ds-modal ds-modal--sm">
          <div class="ds-modal__header">
            <h2 class="ds-modal__title">
              <i class="fas fa-info-circle" style="color: var(--color-primary);"></i>
              Session Timeout
            </h2>
            <button class="ds-modal__close" data-action="close">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="ds-modal__body">
            <p style="color: var(--color-text-secondary); margin-bottom: var(--spacing-4);">
              Your session will expire in <strong>5 minutes</strong> due to inactivity.
            </p>
            <p style="color: var(--color-text-secondary);">
              Click "Stay Logged In" to continue your session.
            </p>
          </div>
          <div class="ds-modal__footer ds-modal__footer--centered">
            <button class="btn btn-modal">
              <i class="fas fa-check"></i>
              Stay Logged In
            </button>
          </div>
        </div>
      </div>
    `;

    return wrapper;
  },
};

/**
 * Scrollable Content
 *
 * Modal with long content that scrolls in body.
 */
export const ScrollableContent = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="modal-overlay modal-overlay--active">
        <div class="ds-modal ds-modal--md">
          <div class="ds-modal__header">
            <h2 class="ds-modal__title">Terms and Conditions</h2>
            <button class="ds-modal__close" data-action="close">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="ds-modal__body">
            <h3 style="color: var(--color-text-primary); margin-bottom: var(--spacing-3);">
              1. Introduction
            </h3>
            <p style="color: var(--color-text-secondary); margin-bottom: var(--spacing-6);">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
              incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
              exercitation ullamco laboris.
            </p>

            <h3 style="color: var(--color-text-primary); margin-bottom: var(--spacing-3);">
              2. User Responsibilities
            </h3>
            <p style="color: var(--color-text-secondary); margin-bottom: var(--spacing-6);">
              Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu
              fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in
              culpa qui officia deserunt mollit anim id est laborum.
            </p>

            <h3 style="color: var(--color-text-primary); margin-bottom: var(--spacing-3);">
              3. Privacy Policy
            </h3>
            <p style="color: var(--color-text-secondary); margin-bottom: var(--spacing-6);">
              Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque
              laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi
              architecto beatae vitae dicta sunt explicabo.
            </p>

            <h3 style="color: var(--color-text-primary); margin-bottom: var(--spacing-3);">
              4. Data Protection
            </h3>
            <p style="color: var(--color-text-secondary); margin-bottom: var(--spacing-6);">
              Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia
              consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.
            </p>

            <h3 style="color: var(--color-text-primary); margin-bottom: var(--spacing-3);">
              5. Termination
            </h3>
            <p style="color: var(--color-text-secondary);">
              Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci
              velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam
              aliquam quaerat voluptatem.
            </p>
          </div>
          <div class="ds-modal__footer">
            <button class="btn btn-secondary">Decline</button>
            <button class="btn btn-modal">Accept</button>
          </div>
        </div>
      </div>
    `;

    return wrapper;
  },
};

/**
 * Logout Confirmation
 *
 * Confirmation dialog for logging out.
 */
export const LogoutConfirmation = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="modal-overlay modal-overlay--active">
        <div class="ds-modal ds-modal--sm">
          <div class="ds-modal__header">
            <h2 class="ds-modal__title">
              <i class="fas fa-sign-out-alt"></i>
              Logout
            </h2>
            <button class="ds-modal__close" data-action="close">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="ds-modal__body">
            <p style="color: var(--color-text-secondary); margin-bottom: var(--spacing-4);">
              Are you sure you want to logout?
            </p>
            <p style="color: var(--color-text-secondary); font-size: 0.875rem;">
              <i class="fas fa-info-circle"></i> Your current session will be terminated.
            </p>
          </div>
          <div class="ds-modal__footer ds-modal__footer--spaced">
            <button class="btn btn-secondary">Cancel</button>
            <button class="btn btn-danger">
              <i class="fas fa-sign-out-alt"></i>
              Logout
            </button>
          </div>
        </div>
      </div>
    `;

    return wrapper;
  },
};

/**
 * All Sizes Comparison
 *
 * Shows all available modal sizes side by side.
 */
export const AllSizes = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'grid';
    wrapper.style.gap = '32px';
    wrapper.style.padding = '24px';

    const sizes = [
      { size: 'sm', width: '500px', label: 'Small' },
      { size: 'md', width: '700px', label: 'Medium (Default)' },
      { size: 'lg', width: '900px', label: 'Large' },
      { size: 'xl', width: '1200px', label: 'Extra Large' },
    ];

    sizes.forEach(({ size, width, label }) => {
      const section = document.createElement('div');
      section.innerHTML = `
        <h3 style="color: var(--color-text-primary); margin-bottom: 16px;">
          ${label} - max-width: ${width}
        </h3>
        <div class="modal-overlay modal-overlay--active" style="position: relative; height: 400px;">
          <div class="ds-modal ds-modal--${size}">
            <div class="ds-modal__header">
              <h2 class="ds-modal__title">${label} Modal</h2>
              <button class="ds-modal__close">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <div class="ds-modal__body">
              <p style="color: var(--color-text-secondary);">
                Max-width: <strong>${width}</strong>
              </p>
            </div>
            <div class="ds-modal__footer">
              <button class="btn btn-secondary">Cancel</button>
              <button class="btn btn-modal">Confirm</button>
            </div>
          </div>
        </div>
      `;
      wrapper.appendChild(section);
    });

    return wrapper;
  },
};
