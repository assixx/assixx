<script lang="ts">
  /**
   * TPM Interval Color Configuration
   *
   * Per-row: ColorPicker (bind:hex) + Label input + Save button.
   * Reset-all button with confirmation modal.
   * Uses svelte-awesome-color-picker (same as KVP categories).
   */
  import ColorPicker from 'svelte-awesome-color-picker';

  import { invalidateAll } from '$app/navigation';

  import { showSuccessAlert, showErrorAlert } from '$lib/stores/toast';

  import {
    updateIntervalColor as apiUpdateIntervalColor,
    resetIntervalColors as apiResetIntervalColors,
    logApiError,
  } from '../../_lib/api';
  import { MESSAGES, INTERVAL_LABELS } from '../../_lib/constants';

  import type {
    IntervalColorConfigEntry,
    IntervalType,
  } from '../../_lib/types';

  // ===========================================================================
  // PROPS
  // ===========================================================================

  const { colors }: { colors: IntervalColorConfigEntry[] } = $props();

  // ===========================================================================
  // CONSTANTS
  // ===========================================================================

  const HEX_REGEX = /^#[\da-f]{6}$/i;
  const INTERVAL_ORDER: IntervalType[] = [
    'daily',
    'weekly',
    'monthly',
    'quarterly',
    'semi_annual',
    'annual',
    'custom',
  ];

  // ===========================================================================
  // TYPES
  // ===========================================================================

  interface EditRow {
    key: IntervalType;
    colorHex: string;
    label: string;
    includeInCard: boolean;
    originalHex: string;
    originalLabel: string;
    originalIncludeInCard: boolean;
  }

  // ===========================================================================
  // STATE
  // ===========================================================================

  function buildEditRow(
    key: IntervalType,
    entry: IntervalColorConfigEntry | undefined,
  ): EditRow {
    const hex = entry?.colorHex ?? '#888888';
    const lbl = entry?.label ?? INTERVAL_LABELS[key];
    const inc = entry?.includeInCard ?? false;
    return {
      key,
      colorHex: hex,
      label: lbl,
      includeInCard: inc,
      originalHex: hex,
      originalLabel: lbl,
      originalIncludeInCard: inc,
    };
  }

  // eslint-disable-next-line svelte/prefer-writable-derived -- bind:hex/bind:value need deep reactivity from $state (derived proxies are shallow)
  let rows = $state<EditRow[]>([]);
  let savingKey = $state<string | null>(null);

  $effect(() => {
    rows = INTERVAL_ORDER.map((key: IntervalType) => {
      const entry = colors.find(
        (c: IntervalColorConfigEntry) => c.statusKey === key,
      );
      return buildEditRow(key, entry);
    });
  });
  let resetting = $state(false);
  let showResetConfirm = $state(false);

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  function isValidHex(hex: string): boolean {
    return HEX_REGEX.test(hex);
  }

  function hasChanges(row: EditRow): boolean {
    return (
      row.colorHex !== row.originalHex ||
      row.label !== row.originalLabel ||
      row.includeInCard !== row.originalIncludeInCard
    );
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
      await apiUpdateIntervalColor({
        intervalKey: row.key,
        colorHex: row.colorHex,
        label: row.label.trim(),
        includeInCard: row.includeInCard,
      });
      showSuccessAlert(MESSAGES.SUCCESS_INTERVAL_COLOR_UPDATED);
      await invalidateAll();
    } catch (err: unknown) {
      logApiError('updateIntervalColor', err);
      const msg =
        err instanceof Error ?
          err.message
        : MESSAGES.ERROR_INTERVAL_COLOR_UPDATE;
      showErrorAlert(msg);
    } finally {
      savingKey = null;
    }
  }

  async function handleResetColors(): Promise<void> {
    showResetConfirm = false;
    resetting = true;
    try {
      await apiResetIntervalColors();
      showSuccessAlert(MESSAGES.SUCCESS_INTERVAL_COLORS_RESET);
      await invalidateAll();
    } catch (err: unknown) {
      logApiError('resetIntervalColors', err);
      const msg =
        err instanceof Error ?
          err.message
        : MESSAGES.ERROR_INTERVAL_COLOR_RESET;
      showErrorAlert(msg);
    } finally {
      resetting = false;
    }
  }
</script>

<div class="mb-4 flex items-start justify-between gap-4">
  <div>
    <h3
      class="flex items-center gap-2 text-base font-semibold text-(--color-text-primary)"
    >
      <i class="fas fa-swatchbook"></i>
      {MESSAGES.INTERVAL_COLOR_TITLE}
    </h3>
    <p class="mt-1 text-sm text-(--color-text-secondary)">
      {MESSAGES.INTERVAL_COLOR_DESCRIPTION}
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
    {MESSAGES.INTERVAL_COLOR_RESET}
  </button>
</div>

<div class="color-grid">
  {#each rows as row, i (row.key)}
    {@const saving = savingKey === row.key}
    {@const changed = hasChanges(row)}
    {@const validHex = isValidHex(row.colorHex)}
    <div class="color-row">
      <div class="color-name">
        {INTERVAL_LABELS[row.key]}
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
          --cp-border-color="var(--color-border, #616161)"
          --cp-text-color="var(--color-text-primary, #fff)"
          --cp-input-color="var(--color-gray-800, #424242)"
          --cp-button-hover-color="var(--color-gray-700, #616161)"
          --picker-z-index="1060"
        />
        <span class="color-hex-display">{row.colorHex}</span>
      </div>
      <div class="color-label-field">
        <input
          id="interval-label-{row.key}"
          type="text"
          class="form-field__control"
          bind:value={rows[i].label}
          maxlength={50}
          placeholder="Bezeichnung"
        />
      </div>
      <label class="choice-card interval-preview-toggle">
        <input
          type="checkbox"
          class="choice-card__input"
          bind:checked={rows[i].includeInCard}
        />
        <span class="choice-card__text">TPM Karte mit einschließen</span>
      </label>
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
    </div>
    {#if rows[i].includeInCard}
      <div class="card-preview-wrapper">
        <div
          class="card-preview"
          style="background-color: {row.colorHex}"
        >
          <div class="card-preview__header">
            <span class="card-preview__code">BT1</span>
          </div>
          <div class="card-preview__body">
            <div class="card-preview__title">{row.label}</div>
          </div>
          <div class="card-preview__footer">
            <span class="card-preview__status">Erledigt</span>
          </div>
        </div>
      </div>
    {/if}
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
      <h3 class="confirm-modal__title">{MESSAGES.INTERVAL_COLOR_RESET}</h3>
      <p class="confirm-modal__message">
        {MESSAGES.INTERVAL_COLOR_RESET_CONFIRM}
      </p>
      <div class="confirm-modal__actions">
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--cancel"
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
          {MESSAGES.INTERVAL_COLOR_RESET}
        </button>
      </div>
    </div>
  </div>
{/if}

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

  /* Hue slider thumb: no fill, only border */
  .color-picker-wrapper :global(.h),
  .color-picker-wrapper :global(.a) {
    --thumb-background: transparent;
    --thumb-border: 2px solid var(--color-text-primary, #fff);
  }

  .interval-preview-toggle {
    flex-shrink: 0;
    padding: 6px 12px;
    min-width: max-content;
  }

  .card-preview-wrapper {
    display: flex;
    padding: 0.25rem 0.75rem 0.5rem;
    padding-left: 11rem;
  }

  .card-preview {
    width: 160px;
    height: 210px;
    border-radius: var(--radius-xs, 4px);
    display: flex;
    flex-direction: column;
    padding: 0.625rem;
    color: #fff;
    box-shadow: 0 2px 8px rgb(0 0 0 / 20%);
    flex-shrink: 0;
  }

  .card-preview__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 0.375rem;
    border-bottom: 1px solid rgb(0 0 0 / 15%);
  }

  .card-preview__code {
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .card-preview__body {
    flex: 1;
    display: flex;
    align-items: center;
    padding: 0.5rem 0;
  }

  .card-preview__title {
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.35;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    -webkit-box-orient: vertical;
  }

  .card-preview__footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.25rem;
    padding-top: 0.375rem;
    border-top: 1px solid rgb(0 0 0 / 15%);
  }

  .card-preview__status {
    font-size: 0.65rem;
    opacity: 85%;
    margin-left: auto;
  }

  @media (width <= 768px) {
    .color-row {
      flex-wrap: wrap;
    }

    .color-label-field {
      width: 100%;
    }

    .card-preview-wrapper {
      padding-left: 0.75rem;
    }
  }
</style>
