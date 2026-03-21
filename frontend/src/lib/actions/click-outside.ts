/**
 * Capture-phase click-outside detection for dropdowns.
 *
 * WHY this exists:
 * Modals use e.stopPropagation() on their click handler to prevent
 * backdrop-close when clicking inside the modal. This kills ALL bubble-phase
 * click handlers — including <svelte:window onclick> and document.addEventListener.
 * Dropdowns inside modals can never detect "click outside" via bubble phase.
 *
 * HOW it works:
 * Capture phase fires top-down BEFORE the bubble phase. By the time the modal's
 * stopPropagation() runs (bubble phase), our capture handler has already fired.
 *
 * USAGE in Svelte 5 components:
 * ```ts
 * import { onClickOutsideDropdown } from '$lib/actions/click-outside';
 *
 * $effect(() => {
 *   return onClickOutsideDropdown(closeAllDropdowns);
 * });
 * ```
 */

/**
 * Register a capture-phase click handler that fires `callback` when a click
 * occurs outside any `.dropdown` element. Returns cleanup function.
 */
export function onClickOutsideDropdown(callback: () => void): () => void {
  function handler(event: MouseEvent): void {
    if (event.target instanceof HTMLElement && !event.target.closest('.dropdown')) {
      callback();
    }
  }

  document.addEventListener('click', handler, true);
  return () => {
    document.removeEventListener('click', handler, true);
  };
}
