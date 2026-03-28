/**
 * Tooltip Utility - Design System
 *
 * Provides programmatic tooltip management with automatic cleanup.
 * Works with the tooltip.css styles.
 *
 * FEATURES:
 * - Auto-cleanup on SvelteKit navigation
 * - Auto-cleanup on window blur (tab switch)
 * - Manual show/hide API
 * - Support for all CSS variants (info, warning, error, success)
 * - Position variants (top, bottom, right)
 *
 * USAGE:
 *   import { tooltip } from '$design-system/primitives/tooltip/tooltip.svelte';
 *
 *   // Show tooltip
 *   tooltip.show(element, {
 *     content: 'Hello World',
 *     position: 'bottom',
 *     variant: 'info'
 *   });
 *
 *   // Hide tooltip for specific element
 *   tooltip.hide(element);
 *
 *   // Hide all tooltips (call on drag start, modal open, etc.)
 *   tooltip.hideAll();
 *
 *   // Cleanup (call in onDestroy if needed)
 *   tooltip.destroy();
 */

import { browser } from '$app/environment';
import { beforeNavigate } from '$app/navigation';

// ==========================================================================
// TYPES
// ==========================================================================

export type TooltipPosition = 'top' | 'bottom' | 'right';
export type TooltipVariant = 'default' | 'info' | 'warning' | 'error' | 'success' | 'light';

export interface TooltipOptions {
  /** Text or HTML-safe content */
  content: string;
  /** Optional description (renders on new line) */
  description?: string;
  /** Optional location with icon (renders on new line) */
  location?: string;
  /** Position relative to element */
  position?: TooltipPosition;
  /** Visual variant */
  variant?: TooltipVariant;
  /** Additional CSS classes */
  className?: string;
}

// eslint-disable-next-line svelte/no-top-level-browser-globals -- Type definition only, not runtime usage
interface TooltipElement extends HTMLElement {
  _tooltip?: HTMLDivElement;
}

// ==========================================================================
// CONSTANTS
// ==========================================================================

const TOOLTIP_CLASS = 'ds-tooltip-managed';
const TOOLTIP_OFFSET = 8;

// ==========================================================================
// STATE
// ==========================================================================

let isInitialized = false;
let navigationCleanupRegistered = false;

// ==========================================================================
// PRIVATE FUNCTIONS
// ==========================================================================

/**
 * Remove all managed tooltips from DOM
 */
function removeAllTooltips(): void {
  if (!browser) return;

  document.querySelectorAll(`.${TOOLTIP_CLASS}`).forEach((el) => {
    el.remove();
  });
}

/**
 * Remove tooltip for specific element
 */
function removeTooltip(element: TooltipElement): void {
  if (element._tooltip) {
    element._tooltip.remove();
    delete element._tooltip;
  }
}

/**
 * Calculate position for tooltip
 */
function calculatePosition(
  triggerRect: DOMRect,
  tooltipEl: HTMLDivElement,
  position: TooltipPosition,
): { top: number; left: number } {
  const tooltipRect = tooltipEl.getBoundingClientRect();

  switch (position) {
    case 'top':
      return {
        top: triggerRect.top - tooltipRect.height - TOOLTIP_OFFSET,
        left: triggerRect.left + triggerRect.width / 2,
      };
    case 'right':
      return {
        top: triggerRect.top + triggerRect.height / 2,
        left: triggerRect.right + TOOLTIP_OFFSET,
      };
    case 'bottom':
    default:
      return {
        top: triggerRect.bottom + TOOLTIP_OFFSET,
        left: triggerRect.left + triggerRect.width / 2,
      };
  }
}

/**
 * Build CSS class string for tooltip
 */
function buildClassName(
  position: TooltipPosition,
  variant: TooltipVariant,
  extra?: string,
): string {
  const classes = ['tooltip__content', `tooltip__content--${position}`, 'show', TOOLTIP_CLASS];

  if (variant !== 'default') {
    classes.push(`tooltip__content--${variant}`);
  }

  if (extra !== undefined && extra !== '') {
    classes.push(extra);
  }

  return classes.join(' ');
}

/**
 * Create tooltip DOM element
 */
function createTooltipElement(options: TooltipOptions): HTMLDivElement {
  const {
    content,
    description,
    location,
    position = 'bottom',
    variant = 'default',
    className,
  } = options;

  const tooltip = document.createElement('div');
  tooltip.className = buildClassName(position, variant, className);
  tooltip.setAttribute('role', 'tooltip');

  // Title (bold)
  const titleEl = document.createElement('strong');
  titleEl.textContent = content;
  tooltip.appendChild(titleEl);

  // Description
  if (description !== undefined && description !== '') {
    tooltip.appendChild(document.createElement('br'));
    tooltip.appendChild(document.createTextNode(description));
  }

  // Location with icon
  if (location !== undefined && location !== '') {
    tooltip.appendChild(document.createElement('br'));
    const iconEl = document.createElement('i');
    iconEl.className = 'fas fa-map-marker-alt';
    iconEl.style.marginRight = '4px';
    tooltip.appendChild(iconEl);
    tooltip.appendChild(document.createTextNode(location));
  }

  return tooltip;
}

/**
 * Initialize global event listeners (once)
 */
function initializeListeners(): void {
  if (!browser || isInitialized) return;

  // Cleanup on window blur (user switches tab)
  window.addEventListener('blur', removeAllTooltips);

  // Cleanup on escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      removeAllTooltips();
    }
  });

  // Cleanup on scroll (optional - can cause flicker)
  // window.addEventListener('scroll', removeAllTooltips, { passive: true });

  isInitialized = true;
}

// ==========================================================================
// PUBLIC API
// ==========================================================================

export const tooltip = {
  /** Show tooltip for an element */
  show(element: HTMLElement, options: TooltipOptions): void {
    if (!browser) return;

    initializeListeners();

    const el = element as TooltipElement;

    // Remove existing tooltip for this element
    removeTooltip(el);

    // Remove any other tooltips (only one at a time)
    removeAllTooltips();

    // Create tooltip
    const tooltipEl = createTooltipElement(options);

    // Add to body (for position:fixed to work)
    document.body.appendChild(tooltipEl);

    // Calculate and apply position
    const triggerRect = element.getBoundingClientRect();
    const pos = calculatePosition(triggerRect, tooltipEl, options.position ?? 'bottom');

    tooltipEl.style.position = 'fixed';
    tooltipEl.style.top = `${pos.top}px`;
    tooltipEl.style.left = `${pos.left}px`;
    tooltipEl.style.zIndex = '9999';

    // Adjust transform based on position
    if (options.position === 'right') {
      tooltipEl.style.transform = 'translateY(-50%)';
    } else {
      tooltipEl.style.transform = 'translateX(-50%)';
    }

    // Store reference
    el._tooltip = tooltipEl;
  },

  /** Hide tooltip for specific element */
  hide(element: HTMLElement): void {
    if (!browser) return;
    removeTooltip(element as TooltipElement);
  },

  /**
   * Hide all tooltips
   * Call this on: drag start, modal open, etc.
   */
  hideAll(): void {
    if (!browser) return;
    removeAllTooltips();
  },

  /**
   * Register cleanup on SvelteKit navigation
   * Call this once in your root layout or component
   *
   * USAGE (in +layout.svelte or component):
   *   import { tooltip } from '$design-system/primitives/tooltip/tooltip.svelte';
   *   tooltip.registerNavigationCleanup();
   */
  registerNavigationCleanup(): void {
    if (!browser || navigationCleanupRegistered) return;

    // This needs to be called within a Svelte component context
    try {
      beforeNavigate(() => {
        removeAllTooltips();
      });
      navigationCleanupRegistered = true;
    } catch {
      // beforeNavigate must be called during component initialization
      // If called outside, silently fail - tooltips will still work
      console.warn('[Tooltip] registerNavigationCleanup must be called during component init');
    }
  },

  /**
   * Full cleanup - remove listeners and tooltips
   * Call in onDestroy if needed
   */
  destroy(): void {
    if (!browser) return;
    removeAllTooltips();
    // Note: We don't remove global listeners as they may be used by other instances
  },
};

// ==========================================================================
// SVELTE ACTION (Alternative API)
// ==========================================================================

/**
 * Svelte action for declarative tooltip usage
 *
 * USAGE:
 *   <button use:tooltipAction={{ content: 'Hello', position: 'bottom' }}>
 *     Hover me
 *   </button>
 */
export function tooltipAction(
  node: HTMLElement,
  options: TooltipOptions,
): { update: (opts: TooltipOptions) => void; destroy: () => void } {
  let currentOptions = options;

  function handleMouseEnter() {
    tooltip.show(node, currentOptions);
  }

  function handleMouseLeave() {
    tooltip.hide(node);
  }

  node.addEventListener('mouseenter', handleMouseEnter);
  node.addEventListener('mouseleave', handleMouseLeave);
  node.addEventListener('focus', handleMouseEnter);
  node.addEventListener('blur', handleMouseLeave);

  return {
    update(newOptions: TooltipOptions) {
      currentOptions = newOptions;
    },
    destroy() {
      tooltip.hide(node);
      node.removeEventListener('mouseenter', handleMouseEnter);
      node.removeEventListener('mouseleave', handleMouseLeave);
      node.removeEventListener('focus', handleMouseEnter);
      node.removeEventListener('blur', handleMouseLeave);
    },
  };
}
