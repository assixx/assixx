<!--
  Organigramm — Hauptseite (Root only)
  Visueller Organigramm-Builder unter /settings/organigram
-->
<script lang="ts">
  import { invalidateAll } from '$app/navigation';

  import { createLogger } from '$lib/utils/logger.js';

  import { savePositions, updateHierarchyLabels } from './_lib/api.js';
  import HierarchyLabelsModal from './_lib/HierarchyLabelsModal.svelte';
  import OrgCanvas from './_lib/OrgCanvas.svelte';
  import OrgToolbar from './_lib/OrgToolbar.svelte';
  import {
    adjustZoom,
    getIsDirty,
    getIsLocked,
    getIsSaving,
    getPositionsForSave,
    getZoom,
    initFromTree,
    markSaved,
    recomputeAutoLayout,
    resetView,
    setSaving,
    toggleLock,
    updateTreeLabels,
  } from './_lib/state.svelte.js';

  import type { PageData } from './$types';
  import type { HierarchyLabels } from './_lib/types.js';

  const log = createLogger('Organigram:Page');

  const { data }: { data: PageData } = $props();

  const isDirty = $derived(getIsDirty());
  const isLocked = $derived(getIsLocked());
  const isSaving = $derived(getIsSaving());
  const currentZoom = $derived(getZoom());

  /** Single Source of Truth: Layout-Data (A7) */
  const labels = $derived(data.hierarchyLabels);

  let showLabelsModal = $state(false);
  let isLabelsSaving = $state(false);

  async function toggleFullscreen(): Promise<void> {
    try {
      document.body.classList.add('fullscreen-mode');
      await document.documentElement.requestFullscreen();
    } catch (err: unknown) {
      log.error({ err }, 'Fullscreen fehlgeschlagen');
      document.body.classList.remove('fullscreen-mode');
    }
  }

  function handleFullscreenChange(): void {
    if (!document.fullscreenElement) {
      document.body.classList.remove('fullscreen-mode');
    }
  }

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

  async function handleSaveLabels(newLabels: HierarchyLabels): Promise<void> {
    isLabelsSaving = true;
    try {
      const saved = await updateHierarchyLabels({ levels: newLabels });
      updateTreeLabels(saved);
      showLabelsModal = false;
      await invalidateAll();
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

<svelte:document onfullscreenchange={handleFullscreenChange} />

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
      {labels.area}
    </span>
    <span class="legend-item">
      <span
        class="legend-dot"
        style="background: #22c55e"
      ></span>
      {labels.department}
    </span>
    <span class="legend-item">
      <span
        class="legend-dot"
        style="background: #f59e0b"
      ></span>
      {labels.team}
    </span>
    <span class="legend-item">
      <span
        class="legend-dot"
        style="background: #06b6d4"
      ></span>
      {labels.asset}
    </span>
    <span class="legend-hint">
      Mausrad: Zoom &middot; Fläche ziehen: Verschieben
    </span>
  </div>

  <!-- Fullscreen-fähiger Container (Toolbar + Canvas) -->
  <div
    class="canvas-section"
    id="organigrammCanvas"
  >
    <!-- Toolbar -->
    <OrgToolbar
      zoom={currentZoom}
      {isDirty}
      {isSaving}
      {isLocked}
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
      ontogglelock={toggleLock}
      onfullscreen={toggleFullscreen}
    />

    <!-- Canvas -->
    <div class="canvas-wrapper">
      {#if data.loadError}
        <div
          class="flex flex-col items-center justify-center py-16 text-center"
        >
          <i
            class="fas fa-exclamation-triangle mb-6 text-7xl text-(--color-text-secondary) opacity-40"
          ></i>
          <p class="text-xl text-(--color-text-secondary)">
            Organigramm konnte nicht geladen werden.
          </p>
          <p class="mt-2 text-(--color-text-secondary) opacity-60">
            Bitte prüfe die Verbindung zum Backend.
          </p>
        </div>
      {:else if data.tree.nodes.length === 0}
        <div
          class="flex flex-col items-center justify-center py-16 text-center"
        >
          <i
            class="fas fa-sitemap mb-6 text-7xl text-(--color-text-secondary) opacity-40"
          ></i>
          <p class="text-xl text-(--color-text-secondary)">
            Keine Organisationseinheiten vorhanden
          </p>
        </div>
      {:else}
        <OrgCanvas />
      {/if}
    </div>
  </div>
</div>

<!-- Modal -->
<HierarchyLabelsModal
  show={showLabelsModal}
  {labels}
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

  /* Canvas Section (Toolbar + Canvas) */
  .canvas-section {
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: 0.75rem;
    min-height: 0;
  }

  /* Canvas */
  .canvas-wrapper {
    position: relative;
    flex: 1;
    min-height: 400px;
    border-radius: var(--radius-xl, 12px);
    overflow: hidden;
    border: var(--glass-border);
  }

  /* Dot pattern — dark mode: white dots, thick center → thin edges */
  .canvas-wrapper::after {
    position: absolute;
    z-index: 0;
    inset: 0;
    border-radius: 12px;
    background-image: radial-gradient(
      circle,
      color-mix(in oklch, var(--color-white) 45%, transparent) 1.5px,
      transparent 1.5px
    );
    background-size: 20px 20px;
    mask-image: radial-gradient(
      ellipse 80% 80% at 50% 50%,
      var(--color-black) 10%,
      transparent 75%
    );
    pointer-events: none;
    content: '';
  }

  /* Dot pattern — light mode: dark dots */
  :global(html:not(.dark)) .canvas-wrapper::after {
    background-image: radial-gradient(
      circle,
      color-mix(in oklch, var(--color-black) 60%, transparent) 1.5px,
      transparent 1.5px
    );
  }

  /* Fullscreen Mode — 1:1 Blackboard-Pattern */
  :global(body.fullscreen-mode #organigrammCanvas) {
    position: fixed !important;
    z-index: 9999 !important;
    margin: 0 !important;
    inset: 0 !important;
    box-shadow: none !important;
    border: 0 !important;
    border-radius: 0 !important;
    padding: 1rem !important;
    width: 100% !important;
    min-height: 100vh !important;
    overflow: hidden;
  }

  :global(body.fullscreen-mode .sidebar),
  :global(body.fullscreen-mode .header),
  :global(body.fullscreen-mode #breadcrumb-container),
  :global(body.fullscreen-mode .organigramm-page > .card),
  :global(body.fullscreen-mode .organigramm-page > .legend) {
    display: none !important;
  }
</style>
