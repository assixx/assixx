<script>
  /**
   * Toast Container Component
   * 1:1 Copy from frontend/src/scripts/services/notification.service.ts
   * Renders toast notifications in fixed position
   */

  import { toasts } from '$lib/stores/toast.js';

  // =============================================================================
  // HELPER FUNCTIONS (1:1 from legacy notification.service.ts)
  // =============================================================================

  /**
   * Get notification colors based on type
   * @param {'success' | 'error' | 'warning' | 'info'} type
   * @returns {{ bgColor: string; borderColor: string; textColor: string }}
   */
  function getNotificationColors(type) {
    switch (type) {
      case 'success':
        return {
          bgColor: 'rgba(76, 175, 80, 0.1)',
          borderColor: 'rgba(76, 175, 80, 0.2)',
          textColor: 'rgba(76, 175, 80, 0.9)',
        };
      case 'warning':
        return {
          bgColor: 'rgba(255, 152, 0, 0.1)',
          borderColor: 'rgba(255, 152, 0, 0.2)',
          textColor: 'rgba(255, 152, 0, 0.9)',
        };
      case 'error':
        return {
          bgColor: 'rgba(244, 67, 54, 0.1)',
          borderColor: 'rgba(244, 67, 54, 0.2)',
          textColor: 'rgba(244, 67, 54, 0.9)',
        };
      case 'info':
      default:
        return {
          bgColor: 'rgba(33, 150, 243, 0.1)',
          borderColor: 'rgba(33, 150, 243, 0.2)',
          textColor: 'rgba(33, 150, 243, 0.9)',
        };
    }
  }

  /**
   * Get icon class for notification type
   * @param {'success' | 'error' | 'warning' | 'info'} type
   * @returns {string}
   */
  function getIconClass(type) {
    switch (type) {
      case 'success':
        return 'fa-check-circle';
      case 'warning':
        return 'fa-exclamation-triangle';
      case 'error':
        return 'fa-exclamation-circle';
      case 'info':
      default:
        return 'fa-info-circle';
    }
  }
</script>

<!-- Notification Container (1:1 like legacy) -->
<div
  id="notification-container"
  class="notification-container"
  style="position: fixed; top: 91px; right: 20px; z-index: 10000; pointer-events: none;"
>
  {#each $toasts as toast (toast.id)}
    {@const colors = getNotificationColors(toast.type)}
    <div
      id="notification-{toast.id}"
      class="notification notification-{toast.type}"
      class:dismissing={toast.dismissing}
      style="
        position: relative;
        padding: 12px 20px;
        background: {colors.bgColor};
        border: 1px solid {colors.borderColor};
        color: {colors.textColor};
        border-radius: var(--radius-xl);
        font-size: 14px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
        pointer-events: auto;
        width: max-content;
        max-width: 360px;
      "
    >
      <!-- Icon -->
      <span style="color: {colors.textColor}; display: flex; align-items: center;">
        <i class="fas {getIconClass(toast.type)}" style="font-size: 18px;"></i>
      </span>

      <!-- Text -->
      <span style="flex: 1; color: {colors.textColor};">
        {toast.title}{toast.message ? `: ${toast.message}` : ''}
      </span>
    </div>
  {/each}
</div>

<style>
  /* Animations (1:1 from legacy notification.service.ts) */
  .notification {
    animation: slideInRight 0.3s ease-out;
  }

  .notification.dismissing {
    animation: slideOutRight 0.3s ease-in;
  }

  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }

  /* Responsive (1:1 from legacy) */
  @media (max-width: 768px) {
    .notification-container {
      left: 20px !important;
      right: 20px !important;
      max-width: none !important;
    }
  }
</style>
