/**
 * Helper script to prevent confirmation dialogs from being shown multiple times.
 * This script overrides the window.confirm function to prevent it from being
 * called multiple times for the same message.
 */

interface ConfirmTracking {
  lastConfirmTime: number;
  lastConfirmMessage: string;
  lastConfirmResult: boolean;
}

(function (): void {
  console.info('[Confirm] Installing confirm-once patch');

  // Save reference to original confirm function
  const originalConfirm = window.confirm;

  // Tracking variables
  const tracking: ConfirmTracking = {
    lastConfirmTime: 0,
    lastConfirmMessage: '',
    lastConfirmResult: false,
  };

  // Override confirm function
  window.confirm = function (message?: string): boolean {
    const confirmMessage = message || '';
    console.info(`[Confirm] Confirm dialog requested: ${confirmMessage}`);

    const now = Date.now();

    // If the same confirmation dialog should be shown again within 3 seconds,
    // just return the previous result
    if (confirmMessage === tracking.lastConfirmMessage && now - tracking.lastConfirmTime < 3000) {
      console.info(`[Confirm] Reusing previous result: ${tracking.lastConfirmResult}`);
      return tracking.lastConfirmResult;
    }

    // Otherwise call the original confirm function
    tracking.lastConfirmTime = now;
    tracking.lastConfirmMessage = confirmMessage;
    tracking.lastConfirmResult = originalConfirm.call(window, confirmMessage);

    console.info(`[Confirm] User selected: ${tracking.lastConfirmResult}`);
    return tracking.lastConfirmResult;
  };

  console.info('[Confirm] Confirm-once patch installed');
})();
