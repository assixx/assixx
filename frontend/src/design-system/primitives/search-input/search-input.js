/**
 * Search Input JavaScript Helper
 *
 * Optional JavaScript for enhanced search input functionality:
 * - Show/hide clear button
 * - Clear input on button click
 * - Loading state management
 * - Basic autocomplete support
 *
 * USAGE:
 *   import { initSearchInput } from './search-input.js';
 *
 *   const search = initSearchInput(document.querySelector('.search-input'), {
 *     onSearch: (value) => console.log('Search:', value),
 *     onClear: () => console.log('Cleared'),
 *     debounce: 300,
 *   });
 *
 * PROGRESSIVE ENHANCEMENT:
 *   Works without JavaScript - uses native search input.
 */

/**
 * Debounce function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Initialize search input
 */
export function initSearchInput(searchElement, options = {}) {
  if (!searchElement) {
    console.error('Search input element not found');
    return null;
  }

  // Default options
  const config = {
    onSearch: null,
    onClear: null,
    onFocus: null,
    onBlur: null,
    debounce: 300,
    minLength: 0,
    showClearButton: true,
    ...options,
  };

  // Find elements
  const input =
    searchElement.querySelector('.search-input__field') || searchElement.querySelector('input[type="search"]');
  const clearButton = searchElement.querySelector('.search-input__clear');

  if (!input) {
    console.error('Search input field not found');
    return null;
  }

  /**
   * Update clear button visibility
   */
  function updateClearButton() {
    if (!config.showClearButton || !clearButton) return;

    if (input.value.length > 0) {
      searchElement.classList.add('search-input--has-value');
    } else {
      searchElement.classList.remove('search-input--has-value');
    }
  }

  /**
   * Clear input
   */
  function clearInput() {
    input.value = '';
    updateClearButton();
    input.focus();

    // Callback
    if (config.onClear) {
      config.onClear();
    }

    // Trigger search with empty value
    if (config.onSearch) {
      config.onSearch('');
    }
  }

  /**
   * Handle search
   */
  function handleSearch() {
    const value = input.value.trim();

    // Only search if meets minimum length
    if (value.length < config.minLength && value.length > 0) {
      return;
    }

    // Callback
    if (config.onSearch) {
      config.onSearch(value);
    }
  }

  /**
   * Set loading state
   */
  function setLoading(loading) {
    if (loading) {
      searchElement.classList.add('search-input--loading');
    } else {
      searchElement.classList.remove('search-input--loading');
    }
  }

  /**
   * Set error state
   */
  function setError(error) {
    if (error) {
      searchElement.classList.add('search-input--error');
    } else {
      searchElement.classList.remove('search-input--error');
    }
  }

  /**
   * Set success state
   */
  function setSuccess(success) {
    if (success) {
      searchElement.classList.add('search-input--success');
    } else {
      searchElement.classList.remove('search-input--success');
    }
  }

  /**
   * Disable/Enable input
   */
  function setDisabled(disabled) {
    if (disabled) {
      searchElement.classList.add('search-input--disabled');
      input.disabled = true;
    } else {
      searchElement.classList.remove('search-input--disabled');
      input.disabled = false;
    }
  }

  // Create debounced search handler
  const debouncedSearch = debounce(handleSearch, config.debounce);

  // Event listeners
  input.addEventListener('input', () => {
    updateClearButton();
    debouncedSearch();
  });

  if (clearButton) {
    clearButton.addEventListener('click', clearInput);
  }

  if (config.onFocus) {
    input.addEventListener('focus', config.onFocus);
  }

  if (config.onBlur) {
    input.addEventListener('blur', config.onBlur);
  }

  // Initial state
  updateClearButton();

  // Public API
  return {
    getValue: () => input.value,
    setValue: (value) => {
      input.value = value;
      updateClearButton();
    },
    clear: clearInput,
    focus: () => input.focus(),
    blur: () => input.blur(),
    setLoading,
    setError,
    setSuccess,
    setDisabled,
    destroy: () => {
      input.removeEventListener('input', debouncedSearch);
      if (clearButton) {
        clearButton.removeEventListener('click', clearInput);
      }
    },
  };
}

/**
 * Create search input element
 */
export function createSearchInput(options = {}) {
  const { placeholder = 'Search...', value = '', size = 'md', disabled = false, id = null } = options;

  const wrapper = document.createElement('div');
  wrapper.className = 'search-input';

  if (size !== 'md') {
    wrapper.classList.add(`search-input--${size}`);
  }

  if (disabled) {
    wrapper.classList.add('search-input--disabled');
  }

  // Icon
  const icon = document.createElement('i');
  icon.className = 'search-input__icon fas fa-search';
  wrapper.appendChild(icon);

  // Input
  const input = document.createElement('input');
  input.type = 'search';
  input.className = 'search-input__field';
  input.placeholder = placeholder;
  input.value = value;
  input.disabled = disabled;
  if (id) input.id = id;
  wrapper.appendChild(input);

  // Clear button
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'search-input__clear';
  clearBtn.setAttribute('aria-label', 'Clear search');
  clearBtn.innerHTML = '<i class="fas fa-times"></i>';
  wrapper.appendChild(clearBtn);

  // Spinner
  const spinner = document.createElement('div');
  spinner.className = 'search-input__spinner';
  wrapper.appendChild(spinner);

  return wrapper;
}

/**
 * Initialize all search inputs in the document
 * Converts data attributes to search inputs
 *
 * Example HTML:
 * <div class="search-input" data-search-input data-debounce="500"></div>
 */
export function initAllSearchInputs() {
  const searches = document.querySelectorAll('[data-search-input]');

  searches.forEach((element) => {
    const debounce = Number.parseInt(element.dataset.debounce) || 300;
    const minLength = Number.parseInt(element.dataset.minLength) || 0;

    initSearchInput(element, {
      debounce,
      minLength,
    });
  });
}

export default {
  initSearchInput,
  createSearchInput,
  initAllSearchInputs,
};
