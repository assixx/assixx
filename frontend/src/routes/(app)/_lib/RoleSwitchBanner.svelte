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

  const roleDisplayNames: Record<
    'root' | 'admin' | 'employee' | 'dummy',
    string
  > = {
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
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="currentColor"
        class="banner-icon"
      >
        <path
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
        />
      </svg>
      <span>
        Sie agieren derzeit als <strong>{roleDisplayNames[activeRole]}</strong>.
        Ihre ursprüngliche Rolle ist
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
    position: fixed;
    top: 80px;
    right: 30%;
    left: 30%;
    z-index: 999;
    margin-top: 2px;
    border-radius: 5px;
    padding: 5px 20px;
  }

  .role-switch-banner-content {
    display: flex;
    position: relative;
    justify-content: center;
    align-items: center;
    width: 100%;
    color: var(--color-warning);
    font-size: 14px;
  }

  .role-switch-banner-content strong {
    color: var(--color-orange-300);
    font-weight: 600;
  }

  .banner-icon {
    margin-right: 8px;
  }

  .role-switch-banner-close {
    display: inherit;
    position: absolute;
    right: 0;
    cursor: pointer;
    border: none;
    border-radius: 300px;
    background: none;
    padding: 4px;
    color: var(--color-warning);
  }

  .role-switch-banner-close:hover {
    background: oklch(84.42% 0.1721 84.94 / 20%);
    color: var(--color-orange-300);
  }

  @media (width < 768px) {
    .role-switch-banner {
      top: var(--header-height-mobile);
      right: 5%;
      left: 5%;
    }
  }
</style>
