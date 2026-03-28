<script lang="ts">
  import { isDark as getIsDark, toggleTheme } from '$lib/stores/theme.svelte';

  const dark = $derived(getIsDark());
</script>

<button
  type="button"
  class="theme-btn"
  onclick={toggleTheme}
  aria-label={dark ? 'Zu Light Mode wechseln' : 'Zu Dark Mode wechseln'}
>
  {#if dark}
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle
        cx="12"
        cy="12"
        r="4"
      />
      <path d="M12 2v2" /><path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" /><path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
    </svg>
  {:else}
    <svg
      viewBox="0 0 384 512"
      fill="currentColor"
    >
      <path
        d="M223.5 32C100 32 0 132.3 0 256S100 480 223.5 480c60.6 0 115.5-24.2 155.8-63.4c5-4.9 6.3-12.5 3.1-18.7s-10.1-9.7-17-8.5c-9.8 1.7-19.8 2.6-30.1 2.6c-96.9 0-175.5-78.8-175.5-176c0-65.8 36-123.1 89.3-153.3c6.1-3.5 9.2-10.5 7.7-17.3s-7.3-11.9-14.3-12.5c-6.3-.5-12.6-.8-19-.8z"
      />
    </svg>
  {/if}
</button>

<style>
  .theme-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border: var(--glass-border);
    border-radius: 8px;
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition:
      color 200ms ease,
      background 200ms ease;
  }

  .theme-btn:hover {
    color: var(--color-text-primary);
    background: var(--color-bg-tertiary);
  }

  .theme-btn:focus-visible {
    outline: 2px solid var(--color-blue-400);
    outline-offset: 2px;
  }

  .theme-btn svg {
    width: 18px;
    height: 18px;
  }
</style>
