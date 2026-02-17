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
      0 4px 12px rgb(0 0 0 / 20%),
      inset 0 1px 0 rgb(255 255 255 / 10%);
    border: 1px solid hsl(0deg 0% 100% / 10%);
    border-radius: 50%;
    background: rgb(255 255 255 / 8%);
    width: 36px;
    height: 36px;
    color: var(--text-secondary);
    font-size: 19px;
  }

  .help-button:hover {
    transform: scale(1.1);
    box-shadow:
      0 6px 16px rgb(33 150 243 / 30%),
      inset 0 1px 0 rgb(255 255 255 / 10%);
    border-color: var(--primary-color);
    background: rgb(33 150 243 / 15%);
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
      0 4px 16px rgb(0 0 0 / 20%),
      inset 0 1px 0 rgb(255 255 255 / 5%);
    border: 1px solid rgb(255 255 255 / 10%);
    border-radius: 12px;
    background: rgb(255 255 255 / 2%);
    padding: 10px 20px;
    color: var(--text-secondary);
    font-weight: 500;
    font-size: 14px;
    text-decoration: none;
  }

  .back-button:hover {
    transform: translateX(-5px);
    box-shadow:
      0 6px 24px rgb(0 0 0 / 30%),
      inset 0 1px 0 rgb(255 255 255 / 10%);
    border-color: rgb(255 255 255 / 15%);
    background: rgb(255 255 255 / 5%);
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
