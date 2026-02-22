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

<div class="mb-6 flex items-start justify-between gap-4">
  <div>
    <h3
      class="flex items-center gap-2 text-base font-semibold text-(--color-text-primary)"
    >
      <i class="fas fa-palette"></i>
      {MESSAGES.COLOR_TITLE}
    </h3>
    <p class="mt-1 text-sm text-(--color-text-secondary)">
      {MESSAGES.COLOR_DESCRIPTION}
    </p>
  </div>
  <button
    type="button"
    class="btn btn-primary"
    disabled={resetting}
    onclick={() => {
      showResetConfirm = true;
    }}
  >
    <i class="fas fa-undo"></i>
    {MESSAGES.COLOR_RESET}
  </button>
</div>

<div class="color-grid">
  {#each STATUS_ORDER as statusKey (statusKey)}
    {@const edit = getEdit(statusKey)}
    {@const saving = savingKey === statusKey}
    {@const changed = hasChanges(statusKey)}
    {@const validHex = isValidHex(edit.colorHex)}
    <div class="color-row">
      <div
        class="color-preview"
        style="background-color: {edit.colorHex}"
      ></div>
      <div class="color-status">
        {CARD_STATUS_LABELS[statusKey]}
      </div>
      <div class="color-inputs">
        <div class="color-field">
          <label
            class="form-field__label"
            for="hex-{statusKey}"
          >
            {MESSAGES.COLOR_HEX}
          </label>
          <div class="color-hex-group">
            <input
              type="color"
              class="color-picker"
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
              class="form-field__control color-hex-input"
              class:is-error={!validHex}
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
        <div class="color-field color-field--grow">
          <label
            class="form-field__label"
            for="label-{statusKey}"
          >
            {MESSAGES.COLOR_LABEL}
          </label>
          <input
            id="label-{statusKey}"
            type="text"
            class="form-field__control"
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
        class="btn btn-primary btn-icon"
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

<!-- Reset Confirmation -->
{#if showResetConfirm}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-overlay modal-overlay--active"
    onclick={() => {
      showResetConfirm = false;
    }}
    onkeydown={(e: KeyboardEvent) => {
      if (e.key === 'Escape') showResetConfirm = false;
    }}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="confirm-modal"
      role="alertdialog"
      aria-modal="true"
      tabindex="-1"
      onclick={(e: MouseEvent) => {
        e.stopPropagation();
      }}
    >
      <div class="confirm-modal__icon">
        <i class="fas fa-undo"></i>
      </div>
      <h3 class="confirm-modal__title">{MESSAGES.COLOR_RESET}</h3>
      <p class="confirm-modal__message">{MESSAGES.COLOR_RESET_CONFIRM}</p>
      <div class="confirm-modal__actions">
        <button
          type="button"
          class="confirm-modal__btn--cancel"
          onclick={() => {
            showResetConfirm = false;
          }}
        >
          {MESSAGES.BTN_CANCEL}
        </button>
        <button
          type="button"
          class="btn btn-primary"
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
  .color-grid {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .color-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--glass-bg-hover);
    border-radius: var(--radius-md);
  }

  .color-preview {
    width: 2rem;
    height: 2rem;
    border-radius: var(--radius-md);
    flex-shrink: 0;
    border: 2px solid var(--color-glass-border);
  }

  .color-status {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--color-text-primary);
    min-width: 6rem;
  }

  .color-inputs {
    display: flex;
    gap: 0.75rem;
    flex: 1;
    min-width: 0;
  }

  .color-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .color-field--grow {
    flex: 1;
    min-width: 0;
  }

  .color-hex-group {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .color-picker {
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: 1px solid var(--color-glass-border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    flex-shrink: 0;
  }

  .color-hex-input {
    width: 6rem;
    font-family: monospace;
  }

  /* .is-error is provided by the design system form-field component */

  @media (width <= 768px) {
    .color-row {
      flex-wrap: wrap;
    }

    .color-inputs {
      flex-direction: column;
      width: 100%;
    }
  }
</style>
