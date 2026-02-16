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
      args.footerAlign === 'center' ? 'ds-modal__footer--centered'
      : args.footerAlign === 'spaced' ? 'ds-modal__footer--spaced'
      : '';

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="modal-overlay modal-overlay--active">
        <div class="ds-modal ${sizeClass}">
          <div class="ds-modal__header">
            <h2 class="ds-modal__title">${args.title}</h2>
            ${
              args.showClose ?
                `
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
                args.size === 'sm' ? '500px'
                : args.size === 'lg' ? '900px'
                : args.size === 'xl' ? '1200px'
                : args.size === 'full' ? '~100vw'
                : '700px'
              })
            </p>
          </div>
          <div class="ds-modal__footer ${footerClass}">
            <button class="btn btn-cancel">Cancel</button>
            <button class="btn btn-primary">Confirm</button>
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
            <button class="btn btn-cancel">Cancel</button>
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
            <button class="btn btn-cancel">
              Cancel
            </button>
            <button class="btn btn-primary">
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
            <button class="btn btn-cancel">
              Cancel
            </button>
            <button class="btn btn-primary">
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
              args.showWarning ?
                `
            <p style="color: var(--color-${args.confirmVariant === 'danger' ? 'danger' : 'warning'}); font-size: 0.875rem;">
              <i class="fas fa-exclamation-triangle"></i> ${args.warningText}
            </p>
            `
              : ''
            }
          </div>
          <div class="ds-modal__footer ds-modal__footer--spaced">
            <button class="btn btn-cancel">${args.cancelText}</button>
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
            <button class="btn btn-primary">
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
            <button class="btn btn-cancel">Decline</button>
            <button class="btn btn-primary">Accept</button>
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
        <div class="ds-modal ds-modal--sm ds-modal--logout">
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
            <button class="btn btn-dark">Cancel</button>
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
              <button class="btn btn-cancel">Cancel</button>
              <button class="btn btn-primary">Confirm</button>
            </div>
          </div>
        </div>
      `;
      wrapper.appendChild(section);
    });

    return wrapper;
  },
};

/**
 * Upload Modal
 *
 * Modal for uploading documents with drag-and-drop support.
 * Used in documents-explorer for admins and root users.
 */
export const UploadModal = {
  args: {
    maxFileSize: '10 MB',
    acceptedFormats: '.pdf, .doc, .docx, .xls, .xlsx, .jpg, .png',
    showProgress: false,
    uploadProgress: 0,
  },
  argTypes: {
    maxFileSize: {
      control: 'text',
      description: 'Maximum file size allowed',
    },
    acceptedFormats: {
      control: 'text',
      description: 'Accepted file formats',
    },
    showProgress: {
      control: 'boolean',
      description: 'Show upload progress bar',
    },
    uploadProgress: {
      control: { type: 'range', min: 0, max: 100 },
      description: 'Upload progress percentage',
    },
  },
  render: (args) => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="modal-overlay modal-overlay--active">
        <div class="ds-modal ds-modal--lg">
          <div class="ds-modal__header">
            <h3 class="ds-modal__title">
              <i class="fas fa-upload mr-2"></i>
              Dokument hochladen
            </h3>
            <button type="button" class="ds-modal__close" data-action="close">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="ds-modal__body">
            <form style="display: grid; gap: var(--spacing-5);">

              <!-- Upload Area -->
              <div class="upload-zone" style="
                border: 2px dashed var(--color-border);
                border-radius: 12px;
                padding: 40px;
                text-align: center;
                background: rgba(59, 130, 246, 0.05);
                transition: all 0.3s ease;
                cursor: pointer;
              " onmouseover="this.style.borderColor='var(--color-primary)'; this.style.background='rgba(59, 130, 246, 0.1)'"
                 onmouseout="this.style.borderColor='var(--color-border)'; this.style.background='rgba(59, 130, 246, 0.05)'">
                <i class="fas fa-cloud-upload-alt" style="font-size: 48px; color: var(--color-primary); margin-bottom: 16px;"></i>
                <h4 style="color: var(--color-text-primary); margin-bottom: 8px;">
                  Datei hier ablegen oder klicken zum Auswählen
                </h4>
                <p style="color: var(--color-text-secondary); font-size: 14px; margin-bottom: 8px;">
                  Maximale Dateigröße: ${args.maxFileSize}
                </p>
                <p style="color: var(--color-text-tertiary); font-size: 12px;">
                  Unterstützte Formate: ${args.acceptedFormats}
                </p>
                <input type="file" style="display: none;" accept="${args.acceptedFormats}" />
              </div>

              <!-- Selected File Display (when file is selected) -->
              <div class="selected-file" style="
                display: none;
                padding: 16px;
                background: var(--background-secondary);
                border-radius: 8px;
                border: 1px solid var(--color-border);
              ">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <i class="fas fa-file-pdf" style="font-size: 32px; color: var(--color-danger);"></i>
                  <div style="flex: 1;">
                    <div style="color: var(--color-text-primary); font-weight: 500;">Beispieldokument.pdf</div>
                    <div style="color: var(--color-text-secondary); font-size: 14px;">2.5 MB</div>
                  </div>
                  <button type="button" class="btn btn-sm btn-danger" style="padding: 4px 8px;">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              </div>

              <!-- Upload Progress (shown during upload) -->
              ${
                args.showProgress ?
                  `
              <div class="upload-progress" style="
                padding: 16px;
                background: var(--background-secondary);
                border-radius: 8px;
                border: 1px solid var(--color-border);
              ">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                  <span style="color: var(--color-text-primary); font-size: 14px;">Hochladen...</span>
                  <span style="color: var(--color-text-secondary); font-size: 14px;">${args.uploadProgress}%</span>
                </div>
                <div class="progress" style="height: 8px;">
                  <div class="progress__bar" style="width: ${args.uploadProgress}%; background: var(--gradient-primary);"></div>
                </div>
              </div>
              `
                : ''
              }

              <!-- Category Selection - Custom Dropdown -->
              <div class="form-field">
                <label class="form-field__label form-field__label--required">
                  Kategorie
                </label>
                <div class="dropdown" style="margin-top: var(--spacing-2);">
                  <button type="button" class="dropdown__trigger" style="width: 100%;">
                    <span style="display: flex; align-items: center; gap: 8px;">
                      <i class="fas fa-folder"></i>
                      <span>Kategorie wählen</span>
                    </span>
                    <i class="fas fa-chevron-down"></i>
                  </button>
                  <div class="dropdown__menu" style="display: none;">
                    <div class="dropdown__option" data-value="personal">
                      <i class="fas fa-user"></i> Persönliche Dokumente
                    </div>
                    <div class="dropdown__option" data-value="team">
                      <i class="fas fa-users"></i> Team Dokumente
                    </div>
                    <div class="dropdown__option" data-value="department">
                      <i class="fas fa-building"></i> Abteilungsdokumente
                    </div>
                    <div class="dropdown__option" data-value="company">
                      <i class="fas fa-briefcase"></i> Firmendokumente
                    </div>
                    <div class="dropdown__option" data-value="payroll">
                      <i class="fas fa-money-bill-wave"></i> Gehaltsabrechnungen
                    </div>
                  </div>
                </div>
              </div>

              <!-- Document Name -->
              <div class="form-field">
                <label class="form-field__label form-field__label--required" for="docName">
                  Dokumentname
                </label>
                <input
                  type="text"
                  id="docName"
                  class="form-field__control"
                  placeholder="z.B. Arbeitsvertrag 2025"
                  required
                >
                <small class="form-field__message">
                  Der Name wird in der Dokumentenliste angezeigt
                </small>
              </div>

              <!-- Description -->
              <div class="form-field">
                <label class="form-field__label" for="docDescription">
                  Beschreibung
                </label>
                <textarea
                  id="docDescription"
                  class="form-field__control"
                  rows="3"
                  placeholder="Optionale Beschreibung des Dokuments..."
                ></textarea>
              </div>

              <!-- Target Selection (for Admin/Root) -->
              <div class="form-field">
                <label class="form-field__label">
                  Sichtbarkeit
                </label>
                <div style="display: grid; gap: 12px;">
                  <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="radio" name="visibility" value="private" checked>
                    <span style="color: var(--color-text-primary);">
                      <i class="fas fa-lock mr-2"></i>Privat (nur für mich)
                    </span>
                  </label>
                  <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="radio" name="visibility" value="team">
                    <span style="color: var(--color-text-primary);">
                      <i class="fas fa-users mr-2"></i>Team
                    </span>
                  </label>
                  <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="radio" name="visibility" value="department">
                    <span style="color: var(--color-text-primary);">
                      <i class="fas fa-building mr-2"></i>Abteilung
                    </span>
                  </label>
                  <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="radio" name="visibility" value="company">
                    <span style="color: var(--color-text-primary);">
                      <i class="fas fa-briefcase mr-2"></i>Gesamte Firma
                    </span>
                  </label>
                </div>
              </div>

              <!-- Tags -->
              <div class="form-field">
                <label class="form-field__label" for="docTags">
                  Tags
                </label>
                <input
                  type="text"
                  id="docTags"
                  class="form-field__control"
                  placeholder="z.B. vertrag, 2025, personal (kommagetrennt)"
                >
                <small class="form-field__message">
                  Tags helfen beim späteren Suchen und Filtern
                </small>
              </div>

            </form>
          </div>
          <div class="ds-modal__footer">
            <button type="button" class="btn btn-cancel">
              Abbrechen
            </button>
            <button type="button" class="btn btn-primary">
              <i class="fas fa-upload mr-2"></i>
              Hochladen
            </button>
          </div>
        </div>
      </div>
    `;

    return wrapper;
  },
};

/**
 * Document Preview Modal
 *
 * Modal for previewing PDF documents with metadata display.
 * Used in documents-search and other document pages.
 */
export const DocumentPreviewModal = {
  args: {
    state: 'loaded',
    documentName: 'Gehaltsabrechnung_Januar_2025.pdf',
    fileName: 'Gehaltsabrechnung_Januar_2025.pdf',
    fileSize: '2.9 MB',
    uploadedBy: 'Max Mustermann',
    uploadDate: '06.11.2025',
  },
  argTypes: {
    state: {
      control: 'select',
      options: ['loading', 'loaded', 'error'],
      description: 'Preview state',
    },
    documentName: {
      control: 'text',
      description: 'Document title (displayed in header)',
    },
    fileName: {
      control: 'text',
      description: 'File name',
    },
    fileSize: {
      control: 'text',
      description: 'File size (formatted)',
    },
    uploadedBy: {
      control: 'text',
      description: 'Uploader name',
    },
    uploadDate: {
      control: 'text',
      description: 'Upload date (formatted)',
    },
  },
  render: (args) => {
    const wrapper = document.createElement('div');

    // Determine iframe content based on state
    let iframeContent = '';
    let previewErrorVisible = 'u-hidden';

    if (args.state === 'loading') {
      iframeContent = `
        <div class="flex justify-center items-center h-full">
          <div class="spinner"></div>
          <span class="ml-3 text-[var(--color-text-secondary)]">Lade Vorschau...</span>
        </div>
      `;
      previewErrorVisible = 'u-hidden';
    } else if (args.state === 'error') {
      iframeContent = '';
      previewErrorVisible = '';
    } else {
      // Loaded state - show placeholder for PDF
      iframeContent = `
        <div class="flex flex-col justify-center items-center h-full bg-[var(--background-tertiary)] text-[var(--color-text-secondary)]">
          <i class="fas fa-file-pdf text-6xl mb-4" style="color: var(--color-danger);"></i>
          <p class="font-medium mb-2">PDF Vorschau</p>
          <small>In production würde hier das PDF im iframe angezeigt</small>
        </div>
      `;
      previewErrorVisible = 'u-hidden';
    }

    wrapper.innerHTML = `
      <div class="modal-overlay modal-overlay--active">
        <div class="ds-modal ds-modal--lg">
          <div class="ds-modal__header">
            <h3 class="ds-modal__title">
              <i class="fas fa-file-alt mr-2"></i>
              <span id="modalDocumentTitle">${args.documentName}</span>
            </h3>
            <button type="button" class="ds-modal__close" data-action="close-document-modal">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="ds-modal__body">
            <!-- Document Preview iframe -->
            <div class="mb-4 relative">
              ${
                args.state === 'loaded' || args.state === 'loading' ?
                  `
              <div class="w-full h-[600px] border border-[var(--color-border)] rounded-lg overflow-hidden">
                ${iframeContent}
              </div>
              `
                : ''
              }
              <div id="previewError" class="${previewErrorVisible} text-center py-10">
                <i class="fas fa-exclamation-circle text-4xl text-[var(--color-text-secondary)] mb-4"></i>
                <p class="text-[var(--color-text-primary)] mb-2">Vorschau nicht verfügbar</p>
                <small class="text-[var(--color-text-secondary)]">Das Dokument kann nicht in der Vorschau angezeigt werden.</small>
              </div>
            </div>

            <!-- Document Info Grid -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-[var(--background-secondary)] rounded-lg">
              <div class="flex items-start gap-3">
                <i class="fas fa-file text-[var(--color-primary)] mt-1 flex-shrink-0"></i>
                <div class="min-w-0 flex-1">
                  <label class="text-sm text-[var(--color-text-secondary)] block mb-1">Dateiname</label>
                  <span id="modalFileName" class="text-[var(--color-text-primary)] font-medium block break-words">${args.fileName}</span>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <i class="fas fa-weight text-[var(--color-primary)] mt-1 flex-shrink-0"></i>
                <div class="min-w-0 flex-1">
                  <label class="text-sm text-[var(--color-text-secondary)] block mb-1">Größe</label>
                  <span id="modalFileSize" class="text-[var(--color-text-primary)] font-medium block">${args.fileSize}</span>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <i class="fas fa-user text-[var(--color-primary)] mt-1 flex-shrink-0"></i>
                <div class="min-w-0 flex-1">
                  <label class="text-sm text-[var(--color-text-secondary)] block mb-1">Hochgeladen von</label>
                  <span id="modalUploadedBy" class="text-[var(--color-text-primary)] font-medium block break-words">${args.uploadedBy}</span>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <i class="fas fa-calendar text-[var(--color-primary)] mt-1 flex-shrink-0"></i>
                <div class="min-w-0 flex-1">
                  <label class="text-sm text-[var(--color-text-secondary)] block mb-1">Datum</label>
                  <span id="modalUploadDate" class="text-[var(--color-text-primary)] font-medium block">${args.uploadDate}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="ds-modal__footer">
            <button type="button" class="btn btn-cancel" data-action="close-document-modal">
              <i class="fas fa-times mr-2"></i>
              Schließen
            </button>
            <button type="button" class="btn btn-primary" id="downloadButton" data-action="download-document">
              <i class="fas fa-download mr-2"></i>
              Herunterladen
            </button>
          </div>
        </div>
      </div>
    `;

    return wrapper;
  },
};
