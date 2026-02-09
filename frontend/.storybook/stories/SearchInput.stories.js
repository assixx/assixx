/**
 * Search Input Component – Enhanced Search with Icons
 *
 * Search input field with leading icon, trailing clear button, and loading state.
 * Progressive enhancement - works without JavaScript.
 *
 * NOTE: This story demonstrates the CSS-only version.
 * - Auto-show/hide clear button
 * - Debounced search
 * - Loading state management
 */

export default {
  title: 'Design System/Search Input',
  tags: ['autodocs'],

  parameters: {
    layout: 'centered',
  },

  argTypes: {
    placeholder: {
      control: 'text',
      description: 'Placeholder text',
    },
    value: {
      control: 'text',
      description: 'Input value',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Input size',
    },
    disabled: {
      control: 'boolean',
      description: 'Disabled state',
    },
    loading: {
      control: 'boolean',
      description: 'Loading state',
    },
  },
};

/**
 * Basic Search Input
 */
export const BasicSearch = {
  args: {
    placeholder: 'Search...',
    value: '',
    size: 'md',
    disabled: false,
    loading: false,
  },
  render: (args) => {
    const wrapper = document.createElement('div');
    wrapper.style.width = '400px';

    const sizeClass = args.size !== 'md' ? `search-input--${args.size}` : '';
    const disabledClass = args.disabled ? 'search-input--disabled' : '';
    const loadingClass = args.loading ? 'search-input--loading' : '';

    wrapper.innerHTML = `
      <div class="search-input ${sizeClass} ${disabledClass} ${loadingClass}">
        <i class="search-input__icon fas fa-search"></i>
        <input
          type="search"
          class="search-input__field"
          placeholder="${args.placeholder}"
          value="${args.value}"
          ${args.disabled ? 'disabled' : ''}
        >
        <button class="search-input__clear" type="button" aria-label="Clear search">
          <i class="fas fa-times"></i>
        </button>
        <div class="search-input__spinner"></div>
      </div>
    `;

    // Initialize JavaScript
    setTimeout(() => {
      const searchElement = wrapper.querySelector('.search-input');
    }, 0);

    return wrapper;
  },
};

/**
 * Size Variants
 */
export const SizeVariants = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1.5rem; width: 400px;">
        <div>
          <label style="display: block; margin-bottom: 0.5rem; color: var(--color-text-secondary); font-size: 0.75rem;">Small</label>
          <div class="search-input search-input--sm">
            <i class="search-input__icon fas fa-search"></i>
            <input type="search" class="search-input__field" placeholder="Search users...">
            <button class="search-input__clear" type="button" aria-label="Clear search">
              <i class="fas fa-times"></i>
            </button>
            <div class="search-input__spinner"></div>
          </div>
        </div>

        <div>
          <label style="display: block; margin-bottom: 0.5rem; color: var(--color-text-secondary); font-size: 0.75rem;">Medium (Default)</label>
          <div class="search-input">
            <i class="search-input__icon fas fa-search"></i>
            <input type="search" class="search-input__field" placeholder="Search documents...">
            <button class="search-input__clear" type="button" aria-label="Clear search">
              <i class="fas fa-times"></i>
            </button>
            <div class="search-input__spinner"></div>
          </div>
        </div>

        <div>
          <label style="display: block; margin-bottom: 0.5rem; color: var(--color-text-secondary); font-size: 0.75rem;">Large</label>
          <div class="search-input search-input--lg">
            <i class="search-input__icon fas fa-search"></i>
            <input type="search" class="search-input__field" placeholder="Search everything...">
            <button class="search-input__clear" type="button" aria-label="Clear search">
              <i class="fas fa-times"></i>
            </button>
            <div class="search-input__spinner"></div>
          </div>
        </div>
      </div>
    `;

    // Initialize JavaScript for all
    setTimeout(() => {
      wrapper.querySelectorAll('.search-input').forEach((el) => {});
    }, 0);

    return wrapper;
  },
};

/**
 * States
 */
export const States = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1.5rem; width: 400px;">
        <div>
          <label style="display: block; margin-bottom: 0.5rem; color: var(--color-text-secondary); font-size: 0.75rem;">Normal</label>
          <div class="search-input">
            <i class="search-input__icon fas fa-search"></i>
            <input type="search" class="search-input__field" placeholder="Search...">
            <button class="search-input__clear" type="button" aria-label="Clear search">
              <i class="fas fa-times"></i>
            </button>
            <div class="search-input__spinner"></div>
          </div>
        </div>

        <div>
          <label style="display: block; margin-bottom: 0.5rem; color: var(--color-text-secondary); font-size: 0.75rem;">With Value (clear button shows)</label>
          <div class="search-input search-input--has-value">
            <i class="search-input__icon fas fa-search"></i>
            <input type="search" class="search-input__field" placeholder="Search..." value="example search">
            <button class="search-input__clear" type="button" aria-label="Clear search">
              <i class="fas fa-times"></i>
            </button>
            <div class="search-input__spinner"></div>
          </div>
        </div>

        <div>
          <label style="display: block; margin-bottom: 0.5rem; color: var(--color-text-secondary); font-size: 0.75rem;">Loading</label>
          <div class="search-input search-input--loading search-input--has-value">
            <i class="search-input__icon fas fa-search"></i>
            <input type="search" class="search-input__field" placeholder="Search..." value="searching">
            <button class="search-input__clear" type="button" aria-label="Clear search">
              <i class="fas fa-times"></i>
            </button>
            <div class="search-input__spinner"></div>
          </div>
        </div>

        <div>
          <label style="display: block; margin-bottom: 0.5rem; color: var(--color-text-secondary); font-size: 0.75rem;">Error</label>
          <div class="search-input search-input--error">
            <i class="search-input__icon fas fa-search"></i>
            <input type="search" class="search-input__field" placeholder="Search...">
            <button class="search-input__clear" type="button" aria-label="Clear search">
              <i class="fas fa-times"></i>
            </button>
            <div class="search-input__spinner"></div>
          </div>
          <p style="margin-top: 0.5rem; color: var(--color-danger); font-size: 0.75rem;">Search failed. Please try again.</p>
        </div>

        <div>
          <label style="display: block; margin-bottom: 0.5rem; color: var(--color-text-secondary); font-size: 0.75rem;">Success</label>
          <div class="search-input search-input--success search-input--has-value">
            <i class="search-input__icon fas fa-search"></i>
            <input type="search" class="search-input__field" placeholder="Search..." value="found results">
            <button class="search-input__clear" type="button" aria-label="Clear search">
              <i class="fas fa-times"></i>
            </button>
            <div class="search-input__spinner"></div>
          </div>
          <p style="margin-top: 0.5rem; color: var(--color-success); font-size: 0.75rem;">5 results found</p>
        </div>

        <div>
          <label style="display: block; margin-bottom: 0.5rem; color: var(--color-text-secondary); font-size: 0.75rem;">Disabled</label>
          <div class="search-input search-input--disabled">
            <i class="search-input__icon fas fa-search"></i>
            <input type="search" class="search-input__field" placeholder="Search..." disabled>
            <button class="search-input__clear" type="button" aria-label="Clear search">
              <i class="fas fa-times"></i>
            </button>
            <div class="search-input__spinner"></div>
          </div>
        </div>
      </div>
    `;

    // Initialize JavaScript
    setTimeout(() => {
      wrapper
        .querySelectorAll('.search-input:not(.search-input--disabled)')
        .forEach((el) => {});
    }, 0);

    return wrapper;
  },
};

/**
 * With Results Dropdown
 */
export const WithResults = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div style="width: 500px;">
        <div class="search-input-wrapper search-input-wrapper--open">
          <div class="search-input search-input--has-value">
            <i class="search-input__icon fas fa-search"></i>
            <input type="search" class="search-input__field" placeholder="Search users..." value="john">
            <button class="search-input__clear" type="button" aria-label="Clear search">
              <i class="fas fa-times"></i>
            </button>
            <div class="search-input__spinner"></div>
          </div>

          <div class="search-input__results">
            <div class="search-input__result-item search-input__result-item--active">
              <strong>John</strong> Doe <span style="color: var(--color-text-muted); font-size: 0.875rem;">· Admin</span>
            </div>
            <div class="search-input__result-item">
              <strong>John</strong> Smith <span style="color: var(--color-text-muted); font-size: 0.875rem;">· Employee</span>
            </div>
            <div class="search-input__result-item">
              <strong>John</strong>son Miller <span style="color: var(--color-text-muted); font-size: 0.875rem;">· Manager</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // Initialize JavaScript
    setTimeout(() => {
      const searchElement = wrapper.querySelector('.search-input');
    }, 0);

    return wrapper;
  },
};

/**
 * Real-World Example: Global Search
 */
export const GlobalSearch = {
  parameters: {
    layout: 'padded',
  },
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div style="max-width: 600px; padding: 2rem; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; backdrop-filter: blur(10px);">
        <h3 style="margin: 0 0 1.5rem 0; color: var(--color-text-primary);">Global Search</h3>

        <div class="search-input search-input--lg">
          <i class="search-input__icon fas fa-search"></i>
          <input type="search" class="search-input__field" placeholder="Search users, documents, or settings...">
          <button class="search-input__clear" type="button" aria-label="Clear search">
            <i class="fas fa-times"></i>
          </button>
          <div class="search-input__spinner"></div>
        </div>

        <div style="margin-top: 1.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button class="btn btn-sm" style="font-size: 0.75rem; padding: 0.25rem 0.75rem;">
            <i class="fas fa-users"></i> Users
          </button>
          <button class="btn btn-sm" style="font-size: 0.75rem; padding: 0.25rem 0.75rem;">
            <i class="fas fa-file"></i> Documents
          </button>
          <button class="btn btn-sm" style="font-size: 0.75rem; padding: 0.25rem 0.75rem;">
            <i class="fas fa-calendar"></i> Events
          </button>
          <button class="btn btn-sm" style="font-size: 0.75rem; padding: 0.25rem 0.75rem;">
            <i class="fas fa-cog"></i> Settings
          </button>
        </div>
      </div>
    `;

    // Initialize JavaScript
    setTimeout(() => {
      const searchElement = wrapper.querySelector('.search-input');
    }, 0);

    return wrapper;
  },
};

/**
 * Real-World Example: User Filter
 */
export const UserFilter = {
  parameters: {
    layout: 'padded',
  },
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div style="max-width: 800px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <h3 style="margin: 0; color: var(--color-text-primary);">Users</h3>
          <button class="btn btn-primary btn-sm">
            <i class="fas fa-plus"></i> Add User
          </button>
        </div>

        <div class="search-input">
          <i class="search-input__icon fas fa-search"></i>
          <input type="search" class="search-input__field" placeholder="Filter by name, email, or role...">
          <button class="search-input__clear" type="button" aria-label="Clear search">
            <i class="fas fa-times"></i>
          </button>
          <div class="search-input__spinner"></div>
        </div>

        <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 8px;">
          <p style="margin: 0; color: var(--color-text-muted); font-size: 0.875rem; text-align: center;">
            Showing all 156 users
          </p>
        </div>
      </div>
    `;

    // Initialize JavaScript
    setTimeout(() => {
      const searchElement = wrapper.querySelector('.search-input');
    }, 0);

    return wrapper;
  },
};

/**
 * All Variants Showcase
 */
export const AllVariants = {
  parameters: {
    layout: 'padded',
  },
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 3rem; max-width: 600px;">
        <!-- Sizes -->
        <div>
          <h3 style="margin-bottom: 1.5rem; color: var(--color-text-secondary);">Sizes</h3>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <div class="search-input search-input--sm">
              <i class="search-input__icon fas fa-search"></i>
              <input type="search" class="search-input__field" placeholder="Small search...">
              <button class="search-input__clear" type="button" aria-label="Clear search">
                <i class="fas fa-times"></i>
              </button>
              <div class="search-input__spinner"></div>
            </div>

            <div class="search-input">
              <i class="search-input__icon fas fa-search"></i>
              <input type="search" class="search-input__field" placeholder="Medium search (default)...">
              <button class="search-input__clear" type="button" aria-label="Clear search">
                <i class="fas fa-times"></i>
              </button>
              <div class="search-input__spinner"></div>
            </div>

            <div class="search-input search-input--lg">
              <i class="search-input__icon fas fa-search"></i>
              <input type="search" class="search-input__field" placeholder="Large search...">
              <button class="search-input__clear" type="button" aria-label="Clear search">
                <i class="fas fa-times"></i>
              </button>
              <div class="search-input__spinner"></div>
            </div>
          </div>
        </div>

        <!-- States -->
        <div>
          <h3 style="margin-bottom: 1.5rem; color: var(--color-text-secondary);">States</h3>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <div class="search-input search-input--has-value">
              <i class="search-input__icon fas fa-search"></i>
              <input type="search" class="search-input__field" placeholder="Search..." value="With value">
              <button class="search-input__clear" type="button" aria-label="Clear search">
                <i class="fas fa-times"></i>
              </button>
              <div class="search-input__spinner"></div>
            </div>

            <div class="search-input search-input--loading search-input--has-value">
              <i class="search-input__icon fas fa-search"></i>
              <input type="search" class="search-input__field" placeholder="Search..." value="Loading">
              <button class="search-input__clear" type="button" aria-label="Clear search">
                <i class="fas fa-times"></i>
              </button>
              <div class="search-input__spinner"></div>
            </div>

            <div class="search-input search-input--error">
              <i class="search-input__icon fas fa-search"></i>
              <input type="search" class="search-input__field" placeholder="Error state...">
              <button class="search-input__clear" type="button" aria-label="Clear search">
                <i class="fas fa-times"></i>
              </button>
              <div class="search-input__spinner"></div>
            </div>

            <div class="search-input search-input--success search-input--has-value">
              <i class="search-input__icon fas fa-search"></i>
              <input type="search" class="search-input__field" placeholder="Search..." value="Success">
              <button class="search-input__clear" type="button" aria-label="Clear search">
                <i class="fas fa-times"></i>
              </button>
              <div class="search-input__spinner"></div>
            </div>

            <div class="search-input search-input--disabled">
              <i class="search-input__icon fas fa-search"></i>
              <input type="search" class="search-input__field" placeholder="Disabled..." disabled>
              <button class="search-input__clear" type="button" aria-label="Clear search">
                <i class="fas fa-times"></i>
              </button>
              <div class="search-input__spinner"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Initialize JavaScript
    setTimeout(() => {
      wrapper
        .querySelectorAll('.search-input:not(.search-input--disabled)')
        .forEach((el) => {});
    }, 0);

    return wrapper;
  },
};
