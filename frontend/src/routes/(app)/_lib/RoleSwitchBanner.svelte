<!--
  RoleSwitchBanner.svelte
  Warning banner shown when user is viewing as a different role
  Extracted from +layout.svelte for max-lines compliance
-->
<script lang="ts">
  interface Props {
    isVisible: boolean;
    userRole: 'root' | 'admin' | 'employee' | 'dummy';
    activeRole: 'root' | 'admin' | 'employee' | 'dummy';
    onDismiss: () => void;
  }

  const { isVisible, userRole, activeRole, onDismiss }: Props = $props();

  const roleDisplayNames: Record<'root' | 'admin' | 'employee' | 'dummy', string> = {
    root: 'Root',
    admin: 'Administrator',
    employee: 'Mitarbeiter',
    dummy: 'Dummy',
  };
</script>

{#if isVisible}
  <div
    class="role-switch-banner"
    id="role-switch-warning-banner"
  >
    <div class="role-switch-banner-content">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="currentColor"
        class="banner-icon"
      >
        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
      </svg>
      <span>
        Sie agieren derzeit als <strong>{roleDisplayNames[activeRole]}</strong>. Ihre ursprüngliche
        Rolle ist
        <strong>{roleDisplayNames[userRole]}</strong>.
      </span>
      <button
        type="button"
        class="role-switch-banner-close"
        onclick={onDismiss}
        title="Banner schließen"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path
            d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
          />
        </svg>
      </button>
    </div>
  </div>
{/if}

<style>
  .role-switch-banner {
    z-index: var(--z-notification);
    background: var(--banner-warning-bg);
    border-bottom: 1px solid var(--banner-warning-border);
    padding: var(--spacing-5) var(--spacing-6);
    width: 100%;
  }

  .role-switch-banner-content {
    display: flex;
    position: relative;
    justify-content: center;
    align-items: center;
    gap: var(--spacing-2);
    color: var(--banner-warning-text);
    font-size: var(--font-size-sm);
    line-height: var(--line-height-none);
  }

  .role-switch-banner-content strong {
    color: var(--banner-warning-text-strong);
    font-weight: var(--font-weight-semibold);
  }

  .banner-icon {
    flex-shrink: 0;
    color: var(--banner-warning-icon);
  }

  .role-switch-banner-close {
    position: absolute;
    right: 0;
    display: flex;
    align-items: center;
    cursor: pointer;
    border: none;
    border-radius: var(--radius);
    background: none;
    padding: var(--spacing-1);
    color: var(--banner-warning-close);
    transition: color 0.15s;
  }

  .role-switch-banner-close:hover {
    color: var(--banner-warning-close-hover);
  }
</style>
