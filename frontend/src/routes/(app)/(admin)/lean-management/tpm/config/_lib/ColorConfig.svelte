<script lang="ts">
  /**
   * TPM Color Configuration Component
   *
   * Shows all 4 status colors with hex picker, label editing,
   * per-color save, and reset-all-to-defaults button.
   */
  import { SvelteMap } from 'svelte/reactivity';

  import { invalidateAll } from '$app/navigation';

  import { showSuccessAlert, showErrorAlert } from '$lib/stores/toast';

  import {
    updateColor as apiUpdateColor,
    resetColors as apiResetColors,
    logApiError,
  } from '../../_lib/api';
  import { MESSAGES, CARD_STATUS_LABELS } from '../../_lib/constants';

  import type { TpmColorConfigEntry, CardStatus } from '../../_lib/types';

  // ===========================================================================
  // PROPS
  // ===========================================================================

  const { colors }: { colors: TpmColorConfigEntry[] } = $props();

  // ===========================================================================
  // CONSTANTS
  // ===========================================================================

  const HEX_REGEX = /^#[\da-f]{6}$/i;
  const STATUS_ORDER: CardStatus[] = ['green', 'red', 'yellow', 'overdue'];

  // ===========================================================================
  // STATE
  // ===========================================================================

  let savingKey = $state<string | null>(null);
  let resetting = $state(false);
  let showResetConfirm = $state(false);

  // ===========================================================================
  // DERIVED
  // ===========================================================================

  /** Editable copies — rebuilt from props on every SSR refresh (invalidateAll).
   *  Deep property mutations on derived objects ARE tracked by Svelte 5. */
  const editState = $derived.by(() => {
    const state = new SvelteMap<string, { colorHex: string; label: string }>();
    for (const entry of colors) {
      state.set(entry.statusKey, {
        colorHex: entry.colorHex,
        label: entry.label,
      });
    }
    for (const key of STATUS_ORDER) {
      if (!state.has(key)) {
        state.set(key, {
          colorHex: '#888888',
          label: CARD_STATUS_LABELS[key],
        });
      }
    }
    return state;
  });

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  function isValidHex(hex: string): boolean {
    return HEX_REGEX.test(hex);
  }

  function getEdit(key: CardStatus): { colorHex: string; label: string } {
    return editState.get(key) ?? { colorHex: '#888888', label: '' };
  }

  function hasChanges(key: CardStatus): boolean {
    const original = colors.find(
      (c: TpmColorConfigEntry) => c.statusKey === key,
    );
    const edit = editState.get(key);
    if (original === undefined || edit === undefined) return true;
    return original.colorHex !== edit.colorHex || original.label !== edit.label;
  }

  // ===========================================================================
  // ACTIONS
  // ===========================================================================

  async function handleSaveColor(statusKey: CardStatus): Promise<void> {
    const edit = editState.get(statusKey);
    if (edit === undefined) return;

    if (!isValidHex(edit.colorHex)) {
      showErrorAlert(MESSAGES.COLOR_HEX_INVALID);
      return;
    }
    if (edit.label.trim() === '') {
      showErrorAlert(MESSAGES.COLOR_LABEL_REQUIRED);
      return;
    }

    savingKey = statusKey;
    try {
      await apiUpdateColor({
        statusKey,
        colorHex: edit.colorHex,
        label: edit.label.trim(),
      });
      showSuccessAlert(MESSAGES.SUCCESS_COLOR_UPDATED);
      await invalidateAll();
    } catch (err: unknown) {
      logApiError('updateColor', err);
      const msg =
        err instanceof Error ? err.message : MESSAGES.ERROR_COLOR_UPDATE;
      showErrorAlert(msg);
    } finally {
      savingKey = null;
    }
  }

  async function handleResetColors(): Promise<void> {
    showResetConfirm = false;
    resetting = true;
    try {
      await apiResetColors();
      showSuccessAlert(MESSAGES.SUCCESS_COLORS_RESET);
      await invalidateAll();
    } catch (err: unknown) {
      logApiError('resetColors', err);
      const msg =
        err instanceof Error ? err.message : MESSAGES.ERROR_COLOR_RESET;
      showErrorAlert(msg);
    } finally {
      resetting = false;
    }
  }
</script>

<div class="color-config">
  <div class="color-config__header">
    <div>
      <h3 class="color-config__title">
        <i class="fas fa-palette"></i>
        {MESSAGES.COLOR_TITLE}
      </h3>
      <p class="color-config__desc">{MESSAGES.COLOR_DESCRIPTION}</p>
    </div>
    <button
      type="button"
      class="btn btn--ghost btn--sm"
      disabled={resetting}
      onclick={() => {
        showResetConfirm = true;
      }}
    >
      <i class="fas fa-undo"></i>
      {MESSAGES.COLOR_RESET}
    </button>
  </div>

  <div class="color-config__grid">
    {#each STATUS_ORDER as statusKey (statusKey)}
      {@const edit = getEdit(statusKey)}
      {@const saving = savingKey === statusKey}
      {@const changed = hasChanges(statusKey)}
      {@const validHex = isValidHex(edit.colorHex)}
      <div class="color-row">
        <div
          class="color-row__preview"
          style="background-color: {edit.colorHex}"
        ></div>
        <div class="color-row__status">
          {CARD_STATUS_LABELS[statusKey]}
        </div>
        <div class="color-row__inputs">
          <div class="color-row__field">
            <label
              class="color-row__label"
              for="hex-{statusKey}"
            >
              {MESSAGES.COLOR_HEX}
            </label>
            <div class="color-row__hex-group">
              <input
                type="color"
                class="color-row__picker"
                value={edit.colorHex}
                oninput={(e: Event) => {
                  const target = e.target as HTMLInputElement;
                  const entry = editState.get(statusKey);
                  if (entry !== undefined) entry.colorHex = target.value;
                }}
              />
              <input
                id="hex-{statusKey}"
                type="text"
                class="input input--sm color-row__hex-input"
                class:input--error={!validHex}
                value={edit.colorHex}
                maxlength={7}
                placeholder="#10b981"
                oninput={(e: Event) => {
                  const target = e.target as HTMLInputElement;
                  const entry = editState.get(statusKey);
                  if (entry !== undefined) entry.colorHex = target.value;
                }}
              />
            </div>
          </div>
          <div class="color-row__field color-row__field--label">
            <label
              class="color-row__label"
              for="label-{statusKey}"
            >
              {MESSAGES.COLOR_LABEL}
            </label>
            <input
              id="label-{statusKey}"
              type="text"
              class="input input--sm"
              value={edit.label}
              maxlength={50}
              oninput={(e: Event) => {
                const target = e.target as HTMLInputElement;
                const entry = editState.get(statusKey);
                if (entry !== undefined) entry.label = target.value;
              }}
            />
          </div>
        </div>
        <button
          type="button"
          class="btn btn--primary btn--sm"
          disabled={saving || !changed || !validHex}
          onclick={() => {
            void handleSaveColor(statusKey);
          }}
        >
          {#if saving}
            <i class="fas fa-spinner fa-spin"></i>
          {:else}
            <i class="fas fa-check"></i>
          {/if}
        </button>
      </div>
    {/each}
  </div>
</div>

<!-- Reset Confirmation -->
{#if showResetConfirm}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-backdrop"
    onclick={() => {
      showResetConfirm = false;
    }}
    onkeydown={(e: KeyboardEvent) => {
      if (e.key === 'Escape') showResetConfirm = false;
    }}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="modal"
      role="alertdialog"
      aria-modal="true"
      tabindex="-1"
      onclick={(e: MouseEvent) => {
        e.stopPropagation();
      }}
    >
      <div class="modal__header">
        <i class="fas fa-undo modal__icon"></i>
        <h3 class="modal__title">{MESSAGES.COLOR_RESET}</h3>
      </div>
      <div class="modal__body">
        <p>{MESSAGES.COLOR_RESET_CONFIRM}</p>
      </div>
      <div class="modal__actions">
        <button
          type="button"
          class="btn btn--ghost"
          onclick={() => {
            showResetConfirm = false;
          }}
        >
          {MESSAGES.BTN_CANCEL}
        </button>
        <button
          type="button"
          class="btn btn--primary"
          disabled={resetting}
          onclick={() => {
            void handleResetColors();
          }}
        >
          {#if resetting}
            <i class="fas fa-spinner fa-spin"></i>
          {/if}
          {MESSAGES.COLOR_RESET}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .color-config__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .color-config__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-gray-800);
  }

  .color-config__desc {
    color: var(--color-gray-500);
    font-size: 0.8125rem;
    margin-top: 0.25rem;
  }

  .color-config__grid {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .color-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--color-gray-50);
    border-radius: var(--radius-md, 8px);
  }

  .color-row__preview {
    width: 2rem;
    height: 2rem;
    border-radius: var(--radius-md, 8px);
    flex-shrink: 0;
    border: 2px solid var(--color-gray-200);
  }

  .color-row__status {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--color-gray-700);
    min-width: 6rem;
  }

  .color-row__inputs {
    display: flex;
    gap: 0.75rem;
    flex: 1;
    min-width: 0;
  }

  .color-row__field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .color-row__field--label {
    flex: 1;
    min-width: 0;
  }

  .color-row__label {
    font-size: 0.75rem;
    color: var(--color-gray-500);
    font-weight: 500;
  }

  .color-row__hex-group {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .color-row__picker {
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: 1px solid var(--color-gray-300);
    border-radius: var(--radius-sm, 4px);
    cursor: pointer;
    flex-shrink: 0;
  }

  .color-row__hex-input {
    width: 6rem;
    font-family: monospace;
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgb(0 0 0 / 50%);
    padding: 1rem;
  }

  .modal {
    background: var(--color-white, #fff);
    border-radius: var(--radius-lg, 12px);
    box-shadow: var(--shadow-xl, 0 20px 25px -5px rgb(0 0 0 / 10%));
    max-width: 420px;
    width: 100%;
    overflow: hidden;
  }

  .modal__header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--color-gray-200);
  }

  .modal__icon {
    font-size: 1.25rem;
    color: var(--color-blue-500, #3b82f6);
  }

  .modal__title {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--color-gray-900);
  }

  .modal__body {
    padding: 1.25rem 1.5rem;
    font-size: 0.875rem;
    color: var(--color-gray-600);
  }

  .modal__actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-gray-200);
    background: var(--color-gray-50);
  }

  @media (width <= 768px) {
    .color-row {
      flex-wrap: wrap;
    }

    .color-row__inputs {
      flex-direction: column;
      width: 100%;
    }
  }
</style>
