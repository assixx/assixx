<!--
  OrgCanvas — SVG Canvas mit Pan/Zoom
  Rendert OrgNode-Komponenten und Bézier-Verbindungslinien.
  Pan: Mittelklick-Drag oder Shift+Linksklick
  Zoom: Mausrad
-->
<script lang="ts">
  import { LAYOUT } from './constants.js';
  import OrgNode from './OrgNode.svelte';
  import {
    adjustZoom,
    getConnections,
    getHoveredNodeKey,
    getPanX,
    getPanY,
    getRenderNodes,
    getZoom,
    setPan,
  } from './state.svelte.js';

  import type { Connection } from './types.js';

  const zoom = $derived(getZoom());
  const panX = $derived(getPanX());
  const panY = $derived(getPanY());
  const renderNodes = $derived(getRenderNodes());
  const connections = $derived(getConnections());
  const hoveredKey = $derived(getHoveredNodeKey());

  let svgElement = $state<SVGSVGElement>(undefined as unknown as SVGSVGElement);
  let isPanning = $state(false);
  let panStartX = $state(0);
  let panStartY = $state(0);

  function handleWheel(event: WheelEvent): void {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -LAYOUT.ZOOM_STEP : LAYOUT.ZOOM_STEP;
    adjustZoom(delta);
  }

  function handlePointerDown(event: PointerEvent): void {
    const isPanTrigger =
      event.button === 1 || (event.button === 0 && event.shiftKey);
    if (!isPanTrigger) return;

    event.preventDefault();
    isPanning = true;
    panStartX = event.clientX - panX;
    panStartY = event.clientY - panY;
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!isPanning) return;
    setPan(event.clientX - panStartX, event.clientY - panStartY);
  }

  function handlePointerUp(): void {
    isPanning = false;
  }

  function connectionPath(conn: Connection): string {
    const midY = (conn.y1 + conn.y2) / 2;
    return `M ${conn.x1} ${conn.y1} C ${conn.x1} ${midY}, ${conn.x2} ${midY}, ${conn.x2} ${conn.y2}`;
  }

  function isConnectionHighlighted(conn: Connection): boolean {
    if (hoveredKey === '') return false;
    return conn.parentKey === hoveredKey || conn.childKey === hoveredKey;
  }
</script>

<svg
  bind:this={svgElement}
  class="org-canvas"
  onwheel={handleWheel}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  role="img"
  aria-label="Organigramm"
>
  <!-- Grid-Hintergrund -->
  <defs>
    <pattern
      id="org-grid"
      width={LAYOUT.GRID_SIZE}
      height={LAYOUT.GRID_SIZE}
      patternUnits="userSpaceOnUse"
    >
      <circle
        cx="1"
        cy="1"
        r="0.5"
        fill="currentColor"
        opacity="0.15"
      />
    </pattern>
  </defs>
  <rect
    width="100%"
    height="100%"
    fill="url(#org-grid)"
    class="grid-bg"
  />

  <!-- Transformierter Content-Layer -->
  <g transform="translate({panX}, {panY}) scale({zoom})">
    <!-- Verbindungslinien (hinter Knoten) -->
    {#each connections as conn (`${conn.parentKey}-${conn.childKey}`)}
      {@const highlighted = isConnectionHighlighted(conn)}
      <path
        d={connectionPath(conn)}
        fill="none"
        stroke={highlighted ?
          'var(--color-primary, #3b82f6)'
        : 'var(--color-text-tertiary, #666)'}
        stroke-width={highlighted ? 2.5 : 1.5}
        stroke-dasharray={highlighted ? 'none' : '4 2'}
        opacity={highlighted ? 0.8 : 0.4}
        class="connection"
      />
    {/each}

    <!-- Knoten -->
    {#each renderNodes as node (node.entityUuid)}
      <OrgNode
        {node}
        {svgElement}
      />
    {/each}
  </g>

  <!-- Leerer Zustand -->
  {#if renderNodes.length === 0}
    <text
      x="50%"
      y="50%"
      text-anchor="middle"
      dominant-baseline="central"
      class="empty-text"
      fill="var(--color-text-secondary)"
    >
      Keine Organisationseinheiten vorhanden
    </text>
  {/if}
</svg>

<style>
  .org-canvas {
    width: 100%;
    height: 100%;
    display: block;
    cursor: grab;
    user-select: none;
    background: var(--glass-bg, rgb(255 255 255 / 3%));
    border-radius: var(--radius-xl, 12px);
    border: 1px solid var(--glass-border, rgb(255 255 255 / 8%));
  }

  .org-canvas:active {
    cursor: grabbing;
  }

  .grid-bg {
    pointer-events: none;
  }

  .connection {
    transition:
      stroke 0.15s ease,
      opacity 0.15s ease;
    pointer-events: none;
  }

  .empty-text {
    font-size: 16px;
    font-weight: 500;
  }
</style>
