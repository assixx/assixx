<!--
  OrgToolbar — Toolbar für Organigramm-Aktionen
  Zoom In/Out/Reset, Auto-Layout, Speichern, Hierarchie-Labels
-->
<script lang="ts">
  interface Props {
    zoom: number;
    fontSize: number;
    isDirty: boolean;
    isSaving: boolean;
    isLocked: boolean;
    onzoomin: () => void;
    onzoomout: () => void;
    onzoomreset: () => void;
    onfontinc: () => void;
    onfontdec: () => void;
    onautolayout: () => void;
    onsave: () => void;
    onreset: () => void;
    onopenlabels: () => void;
    ontogglelock: () => void;
    onfullscreen: () => void;
  }

  const {
    zoom,
    fontSize,
    isDirty,
    isSaving,
    isLocked,
    onzoomin,
    onzoomout,
    onzoomreset,
    onfontinc,
    onfontdec,
    onautolayout,
    onsave,
    onreset,
    onopenlabels,
    ontogglelock,
    onfullscreen,
  }: Props = $props();

  const zoomPercent = $derived(Math.round(zoom * 100));
</script>

<div class="org-toolbar">
  <div class="zoom-controls">
    <button
      type="button"
      class="btn btn-icon btn-secondary"
      title="Vergrößern"
      onclick={onzoomin}
    >
      <i class="fas fa-plus"></i>
    </button>
    <span class="zoom-level">{zoomPercent}%</span>
    <button
      type="button"
      class="btn btn-icon btn-secondary"
      title="Verkleinern"
      onclick={onzoomout}
    >
      <i class="fas fa-minus"></i>
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
      disabled={fontSize <= 8}
      onclick={onfontdec}
    >
      <i class="fas fa-font font-icon--sm"></i>
    </button>
    <span class="font-level">{fontSize}px</span>
    <button
      type="button"
      class="btn btn-icon btn-secondary"
      title="Schrift vergrößern"
      disabled={fontSize >= 24}
      onclick={onfontinc}
    >
      <i class="fas fa-font font-icon--lg"></i>
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

<style>
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
