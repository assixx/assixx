<!--
  OrgToolbar — Toolbar für Organigramm-Aktionen
  Zoom In/Out/Reset, Auto-Layout, Speichern, Hierarchie-Labels
-->
<script lang="ts">
  interface Props {
    zoom: number;
    isDirty: boolean;
    isSaving: boolean;
    onzoomin: () => void;
    onzoomout: () => void;
    onzoomreset: () => void;
    onautolayout: () => void;
    onsave: () => void;
    onopenlabels: () => void;
  }

  const {
    zoom,
    isDirty,
    isSaving,
    onzoomin,
    onzoomout,
    onzoomreset,
    onautolayout,
    onsave,
    onopenlabels,
  }: Props = $props();

  const zoomPercent = $derived(Math.round(zoom * 100));
</script>

<div class="org-toolbar">
  <div class="toolbar-group">
    <button
      type="button"
      class="toolbar-btn"
      title="Herauszoomen"
      onclick={onzoomout}
    >
      <i class="fas fa-minus"></i>
    </button>
    <span class="zoom-display">{zoomPercent}%</span>
    <button
      type="button"
      class="toolbar-btn"
      title="Hineinzoomen"
      onclick={onzoomin}
    >
      <i class="fas fa-plus"></i>
    </button>
    <button
      type="button"
      class="toolbar-btn"
      title="Zoom zurücksetzen"
      onclick={onzoomreset}
    >
      <i class="fas fa-expand"></i>
    </button>
  </div>

  <div class="toolbar-divider"></div>

  <div class="toolbar-group">
    <button
      type="button"
      class="toolbar-btn"
      title="Auto-Layout: Positionen neu berechnen"
      onclick={onautolayout}
    >
      <i class="fas fa-th-large"></i>
      <span class="toolbar-label">Auto-Layout</span>
    </button>

    <button
      type="button"
      class="toolbar-btn"
      title="Hierarchie-Ebenen anpassen"
      onclick={onopenlabels}
    >
      <i class="fas fa-tags"></i>
      <span class="toolbar-label">Hierarchie-Ebenen</span>
    </button>
  </div>

  <div class="toolbar-spacer"></div>

  <div class="toolbar-group">
    {#if isDirty}
      <span class="dirty-indicator">
        <i class="fas fa-circle"></i>
        Ungespeichert
      </span>
    {/if}

    <button
      type="button"
      class="toolbar-btn toolbar-btn--primary"
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

<style>
  .org-toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--glass-bg, rgb(255 255 255 / 5%));
    border: 1px solid var(--glass-border, rgb(255 255 255 / 8%));
    border-radius: var(--radius-lg, 8px);
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 0.25rem;
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

  .toolbar-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.625rem;
    border: 1px solid transparent;
    border-radius: var(--radius-md, 6px);
    background: transparent;
    color: var(--color-text-secondary);
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .toolbar-btn:hover:not(:disabled) {
    background: var(--glass-bg-hover, rgb(255 255 255 / 8%));
    color: var(--color-text-primary);
  }

  .toolbar-btn:active:not(:disabled) {
    transform: scale(0.97);
  }

  .toolbar-btn:disabled {
    opacity: 40%;
    cursor: not-allowed;
  }

  .toolbar-btn--primary {
    background: var(--color-primary, #3b82f6);
    color: var(--color-white, oklch(100% 0 0));
    border-color: transparent;
  }

  .toolbar-btn--primary:hover:not(:disabled) {
    background: var(--color-primary-600, #2563eb);
    color: var(--color-white, oklch(100% 0 0));
  }

  .toolbar-btn--primary:disabled {
    background: var(--glass-bg, rgb(255 255 255 / 5%));
    color: var(--color-text-secondary);
  }

  .zoom-display {
    min-width: 3rem;
    text-align: center;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    font-variant-numeric: tabular-nums;
  }

  .toolbar-label {
    font-weight: 500;
  }

  .dirty-indicator {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: var(--color-warning, #f59e0b);
    padding: 0 0.5rem;
  }

  .dirty-indicator i {
    font-size: 0.4rem;
  }

  @media (width <= 768px) {
    .toolbar-label {
      display: none;
    }
  }
</style>
