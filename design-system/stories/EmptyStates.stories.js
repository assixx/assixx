/**
 * Empty States Component – "No Data" Screens
 *
 * Minimal empty state displays with gray icons, message, and optional action.
 * Clean, unobtrusive design for when there's nothing to show.
 */

export default {
  title: 'Design System/Empty States',
  tags: ['autodocs'],

  parameters: {
    layout: 'centered',
  },

  argTypes: {
    icon: {
      control: 'text',
      description: 'FontAwesome icon class',
    },
    title: {
      control: 'text',
      description: 'Empty state title',
    },
    description: {
      control: 'text',
      description: 'Empty state description',
    },
    buttonText: {
      control: 'text',
      description: 'Action button text',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Empty state size',
    },
  },
};

/**
 * Basic Empty State
 */
export const BasicEmpty = {
  args: {
    icon: 'fa-inbox',
    title: 'No items found',
    description: 'Get started by creating your first item.',
    buttonText: 'Create Item',
    size: 'md',
  },
  render: (args) => {
    const wrapper = document.createElement('div');
    wrapper.style.width = '600px';
    wrapper.style.minHeight = '400px';

    const sizeClass = args.size !== 'md' ? `empty-state--${args.size}` : '';

    wrapper.innerHTML = `
      <div class="empty-state ${sizeClass}">
        <div class="empty-state__icon">
          <i class="fas ${args.icon}"></i>
        </div>
        <h3 class="empty-state__title">${args.title}</h3>
        <p class="empty-state__description">${args.description}</p>
        ${args.buttonText ? `<button class="btn btn-primary">${args.buttonText}</button>` : ''}
      </div>
    `;

    return wrapper;
  },
};

/**
 * Common Use Cases
 */
export const CommonUseCases = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem;">
        <!-- No Users -->
        <div class="empty-state empty-state--bordered">
          <div class="empty-state__icon">
            <i class="fas fa-users"></i>
          </div>
          <h3 class="empty-state__title">No users yet</h3>
          <p class="empty-state__description">Add your first team member to get started.</p>
          <button class="btn btn-primary btn-sm">
            <i class="fas fa-plus"></i> Add User
          </button>
        </div>

        <!-- No Documents -->
        <div class="empty-state empty-state--bordered">
          <div class="empty-state__icon">
            <i class="fas fa-file-alt"></i>
          </div>
          <h3 class="empty-state__title">No documents</h3>
          <p class="empty-state__description">Upload your first document to begin.</p>
          <button class="btn btn-primary btn-sm">
            <i class="fas fa-upload"></i> Upload Document
          </button>
        </div>

        <!-- No Search Results -->
        <div class="empty-state empty-state--bordered">
          <div class="empty-state__icon">
            <i class="fas fa-search"></i>
          </div>
          <h3 class="empty-state__title">No results found</h3>
          <p class="empty-state__description">Try adjusting your search or filter criteria.</p>
          <button class="btn btn-cancel btn-sm">Clear Filters</button>
        </div>

        <!-- No Notifications -->
        <div class="empty-state empty-state--bordered">
          <div class="empty-state__icon">
            <i class="fas fa-bell"></i>
          </div>
          <h3 class="empty-state__title">No notifications</h3>
          <p class="empty-state__description">You're all caught up! Nothing to see here.</p>
        </div>
      </div>
    `;

    return wrapper;
  },
  parameters: {
    layout: 'padded',
  },
};

/**
 * Size Variants
 */
export const SizeVariants = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 2rem;">
        <div>
          <h4 style="margin-bottom: 1rem; color: var(--color-text-secondary);">Small</h4>
          <div class="empty-state empty-state--sm empty-state--bordered">
            <div class="empty-state__icon">
              <i class="fas fa-inbox"></i>
            </div>
            <h3 class="empty-state__title">Empty inbox</h3>
            <p class="empty-state__description">No messages to display.</p>
          </div>
        </div>

        <div>
          <h4 style="margin-bottom: 1rem; color: var(--color-text-secondary);">Medium (Default)</h4>
          <div class="empty-state empty-state--bordered">
            <div class="empty-state__icon">
              <i class="fas fa-inbox"></i>
            </div>
            <h3 class="empty-state__title">Empty inbox</h3>
            <p class="empty-state__description">No messages to display at this time.</p>
            <button class="btn btn-primary btn-sm">Compose Message</button>
          </div>
        </div>

        <div>
          <h4 style="margin-bottom: 1rem; color: var(--color-text-secondary);">Large</h4>
          <div class="empty-state empty-state--lg empty-state--bordered">
            <div class="empty-state__icon">
              <i class="fas fa-inbox"></i>
            </div>
            <h3 class="empty-state__title">Empty inbox</h3>
            <p class="empty-state__description">Your inbox is empty. Start a conversation or wait for new messages to arrive.</p>
            <button class="btn btn-primary">Compose Message</button>
          </div>
        </div>
      </div>
    `;

    return wrapper;
  },
  parameters: {
    layout: 'padded',
  },
};

/**
 * Semantic Variants (Colored Icons)
 */
export const SemanticVariants = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem;">
        <!-- Default (Gray) -->
        <div class="empty-state empty-state--bordered">
          <div class="empty-state__icon">
            <i class="fas fa-inbox"></i>
          </div>
          <h3 class="empty-state__title">Default (Gray)</h3>
          <p class="empty-state__description">Neutral, minimal empty state.</p>
        </div>

        <!-- Info -->
        <div class="empty-state empty-state--info empty-state--bordered">
          <div class="empty-state__icon">
            <i class="fas fa-info-circle"></i>
          </div>
          <h3 class="empty-state__title">Info State</h3>
          <p class="empty-state__description">Informational message or guidance.</p>
        </div>

        <!-- Warning -->
        <div class="empty-state empty-state--warning empty-state--bordered">
          <div class="empty-state__icon">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          <h3 class="empty-state__title">Warning State</h3>
          <p class="empty-state__description">Attention needed or caution required.</p>
        </div>

        <!-- Error -->
        <div class="empty-state empty-state--error empty-state--bordered">
          <div class="empty-state__icon">
            <i class="fas fa-times-circle"></i>
          </div>
          <h3 class="empty-state__title">Error State</h3>
          <p class="empty-state__description">Something went wrong. Please try again.</p>
          <button class="btn btn-danger btn-sm">Retry</button>
        </div>

        <!-- Success -->
        <div class="empty-state empty-state--success empty-state--bordered">
          <div class="empty-state__icon">
            <i class="fas fa-check-circle"></i>
          </div>
          <h3 class="empty-state__title">Success State</h3>
          <p class="empty-state__description">All done! Everything is complete.</p>
        </div>
      </div>
    `;

    return wrapper;
  },
  parameters: {
    layout: 'padded',
  },
};

/**
 * Style Variants
 */
export const StyleVariants = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 2rem;">
        <div>
          <h4 style="margin-bottom: 1rem; color: var(--color-text-secondary);">Default (No Border)</h4>
          <div class="empty-state">
            <div class="empty-state__icon">
              <i class="fas fa-inbox"></i>
            </div>
            <h3 class="empty-state__title">No items found</h3>
            <p class="empty-state__description">Clean, minimal design without border.</p>
          </div>
        </div>

        <div>
          <h4 style="margin-bottom: 1rem; color: var(--color-text-secondary);">Bordered</h4>
          <div class="empty-state empty-state--bordered">
            <div class="empty-state__icon">
              <i class="fas fa-inbox"></i>
            </div>
            <h3 class="empty-state__title">No items found</h3>
            <p class="empty-state__description">With glassmorphism card border.</p>
          </div>
        </div>

        <div>
          <h4 style="margin-bottom: 1rem; color: var(--color-text-secondary);">Minimal (No Icon Background)</h4>
          <div class="empty-state empty-state--minimal">
            <div class="empty-state__icon">
              <i class="fas fa-inbox"></i>
            </div>
            <h3 class="empty-state__title">No items found</h3>
            <p class="empty-state__description">Ultra-minimal with transparent icon.</p>
          </div>
        </div>
      </div>
    `;

    return wrapper;
  },
  parameters: {
    layout: 'padded',
  },
};

/**
 * With Multiple Actions
 */
export const WithActions = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="empty-state empty-state--bordered" style="max-width: 600px;">
        <div class="empty-state__icon">
          <i class="fas fa-folder-open"></i>
        </div>
        <h3 class="empty-state__title">No projects yet</h3>
        <p class="empty-state__description">Create your first project or import an existing one to get started.</p>

        <div class="empty-state__actions">
          <button class="btn btn-primary">
            <i class="fas fa-plus"></i> New Project
          </button>
          <button class="btn btn-cancel">
            <i class="fas fa-upload"></i> Import
          </button>
        </div>

        <div class="empty-state__help">
          Need help? <a href="#">View documentation</a>
        </div>
      </div>
    `;

    return wrapper;
  },
};

/**
 * In Table Context
 */
export const InTable = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div style="max-width: 800px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="margin: 0; color: var(--color-text-primary);">Users</h3>
          <button class="btn btn-primary btn-sm">
            <i class="fas fa-plus"></i> Add User
          </button>
        </div>

        <div style="border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; background: rgba(255, 255, 255, 0.02);">
          <!-- Table Header -->
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; padding: 1rem; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
            <div style="color: var(--color-text-secondary); font-size: 0.875rem; font-weight: 600;">Name</div>
            <div style="color: var(--color-text-secondary); font-size: 0.875rem; font-weight: 600;">Email</div>
            <div style="color: var(--color-text-secondary); font-size: 0.875rem; font-weight: 600;">Role</div>
          </div>

          <!-- Empty State -->
          <div class="empty-state empty-state--in-table">
            <div class="empty-state__icon">
              <i class="fas fa-users"></i>
            </div>
            <h3 class="empty-state__title">No users found</h3>
            <p class="empty-state__description">Add your first team member to get started.</p>
            <button class="btn btn-primary btn-sm">
              <i class="fas fa-plus"></i> Add User
            </button>
          </div>
        </div>
      </div>
    `;

    return wrapper;
  },
  parameters: {
    layout: 'padded',
  },
};

/**
 * Real-World Example: Document Management
 */
export const DocumentManagement = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div style="max-width: 900px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <div>
            <h2 style="margin: 0 0 0.25rem 0; color: var(--color-text-primary);">Documents</h2>
            <p style="margin: 0; color: var(--color-text-muted); font-size: 0.875rem;">Manage your company documents</p>
          </div>
          <button class="btn btn-primary">
            <i class="fas fa-upload"></i> Upload Document
          </button>
        </div>

        <div class="empty-state empty-state--lg empty-state--bordered">
          <div class="empty-state__icon">
            <i class="fas fa-file-alt"></i>
          </div>
          <h3 class="empty-state__title">No documents uploaded</h3>
          <p class="empty-state__description">Start building your document library by uploading your first file. Supported formats: PDF, DOC, DOCX, XLS, XLSX.</p>

          <div class="empty-state__actions">
            <button class="btn btn-primary">
              <i class="fas fa-upload"></i> Upload Document
            </button>
            <button class="btn btn-cancel">
              <i class="fas fa-folder"></i> Browse Templates
            </button>
          </div>

          <div class="empty-state__help">
            Maximum file size: 10MB · <a href="#">View upload guidelines</a>
          </div>
        </div>
      </div>
    `;

    return wrapper;
  },
  parameters: {
    layout: 'padded',
  },
};

/**
 * Real-World Example: Search Results
 */
export const SearchResults = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div style="max-width: 700px;">
        <div style="margin-bottom: 1.5rem;">
          <div class="search-input">
            <i class="search-input__icon fas fa-search"></i>
            <input type="search" class="search-input__field" placeholder="Search..." value="nonexistent query">
            <button class="search-input__clear" type="button" aria-label="Clear search">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>

        <div class="empty-state empty-state--bordered">
          <div class="empty-state__icon">
            <i class="fas fa-search"></i>
          </div>
          <h3 class="empty-state__title">No results found for "nonexistent query"</h3>
          <p class="empty-state__description">Try different keywords or check your spelling. You can also browse all items below.</p>

          <div class="empty-state__actions">
            <button class="btn btn-cancel btn-sm">Clear Search</button>
            <button class="btn btn-cancel btn-sm">Browse All</button>
          </div>
        </div>
      </div>
    `;

    return wrapper;
  },
  parameters: {
    layout: 'padded',
  },
};

/**
 * All Variants Showcase
 */
export const AllVariants = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 3rem;">
        <!-- Sizes -->
        <div>
          <h3 style="margin-bottom: 1.5rem; color: var(--color-text-secondary);">Sizes</h3>
          <div style="display: grid; gap: 1.5rem;">
            <div class="empty-state empty-state--sm empty-state--bordered">
              <div class="empty-state__icon">
                <i class="fas fa-inbox"></i>
              </div>
              <h3 class="empty-state__title">Small</h3>
              <p class="empty-state__description">Compact empty state.</p>
            </div>

            <div class="empty-state empty-state--bordered">
              <div class="empty-state__icon">
                <i class="fas fa-inbox"></i>
              </div>
              <h3 class="empty-state__title">Medium</h3>
              <p class="empty-state__description">Default empty state size.</p>
            </div>

            <div class="empty-state empty-state--lg empty-state--bordered">
              <div class="empty-state__icon">
                <i class="fas fa-inbox"></i>
              </div>
              <h3 class="empty-state__title">Large</h3>
              <p class="empty-state__description">Prominent empty state for main content areas.</p>
            </div>
          </div>
        </div>

        <!-- Semantic States -->
        <div>
          <h3 style="margin-bottom: 1.5rem; color: var(--color-text-secondary);">Semantic States</h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
            <div class="empty-state empty-state--info empty-state--bordered">
              <div class="empty-state__icon">
                <i class="fas fa-info-circle"></i>
              </div>
              <h3 class="empty-state__title">Info</h3>
              <p class="empty-state__description">Informational state.</p>
            </div>

            <div class="empty-state empty-state--warning empty-state--bordered">
              <div class="empty-state__icon">
                <i class="fas fa-exclamation-triangle"></i>
              </div>
              <h3 class="empty-state__title">Warning</h3>
              <p class="empty-state__description">Warning state.</p>
            </div>

            <div class="empty-state empty-state--error empty-state--bordered">
              <div class="empty-state__icon">
                <i class="fas fa-times-circle"></i>
              </div>
              <h3 class="empty-state__title">Error</h3>
              <p class="empty-state__description">Error state.</p>
            </div>

            <div class="empty-state empty-state--success empty-state--bordered">
              <div class="empty-state__icon">
                <i class="fas fa-check-circle"></i>
              </div>
              <h3 class="empty-state__title">Success</h3>
              <p class="empty-state__description">Success state.</p>
            </div>
          </div>
        </div>
      </div>
    `;

    return wrapper;
  },
  parameters: {
    layout: 'padded',
  },
};
