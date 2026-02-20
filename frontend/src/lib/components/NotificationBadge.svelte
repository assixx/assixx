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
    /** Position mode: 'absolute' for icon overlay, 'inline' for submenu items */
    position?: 'absolute' | 'inline';
  }

  const {
    count,
    max = 99,
    size = 'md',
    variant = 'danger',
    position = 'absolute',
  }: Props = $props();

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
    class="notification-badge notification-badge--{position} {sizeClasses[
      size
    ]} {variantClasses[variant]}"
    aria-label="{count} ungelesene Benachrichtigungen"
  >
    {displayCount}
  </span>
{/if}

<style>
  .notification-badge {
    font-weight: 600;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    border-radius: 9999px;
    box-shadow: 0 2px 4px rgb(0 0 0 / 20%);
    z-index: 10;
  }

  /* Absolute positioning for icon overlays */
  .notification-badge--absolute {
    position: absolute;
    top: -7px;
    right: -16px;
  }

  /* Absolute positioning for submenu items - right aligned within parent */
  .notification-badge--inline {
    position: absolute;
    top: 50%;
    right: 33px;
    transform: translateY(-50%);
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

  @keyframes badge-pulse {
    0%,
    100% {
      box-shadow: 0 2px 4px rgb(0 0 0 / 20%);
    }

    50% {
      box-shadow:
        0 2px 8px rgb(0 0 0 / 30%),
        0 0 0 3px rgb(239 68 68 / 20%);
    }
  }
</style>
