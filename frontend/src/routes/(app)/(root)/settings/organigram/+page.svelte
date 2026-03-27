<!--
  Organigramm — Hauptseite (Root only)
  Visueller Organigramm-Builder unter /settings/organigram
-->
<script lang="ts">
  import { untrack } from 'svelte';

  import { showSuccessAlert, showErrorAlert } from '$lib/stores/toast';
  import { createLogger } from '$lib/utils/logger.js';

  import { fetchNodeDetails, savePositions } from './_lib/api.js';
  import NodeDetailModal from './_lib/NodeDetailModal.svelte';
  import OrgCanvas from './_lib/OrgCanvas.svelte';
  import OrgToolbar from './_lib/OrgToolbar.svelte';
  import {
    adjustNodeSize,
    adjustZoom,
    getCanvasBg,
    getCanvasBgForSave,
    getFontSize,
    getIsDirty,
    getIsLocked,
    getIsSaving,
    getHallConnectionAnchorsForSave,
    getHallOverridesForSave,
    getNodeHeight,
    getNodeWidth,
    getPositionsForSave,
    getViewportForSave,
    getZoom,
    initFromTree,
    markSaved,
    recomputeAutoLayout,
    resetToSaved,
    resetView,
    setCanvasBg,
    setFontSize,
    setSaving,
    toggleLock,
  } from './_lib/state.svelte.js';

  import type { PageData } from './$types';
  import type { OrgEntityType, OrgNodeDetail } from './_lib/types.js';

  const log = createLogger('Organigram:Page');

  const { data }: { data: PageData } = $props();

  const isDirty = $derived(getIsDirty());
  const isLocked = $derived(getIsLocked());
  const isSaving = $derived(getIsSaving());
  const currentZoom = $derived(getZoom());
  const currentFontSize = $derived(getFontSize());
  const currentCanvasBg = $derived(getCanvasBg());
  const currentNodeWidth = $derived(getNodeWidth());
  const currentNodeHeight = $derived(getNodeHeight());

  /** Single Source of Truth: Layout-Data (A7) */
  const labels = $derived(data.tree.hierarchyLabels);

  let detailData = $state<OrgNodeDetail | null>(null);
  let showDetailModal = $state(false);
  let isDetailLoading = $state(false);

  async function handleNodeDblClick(entityType: OrgEntityType, entityUuid: string): Promise<void> {
    showDetailModal = true;
    isDetailLoading = true;
    detailData = null;
    try {
      detailData = await fetchNodeDetails(entityType, entityUuid);
    } catch (err: unknown) {
      log.error({ err }, 'Node-Details laden fehlgeschlagen');
      showErrorAlert('Fehler beim Laden der Details');
      showDetailModal = false;
    } finally {
      isDetailLoading = false;
    }
  }

  function closeDetail(): void {
    showDetailModal = false;
    detailData = null;
  }

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
    const tree = data.tree;
    untrack(() => {
      initFromTree(tree);
    });
  });

  async function handleSavePositions(): Promise<void> {
    setSaving(true);
    try {
      const positions = getPositionsForSave();
      const viewport = getViewportForSave();
      const overrides = getHallOverridesForSave();
      const anchors = getHallConnectionAnchorsForSave();
      const bg = getCanvasBgForSave();
      await savePositions(positions, viewport, overrides, anchors, bg);
      markSaved();
      showSuccessAlert('Organigramm gespeichert');
    } catch (err: unknown) {
      log.error({ err }, 'Positionen speichern fehlgeschlagen');
      showErrorAlert('Fehler beim Speichern des Organigramms');
      setSaving(false);
    }
  }
</script>

<svelte:head>
  <title>Organigramm | Assixx</title>
</svelte:head>

<svelte:document onfullscreenchange={handleFullscreenChange} />

<div class="organigramm-page container">
  <!-- Header (card pattern — konsistent mit anderen Seiten) -->
  <div class="card organigramm-header">
    <div class="card__header">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="card__title">
            <i class="fas fa-sitemap mr-2"></i>
            Organigramm
          </h2>
          {#if data.tree.companyName !== '' || (data.tree.address !== null && data.tree.address !== '')}
            <p class="mt-1 text-sm text-(--color-text-secondary)">
              {#if data.tree.companyName !== ''}
                {data.tree.companyName}
              {/if}
              {#if data.tree.address !== null && data.tree.address !== ''}
                <i class="fas fa-map-marker-alt ml-2"></i>
                {data.tree.address}
              {/if}
            </p>
          {/if}
        </div>
        <div class="flex items-center gap-4">
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
        </div>
      </div>
    </div>
  </div>

  <!-- Fullscreen-fähiger Container (Toolbar + Canvas) -->
  <div
    class="canvas-section"
    id="organigrammCanvas"
  >
    <!-- Toolbar -->
    <OrgToolbar
      zoom={currentZoom}
      fontSize={currentFontSize}
      canvasBg={currentCanvasBg}
      {isDirty}
      {isSaving}
      {isLocked}
      onzoomin={() => {
        adjustZoom(0.05);
      }}
      onzoomout={() => {
        adjustZoom(-0.05);
      }}
      onzoomreset={resetView}
      onfontinc={() => {
        setFontSize(currentFontSize + 1);
      }}
      onfontdec={() => {
        setFontSize(currentFontSize - 1);
      }}
      nodeWidth={currentNodeWidth}
      nodeHeight={currentNodeHeight}
      onnodeinc={() => {
        adjustNodeSize(1);
      }}
      onnodedec={() => {
        adjustNodeSize(-1);
      }}
      onautolayout={recomputeAutoLayout}
      onsave={handleSavePositions}
      onreset={resetToSaved}
      ontogglelock={toggleLock}
      onfullscreen={toggleFullscreen}
      oncanvasbg={setCanvasBg}
    />

    <!-- Canvas -->
    <div
      class="canvas-wrapper"
      style:--org-canvas-bg={currentCanvasBg ?? 'transparent'}
    >
      {#if data.loadError}
        <div class="flex flex-col items-center justify-center py-16 text-center">
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
        <div class="flex flex-col items-center justify-center py-16 text-center">
          <i class="fas fa-sitemap mb-6 text-7xl text-(--color-text-secondary) opacity-40"></i>
          <p class="text-xl text-(--color-text-secondary)">
            Keine Organisationseinheiten vorhanden
          </p>
        </div>
      {:else}
        <OrgCanvas ondblclicknode={handleNodeDblClick} />
      {/if}
    </div>
  </div>
</div>

<!-- Modals -->
<NodeDetailModal
  show={showDetailModal}
  detail={detailData}
  isLoading={isDetailLoading}
  {labels}
  onclose={closeDetail}
/>

<style>
  .organigramm-page {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-6, 1.5rem);
    padding-bottom: var(--spacing-6, 1.5rem);

    /* Viewport-Höhe als Minimum, scrollbar wenn Canvas + Padding mehr brauchen */
    min-height: calc(100dvh - 60px - 2.5rem - 1rem);
  }

  .organigramm-header {
    flex-shrink: 0;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    white-space: nowrap;
  }

  .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    flex-shrink: 0;
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
    flex: 1 1 0;
    min-height: 700px;
    border-radius: var(--radius-xl, 12px);
    overflow: hidden;
    border: var(--glass-border);
  }

  /* Canvas Background — nur Dark Mode (Light Mode behält Default) */
  :global(html.dark) .canvas-wrapper {
    background-color: var(--org-canvas-bg, transparent);
  }

  /* Dot pattern — dark mode: white dots, thick center → thin edges */
  .canvas-wrapper::after {
    position: absolute;
    z-index: 0;
    inset: 0;
    border-radius: 12px;
    background-size: 20px 20px;
    pointer-events: none;
    content: '';
  }

  /* Light mode: custom bg or default gray */
  :global(html:not(.dark)) .canvas-wrapper::after {
    background: var(--org-canvas-bg, var(--color-gray-300));
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
    background: var(--main-bg-gradient), var(--main-bg) !important;
  }

  :global(body.fullscreen-mode .sidebar),
  :global(body.fullscreen-mode .header),
  :global(body.fullscreen-mode #breadcrumb-container),
  :global(body.fullscreen-mode .organigramm-page > .organigramm-header) {
    display: none !important;
  }

  @media (width >= 768px) {
    .organigramm-page {
      min-height: calc(100dvh - 60px - 2.5rem - 1.5rem);
    }
  }

  @media (width >= 1024px) {
    .organigramm-page {
      min-height: calc(100dvh - 60px - 2.5rem - 2rem);
    }
  }
</style>
