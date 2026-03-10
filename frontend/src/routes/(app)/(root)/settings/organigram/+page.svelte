<!--
  Organigramm — Hauptseite (Root only)
  Visueller Organigramm-Builder unter /settings/organigram
-->
<script lang="ts">
  import { createLogger } from '$lib/utils/logger.js';

  import { savePositions, updateHierarchyLabels } from './_lib/api.js';
  import HierarchyLabelsModal from './_lib/HierarchyLabelsModal.svelte';
  import OrgCanvas from './_lib/OrgCanvas.svelte';
  import OrgToolbar from './_lib/OrgToolbar.svelte';
  import {
    adjustZoom,
    getIsDirty,
    getIsSaving,
    getPositionsForSave,
    getTree,
    getZoom,
    initFromTree,
    markSaved,
    recomputeAutoLayout,
    resetView,
    setSaving,
    updateTreeLabels,
  } from './_lib/state.svelte.js';

  import type { PageData } from './$types';
  import type { HierarchyLabels } from './_lib/types.js';

  const log = createLogger('Organigram:Page');

  const { data }: { data: PageData } = $props();

  const isDirty = $derived(getIsDirty());
  const isSaving = $derived(getIsSaving());
  const currentZoom = $derived(getZoom());
  const currentTree = $derived(getTree());

  let showLabelsModal = $state(false);
  let isLabelsSaving = $state(false);

  $effect(() => {
    initFromTree(data.tree);
  });

  async function handleSavePositions(): Promise<void> {
    setSaving(true);
    try {
      const positions = getPositionsForSave();
      await savePositions(positions);
      markSaved();
    } catch (err: unknown) {
      log.error({ err }, 'Positionen speichern fehlgeschlagen');
      setSaving(false);
    }
  }

  async function handleSaveLabels(labels: HierarchyLabels): Promise<void> {
    isLabelsSaving = true;
    try {
      const saved = await updateHierarchyLabels({ levels: labels });
      updateTreeLabels(saved);
      showLabelsModal = false;
    } catch (err: unknown) {
      log.error({ err }, 'Hierarchie-Labels speichern fehlgeschlagen');
    } finally {
      isLabelsSaving = false;
    }
  }
</script>

<svelte:head>
  <title>Organigramm | Assixx</title>
</svelte:head>

<div class="organigramm-page">
  <!-- Header -->
  <div class="card">
    <div class="card__header">
      <div class="header-row">
        <div class="header-info">
          <h2 class="card__title">
            <i class="fas fa-sitemap"></i>
            Organigramm
          </h2>
          {#if data.tree.companyName !== ''}
            <p class="company-name">{data.tree.companyName}</p>
          {/if}
          {#if data.tree.address !== null && data.tree.address !== ''}
            <p class="company-address">
              <i class="fas fa-map-marker-alt"></i>
              {data.tree.address}
            </p>
          {:else}
            <p class="company-address muted">
              <i class="fas fa-map-marker-alt"></i>
              Kein Standort hinterlegt
            </p>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Legend -->
  <div class="legend">
    <span class="legend-item">
      <span
        class="legend-dot"
        style="background: #3b82f6"
      ></span>
      {currentTree.hierarchyLabels.area}
    </span>
    <span class="legend-item">
      <span
        class="legend-dot"
        style="background: #22c55e"
      ></span>
      {currentTree.hierarchyLabels.department}
    </span>
    <span class="legend-item">
      <span
        class="legend-dot"
        style="background: #f59e0b"
      ></span>
      {currentTree.hierarchyLabels.team}
    </span>
    <span class="legend-item">
      <span
        class="legend-dot"
        style="background: #06b6d4"
      ></span>
      {currentTree.hierarchyLabels.asset}
    </span>
    <span class="legend-hint">
      Mausrad: Zoom &middot; Shift+Klick: Verschieben
    </span>
  </div>

  <!-- Toolbar -->
  <OrgToolbar
    zoom={currentZoom}
    {isDirty}
    {isSaving}
    onzoomin={() => {
      adjustZoom(0.1);
    }}
    onzoomout={() => {
      adjustZoom(-0.1);
    }}
    onzoomreset={resetView}
    onautolayout={recomputeAutoLayout}
    onsave={handleSavePositions}
    onopenlabels={() => {
      showLabelsModal = true;
    }}
  />

  <!-- Canvas -->
  <div class="canvas-wrapper">
    {#if data.loadError}
      <div class="empty-state">
        <i class="fas fa-sitemap empty-icon"></i>
        <p>Organigramm konnte nicht geladen werden.</p>
        <p class="muted">Bitte prüfe die Verbindung zum Backend.</p>
      </div>
    {:else}
      <OrgCanvas />
    {/if}
  </div>
</div>

<!-- Modal -->
<HierarchyLabelsModal
  show={showLabelsModal}
  labels={currentTree.hierarchyLabels}
  isSaving={isLabelsSaving}
  onclose={() => {
    showLabelsModal = false;
  }}
  onsave={handleSaveLabels}
/>

<style>
  .organigramm-page {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    height: calc(100vh - 80px);
    padding: 1rem;
  }

  .header-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  .header-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .company-name {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .company-address {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .company-address.muted {
    opacity: 50%;
    font-style: italic;
  }

  /* Legend */
  .legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.8rem;
    color: var(--color-text-secondary);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .legend-hint {
    margin-left: auto;
    opacity: 60%;
    font-size: 0.75rem;
  }

  /* Canvas */
  .canvas-wrapper {
    flex: 1;
    min-height: 400px;
    border-radius: var(--radius-xl, 12px);
    overflow: hidden;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 0.5rem;
    color: var(--color-text-secondary);
  }

  .empty-icon {
    font-size: 3rem;
    opacity: 30%;
    margin-bottom: 0.5rem;
  }

  .muted {
    opacity: 60%;
    font-size: 0.875rem;
  }
</style>
