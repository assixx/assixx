<script lang="ts">
  /**
   * NotificationBadge Component
   *
   * Displays a notification count badge with animation.
   * Shows 99+ for counts over 99.
   */

  interface Props {
    count: number;
    max?: number;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'danger' | 'primary' | 'success' | 'warning';
  }

  const { count, max = 99, size = 'md', variant = 'danger' }: Props = $props();

  const displayCount = $derived(count > max ? `${max}+` : count.toString());
  const show = $derived(count > 0);

  const sizeClasses = {
    sm: 'min-w-[17px] h-[17px] text-[11px] px-[4px]',
    md: 'min-w-[22px] h-[22px] text-[13px] px-[6px]',
    lg: 'min-w-[26px] h-[26px] text-[15px] px-[7px]',
  };

  const variantClasses = {
    danger: 'bg-red-500',
    primary: 'bg-blue-500',
    success: 'bg-green-500',
    warning: 'bg-amber-500',
  };
</script>

{#if show}
  <span
    class="notification-badge {sizeClasses[size]} {variantClasses[variant]}"
    aria-label="{count} ungelesene Benachrichtigungen"
  >
    {displayCount}
  </span>
{/if}

<style>
  .notification-badge {
    position: absolute;
    top: -7px;
    right: -10px;
    font-weight: 600;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    border-radius: 9999px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    animation: badge-pop 0.2s ease-out;
    z-index: 10;
  }

  @keyframes badge-pop {
    0% {
      transform: scale(0);
    }
    50% {
      transform: scale(1.2);
    }
    100% {
      transform: scale(1);
    }
  }

  /* Pulse animation for attention */
  .notification-badge:not(:empty) {
    animation:
      badge-pop 0.2s ease-out,
      badge-pulse 2s ease-in-out infinite;
  }

  @keyframes badge-pulse {
    0%,
    100% {
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    50% {
      box-shadow:
        0 2px 8px rgba(0, 0, 0, 0.3),
        0 0 0 3px rgba(239, 68, 68, 0.2);
    }
  }
</style>
