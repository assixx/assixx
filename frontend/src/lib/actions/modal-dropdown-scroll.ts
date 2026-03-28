/**
 * Global auto-scroll fix for dropdowns inside modals.
 *
 * WHY: .dropdown__menu is position:absolute inside .ds-modal__body (overflow-y:auto).
 * Absolute elements don't contribute to scroll height → menus near the bottom
 * get clipped. This module auto-detects dropdown open/close and adjusts scroll.
 *
 * HOW: Single MutationObserver on document.body watches for class changes on
 * .dropdown__menu elements. When one activates inside a .ds-modal__body,
 * padding is extended and the body scrolls down. On close, it scrolls back
 * and cleans up. State is tracked per modal body via WeakSet (auto-GC).
 *
 * SETUP: Side-effect import in root +layout.svelte:
 *   import '$lib/actions/modal-dropdown-scroll';
 */

import { browser } from '$app/environment';

const SCROLL_PADDING = 16;
const scrolledBodies = new WeakSet<HTMLElement>();

function scrollToShowMenu(
  body: HTMLElement,
  modal: HTMLElement | null,
  menu: HTMLElement,
): boolean {
  const overflow = menu.getBoundingClientRect().bottom - body.getBoundingClientRect().bottom;
  if (overflow <= 0) return false;

  const extraSpace = overflow + SCROLL_PADDING;

  if (modal) modal.style.height = `${modal.offsetHeight}px`;

  const currentPadding = parseFloat(getComputedStyle(body).paddingBottom) || 0;
  body.style.paddingBottom = `${currentPadding + extraSpace}px`;

  requestAnimationFrame(() => {
    body.scrollBy({ top: extraSpace, behavior: 'smooth' });
  });
  return true;
}

function resetScroll(body: HTMLElement, modal: HTMLElement | null): void {
  const removeStyles = (): void => {
    body.style.paddingBottom = '';
    if (modal) modal.style.height = '';
  };

  if (body.scrollTop === 0) {
    removeStyles();
    return;
  }

  body.scrollTo({ top: 0, behavior: 'smooth' });
  body.addEventListener('scrollend', removeStyles, { once: true });
}

function onDropdownClassChange(menu: HTMLElement): void {
  const body = menu.closest<HTMLElement>('.ds-modal__body');
  if (!body) return;

  const modal = body.closest<HTMLElement>('.ds-modal');

  if (menu.classList.contains('active')) {
    // Wait for dropdown transition (200ms ease) to finish before measuring.
    // WHY: During transition, translateY(-10px→0) shifts getBoundingClientRect()
    // up by ~10px. If the overflow is minimal (e.g. RootUserModal), this causes
    // overflow <= 0 and the scroll is skipped — even though the menu WILL overlap.
    setTimeout(() => {
      if (scrollToShowMenu(body, modal, menu)) {
        scrolledBodies.add(body);
      }
    }, 230);
  } else if (scrolledBodies.has(body)) {
    scrolledBodies.delete(body);
    resetScroll(body, modal);
  }
}

if (browser) {
  const observer = new MutationObserver((mutations: MutationRecord[]) => {
    for (const m of mutations) {
      if (m.target instanceof HTMLElement && m.target.classList.contains('dropdown__menu')) {
        onDropdownClassChange(m.target);
      }
    }
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['class'],
    subtree: true,
  });
}
