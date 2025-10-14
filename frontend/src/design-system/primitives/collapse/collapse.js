/**
 * Collapse JavaScript
 *
 * Features:
 * - Auto-init via data-collapse-trigger attribute
 * - Manual initialization
 * - Smooth animations
 * - Keyboard support (Enter/Space)
 * - ARIA attributes
 * - Event callbacks
 *
 * USAGE (Data Attribute):
 *   <button data-collapse-trigger="myContent">Toggle</button>
 *   <div id="myContent" class="collapse__content">
 *     <div class="collapse__body">Content</div>
 *   </div>
 *
 * USAGE (Manual Init):
 *   const collapse = initCollapse(triggerElement, contentElement, {
 *     initialState: 'closed',
 *     onShow: () => console.log('Opened'),
 *     onHide: () => console.log('Closed')
 *   });
 */

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  initialState: 'closed', // 'open' or 'closed'
  animation: true,
  onShow: null,
  onHide: null,
};

/**
 * Collapse state tracker
 */
const collapses = new Map();

/**
 * Initialize collapse
 * @param {HTMLElement} trigger - Trigger button element
 * @param {HTMLElement} content - Content element to collapse
 * @param {Object} options - Configuration options
 * @returns {Object} Collapse API
 */
export function initCollapse(trigger, content, options = {}) {
  if (!trigger || !content) {
    console.error('[Collapse] Invalid trigger or content element');
    return null;
  }

  // Don't re-init - use element references as keys
  if (collapses.has(trigger)) {
    return collapses.get(trigger);
  }

  const config = { ...DEFAULT_CONFIG, ...options };
  let isOpen = config.initialState === 'open';

  // Setup ARIA attributes
  const contentId = content.id || `collapse-content-${Date.now()}`;
  content.id = contentId;

  trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  trigger.setAttribute('aria-controls', contentId);

  content.setAttribute('role', 'region');
  content.setAttribute('aria-hidden', isOpen ? 'false' : 'true');

  // Set initial state
  if (isOpen) {
    content.classList.add('show');
  } else {
    content.classList.remove('show');
  }

  /**
   * Show content
   */
  function show() {
    if (isOpen) return;

    isOpen = true;

    trigger.setAttribute('aria-expanded', 'true');
    content.setAttribute('aria-hidden', 'false');
    content.classList.add('show');

    // Callback
    if (config.onShow) {
      config.onShow(content);
    }

    // Emit event
    trigger.dispatchEvent(
      new CustomEvent('collapse:show', {
        detail: { trigger, content },
      }),
    );
  }

  /**
   * Hide content
   */
  function hide() {
    if (!isOpen) return;

    isOpen = false;

    trigger.setAttribute('aria-expanded', 'false');
    content.setAttribute('aria-hidden', 'true');
    content.classList.remove('show');

    // Callback
    if (config.onHide) {
      config.onHide(content);
    }

    // Emit event
    trigger.dispatchEvent(
      new CustomEvent('collapse:hide', {
        detail: { trigger, content },
      }),
    );
  }

  /**
   * Toggle collapse
   */
  function toggle() {
    if (isOpen) {
      hide();
    } else {
      show();
    }
  }

  /**
   * Handle trigger click
   */
  function handleClick(event) {
    event.preventDefault();
    toggle();
  }

  /**
   * Handle keyboard
   */
  function handleKeydown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggle();
    }
  }

  // Attach event listeners
  trigger.addEventListener('click', handleClick);
  trigger.addEventListener('keydown', handleKeydown);

  /**
   * Destroy collapse
   */
  function destroy() {
    trigger.removeEventListener('click', handleClick);
    trigger.removeEventListener('keydown', handleKeydown);
    collapses.delete(trigger);
  }

  const api = {
    show,
    hide,
    toggle,
    destroy,
    isOpen: () => isOpen,
  };

  collapses.set(trigger, api);

  return api;
}

/**
 * Auto-initialize all collapses with data-collapse-trigger
 */
export function autoInitCollapses() {
  const triggers = document.querySelectorAll('[data-collapse-trigger]');

  triggers.forEach((trigger) => {
    const targetId = trigger.getAttribute('data-collapse-trigger');
    const content = document.getElementById(targetId);

    if (content) {
      const initialState = trigger.getAttribute('data-collapse-initial') || 'closed';
      initCollapse(trigger, content, { initialState });
    } else {
      console.warn(`[Collapse] Target element not found: ${targetId}`);
    }
  });

  // Also init collapses with .collapse structure
  const collapseContainers = document.querySelectorAll('.collapse');

  collapseContainers.forEach((container) => {
    const trigger = container.querySelector('.collapse__trigger');
    const content = container.querySelector('.collapse__content');

    if (trigger && content) {
      const initialState = content.classList.contains('show') ? 'open' : 'closed';
      initCollapse(trigger, content, { initialState });
    }
  });
}

// Auto-init on DOMContentLoaded
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInitCollapses);
  } else {
    // DOM already loaded
    autoInitCollapses();
  }
}
