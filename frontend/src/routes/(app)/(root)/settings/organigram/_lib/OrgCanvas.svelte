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
    setHallOverride,
    setPan,
    setViewportSize,
    zoomAt,
  } from './state.svelte.js';

  import type { Connection, HallBounds, ResizeEdge } from './types.js';

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

  // Hall-Resize State
  let resizingHallUuid = $state('');
  let resizeEdge = $state<ResizeEdge>('right');
  let resizeStartSvg = $state({ x: 0, y: 0 });
  let resizeStartBounds = $state({ x: 0, y: 0, width: 0, height: 0 });

  const HANDLE_SIZE = 8;

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

  /** Viewport-Größe tracken — für Toolbar-Button-Zoom zur Mitte */
  $effect(() => {
    const el = svgElement;

    setViewportSize(el.clientWidth, el.clientHeight);

    const observer = new ResizeObserver(() => {
      setViewportSize(el.clientWidth, el.clientHeight);
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  });

  function handleWheel(event: WheelEvent): void {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -LAYOUT.ZOOM_STEP : LAYOUT.ZOOM_STEP;
    const rect = svgElement.getBoundingClientRect();
    zoomAt(delta, event.clientX - rect.left, event.clientY - rect.top);
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

  function startHallResize(
    event: PointerEvent,
    hall: HallBounds,
    edge: ResizeEdge,
  ): void {
    event.stopPropagation();
    event.preventDefault();
    resizingHallUuid = hall.areaUuid;
    resizeEdge = edge;
    resizeStartSvg = clientToSvg(event.clientX, event.clientY);
    resizeStartBounds = {
      x: hall.x,
      y: hall.y,
      width: hall.width,
      height: hall.height,
    };
    svgElement.setPointerCapture(event.pointerId);
  }

  function applyResize(event: PointerEvent): void {
    const svg = clientToSvg(event.clientX, event.clientY);
    const dx = svg.x - resizeStartSvg.x;
    const dy = svg.y - resizeStartSvg.y;
    const b = resizeStartBounds;
    const MIN = 120;

    let { x, y, width, height } = b;

    if (resizeEdge === 'left') {
      x = b.x + dx;
      width = Math.max(MIN, b.width - dx);
    } else if (resizeEdge === 'right') {
      width = Math.max(MIN, b.width + dx);
    } else if (resizeEdge === 'top') {
      y = b.y + dy;
      height = Math.max(MIN, b.height - dy);
    } else {
      height = Math.max(MIN, b.height + dy);
    }

    setHallOverride(resizingHallUuid, { x, y, width, height });
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
    if (resizingHallUuid !== '') {
      event.preventDefault();
      applyResize(event);
      return;
    }
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
    resizingHallUuid = '';
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
          stroke-width="1.5"
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

    <!-- Hall-Resize Handles (nur wenn entsperrt) -->
    {#if !isLocked}
      {#each hallBounds as hall (hall.areaUuid)}
        <!-- Top -->
        <rect
          role="presentation"
          x={hall.x}
          y={hall.y - HANDLE_SIZE / 2}
          width={hall.width}
          height={HANDLE_SIZE}
          fill="transparent"
          style="cursor: ns-resize"
          pointer-events="all"
          onpointerdown={(e) => {
            startHallResize(e, hall, 'top');
          }}
        />
        <!-- Bottom -->
        <rect
          role="presentation"
          x={hall.x}
          y={hall.y + hall.height - HANDLE_SIZE / 2}
          width={hall.width}
          height={HANDLE_SIZE}
          fill="transparent"
          style="cursor: ns-resize"
          pointer-events="all"
          onpointerdown={(e) => {
            startHallResize(e, hall, 'bottom');
          }}
        />
        <!-- Left -->
        <rect
          role="presentation"
          x={hall.x - HANDLE_SIZE / 2}
          y={hall.y}
          width={HANDLE_SIZE}
          height={hall.height}
          fill="transparent"
          style="cursor: ew-resize"
          pointer-events="all"
          onpointerdown={(e) => {
            startHallResize(e, hall, 'left');
          }}
        />
        <!-- Right -->
        <rect
          role="presentation"
          x={hall.x + hall.width - HANDLE_SIZE / 2}
          y={hall.y}
          width={HANDLE_SIZE}
          height={hall.height}
          fill="transparent"
          style="cursor: ew-resize"
          pointer-events="all"
          onpointerdown={(e) => {
            startHallResize(e, hall, 'right');
          }}
        />
      {/each}
    {/if}

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
