<script lang="ts">
  import { resolve } from '$app/paths';

  import { showInfoAlert } from '$lib/stores/toast';

  import { HELP_MESSAGE } from './constants';

  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
  }

  function showHelp(): void {
    showInfoAlert(HELP_MESSAGE, 10000);
  }
</script>

<a
  href={resolvePath('/')}
  class="back-button"
>
  <span class="icon">←</span>
  <span>Zurück zur Hauptseite</span>
</a>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="help-button"
  onclick={showHelp}
>
  ?
</div>

<style>
  .help-button {
    display: flex;
    position: fixed;
    top: 20px;
    right: 20px;
    justify-content: center;
    align-items: center;
    z-index: 100;
    backdrop-filter: blur(10px);
    cursor: pointer;
    box-shadow:
      0 4px 12px color-mix(in oklch, var(--color-black) 20%, transparent),
      inset 0 1px 0 color-mix(in oklch, var(--color-white) 10%, transparent);
    border: 1px solid color-mix(in oklch, var(--color-white) 10%, transparent);
    border-radius: 50%;
    background: color-mix(in oklch, var(--color-white) 8%, transparent);
    width: 36px;
    height: 36px;
    color: var(--text-secondary);
    font-size: 19px;
  }

  .help-button:hover {
    transform: scale(1.1);
    box-shadow:
      0 6px 16px color-mix(in oklch, var(--color-primary) 30%, transparent),
      inset 0 1px 0 color-mix(in oklch, var(--color-white) 10%, transparent);
    border-color: var(--primary-color);
    background: color-mix(in oklch, var(--color-primary) 15%, transparent);
    color: var(--primary-color);
  }

  .back-button {
    display: flex;
    position: fixed;
    top: 20px;
    left: 20px;
    align-items: center;
    gap: 10px;
    z-index: 1001;

    box-shadow:
      0 4px 16px color-mix(in oklch, var(--color-black) 20%, transparent),
      inset 0 1px 0 color-mix(in oklch, var(--color-white) 5%, transparent);
    border: 1px solid color-mix(in oklch, var(--color-white) 10%, transparent);
    border-radius: 12px;
    background: color-mix(in oklch, var(--color-white) 2%, transparent);
    padding: 10px 20px;
    color: var(--text-secondary);
    font-weight: 500;
    font-size: 14px;
    text-decoration: none;
  }

  .back-button:hover {
    transform: translateX(-5px);
    box-shadow:
      0 6px 24px color-mix(in oklch, var(--color-black) 30%, transparent),
      inset 0 1px 0 color-mix(in oklch, var(--color-white) 10%, transparent);
    border-color: color-mix(in oklch, var(--color-white) 15%, transparent);
    background: color-mix(in oklch, var(--color-white) 5%, transparent);
    color: var(--text-primary);
  }

  .back-button:active {
    transform: translateX(-3px) scale(0.98);
  }

  .back-button .icon {
    font-size: 18px;
  }

  .back-button:hover .icon {
    transform: translateX(-3px);
  }
</style>
