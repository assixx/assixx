<script lang="ts">
  /**
   * ThemeToggle - Neumorphic Day/Night toggle switch
   * Sliding knob in recessed track with sun/moon icons.
   * Dark mode = default. Wired to theme store for actual switching.
   */
  import { isDark as getIsDark, toggleTheme } from '$lib/stores/theme.svelte';

  /** Reactive derived state from theme store */
  const dark = $derived(getIsDark());
</script>

<button
  type="button"
  class="theme-toggle"
  class:is-light={!dark}
  onclick={toggleTheme}
  role="switch"
  aria-checked={!dark}
  aria-label={dark ? 'Zu Light Mode wechseln' : 'Zu Dark Mode wechseln'}
>
  <span class="theme-toggle__track">
    <!-- Lucide sun icon (left side) -->
    <svg
      class="theme-toggle__icon theme-toggle__sun"
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
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
    <!-- FA moon crescent (right side) -->
    <svg
      class="theme-toggle__icon theme-toggle__moon"
      viewBox="0 0 384 512"
      fill="currentColor"
    >
      <path
        d="M223.5 32C100 32 0 132.3 0 256S100 480 223.5 480c60.6 0 115.5-24.2 155.8-63.4c5-4.9 6.3-12.5 3.1-18.7s-10.1-9.7-17-8.5c-9.8 1.7-19.8 2.6-30.1 2.6c-96.9 0-175.5-78.8-175.5-176c0-65.8 36-123.1 89.3-153.3c6.1-3.5 9.2-10.5 7.7-17.3s-7.3-11.9-14.3-12.5c-6.3-.5-12.6-.8-19-.8z"
      />
    </svg>
    <span class="theme-toggle__knob"></span>
  </span>
</button>

<style>
  .theme-toggle {
    display: flex;
    align-items: center;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
  }

  .theme-toggle__track {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 76px;
    height: 33px;
    padding: 0 12px;
    border-radius: 17px;
    border: none;
    background: rgb(0 3 8 / 50%);
    box-shadow: inset 0 -1px rgba(255, 255, 255, 0.203);
    transition:
      background 400ms ease,
      box-shadow 400ms ease;
  }

  /* Stars as dots (dark mode) */
  .theme-toggle__track::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    box-shadow:
      21px 24px 0 0.6px rgb(200 220 255),
      14px 6px 0 0.7px rgb(170 200 255),
      33px 21px 0 0.8px rgb(190 215 255),
      40px 8px 0 0.6px rgb(180 210 255),
      26px 15px 0 0.5px rgb(200 225 255),
      10px 19px 0 0.6px rgb(185 215 255),
      45px 25px 0 0.7px rgb(195 220 255),
      38px 14px 0 0.5px rgb(175 205 255),
      67px 7px 0 0.6px rgb(180 210 255),
      69px 24px 0 0.7px rgb(190 215 255),
      64px 17px 0 0.5px rgb(200 220 255);
    opacity: 1;
    transition: opacity 400ms ease;
    pointer-events: none;
  }

  /* Blue night glow behind moon (top-left of moon area) */
  .theme-toggle__track::after {
    content: '';
    position: absolute;
    right: 17px;
    top: 2px;
    width: 21px;
    height: 21px;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      rgb(80 140 255 / 47%) 0%,
      transparent 70%
    );
    z-index: 0;
    pointer-events: none;
    transition: opacity 400ms ease;
  }

  .theme-toggle__icon {
    position: relative;
    z-index: 1;
    width: 19px;
    height: 19px;
    transition: opacity 400ms ease;
  }

  .theme-toggle__sun {
    color: rgb(255 255 255 / 35%);
    opacity: 0;
  }

  .theme-toggle__moon {
    color: rgb(210 225 255 / 90%);
    opacity: 1;
  }

  .theme-toggle__knob {
    position: absolute;
    top: 50%;
    left: 4px;
    translate: 0 -50%;
    width: 23px;
    height: 23px;
    border-radius: 50%;
    background: linear-gradient(145deg, #f0f0f0 0%, #a0a0a0 100%);
    box-shadow:
      0 3px 7px rgb(0 0 0 / 55%),
      0 1px 3px rgb(0 0 0 / 30%),
      inset 0 2px 4px rgb(255 255 255 / 70%),
      inset 0 -2px 3px rgb(0 0 0 / 20%);
    transition:
      transform 400ms cubic-bezier(0.68, -0.15, 0.32, 1.15),
      background 400ms ease,
      box-shadow 400ms ease;
  }

  /* ---- Light mode state ---- */
  .theme-toggle.is-light .theme-toggle__track {
    background: var(--color-icon-primary);
    box-shadow:
      inset 0 3px 6px rgb(0 0 0 / 40%),
      inset 0 1px 2px rgb(0 0 0 / 30%),
      inset 0 -1px 1px rgb(255 255 255 / 10%);
  }

  .theme-toggle.is-light .theme-toggle__track::before,
  .theme-toggle.is-light .theme-toggle__track::after {
    opacity: 0;
  }

  .theme-toggle.is-light .theme-toggle__sun {
    color: #c9a900;
    opacity: 1;
  }

  .theme-toggle.is-light .theme-toggle__moon {
    opacity: 0;
  }

  .theme-toggle.is-light .theme-toggle__knob {
    transform: translateX(45px);
  }

  .theme-toggle:focus-visible .theme-toggle__track {
    outline: 2px solid var(--color-blue-400);
    outline-offset: 2px;
  }
</style>
