/**
 * Tooltip JavaScript API
 *
 * Features:
 * - Auto-init via data-tooltip attribute
 * - Manual initialization
 * - Bottom and right positioning (stable)
 * - Configurable delay
 * - Keyboard support (focus/blur)
 * - ARIA support
 * - Event callbacks
 *
 * USAGE (Auto Init):
 *   <button data-tooltip="Helpful info">Hover me</button>
 *   <button data-tooltip="Right tip" data-tooltip-position="right">Right</button>
 *
 * USAGE (Manual Init):
 *   const tooltip = initTooltip(element, {
 *     content: 'Tooltip text',
 *     position: 'bottom',
 *     delay: 300,
 *     variant: 'info'
 *   });
 *
 * API:
 *   tooltip.show()       - Show tooltip
 *   tooltip.hide()       - Hide tooltip
 *   tooltip.toggle()     - Toggle visibility
 *   tooltip.updateContent(text) - Update text
 *   tooltip.destroy()    - Cleanup and remove
 */

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  content: '',
  position: 'bottom', // bottom, right
  variant: '', // '', info, warning, error, success, light
  size: '', // '', sm, lg
  delay: 300, // Show delay in ms
  hideDelay: 0, // Hide delay in ms
  arrow: true,
  interactive: false, // Allow hovering over tooltip
  animation: 'slide', // slide, fade, scale
  offset: 8, // Distance from trigger in px
  autoPosition: false, // Disabled - only bottom/right supported
  onShow: null,
  onHide: null,
};

/**
 * Tooltip state tracker
 */
const tooltips = new Map();

/**
 * Initialize tooltip
 *
 * @param {HTMLElement} trigger - Element that triggers tooltip
 * @param {Object} options - Configuration options
 * @returns {Object} Tooltip API
 */
export function initTooltip(trigger, options = {}) {
  // Merge config
  const config = { ...DEFAULT_CONFIG, ...options };

  // Create tooltip element
  const tooltipId = `tooltip-${Math.random().toString(36).substr(2, 9)}`;
  const tooltipEl = document.createElement('div');
  tooltipEl.className = 'tooltip__content';
  tooltipEl.setAttribute('role', 'tooltip');
  tooltipEl.setAttribute('id', tooltipId);
  tooltipEl.textContent = config.content;

  // Apply position class
  tooltipEl.classList.add(`tooltip__content--${config.position}`);

  // Apply variant class
  if (config.variant) {
    tooltipEl.classList.add(`tooltip__content--${config.variant}`);
  }

  // Apply size class
  if (config.size) {
    tooltipEl.classList.add(`tooltip__content--${config.size}`);
  }

  // Apply animation class
  if (config.animation !== 'slide') {
    tooltipEl.classList.add(`tooltip__content--${config.animation}`);
  }

  // Remove arrow if disabled
  if (!config.arrow) {
    tooltipEl.classList.add('tooltip__content--no-arrow');
  }

  // Add to DOM
  document.body.appendChild(tooltipEl);

  // ARIA connection
  trigger.setAttribute('aria-describedby', tooltipId);

  // State
  let showTimeout = null;
  let hideTimeout = null;
  let isVisible = false;

  /**
   * Position tooltip relative to trigger
   */
  function updatePosition() {
    const triggerRect = trigger.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();
    const offset = config.offset;

    let top, left;

    // Calculate position based on position setting
    switch (config.position) {
      case 'bottom':
        top = triggerRect.bottom + offset;
        left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        break;

      case 'left':
        top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        left = triggerRect.left - tooltipRect.width - offset;
        break;

      case 'right':
        top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        left = triggerRect.right + offset;
        break;

      case 'top':
      default:
        // Default to 'top' position
        top = triggerRect.top - tooltipRect.height - offset;
        left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        break;
    }

    // Auto-adjust if overflows viewport (optional)
    if (config.autoPosition) {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Adjust horizontal overflow
      if (left < 0) {
        left = 8; // Min margin
      } else if (left + tooltipRect.width > viewportWidth) {
        left = viewportWidth - tooltipRect.width - 8;
      }

      // Adjust vertical overflow
      if (top < 0) {
        top = 8;
      } else if (top + tooltipRect.height > viewportHeight) {
        top = viewportHeight - tooltipRect.height - 8;
      }
    }

    // Apply position
    tooltipEl.style.position = 'fixed';
    tooltipEl.style.top = `${top}px`;
    tooltipEl.style.left = `${left}px`;
  }

  /**
   * Show tooltip
   */
  function show() {
    // Clear hide timeout
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }

    // Set show timeout
    showTimeout = setTimeout(() => {
      updatePosition();
      tooltipEl.classList.add('show');
      isVisible = true;

      // Callback
      if (config.onShow) {
        config.onShow(tooltipEl);
      }

      // Emit event
      trigger.dispatchEvent(new CustomEvent('tooltip:show', { detail: { tooltip: tooltipEl } }));
    }, config.delay);
  }

  /**
   * Hide tooltip
   */
  function hide() {
    // Clear show timeout
    if (showTimeout) {
      clearTimeout(showTimeout);
      showTimeout = null;
    }

    // Set hide timeout
    hideTimeout = setTimeout(() => {
      tooltipEl.classList.remove('show');
      isVisible = false;

      // Callback
      if (config.onHide) {
        config.onHide(tooltipEl);
      }

      // Emit event
      trigger.dispatchEvent(new CustomEvent('tooltip:hide', { detail: { tooltip: tooltipEl } }));
    }, config.hideDelay);
  }

  /**
   * Toggle tooltip
   */
  function toggle() {
    if (isVisible) {
      hide();
    } else {
      show();
    }
  }

  /**
   * Update content
   */
  function updateContent(content) {
    tooltipEl.textContent = content;
    config.content = content;

    // Update position if visible
    if (isVisible) {
      updatePosition();
    }
  }

  /**
   * Destroy tooltip
   */
  function destroy() {
    // Clear timeouts
    if (showTimeout) clearTimeout(showTimeout);
    if (hideTimeout) clearTimeout(hideTimeout);

    // Remove element
    tooltipEl.remove();

    // Remove ARIA
    trigger.removeAttribute('aria-describedby');

    // Remove event listeners
    trigger.removeEventListener('mouseenter', show);
    trigger.removeEventListener('mouseleave', hide);
    trigger.removeEventListener('focus', show);
    trigger.removeEventListener('blur', hide);

    if (config.interactive) {
      tooltipEl.removeEventListener('mouseenter', show);
      tooltipEl.removeEventListener('mouseleave', hide);
    }

    // Remove from map
    tooltips.delete(trigger);
  }

  // Event listeners
  trigger.addEventListener('mouseenter', show);
  trigger.addEventListener('mouseleave', hide);
  trigger.addEventListener('focus', show);
  trigger.addEventListener('blur', hide);

  // Interactive tooltip (can hover over it)
  if (config.interactive) {
    tooltipEl.classList.add('tooltip--interactive');
    tooltipEl.addEventListener('mouseenter', show);
    tooltipEl.addEventListener('mouseleave', hide);
  }

  // Update position on scroll/resize
  const updateOnScroll = () => {
    if (isVisible) {
      updatePosition();
    }
  };

  window.addEventListener('scroll', updateOnScroll, true); // Capture phase
  window.addEventListener('resize', updateOnScroll);

  // Store instance
  const instance = {
    show,
    hide,
    toggle,
    updateContent,
    updatePosition,
    destroy,
    get isVisible() {
      return isVisible;
    },
    get element() {
      return tooltipEl;
    },
  };

  tooltips.set(trigger, instance);

  return instance;
}

/**
 * Auto-initialize tooltips with data-tooltip attribute
 */
export function autoInitTooltips() {
  const elements = document.querySelectorAll('[data-tooltip]');

  elements.forEach((el) => {
    // Skip if already initialized
    if (tooltips.has(el)) return;

    const content = el.getAttribute('data-tooltip');
    const position = el.getAttribute('data-tooltip-position') || 'top';
    const variant = el.getAttribute('data-tooltip-variant') || '';
    const size = el.getAttribute('data-tooltip-size') || '';
    const delay = Number.parseInt(el.getAttribute('data-tooltip-delay') || '300', 10);
    const arrow = el.getAttribute('data-tooltip-arrow') !== 'false';
    const interactive = el.getAttribute('data-tooltip-interactive') === 'true';

    initTooltip(el, {
      content,
      position,
      variant,
      size,
      delay,
      arrow,
      interactive,
    });
  });
}

/**
 * Get tooltip instance for element
 *
 * @param {HTMLElement} element
 * @returns {Object|null} Tooltip instance or null
 */
export function getTooltip(element) {
  return tooltips.get(element) || null;
}

/**
 * Destroy all tooltips
 */
export function destroyAllTooltips() {
  tooltips.forEach((tooltip) => tooltip.destroy());
  tooltips.clear();
}

// Auto-init on DOM ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInitTooltips);
  } else {
    autoInitTooltips();
  }
}

// Re-init on dynamic content (optional - can be called manually)
export function refreshTooltips() {
  autoInitTooltips();
}

// Export for direct access
export default initTooltip;
