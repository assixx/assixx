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
    z-index: 9999;
    background: linear-gradient(90deg, oklch(22% 0.04 70 / 90%) 0%, oklch(18% 0.03 70 / 50%) 100%);
    border-bottom: 1px solid oklch(45% 0.1 70 / 30%);
    padding: 18px 24px;
    width: 100%;
  }

  .role-switch-banner-content {
    display: flex;
    position: relative;
    justify-content: center;
    align-items: center;
    gap: 8px;
    color: oklch(75% 0.08 75);
    font-size: 13px;
    line-height: 1;
  }

  .role-switch-banner-content strong {
    color: oklch(85% 0.1 75);
    font-weight: 600;
  }

  .banner-icon {
    flex-shrink: 0;
    color: oklch(80% 0.16 85);
  }

  .role-switch-banner-close {
    position: absolute;
    right: 0;
    display: flex;
    align-items: center;
    cursor: pointer;
    border: none;
    border-radius: 4px;
    background: none;
    padding: 4px;
    color: oklch(65% 0.06 75);
    transition: color 0.15s;
  }

  .role-switch-banner-close:hover {
    color: oklch(85% 0.1 75);
  }
</style>
