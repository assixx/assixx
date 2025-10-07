/**
 * Accordion JavaScript
 *
 * Features:
 * - Auto-init for all accordions on page
 * - Single mode: Only one item open at a time (default)
 * - Multiple mode: Multiple items can be open (.accordion--always-open)
 * - Smooth animations via CSS grid
 * - Keyboard support (Enter/Space)
 * - ARIA attributes
 *
 * USAGE (Auto Init):
 *   <div class="accordion">
 *     <div class="accordion__item">
 *       <button class="accordion__header">...</button>
 *       <div class="accordion__content">...</div>
 *     </div>
 *   </div>
 *
 * USAGE (Manual Init):
 *   const accordion = initAccordion(accordionElement, {
 *     mode: 'single', // 'single' or 'multiple'
 *     defaultOpen: 0  // Index of initially open item
 *   });
 */

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  mode: 'single', // 'single' or 'multiple'
  defaultOpen: null, // Index of initially open item (null = none)
  animation: true, // Enable/disable animations
};

/**
 * Accordion state tracker
 */
const accordions = new Map();

/**
 * Initialize accordion
 * @param {HTMLElement} accordionEl - Accordion container element
 * @param {Object} options - Configuration options
 * @returns {Object} Accordion API
 */
export function initAccordion(accordionEl, options = {}) {
  if (!accordionEl) {
    console.error('[Accordion] Invalid accordion element');
    return null;
  }

  // Don't re-init
  if (accordions.has(accordionEl)) {
    return accordions.get(accordionEl);
  }

  const config = { ...DEFAULT_CONFIG, ...options };

  // Detect mode from class
  if (accordionEl.classList.contains('accordion--always-open')) {
    config.mode = 'multiple';
  }

  const items = Array.from(accordionEl.querySelectorAll('.accordion__item'));
  const headers = Array.from(accordionEl.querySelectorAll('.accordion__header'));

  // Setup ARIA attributes
  items.forEach((item, index) => {
    const header = item.querySelector('.accordion__header');
    const content = item.querySelector('.accordion__content');

    if (!header || !content) return;

    const id = `accordion-${Date.now()}-${index}`;

    header.setAttribute('aria-expanded', item.classList.contains('accordion__item--active') ? 'true' : 'false');
    header.setAttribute('aria-controls', `${id}-content`);
    header.id = `${id}-header`;

    content.id = `${id}-content`;
    content.setAttribute('role', 'region');
    content.setAttribute('aria-labelledby', header.id);
  });

  /**
   * Open accordion item
   * @param {number} index - Item index
   */
  function open(index) {
    // Validate index to prevent object injection
    if (typeof index !== 'number' || index < 0 || index >= items.length) return;

    // eslint-disable-next-line security/detect-object-injection -- index validated above: typeof number, 0 <= index < items.length
    const item = items[index];
    if (!item || item.classList.contains('accordion__item--disabled')) return;

    item.classList.add('accordion__item--active');

    const header = item.querySelector('.accordion__header');
    if (header) {
      header.setAttribute('aria-expanded', 'true');
    }

    // Emit event
    accordionEl.dispatchEvent(
      new CustomEvent('accordion:open', {
        detail: { index, item },
      }),
    );
  }

  /**
   * Close accordion item
   * @param {number} index - Item index
   */
  function close(index) {
    // Validate index to prevent object injection
    if (typeof index !== 'number' || index < 0 || index >= items.length) return;

    // eslint-disable-next-line security/detect-object-injection -- index validated above: typeof number, 0 <= index < items.length
    const item = items[index];
    if (!item) return;

    item.classList.remove('accordion__item--active');

    const header = item.querySelector('.accordion__header');
    if (header) {
      header.setAttribute('aria-expanded', 'false');
    }

    // Emit event
    accordionEl.dispatchEvent(
      new CustomEvent('accordion:close', {
        detail: { index, item },
      }),
    );
  }

  /**
   * Toggle accordion item
   * @param {number} index - Item index
   */
  function toggle(index) {
    // Validate index to prevent object injection
    if (typeof index !== 'number' || index < 0 || index >= items.length) return;

    // eslint-disable-next-line security/detect-object-injection -- index validated above: typeof number, 0 <= index < items.length
    const item = items[index];
    if (!item) return;

    const isActive = item.classList.contains('accordion__item--active');

    if (isActive) {
      close(index);
    } else {
      // Single mode: Close all others
      if (config.mode === 'single') {
        items.forEach((_, i) => {
          if (i !== index) close(i);
        });
      }

      open(index);
    }
  }

  /**
   * Close all items
   */
  function closeAll() {
    items.forEach((_, index) => close(index));
  }

  /**
   * Open all items (only in multiple mode)
   */
  function openAll() {
    if (config.mode === 'multiple') {
      items.forEach((_, index) => open(index));
    }
  }

  /**
   * Handle header click
   * @param {Event} event - Click event
   */
  function handleClick(event) {
    const header = event.currentTarget;
    const item = header.closest('.accordion__item');
    const index = items.indexOf(item);

    if (index !== -1) {
      toggle(index);
    }
  }

  /**
   * Handle keyboard navigation
   * @param {KeyboardEvent} event - Keyboard event
   */
  function handleKeydown(event) {
    const header = event.currentTarget;
    const item = header.closest('.accordion__item');
    const index = items.indexOf(item);

    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        toggle(index);
        break;
      case 'Home':
        event.preventDefault();
        headers[0]?.focus();
        break;
      case 'End':
        event.preventDefault();
        headers[headers.length - 1]?.focus();
        break;
      case 'ArrowDown':
        event.preventDefault();
        headers[index + 1]?.focus();
        break;
      case 'ArrowUp':
        event.preventDefault();
        headers[index - 1]?.focus();
        break;
    }
  }

  // Attach event listeners
  headers.forEach((header) => {
    header.addEventListener('click', handleClick);
    header.addEventListener('keydown', handleKeydown);
  });

  // Set initial state
  if (config.defaultOpen !== null && config.defaultOpen >= 0 && config.defaultOpen < items.length) {
    open(config.defaultOpen);
  }

  /**
   * Destroy accordion
   */
  function destroy() {
    headers.forEach((header) => {
      header.removeEventListener('click', handleClick);
      header.removeEventListener('keydown', handleKeydown);
    });
    accordions.delete(accordionEl);
  }

  const api = {
    open,
    close,
    toggle,
    closeAll,
    openAll,
    destroy,
  };

  accordions.set(accordionEl, api);

  return api;
}

/**
 * Auto-initialize all accordions on the page
 */
export function autoInitAccordions() {
  const accordionElements = document.querySelectorAll('.accordion');

  accordionElements.forEach((accordionEl) => {
    if (!accordions.has(accordionEl)) {
      initAccordion(accordionEl);
    }
  });
}

// Auto-init on DOMContentLoaded
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInitAccordions);
  } else {
    // DOM already loaded
    autoInitAccordions();
  }
}
