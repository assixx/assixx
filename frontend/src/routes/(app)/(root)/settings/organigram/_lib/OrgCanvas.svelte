<!--
  OrgCanvas — SVG Canvas mit Pan/Zoom
  Rendert OrgNode-Komponenten und Bézier-Verbindungslinien.
  Pan: Mittelklick-Drag oder Shift+Linksklick
  Zoom: Mausrad
-->
<script lang="ts">
  import { ENTITY_COLORS, LAYOUT } from './constants.js';
  import OrgNode from './OrgNode.svelte';
  import {
    adjustZoom,
    getAreaBounds,
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
  const areaBounds = $derived(getAreaBounds());

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
  <!-- Transformierter Content-Layer -->
  <g transform="translate({panX}, {panY}) scale({zoom})">
    <!-- Bereichs-Container ("Hallen") — hinterste Ebene -->
    {#each areaBounds as area (area.areaUuid)}
      <g
        class="area-container"
        pointer-events="none"
      >
        <rect
          x={area.x}
          y={area.y}
          width={area.width}
          height={area.height}
          rx="12"
          ry="12"
          fill={ENTITY_COLORS.area.bg}
          stroke={ENTITY_COLORS.area.border}
          stroke-width="1"
          stroke-dasharray="6 3"
          opacity="0.6"
        />
        <text
          x={area.x + 12}
          y={area.y + 20}
          class="area-label"
          fill={ENTITY_COLORS.area.border}
        >
          <tspan font-weight="600">{area.areaName}</tspan>
          {#if area.leadName !== undefined}
            <tspan
              dx="8"
              opacity="0.7">{area.leadName}</tspan
            >
          {/if}
        </text>
      </g>
    {/each}

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
</svg>

<style>
  .org-canvas {
    position: relative;
    z-index: 1;
    width: 100%;
    height: 100%;
    display: block;
    cursor: grab;
    user-select: none;
    border-radius: var(--radius-xl, 12px);
  }

  .org-canvas:active {
    cursor: grabbing;
  }

  .connection {
    transition:
      stroke 0.15s ease,
      opacity 0.15s ease;
    pointer-events: none;
  }

  .area-label {
    font-size: 12px;
    pointer-events: none;
    user-select: none;
  }
</style>
