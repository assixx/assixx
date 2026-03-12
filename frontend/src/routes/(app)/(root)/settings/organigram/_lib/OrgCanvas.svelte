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
    getFontSize,
    getHallBounds,
    getHoveredNodeKey,
    getIsLocked,
    getNodePosition,
    getPanX,
    getPanY,
    getRenderNodes,
    getZoom,
    isHallPrimary,
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
  const hallFontSize = $derived(getFontSize());
  const hallSubFontSize = $derived(Math.max(8, hallFontSize - 2));

  let svgElement = $state<SVGSVGElement>(undefined as unknown as SVGSVGElement);
  let isPanning = $state(false);
  let panStartX = $state(0);
  let panStartY = $state(0);

  // Hall-Drag State
  let draggedHallId = $state('');
  let draggedHallAreaUuid = $state<string | null>(null);
  let draggedHallIsPrimary = $state(false);
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
      if (inside) return hall.id;
    }
    return undefined;
  }

  function startHallDrag(event: PointerEvent, hallId: string): void {
    const hall = hallBounds.find((h: HallBounds) => h.id === hallId);
    if (hall === undefined) return;

    const svg = clientToSvg(event.clientX, event.clientY);
    event.preventDefault();
    draggedHallId = hallId;
    draggedHallAreaUuid = hall.areaUuid;
    draggedHallIsPrimary = isHallPrimary(hallId);

    // Primäre Halle → Offset vom Area-Node (bewegt Area + Kinder mit)
    if (hall.areaUuid !== null && draggedHallIsPrimary) {
      const areaPos = getNodePosition('area', hall.areaUuid);
      if (areaPos !== undefined) {
        hallDragOffsetX = svg.x - areaPos.x;
        hallDragOffsetY = svg.y - areaPos.y;
        (event.currentTarget as Element).setPointerCapture(event.pointerId);
        return;
      }
    }

    // Sekundäre oder unzugewiesene Halle → Offset von Hallen-Bounds
    hallDragOffsetX = svg.x - hall.x;
    hallDragOffsetY = svg.y - hall.y;
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
  }

  function startHallResize(
    event: PointerEvent,
    hall: HallBounds,
    edge: ResizeEdge,
  ): void {
    event.stopPropagation();
    event.preventDefault();
    resizingHallUuid = hall.id;
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

  const LEFT_EDGES: readonly ResizeEdge[] = ['left', 'top-left', 'bottom-left'];
  const RIGHT_EDGES: readonly ResizeEdge[] = [
    'right',
    'top-right',
    'bottom-right',
  ];
  const TOP_EDGES: readonly ResizeEdge[] = ['top', 'top-left', 'top-right'];
  const BOTTOM_EDGES: readonly ResizeEdge[] = [
    'bottom',
    'bottom-left',
    'bottom-right',
  ];

  function applyResize(event: PointerEvent): void {
    const svg = clientToSvg(event.clientX, event.clientY);
    const dx = svg.x - resizeStartSvg.x;
    const dy = svg.y - resizeStartSvg.y;
    const b = resizeStartBounds;
    const MIN = 120;
    const edge = resizeEdge;

    const x = LEFT_EDGES.includes(edge) ? b.x + dx : b.x;
    const w =
      LEFT_EDGES.includes(edge) ? b.width - dx
      : RIGHT_EDGES.includes(edge) ? b.width + dx
      : b.width;
    const y = TOP_EDGES.includes(edge) ? b.y + dy : b.y;
    const h =
      TOP_EDGES.includes(edge) ? b.height - dy
      : BOTTOM_EDGES.includes(edge) ? b.height + dy
      : b.height;

    setHallOverride(resizingHallUuid, {
      x,
      y,
      width: Math.max(MIN, w),
      height: Math.max(MIN, h),
    });
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
    if (draggedHallId !== '') {
      event.preventDefault();
      const svg = clientToSvg(event.clientX, event.clientY);

      if (draggedHallAreaUuid !== null && draggedHallIsPrimary) {
        // Primäre Halle → Area-Node + Kinder mitbewegen
        moveNodeWithChildren(
          'area',
          draggedHallAreaUuid,
          svg.x - hallDragOffsetX,
          svg.y - hallDragOffsetY,
        );
      } else {
        // Sekundäre oder unzugewiesene Halle → nur Override aktualisieren
        const hall = hallBounds.find((h: HallBounds) => h.id === draggedHallId);
        if (hall !== undefined) {
          setHallOverride(draggedHallId, {
            x: svg.x - hallDragOffsetX,
            y: svg.y - hallDragOffsetY,
            width: hall.width,
            height: hall.height,
          });
        }
      }
      return;
    }
    if (!isPanning) return;
    setPan(event.clientX - panStartX, event.clientY - panStartY);
  }

  function handlePointerUp(): void {
    draggedHallId = '';
    draggedHallAreaUuid = null;
    draggedHallIsPrimary = false;
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

  /** Verbindungslinien zwischen Hallen derselben Area */
  interface HallConnection {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }

  /** Punkt auf dem Rechteckrand in Richtung eines Zielpunkts */
  function rectEdgePoint(
    cx: number,
    cy: number,
    width: number,
    height: number,
    targetX: number,
    targetY: number,
  ): { x: number; y: number } {
    const dx = targetX - cx;
    const dy = targetY - cy;
    if (dx === 0 && dy === 0) return { x: cx, y: cy };

    const hw = width / 2;
    const hh = height / 2;
    const tx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
    const ty = dy !== 0 ? hh / Math.abs(dy) : Infinity;
    const t = Math.min(tx, ty);

    return { x: cx + dx * t, y: cy + dy * t };
  }

  const hallConnections = $derived.by((): HallConnection[] => {
    const byArea: Record<string, HallBounds[]> = {};
    for (const hall of hallBounds) {
      if (hall.areaUuid === null) continue;
      (byArea[hall.areaUuid] ??= []).push(hall);
    }

    const lines: HallConnection[] = [];
    for (const halls of Object.values(byArea)) {
      for (let i = 0; i < halls.length - 1; i++) {
        const a = halls[i];
        const b = halls[i + 1];
        const acx = a.x + a.width / 2;
        const acy = a.y + a.height / 2;
        const bcx = b.x + b.width / 2;
        const bcy = b.y + b.height / 2;
        const p1 = rectEdgePoint(acx, acy, a.width, a.height, bcx, bcy);
        const p2 = rectEdgePoint(bcx, bcy, b.width, b.height, acx, acy);
        lines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
      }
    }
    return lines;
  });
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
    <!-- Hallen-Container (assigned + unassigned) -->
    {#each hallBounds as hall (hall.id)}
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
          y={hall.y + 26}
          class="hall-label"
          fill={HALL_COLOR.border}
        >
          <tspan
            font-weight="600"
            font-size="{hallFontSize}px">{hall.hallName}</tspan
          >
          {#if hall.leadName !== undefined}
            <tspan
              dx="8"
              opacity="0.7"
              font-size="{hallSubFontSize}px">{hall.leadName}</tspan
            >
          {/if}
        </text>
      </g>
    {/each}

    <!-- Hall-Resize Handles (nur wenn entsperrt) -->
    {#if !isLocked}
      {#each hallBounds as hall (hall.id)}
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
        <!-- Corner: Top-Left -->
        <rect
          role="presentation"
          x={hall.x - HANDLE_SIZE / 2}
          y={hall.y - HANDLE_SIZE / 2}
          width={HANDLE_SIZE}
          height={HANDLE_SIZE}
          fill="transparent"
          style="cursor: nwse-resize"
          pointer-events="all"
          onpointerdown={(e) => {
            startHallResize(e, hall, 'top-left');
          }}
        />
        <!-- Corner: Top-Right -->
        <rect
          role="presentation"
          x={hall.x + hall.width - HANDLE_SIZE / 2}
          y={hall.y - HANDLE_SIZE / 2}
          width={HANDLE_SIZE}
          height={HANDLE_SIZE}
          fill="transparent"
          style="cursor: nesw-resize"
          pointer-events="all"
          onpointerdown={(e) => {
            startHallResize(e, hall, 'top-right');
          }}
        />
        <!-- Corner: Bottom-Left -->
        <rect
          role="presentation"
          x={hall.x - HANDLE_SIZE / 2}
          y={hall.y + hall.height - HANDLE_SIZE / 2}
          width={HANDLE_SIZE}
          height={HANDLE_SIZE}
          fill="transparent"
          style="cursor: nesw-resize"
          pointer-events="all"
          onpointerdown={(e) => {
            startHallResize(e, hall, 'bottom-left');
          }}
        />
        <!-- Corner: Bottom-Right -->
        <rect
          role="presentation"
          x={hall.x + hall.width - HANDLE_SIZE / 2}
          y={hall.y + hall.height - HANDLE_SIZE / 2}
          width={HANDLE_SIZE}
          height={HANDLE_SIZE}
          fill="transparent"
          style="cursor: nwse-resize"
          pointer-events="all"
          onpointerdown={(e) => {
            startHallResize(e, hall, 'bottom-right');
          }}
        />
      {/each}
    {/if}

    <!-- Hallen-Verbindungslinien (lila, zwischen Hallen derselben Area) -->
    {#each hallConnections as hc, i (`hall-conn-${i}`)}
      <line
        x1={hc.x1}
        y1={hc.y1}
        x2={hc.x2}
        y2={hc.y2}
        stroke={HALL_COLOR.border}
        stroke-width="2"
        stroke-dasharray="8 4"
        opacity="0.6"
        class="connection"
      />
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
    pointer-events: none;
    user-select: none;
  }
</style>
