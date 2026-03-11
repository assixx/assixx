<!--
  OrgCanvas — SVG Canvas mit Pan/Zoom
  Rendert OrgNode-Komponenten und Bézier-Verbindungslinien.
  Pan: Mittelklick-Drag oder Shift+Linksklick
  Zoom: Mausrad
-->
<script lang="ts">
  import { HALL_COLOR, LAYOUT } from './constants.js';
  import OrgNode from './OrgNode.svelte';
  import {
    adjustZoom,
    getConnections,
    getHallBounds,
    getHoveredNodeKey,
    getIsLocked,
    getNodePosition,
    getPanX,
    getPanY,
    getRenderNodes,
    getZoom,
    moveNodeWithChildren,
    setPan,
  } from './state.svelte.js';

  import type { Connection } from './types.js';

  const zoom = $derived(getZoom());
  const panX = $derived(getPanX());
  const panY = $derived(getPanY());
  const renderNodes = $derived(getRenderNodes());
  const connections = $derived(getConnections());
  const hoveredKey = $derived(getHoveredNodeKey());
  const hallBounds = $derived(getHallBounds());
  const isLocked = $derived(getIsLocked());

  let svgElement = $state<SVGSVGElement>(undefined as unknown as SVGSVGElement);
  let isPanning = $state(false);
  let panStartX = $state(0);
  let panStartY = $state(0);

  // Hall-Drag State
  let draggedHallUuid = $state('');
  let hallDragOffsetX = $state(0);
  let hallDragOffsetY = $state(0);

  function clientToSvg(
    clientX: number,
    clientY: number,
  ): { x: number; y: number } {
    const rect = svgElement.getBoundingClientRect();
    return {
      x: (clientX - rect.left - panX) / zoom,
      y: (clientY - rect.top - panY) / zoom,
    };
  }

  function handleWheel(event: WheelEvent): void {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -LAYOUT.ZOOM_STEP : LAYOUT.ZOOM_STEP;
    adjustZoom(delta);
  }

  /** Prüft ob SVG-Koordinaten innerhalb einer Halle liegen */
  function findHallAtPoint(svgX: number, svgY: number): string | undefined {
    for (const hall of hallBounds) {
      const inside =
        svgX >= hall.x &&
        svgX <= hall.x + hall.width &&
        svgY >= hall.y &&
        svgY <= hall.y + hall.height;
      if (inside) return hall.areaUuid;
    }
    return undefined;
  }

  function startHallDrag(event: PointerEvent, areaUuid: string): void {
    const svg = clientToSvg(event.clientX, event.clientY);
    const areaPos = getNodePosition('area', areaUuid);
    if (areaPos === undefined) return;

    event.preventDefault();
    draggedHallUuid = areaUuid;
    hallDragOffsetX = svg.x - areaPos.x;
    hallDragOffsetY = svg.y - areaPos.y;
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
  }

  function handlePointerDown(event: PointerEvent): void {
    if (isLocked) return;
    const isPanTrigger = event.button === 0 || event.button === 1;
    if (!isPanTrigger) return;

    // Linksklick innerhalb einer Halle → Halle ziehen statt Pan
    if (event.button === 0) {
      const svg = clientToSvg(event.clientX, event.clientY);
      const hitHall = findHallAtPoint(svg.x, svg.y);
      if (hitHall !== undefined) {
        startHallDrag(event, hitHall);
        return;
      }
    }

    // Sonst: Canvas-Pan
    event.preventDefault();
    isPanning = true;
    panStartX = event.clientX - panX;
    panStartY = event.clientY - panY;
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent): void {
    if (draggedHallUuid !== '') {
      event.preventDefault();
      const svg = clientToSvg(event.clientX, event.clientY);
      moveNodeWithChildren(
        'area',
        draggedHallUuid,
        svg.x - hallDragOffsetX,
        svg.y - hallDragOffsetY,
      );
      return;
    }
    if (!isPanning) return;
    setPan(event.clientX - panStartX, event.clientY - panStartY);
  }

  function handlePointerUp(): void {
    draggedHallUuid = '';
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
    <!-- Hallen-Container — nur für Areas mit zugewiesener Halle -->
    {#each hallBounds as hall (hall.areaUuid)}
      <g
        class="hall-container"
        pointer-events="none"
      >
        <rect
          x={hall.x}
          y={hall.y}
          width={hall.width}
          height={hall.height}
          rx="12"
          ry="12"
          fill="none"
          stroke={HALL_COLOR.border}
          stroke-width="1"
          stroke-dasharray="6 3"
          opacity="0.8"
        />
        <text
          x={hall.x + 12}
          y={hall.y + 20}
          class="hall-label"
          fill={HALL_COLOR.border}
        >
          <tspan font-weight="600">{hall.hallName}</tspan>
          {#if hall.leadName !== undefined}
            <tspan
              dx="8"
              opacity="0.7">{hall.leadName}</tspan
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

  .hall-label {
    font-size: 12px;
    pointer-events: none;
    user-select: none;
  }
</style>
