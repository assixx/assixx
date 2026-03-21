<!--
  OrgCanvas — SVG Canvas mit Pan/Zoom
  Rendert OrgNode-Komponenten und Bézier-Verbindungslinien.
  Pan: Mittelklick-Drag oder Shift+Linksklick
  Zoom: Mausrad
-->
<script lang="ts">
  import { showWarningAlert } from '$lib/stores/toast';

  import { LAYOUT } from './constants.js';
  import OrgNode from './OrgNode.svelte';
  import {
    getConnections,
    getFontSize,
    getHallBounds,
    getHallConnectionAnchors,
    getHoveredNodeKey,
    getIsLocked,
    getNodePosition,
    getPanX,
    getPanY,
    getRenderNodes,
    getZoom,
    isHallPrimary,
    moveGhostNodesByHall,
    moveNodeWithChildren,
    setHallConnectionAnchor,
    setHallOverride,
    setPan,
    setViewportSize,
    zoomAt,
  } from './state.svelte.js';

  import type {
    AnchorSide,
    Connection,
    HallBounds,
    OrgEntityType,
    PerimeterAnchor,
    ResizeEdge,
  } from './types.js';

  interface Props {
    ondblclicknode?: (entityType: OrgEntityType, entityUuid: string) => void;
  }

  const { ondblclicknode }: Props = $props();

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

  // Anchor-Drag State
  let draggingAnchorKey = $state('');
  let draggingAnchorHallId = $state('');

  const HANDLE_SIZE = 8;
  const LOCK_MSG = 'Bitte erst die Bearbeitung entsperren';

  /** Throttle damit Mausrad-Spam nicht 100 Toasts erzeugt */
  let lastLockToast = 0;
  function showLockWarning(): void {
    const now = Date.now();
    if (now - lastLockToast < 2000) return;
    lastLockToast = now;
    showWarningAlert(LOCK_MSG);
  }

  function clientToSvg(clientX: number, clientY: number): { x: number; y: number } {
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
    if (isLocked) {
      showLockWarning();
      return;
    }
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

  function startHallResize(event: PointerEvent, hall: HallBounds, edge: ResizeEdge): void {
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
  const RIGHT_EDGES: readonly ResizeEdge[] = ['right', 'top-right', 'bottom-right'];
  const TOP_EDGES: readonly ResizeEdge[] = ['top', 'top-left', 'top-right'];
  const BOTTOM_EDGES: readonly ResizeEdge[] = ['bottom', 'bottom-left', 'bottom-right'];

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
    if (isLocked) {
      showLockWarning();
      return;
    }
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

  function applyAnchorDrag(event: PointerEvent): void {
    const svg = clientToSvg(event.clientX, event.clientY);
    const hall = hallBounds.find((h: HallBounds) => h.id === draggingAnchorHallId);
    if (hall !== undefined) {
      setHallConnectionAnchor(draggingAnchorKey, nearestPerimeterAnchor(hall, svg.x, svg.y));
    }
  }

  function applyHallDrag(event: PointerEvent): void {
    const svg = clientToSvg(event.clientX, event.clientY);
    if (draggedHallAreaUuid !== null && draggedHallIsPrimary) {
      moveNodeWithChildren(
        'area',
        draggedHallAreaUuid,
        svg.x - hallDragOffsetX,
        svg.y - hallDragOffsetY,
      );
    } else {
      const hall = hallBounds.find((h: HallBounds) => h.id === draggedHallId);
      if (hall !== undefined) {
        const newX = svg.x - hallDragOffsetX;
        const newY = svg.y - hallDragOffsetY;
        const dx = newX - hall.x;
        const dy = newY - hall.y;

        // Move ghost nodes inside secondary hall
        if (draggedHallAreaUuid !== null) {
          moveGhostNodesByHall(draggedHallId, dx, dy);
        }

        setHallOverride(draggedHallId, {
          x: newX,
          y: newY,
          width: hall.width,
          height: hall.height,
        });
      }
    }
  }

  function handlePointerMove(event: PointerEvent): void {
    if (draggingAnchorKey !== '') {
      event.preventDefault();
      applyAnchorDrag(event);
      return;
    }
    if (resizingHallUuid !== '') {
      event.preventDefault();
      applyResize(event);
      return;
    }
    if (draggedHallId !== '') {
      event.preventDefault();
      applyHallDrag(event);
      return;
    }
    if (!isPanning) return;
    setPan(event.clientX - panStartX, event.clientY - panStartY);
  }

  function handlePointerUp(): void {
    draggingAnchorKey = '';
    draggingAnchorHallId = '';
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
    hallIdA: string;
    hallIdB: string;
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

  /** PerimeterAnchor → absolute Koordinaten auf dem Hallenrand */
  function anchorToPoint(hall: HallBounds, anchor: PerimeterAnchor): { x: number; y: number } {
    switch (anchor.side) {
      case 'top':
        return { x: hall.x + anchor.t * hall.width, y: hall.y };
      case 'bottom':
        return {
          x: hall.x + anchor.t * hall.width,
          y: hall.y + hall.height,
        };
      case 'left':
        return { x: hall.x, y: hall.y + anchor.t * hall.height };
      case 'right':
        return {
          x: hall.x + hall.width,
          y: hall.y + anchor.t * hall.height,
        };
    }
  }

  /** Nächster Punkt auf dem Hallenrand zur Mausposition */
  function nearestPerimeterAnchor(hall: HallBounds, mx: number, my: number): PerimeterAnchor {
    const { x: hx, y: hy, width: hw, height: hh } = hall;
    const cl = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
    const d2 = (ax: number, ay: number, bx: number, by: number): number =>
      (ax - bx) ** 2 + (ay - by) ** 2;

    const topX = cl(mx, hx, hx + hw);
    const botX = cl(mx, hx, hx + hw);
    const leftY = cl(my, hy, hy + hh);
    const rightY = cl(my, hy, hy + hh);

    const candidates: { side: AnchorSide; t: number; dist: number }[] = [
      {
        side: 'top',
        t: hw > 0 ? (topX - hx) / hw : 0.5,
        dist: d2(mx, my, topX, hy),
      },
      {
        side: 'bottom',
        t: hw > 0 ? (botX - hx) / hw : 0.5,
        dist: d2(mx, my, botX, hy + hh),
      },
      {
        side: 'left',
        t: hh > 0 ? (leftY - hy) / hh : 0.5,
        dist: d2(mx, my, hx, leftY),
      },
      {
        side: 'right',
        t: hh > 0 ? (rightY - hy) / hh : 0.5,
        dist: d2(mx, my, hx + hw, rightY),
      },
    ];

    candidates.sort((a, b) => a.dist - b.dist);
    return { side: candidates[0].side, t: candidates[0].t };
  }

  function startAnchorDrag(event: PointerEvent, hallId: string, anchorKey: string): void {
    if (isLocked) {
      showLockWarning();
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    draggingAnchorKey = anchorKey;
    draggingAnchorHallId = hallId;
    svgElement.setPointerCapture(event.pointerId);
  }

  /** Ankerpunkt oder Auto-berechneter Randpunkt für eine Halle */
  function resolveEndpoint(
    hall: HallBounds,
    other: HallBounds,
    key: string,
    anchors: Record<string, PerimeterAnchor>,
  ): { x: number; y: number } {
    if (key in anchors) {
      return anchorToPoint(hall, anchors[key]);
    }
    return rectEdgePoint(
      hall.x + hall.width / 2,
      hall.y + hall.height / 2,
      hall.width,
      hall.height,
      other.x + other.width / 2,
      other.y + other.height / 2,
    );
  }

  const hallConnections = $derived.by((): HallConnection[] => {
    const byArea: Record<string, HallBounds[]> = {};
    for (const hall of hallBounds) {
      if (hall.areaUuid === null) continue;
      (byArea[hall.areaUuid] ??= []).push(hall);
    }

    const anchors = getHallConnectionAnchors();
    const lines: HallConnection[] = [];
    for (const halls of Object.values(byArea)) {
      for (let i = 0; i < halls.length - 1; i++) {
        const a = halls[i];
        const b = halls[i + 1];
        const p1 = resolveEndpoint(a, b, `${a.id}\u2192${b.id}`, anchors);
        const p2 = resolveEndpoint(b, a, `${b.id}\u2192${a.id}`, anchors);

        lines.push({
          hallIdA: a.id,
          hallIdB: b.id,
          x1: p1.x,
          y1: p1.y,
          x2: p2.x,
          y2: p2.y,
        });
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
          stroke="var(--org-connection-stroke, #000)"
          stroke-width="1.65"
          stroke-dasharray="6 3"
          opacity="0.8"
        />
        <text
          x={hall.x + 12}
          y={hall.y + 34 - hallFontSize * 0.63}
          class="hall-label"
          fill="var(--org-connection-stroke, #000)"
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

    <!-- Hallen-Verbindungslinien (zwischen Hallen derselben Area) -->
    {#each hallConnections as hc (`hall-conn-${hc.hallIdA}-${hc.hallIdB}`)}
      <line
        x1={hc.x1}
        y1={hc.y1}
        x2={hc.x2}
        y2={hc.y2}
        stroke="var(--org-connection-stroke, #000)"
        stroke-width="2.2"
        stroke-dasharray="8 4"
        opacity="0.6"
        class="connection"
      />
    {/each}

    <!-- Anchor-Drag: unsichtbare breite Linie als Greiffläche + Endpunkt-Kreise -->
    {#if !isLocked}
      {#each hallConnections as hc (`anchor-${hc.hallIdA}-${hc.hallIdB}`)}
        {@const handleR = 12 / zoom}
        {@const hitWidth = 24 / zoom}
        <!-- Breite unsichtbare Linie — Greifen irgendwo startet Drag des näheren Endpunkts -->
        <line
          x1={hc.x1}
          y1={hc.y1}
          x2={hc.x2}
          y2={hc.y2}
          stroke="transparent"
          stroke-width={hitWidth}
          class="connection-hitarea"
          role="presentation"
          onpointerdown={(e: PointerEvent) => {
            const svg = clientToSvg(e.clientX, e.clientY);
            const d1 = (svg.x - hc.x1) ** 2 + (svg.y - hc.y1) ** 2;
            const d2 = (svg.x - hc.x2) ** 2 + (svg.y - hc.y2) ** 2;
            if (d1 <= d2) {
              startAnchorDrag(e, hc.hallIdA, `${hc.hallIdA}\u2192${hc.hallIdB}`);
            } else {
              startAnchorDrag(e, hc.hallIdB, `${hc.hallIdB}\u2192${hc.hallIdA}`);
            }
          }}
        />
        <!-- Endpunkt-Kreise (zoom-kompensiert) -->
        <circle
          cx={hc.x1}
          cy={hc.y1}
          r={handleR}
          role="presentation"
          class="anchor-handle"
          onpointerdown={(e: PointerEvent) => {
            startAnchorDrag(e, hc.hallIdA, `${hc.hallIdA}\u2192${hc.hallIdB}`);
          }}
        />
        <circle
          cx={hc.x2}
          cy={hc.y2}
          r={handleR}
          role="presentation"
          class="anchor-handle"
          onpointerdown={(e: PointerEvent) => {
            startAnchorDrag(e, hc.hallIdB, `${hc.hallIdB}\u2192${hc.hallIdA}`);
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
        : 'var(--org-connection-stroke, #000)'}
        stroke-width={highlighted ? 2.75 : 1.65}
        stroke-dasharray={highlighted ? 'none' : '4 2'}
        opacity={highlighted ? 0.8 : 0.4}
        class="connection"
      />
    {/each}

    <!-- Knoten -->
    {#each renderNodes as node (node.renderKey)}
      <OrgNode
        {node}
        {svgElement}
        {ondblclicknode}
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

  .connection-hitarea {
    pointer-events: stroke;
    cursor: crosshair;
  }

  .anchor-handle {
    fill: transparent;
    stroke: none;
    pointer-events: all;
    cursor: crosshair;
    transition:
      fill 0.15s ease,
      stroke 0.15s ease;
  }

  .anchor-handle:hover {
    fill: var(--org-connection-stroke, #000);
    fill-opacity: 60%;
    stroke: var(--org-connection-stroke, #000);
    stroke-width: 2;
  }

  .hall-label {
    pointer-events: none;
    user-select: none;
  }
</style>
