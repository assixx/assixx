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

  import ConfirmModal from '$design-system/components/confirm-modal/ConfirmModal.svelte';

  import {
    updateIntervalColor as apiUpdateIntervalColor,
    resetIntervalColors as apiResetIntervalColors,
    resetSingleIntervalColor as apiResetSingleIntervalColor,
    logApiError,
  } from '../../_lib/api';
  import {
    MESSAGES,
    INTERVAL_LABELS,
    DEFAULT_COLORS,
  } from '../../_lib/constants';

  import type {
    IntervalColorConfigEntry,
    IntervalType,
    TpmColorConfigEntry,
    CardStatus,
  } from '../../_lib/types';

  // ===========================================================================
  // PROPS
  // ===========================================================================

  const {
    colors,
    statusColors,
  }: {
    colors: IntervalColorConfigEntry[];
    statusColors: TpmColorConfigEntry[];
  } = $props();

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
  let resettingKey = $state<string | null>(null);
  let showResetConfirm = $state(false);

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  function isValidHex(hex: string): boolean {
    return HEX_REGEX.test(hex);
  }

  function getStatusColor(status: CardStatus): string {
    const found = statusColors.find(
      (c: TpmColorConfigEntry) => c.statusKey === status,
    );
    return found !== undefined ? found.colorHex : DEFAULT_COLORS[status];
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

  async function handleResetSingleColor(row: EditRow): Promise<void> {
    resettingKey = row.key;
    try {
      await apiResetSingleIntervalColor(row.key);
      showSuccessAlert(MESSAGES.SUCCESS_SINGLE_INTERVAL_COLOR_RESET);
      await invalidateAll();
    } catch (err: unknown) {
      logApiError('resetSingleIntervalColor', err);
      const msg =
        err instanceof Error ?
          err.message
        : MESSAGES.ERROR_SINGLE_INTERVAL_COLOR_RESET;
      showErrorAlert(msg);
    } finally {
      resettingKey = null;
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
    {#if rows[i].includeInCard}
      <div class="card-preview-wrapper">
        <!-- Erledigt: Custom-Farbe als Hintergrund -->
        <div class="card-preview-item">
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
          <span class="card-preview-label">Erledigt</span>
        </div>

        <!-- Fällig: Rot + Custom-Farbpunkt -->
        <div class="card-preview-item">
          <div
            class="card-preview"
            style="background-color: {getStatusColor('red')}"
          >
            <div class="card-preview__header">
              <span
                class="card-preview__dot"
                style="background-color: {row.colorHex}"
              ></span>
              <span class="card-preview__code">BT1</span>
            </div>
            <div class="card-preview__body">
              <div class="card-preview__title">{row.label}</div>
            </div>
            <div class="card-preview__footer">
              <span class="card-preview__status">Fällig</span>
            </div>
          </div>
          <span class="card-preview-label">Fällig</span>
        </div>

        <!-- Überfällig: Dunkelrot + Custom-Farbpunkt -->
        <div class="card-preview-item">
          <div
            class="card-preview"
            style="background-color: {getStatusColor('overdue')}"
          >
            <div class="card-preview__header">
              <span
                class="card-preview__dot"
                style="background-color: {row.colorHex}"
              ></span>
              <span class="card-preview__code">BT1</span>
            </div>
            <div class="card-preview__body">
              <div class="card-preview__title">{row.label}</div>
            </div>
            <div class="card-preview__footer">
              <span class="card-preview__status">Überfällig</span>
            </div>
          </div>
          <span class="card-preview-label">Überfällig</span>
        </div>
      </div>
    {/if}
  {/each}
</div>

<!-- Reset Confirmation -->
<ConfirmModal
  show={showResetConfirm}
  id="tpm-interval-color-reset-modal"
  title={MESSAGES.INTERVAL_COLOR_RESET}
  variant="info"
  icon="fa-undo"
  confirmLabel={MESSAGES.INTERVAL_COLOR_RESET}
  submitting={resetting}
  onconfirm={() => void handleResetColors()}
  oncancel={() => {
    showResetConfirm = false;
  }}
>
  {MESSAGES.INTERVAL_COLOR_RESET_CONFIRM}
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
    gap: 1rem;
    padding: 0.5rem 0.75rem 0.75rem;
    padding-left: 11rem;
  }

  .card-preview-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
  }

  .card-preview-label {
    font-size: 0.688rem;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .card-preview {
    width: 160px;
    height: 210px;
    border-radius: var(--radius-xs, 4px);
    display: flex;
    flex-direction: column;
    padding: 0.625rem;
    color: var(--color-white);
    box-shadow: 0 2px 8px
      color-mix(in oklch, var(--color-black) 20%, transparent);
    flex-shrink: 0;
  }

  .card-preview__header {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding-bottom: 0.375rem;
    border-bottom: 1px solid
      color-mix(in oklch, var(--color-black) 15%, transparent);
  }

  .card-preview__code {
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .card-preview__dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1.5px solid color-mix(in oklch, var(--color-white) 60%, transparent);
    flex-shrink: 0;
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
    border-top: 1px solid
      color-mix(in oklch, var(--color-black) 15%, transparent);
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
      flex-wrap: wrap;
    }
  }
</style>
