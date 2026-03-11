<!--
  OrgToolbar — Toolbar für Organigramm-Aktionen
  Zoom In/Out/Reset, Auto-Layout, Speichern, Hierarchie-Labels
-->
<script lang="ts">
  interface Props {
    zoom: number;
    isDirty: boolean;
    isSaving: boolean;
    isLocked: boolean;
    onzoomin: () => void;
    onzoomout: () => void;
    onzoomreset: () => void;
    onautolayout: () => void;
    onsave: () => void;
    onopenlabels: () => void;
    ontogglelock: () => void;
    onfullscreen: () => void;
  }

  const {
    zoom,
    isDirty,
    isSaving,
    isLocked,
    onzoomin,
    onzoomout,
    onzoomreset,
    onautolayout,
    onsave,
    onopenlabels,
    ontogglelock,
    onfullscreen,
  }: Props = $props();

  const zoomPercent = $derived(Math.round(zoom * 100));
</script>

<div class="org-toolbar">
  <div class="toolbar-group">
    <button
      type="button"
      class="btn btn-icon btn-secondary"
      title="Herauszoomen"
      onclick={onzoomout}
    >
      <i class="fas fa-minus"></i>
    </button>
    <span class="zoom-display">{zoomPercent}%</span>
    <button
      type="button"
      class="btn btn-icon btn-secondary"
      title="Hineinzoomen"
      onclick={onzoomin}
    >
      <i class="fas fa-plus"></i>
    </button>
    <button
      type="button"
      class="btn btn-icon btn-secondary"
      title="Zoom zurücksetzen"
      onclick={onzoomreset}
    >
      <i class="fas fa-compress-arrows-alt"></i>
    </button>
    <button
      type="button"
      class="btn btn-icon btn-secondary"
      title="Vollbild"
      onclick={onfullscreen}
    >
      <i class="fas fa-expand"></i>
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
    {#if isDirty}
      <span class="dirty-indicator">
        <i class="fas fa-circle"></i>
        Ungespeichert
      </span>
    {/if}

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

<style>
  .org-toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
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
