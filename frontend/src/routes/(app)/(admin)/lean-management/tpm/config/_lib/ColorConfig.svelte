<script lang="ts">
  /**
   * TPM Card Status Color Configuration
   *
   * Per-row: ColorPicker (bind:hex) + Label input + Save button.
   * Reset-all button with confirmation modal.
   * Uses svelte-awesome-color-picker (same as KVP categories).
   */
  import ColorPicker from 'svelte-awesome-color-picker';

  import { invalidateAll } from '$app/navigation';

  import { showSuccessAlert, showErrorAlert } from '$lib/stores/toast';

  import ConfirmModal from '$design-system/components/confirm-modal/ConfirmModal.svelte';

  import {
    updateColor as apiUpdateColor,
    resetColors as apiResetColors,
    resetSingleColor as apiResetSingleColor,
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
  // TYPES
  // ===========================================================================

  interface EditRow {
    key: CardStatus;
    colorHex: string;
    label: string;
    originalHex: string;
    originalLabel: string;
  }

  // ===========================================================================
  // STATE
  // ===========================================================================

  // eslint-disable-next-line svelte/prefer-writable-derived -- bind:hex/bind:value need deep reactivity from $state (derived proxies are shallow)
  let rows = $state<EditRow[]>([]);
  let savingKey = $state<string | null>(null);

  $effect(() => {
    rows = STATUS_ORDER.map((key: CardStatus) => {
      const entry = colors.find((c: TpmColorConfigEntry) => c.statusKey === key);
      return {
        key,
        colorHex: entry?.colorHex ?? '#888888',
        label: entry?.label ?? CARD_STATUS_LABELS[key],
        originalHex: entry?.colorHex ?? '#888888',
        originalLabel: entry?.label ?? CARD_STATUS_LABELS[key],
      };
    });
  });
  let resetting = $state(false);
  let resettingKey = $state<string | null>(null);
  let showResetConfirm = $state(false);

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  function isValidHex(hex: string): boolean {
    return HEX_REGEX.test(hex);
  }

  function hasChanges(row: EditRow): boolean {
    return row.colorHex !== row.originalHex || row.label !== row.originalLabel;
  }

  // ===========================================================================
  // ACTIONS
  // ===========================================================================

  async function handleSaveColor(row: EditRow): Promise<void> {
    if (!isValidHex(row.colorHex)) {
      showErrorAlert(MESSAGES.COLOR_HEX_INVALID);
      return;
    }
    if (row.label.trim() === '') {
      showErrorAlert(MESSAGES.COLOR_LABEL_REQUIRED);
      return;
    }

    savingKey = row.key;
    try {
      await apiUpdateColor({
        statusKey: row.key,
        colorHex: row.colorHex,
        label: row.label.trim(),
      });
      showSuccessAlert(MESSAGES.SUCCESS_COLOR_UPDATED);
      await invalidateAll();
    } catch (err: unknown) {
      logApiError('updateColor', err);
      const msg = err instanceof Error ? err.message : MESSAGES.ERROR_COLOR_UPDATE;
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
      const msg = err instanceof Error ? err.message : MESSAGES.ERROR_COLOR_RESET;
      showErrorAlert(msg);
    } finally {
      resetting = false;
    }
  }

  async function handleResetSingleColor(row: EditRow): Promise<void> {
    resettingKey = row.key;
    try {
      await apiResetSingleColor(row.key);
      showSuccessAlert(MESSAGES.SUCCESS_SINGLE_COLOR_RESET);
      await invalidateAll();
    } catch (err: unknown) {
      logApiError('resetSingleColor', err);
      const msg = err instanceof Error ? err.message : MESSAGES.ERROR_SINGLE_COLOR_RESET;
      showErrorAlert(msg);
    } finally {
      resettingKey = null;
    }
  }
</script>

<div class="mb-4 flex items-start justify-between gap-4">
  <div>
    <h3 class="flex items-center gap-2 text-base font-semibold text-(--color-text-primary)">
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
  {#each rows as row, i (row.key)}
    {@const saving = savingKey === row.key}
    {@const changed = hasChanges(row)}
    {@const validHex = isValidHex(row.colorHex)}
    <div class="color-row">
      <div class="color-name">
        {CARD_STATUS_LABELS[row.key]}
      </div>
      <div class="color-picker-wrapper">
        <ColorPicker
          bind:hex={rows[i].colorHex}
          label=""
          isAlpha={false}
          position="responsive"
          --picker-height="150px"
          --picker-width="150px"
          --slider-width="150px"
          --focus-color="var(--color-primary, #2196f3)"
          --cp-bg-color="var(--color-gray-900, #212121)"
          --cp-border-color="#616161"
          --cp-text-color="#fff"
          --cp-input-color="#424242"
          --cp-button-hover-color="#616161"
          --picker-z-index="1060"
        />
        <span class="color-hex-display">{row.colorHex}</span>
      </div>
      <div class="color-label-field">
        <input
          id="label-{row.key}"
          type="text"
          class="form-field__control"
          bind:value={rows[i].label}
          maxlength={50}
          placeholder="Bezeichnung"
        />
      </div>
      <button
        type="button"
        class="btn btn-primary btn-icon"
        disabled={saving || !changed || !validHex}
        onclick={() => {
          void handleSaveColor(row);
        }}
      >
        {#if saving}
          <i class="fas fa-spinner fa-spin"></i>
        {:else}
          <i class="fas fa-check"></i>
        {/if}
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-icon"
        title="Diese Farbe auf Standard zurücksetzen"
        disabled={resettingKey === row.key}
        onclick={() => {
          void handleResetSingleColor(row);
        }}
      >
        {#if resettingKey === row.key}
          <i class="fas fa-spinner fa-spin"></i>
        {:else}
          <i class="fas fa-undo"></i>
        {/if}
      </button>
    </div>
  {/each}
</div>

<!-- Reset Confirmation -->
<ConfirmModal
  show={showResetConfirm}
  id="tpm-color-reset-modal"
  title={MESSAGES.COLOR_RESET}
  variant="info"
  icon="fa-undo"
  confirmLabel={MESSAGES.COLOR_RESET}
  submitting={resetting}
  onconfirm={() => void handleResetColors()}
  oncancel={() => {
    showResetConfirm = false;
  }}
>
  {MESSAGES.COLOR_RESET_CONFIRM}
</ConfirmModal>

<style>
  .color-grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .color-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: var(--glass-bg-hover);
    border-radius: var(--radius-md);
  }

  .color-name {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--color-text-primary);
    width: 10rem;
    flex-shrink: 0;
  }

  .color-picker-wrapper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .color-hex-display {
    font-family: monospace;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    min-width: 4.5rem;
  }

  .color-label-field {
    flex: 1;
    min-width: 0;
  }

  /* Hide alpha-grid overlay (alpha is disabled) */
  .color-picker-wrapper :global(.alpha) {
    display: none;
  }

  /* Hue + Alpha slider: hide thumb */
  .color-picker-wrapper :global(.h .thumb),
  .color-picker-wrapper :global(.a .thumb) {
    display: none;
  }

  @media (width <= 768px) {
    .color-row {
      flex-wrap: wrap;
    }

    .color-label-field {
      width: 100%;
    }
  }
</style>
