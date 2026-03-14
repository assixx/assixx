<!--
  OrgToolbar — Toolbar für Organigramm-Aktionen
  Zoom In/Out/Reset, Auto-Layout, Speichern, Hierarchie-Labels, Canvas-Background
-->
<script lang="ts">
  import ColorPicker from 'svelte-awesome-color-picker';

  interface Props {
    zoom: number;
    fontSize: number;
    isDirty: boolean;
    isSaving: boolean;
    isLocked: boolean;
    canvasBg: string | null;
    onzoomin: () => void;
    onzoomout: () => void;
    onzoomreset: () => void;
    onfontinc: () => void;
    onfontdec: () => void;
    onnodeinc: () => void;
    onnodedec: () => void;
    nodeWidth: number;
    nodeHeight: number;
    onautolayout: () => void;
    onsave: () => void;
    onreset: () => void;
    onopenlabels: () => void;
    ontogglelock: () => void;
    onfullscreen: () => void;
    oncanvasbg: (color: string | null) => void;
  }

  const {
    zoom,
    fontSize,
    isDirty,
    isSaving,
    isLocked,
    canvasBg,
    onzoomin,
    onzoomout,
    onzoomreset,
    onfontinc,
    onfontdec,
    onnodeinc,
    onnodedec,
    nodeWidth,
    nodeHeight,
    onautolayout,
    onsave,
    onreset,
    onopenlabels,
    ontogglelock,
    onfullscreen,
    oncanvasbg,
  }: Props = $props();

  const zoomPercent = $derived(Math.round(zoom * 100));

  let pickerHex = $state<string | null>(null);
  let showPicker = $state(false);

  /** Track last known value to detect actual user interaction */
  let lastPickerHex: string | null = null;

  /** Sync picker wenn canvasBg sich von außen ändert (z.B. Reset) */
  $effect(() => {
    pickerHex = canvasBg;
    lastPickerHex = canvasBg;
  });

  /** Propagate bind:hex changes — nur wenn User tatsächlich den Picker bewegt */
  $effect(() => {
    if (showPicker && pickerHex !== lastPickerHex) {
      lastPickerHex = pickerHex;
      oncanvasbg(pickerHex);
    }
  });
</script>

<div class="toolbar-wrapper">
  <div
    class="dirty-banner"
    class:dirty-banner--visible={isDirty}
  >
    <i class="fas fa-circle"></i>
    Ungespeichert
  </div>

  <div class="org-toolbar">
    <div class="zoom-controls">
      <button
        type="button"
        class="btn btn-icon btn-secondary"
        title="Vergrößern"
        disabled={isLocked}
        onclick={onzoomin}
      >
        <i class="fas fa-plus"></i>
      </button>
      <span class="zoom-level">{zoomPercent}%</span>
      <button
        type="button"
        class="btn btn-icon btn-secondary"
        title="Verkleinern"
        disabled={isLocked}
        onclick={onzoomout}
      >
        <i class="fas fa-minus"></i>
      </button>
      <button
        type="button"
        class="btn btn-icon btn-secondary"
        title="Zoom zurücksetzen"
        disabled={isLocked}
        onclick={onzoomreset}
      >
        <i class="fas fa-compress-arrows-alt"></i>
      </button>
      <button
        type="button"
        class="btn btn-icon btn-secondary ml-2"
        title="Vollbild"
        onclick={onfullscreen}
      >
        <i class="fas fa-expand"></i>
      </button>
    </div>

    <div class="toolbar-divider"></div>

    <div class="font-controls">
      <button
        type="button"
        class="btn btn-icon btn-secondary"
        title="Schrift verkleinern"
        disabled={isLocked || fontSize <= 8}
        onclick={onfontdec}
      >
        <i class="fas fa-font font-icon--sm"></i>
      </button>
      <span class="font-level">{fontSize}px</span>
      <button
        type="button"
        class="btn btn-icon btn-secondary"
        title="Schrift vergrößern"
        disabled={isLocked || fontSize >= 120}
        onclick={onfontinc}
      >
        <i class="fas fa-font font-icon--lg"></i>
      </button>
    </div>

    <div class="toolbar-divider"></div>

    <div class="font-controls">
      <button
        type="button"
        class="btn btn-icon btn-secondary"
        title="Knoten verkleinern"
        disabled={isLocked || nodeWidth <= 100}
        onclick={onnodedec}
      >
        <i class="fas fa-compress-alt"></i>
      </button>
      <span class="font-level">{nodeWidth}×{nodeHeight}</span>
      <button
        type="button"
        class="btn btn-icon btn-secondary"
        title="Knoten vergrößern"
        disabled={isLocked || nodeWidth >= 1000}
        onclick={onnodeinc}
      >
        <i class="fas fa-expand-alt"></i>
      </button>
    </div>

    <div class="toolbar-divider"></div>

    <button
      type="button"
      class="btn btn-icon"
      class:btn-secondary={!isLocked}
      class:lock-active={isLocked}
      title={isLocked ? 'Bearbeitung entsperren' : 'Bearbeitung sperren'}
      onclick={ontogglelock}
    >
      <i
        class="fas"
        class:fa-lock={isLocked}
        class:fa-lock-open={!isLocked}
      ></i>
    </button>

    <div class="toolbar-divider"></div>

    <!-- Canvas Background Color Picker -->
    <div class="color-picker-wrapper">
      <button
        type="button"
        class="btn btn-icon btn-secondary"
        title="Hintergrundfarbe"
        onmousedown={(e: MouseEvent) => {
          e.stopPropagation();
          showPicker = !showPicker;
        }}
      >
        <span
          class="color-swatch"
          style:background-color={canvasBg ?? 'transparent'}
        ></span>
      </button>

      <ColorPicker
        bind:hex={pickerHex}
        bind:isOpen={showPicker}
        label=""
        nullable
        isAlpha
        position="responsive"
        texts={{ label: { withoutColor: 'Transparent' } }}
        --input-size="0px"
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
    </div>

    <div class="toolbar-divider"></div>

    <div class="toolbar-group">
      <button
        type="button"
        class="btn btn-secondary"
        title="Auto-Layout: Positionen neu berechnen"
        disabled={isLocked}
        onclick={onautolayout}
      >
        <i class="fas fa-th-large"></i>
        <span class="toolbar-label">Auto-Layout</span>
      </button>

      <button
        type="button"
        class="btn btn-secondary"
        title="Hierarchie-Ebenen anpassen"
        onclick={onopenlabels}
      >
        <i class="fas fa-tags"></i>
        <span class="toolbar-label">Hierarchie-Ebenen</span>
      </button>
    </div>

    <div class="toolbar-spacer"></div>

    <div class="toolbar-group">
      <button
        type="button"
        class="btn btn-secondary"
        title="Änderungen verwerfen"
        disabled={!isDirty || isSaving}
        onclick={onreset}
      >
        <i class="fas fa-undo"></i>
        <span class="toolbar-label">Zurücksetzen</span>
      </button>

      <button
        type="button"
        class="btn btn-primary"
        title="Positionen speichern"
        disabled={!isDirty || isSaving}
        onclick={onsave}
      >
        {#if isSaving}
          <span class="spinner-ring spinner-ring--sm"></span>
        {:else}
          <i class="fas fa-save"></i>
        {/if}
        <span class="toolbar-label">Speichern</span>
      </button>
    </div>
  </div>
</div>

<style>
  .toolbar-wrapper {
    position: relative;
  }

  .org-toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 1.25rem;
  }

  .toolbar-divider {
    width: 1px;
    height: 24px;
    background: var(--glass-border, rgb(255 255 255 / 8%));
    margin: 0 0.25rem;
  }

  .toolbar-spacer {
    flex: 1;
  }

  .zoom-controls {
    display: flex;
    align-items: center;
    gap: 10px;
    border: var(--glass-border);
    border-radius: var(--radius-xl);
  }

  .zoom-level {
    opacity: 80%;
    min-width: 45px;
    color: var(--text-primary);
    font-weight: 500;
    font-size: 14px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .font-controls {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .font-level {
    opacity: 80%;
    min-width: 38px;
    font-weight: 500;
    font-size: 14px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .font-icon--sm {
    font-size: 0.65rem;
  }

  .font-icon--lg {
    font-size: 1rem;
  }

  .toolbar-label {
    font-weight: 500;
  }

  .dirty-banner {
    position: absolute;
    top: -1.25rem;
    left: 0;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    color: var(--color-warning, #f59e0b);
    font-size: 0.7rem;
    font-weight: 600;
    opacity: 0%;
    transition: opacity 0.2s ease;
    pointer-events: none;
  }

  .dirty-banner--visible {
    opacity: 100%;
  }

  .dirty-banner i {
    font-size: 0.35rem;
  }

  .color-picker-wrapper {
    position: relative;
  }

  .color-swatch {
    display: inline-block;
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 2px solid var(--color-border, #555);
    background-image:
      linear-gradient(
        45deg,
        var(--color-gray-400) 25%,
        transparent 25%,
        transparent 75%,
        var(--color-gray-400) 75%
      ),
      linear-gradient(
        45deg,
        var(--color-gray-400) 25%,
        transparent 25%,
        transparent 75%,
        var(--color-gray-400) 75%
      );
    background-size: 8px 8px;
    background-position:
      0 0,
      4px 4px;
  }

  /* Hide the ColorPicker's default trigger — we use our own button */
  .color-picker-wrapper :global(.color-picker > label) {
    position: absolute;
    width: 0;
    height: 0;
    margin: 0;
    padding: 0;
    overflow: hidden;
    pointer-events: none;
  }

  /* Style the ColorPicker popup */
  .color-picker-wrapper :global(.wrapper[role='dialog']) {
    border-radius: var(--radius-xl, 12px);
    box-shadow: var(--shadow-dropdown);
  }

  /* Hue + Alpha slider: hide thumb */
  .color-picker-wrapper :global(.h .thumb),
  .color-picker-wrapper :global(.a .thumb) {
    display: none;
  }

  .lock-active {
    background: var(--color-warning, #f59e0b) !important;
    color: var(--color-white, #fff) !important;
    border-color: transparent !important;
  }

  .lock-active:hover {
    background: var(--color-warning-600, #d97706) !important;
  }

  @media (width <= 768px) {
    .toolbar-label {
      display: none;
    }
  }
</style>
