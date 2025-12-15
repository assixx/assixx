/**
 * Global Modal Component - Reset scroll position for all modals
 * Watches for modal open/close via class changes and resets scrollTop
 */
export function initModals() {
  console.info('[Modal Component] Initializing global modal manager...');

  // MutationObserver to watch for class changes on modal overlays
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        const modal = mutation.target;
        const isActive = modal.classList.contains('modal-overlay--active') || modal.classList.contains('active');

        // When modal becomes ACTIVE (opens), reset scroll position
        if (isActive) {
          const modalBody = modal.querySelector('.ds-modal__body, .modal__body');
          if (modalBody) {
            // Reset immediately
            modalBody.scrollTop = 0;

            // Reset again after render (browser may restore scroll)
            setTimeout(() => {
              modalBody.scrollTop = 0;
            }, 0);
          }
        }
      }
    });
  });

  // Observe all modal overlays
  const modals = document.querySelectorAll('.modal-overlay, .modal');
  modals.forEach((modal) => {
    observer.observe(modal, {
      attributes: true,
      attributeFilter: ['class'],
    });
  });

  console.info(`[Modal Component] Monitoring ${modals.length} modals for scroll reset`);
}
