<script lang="ts">
  /**
   * Toast Container Component
   * Uses Design System toast primitives for consistent theming (light/dark)
   *
   * Migrated to Svelte 5 runes — legacy $store subscription broke hydration
   * after vite-plugin-svelte 7 + Vite 8 upgrade (context.l is null).
   */

  import { goto } from '$app/navigation';

  import { dismissToast, toasts, type Toast, type ToastType } from '$lib/stores/toast';

  let toastList: Toast[] = $state([]);

  $effect(() => {
    return toasts.subscribe((value: Toast[]) => {
      toastList = value;
    });
  });

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
</script>

<div class="notification-container">
  {#each toastList as toast (toast.id)}
    <div
      id="notification-{toast.id}"
      class="toast toast--{toast.type} notification"
      class:dismissing={toast.dismissing}
    >
      <span class="toast__icon">
        <i class="fas {getIconClass(toast.type)}"></i>
      </span>
      <span class="toast__content">
        {toast.title}{toast.message !== undefined && toast.message !== '' ?
          `: ${toast.message}`
        : ''}
      </span>
      {#if toast.action !== undefined}
        <!--
          Toast-Action-Button: zwei Varianten (ToastAction in stores/toast.ts):
          1. onClick-Callback — z.B. Undo-Pattern (DELETE des gerade erstellten Records)
          2. href-Navigation  — z.B. Quick-Link zu Folge-Seite (Berechtigungen zuweisen)
          onClick hat Vorrang, weil es semantisch spezifischer ist.
        -->
        <button
          type="button"
          class="btn btn-primary btn--sm"
          onclick={() => {
            const action = toast.action;
            if (action === undefined) return;
            dismissToast(toast.id);
            if (action.onClick !== undefined) {
              void action.onClick();
            } else if (action.href !== undefined) {
              void goto(action.href);
            }
          }}
        >
          {toast.action.label}
          <i class="fas {toast.action.onClick !== undefined ? 'fa-rotate-left' : 'fa-arrow-right'}"
          ></i>
        </button>
      {/if}
      {#if toast.showProgress === true && toast.duration !== undefined && toast.duration > 0}
        <div class="toast__progress">
          <div
            class="toast__progress-bar"
            style="animation-duration: {toast.duration}ms"
          ></div>
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .notification-container {
    position: fixed;
    top: 65px;
    right: 20px;
    z-index: 10000;
    pointer-events: none;
  }

  .notification {
    pointer-events: auto;
    width: max-content;
    max-width: 600px;
    margin-bottom: 10px;
    animation: slide-in-right 0.3s ease-out;

    /*
     * Override design-system .toast { align-items: flex-start } — otherwise the
     * action button (Rückgängig / Weiter →) sticks to the container top while the
     * text grows taller via line-height below → visually misaligned.
     * center → icon, text, button on the same baseline.
     */
    align-items: center;
  }

  /* Action button must not wrap or shrink so "Rückgängig ⟲" or
     "Berechtigungen →" stays on a single line. */
  .notification :global(.btn) {
    flex-shrink: 0;
    white-space: nowrap;
  }

  .notification.dismissing {
    animation: slide-out-right 0.3s ease-in forwards;
  }

  @keyframes slide-in-right {
    from {
      transform: translateX(100%);
      opacity: 0%;
    }

    to {
      transform: translateX(0);
      opacity: 100%;
    }
  }

  @keyframes slide-out-right {
    from {
      transform: translateX(0);
      opacity: 100%;
    }

    to {
      transform: translateX(100%);
      opacity: 0%;
    }
  }

  @media (width <= 768px) {
    .notification-container {
      left: 20px;
      right: 20px;
      max-width: none;
    }
  }
</style>
