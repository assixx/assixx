<script lang="ts">
  /**
   * Toast Container Component
   * Uses Design System alert primitives for consistent theming (light/dark)
   */

  import { toasts, type ToastType } from '$lib/stores/toast';

  /** Map toast type to FontAwesome icon class */
  function getIconClass(type: ToastType): string {
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

  /** Map toast type to alert variant class */
  function getAlertVariant(type: ToastType): string {
    if (type === 'error') return 'alert--error';
    return `alert--${type}`;
  }
</script>

<div class="notification-container">
  {#each $toasts as toast (toast.id)}
    <div
      id="notification-{toast.id}"
      class="alert {getAlertVariant(toast.type)} notification"
      class:dismissing={toast.dismissing}
    >
      <span class="alert__icon">
        <i class="fas {getIconClass(toast.type)}"></i>
      </span>
      <span class="alert__content">
        {toast.title}{toast.message !== undefined && toast.message !== '' ?
          `: ${toast.message}`
        : ''}
      </span>
    </div>
  {/each}
</div>

<style>
  .notification-container {
    position: fixed;
    top: 91px;
    right: 20px;
    z-index: 10000;
    pointer-events: none;
  }

  .notification {
    pointer-events: auto;
    width: max-content;
    max-width: 500px;
    margin-bottom: 10px;
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

  @media (max-width: 768px) {
    .notification-container {
      left: 20px;
      right: 20px;
      max-width: none;
    }
  }
</style>
