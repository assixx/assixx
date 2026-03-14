/**
 * Organigramm — Reactive State (Svelte 5 Runes)
 * Manages tree data, node positions, canvas viewport, and dirty tracking.
 */
import { LAYOUT } from './constants.js';

import type {
  Connection,
  HallBounds,
  HallOverride,
  HierarchyLabels,
  OrgChartNode,
  OrgChartTree,
  OrgEntityType,
  OrgTreeHall,
  RenderNode,
} from './types.js';

// --- Position Key ---

type PositionKey = `${OrgEntityType}:${string}`;

function makeKey(entityType: OrgEntityType, entityUuid: string): PositionKey {
  return `${entityType}:${entityUuid}`;
}

interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

// --- Reactive State ---

let tree = $state<OrgChartTree>({
  companyName: '',
  address: null,
  hierarchyLabels: {
    hall: 'Hallen',
    area: 'Bereiche',
    department: 'Abteilungen',
    team: 'Teams',
    asset: 'Anlagen',
  },
  viewport: { zoom: 1, panX: 0, panY: 0, fontSize: 13 },
  hallOverrides: {},
  canvasBg: null,
  nodes: [],
  halls: [],
});
let nodePositions = $state<Record<PositionKey, NodePosition>>({});
let zoom = $state(1);
let panX = $state(0);
let panY = $state(0);
let fontSize = $state(13);
let dirty = $state(false);
let saving = $state(false);
let hoveredNodeKey = $state('');
let locked = $state(true);
let hallOverrides = $state<Record<string, HallOverride>>({});
let canvasBg = $state<string | null>(null);
let nodeWidth = $state<number>(LAYOUT.NODE_WIDTH);
let nodeHeight = $state<number>(LAYOUT.NODE_HEIGHT);

// --- Getters ---

export function getTree(): OrgChartTree {
  return tree;
}

export function getZoom(): number {
  return zoom;
}

export function getPanX(): number {
  return panX;
}

export function getPanY(): number {
  return panY;
}

export function getFontSize(): number {
  return fontSize;
}

export function setFontSize(value: number): void {
  fontSize = Math.max(8, Math.min(120, value));
  dirty = true;
}

export function getIsDirty(): boolean {
  return dirty;
}

export function getIsSaving(): boolean {
  return saving;
}

export function getHoveredNodeKey(): string {
  return hoveredNodeKey;
}

export function setHoveredNodeKey(key: string): void {
  hoveredNodeKey = key;
}

export function getIsLocked(): boolean {
  return locked;
}

export function toggleLock(): void {
  locked = !locked;
}

export function getCanvasBg(): string | null {
  return canvasBg;
}

export function setCanvasBg(value: string | null): void {
  canvasBg = value;
  dirty = true;
}

export function getNodeWidth(): number {
  return nodeWidth;
}

export function getNodeHeight(): number {
  return nodeHeight;
}

export function adjustNodeSize(delta: number): void {
  const wStep = delta * 20;
  const hStep = delta * 8;
  const newW = Math.max(100, Math.min(1000, nodeWidth + wStep));
  const newH = Math.max(40, Math.min(400, nodeHeight + hStep));
  if (newW === nodeWidth && newH === nodeHeight) return;

  const updated: Record<PositionKey, NodePosition> = {};
  for (const [key, pos] of Object.entries(nodePositions)) {
    updated[key as PositionKey] = { ...pos, width: newW, height: newH };
  }
  nodePositions = updated;

  nodeWidth = newW;
  nodeHeight = newH;
  dirty = true;
}

// --- Init ---

export function initFromTree(data: OrgChartTree): void {
  tree = data;
  dirty = false;
  saving = false;
  hoveredNodeKey = '';

  // 1. Compute auto-layout for ALL nodes
  const autoPositions = computeAutoLayout(data.nodes);

  // 2. Override with saved positions from backend
  overlaySavedPositions(data.nodes, autoPositions);

  nodePositions = autoPositions;

  // 3. Restore saved viewport or reset
  zoom = data.viewport.zoom;
  panX = data.viewport.panX;
  panY = data.viewport.panY;
  fontSize = data.viewport.fontSize;
  nodeWidth = data.viewport.nodeWidth ?? LAYOUT.NODE_WIDTH;
  nodeHeight = data.viewport.nodeHeight ?? LAYOUT.NODE_HEIGHT;

  // 4. Restore hall overrides
  hallOverrides = data.hallOverrides;

  // 5. Restore canvas background
  canvasBg = data.canvasBg;
}

function overlaySavedPositions(
  nodes: OrgChartNode[],
  target: Record<string, NodePosition>,
): void {
  for (const node of nodes) {
    if (node.position !== null) {
      const key = makeKey(node.entityType, node.entityUuid);
      target[key] = {
        x: node.position.positionX,
        y: node.position.positionY,
        width: node.position.width,
        height: node.position.height,
      };
    }
    overlaySavedPositions(node.children, target);
    overlaySavedPositions(node.assets, target);
  }
}

// --- Auto-Layout (Top-Down Tree) ---

function computeAutoLayout(
  nodes: OrgChartNode[],
): Record<string, NodePosition> {
  const result: Record<string, NodePosition> = {};
  const pad = LAYOUT.CANVAS_PADDING;
  let nextLeafX = pad;

  function layoutNode(
    node: OrgChartNode,
    depth: number,
  ): { left: number; right: number } {
    // Areas (depth 0) get extra offset for the container header
    const headerOffset =
      node.entityType === 'area' ? LAYOUT.AREA_HEADER_HEIGHT : 0;
    const y = pad + headerOffset + depth * (nodeHeight + LAYOUT.VERTICAL_GAP);
    const allChildren = [...node.children, ...node.assets];

    if (allChildren.length === 0) {
      const x = nextLeafX;
      nextLeafX += nodeWidth + LAYOUT.HORIZONTAL_GAP;
      result[makeKey(node.entityType, node.entityUuid)] = {
        x,
        y,
        width: nodeWidth,
        height: nodeHeight,
      };
      return { left: x, right: x + nodeWidth };
    }

    let groupLeft = Infinity;
    let groupRight = -Infinity;
    for (const child of allChildren) {
      const bounds = layoutNode(child, depth + 1);
      groupLeft = Math.min(groupLeft, bounds.left);
      groupRight = Math.max(groupRight, bounds.right);
    }

    const x = (groupLeft + groupRight) / 2 - nodeWidth / 2;
    result[makeKey(node.entityType, node.entityUuid)] = {
      x,
      y,
      width: nodeWidth,
      height: nodeHeight,
    };

    return {
      left: Math.min(x, groupLeft),
      right: Math.max(x + nodeWidth, groupRight),
    };
  }

  for (const node of nodes) {
    layoutNode(node, 0);
    // Extra Lücke zwischen Area-Gruppen
    nextLeafX += LAYOUT.HORIZONTAL_GAP;
  }

  return result;
}

export function getNodePosition(
  entityType: OrgEntityType,
  entityUuid: string,
): NodePosition | undefined {
  return nodePositions[makeKey(entityType, entityUuid)];
}

// --- Node Position Updates (Drag + Auto-Follow) ---

/** Move only this single node — children stay in place */
export function moveNodeOnly(
  entityType: OrgEntityType,
  entityUuid: string,
  newX: number,
  newY: number,
): void {
  const key = makeKey(entityType, entityUuid);
  const oldPos = nodePositions[key];
  nodePositions[key] = {
    x: newX,
    y: newY,
    width: oldPos.width,
    height: oldPos.height,
  };
  dirty = true;
}

/** Move a node and all its descendants by the same delta */
export function moveNodeWithChildren(
  entityType: OrgEntityType,
  entityUuid: string,
  newX: number,
  newY: number,
): void {
  const key = makeKey(entityType, entityUuid);
  const oldPos = nodePositions[key];
  const dx = newX - oldPos.x;
  const dy = newY - oldPos.y;

  nodePositions[key] = {
    x: newX,
    y: newY,
    width: oldPos.width,
    height: oldPos.height,
  };

  const descendantKeys = findDescendantKeys(entityType, entityUuid);
  for (const descKey of descendantKeys) {
    const descPos = nodePositions[descKey];
    nodePositions[descKey] = {
      x: descPos.x + dx,
      y: descPos.y + dy,
      width: descPos.width,
      height: descPos.height,
    };
  }

  dirty = true;
}

function findDescendantKeys(
  entityType: OrgEntityType,
  entityUuid: string,
): PositionKey[] {
  const keys: PositionKey[] = [];

  function findNode(nodes: OrgChartNode[]): OrgChartNode | undefined {
    for (const node of nodes) {
      if (node.entityType === entityType && node.entityUuid === entityUuid) {
        return node;
      }
      const inChildren = findNode(node.children);
      if (inChildren !== undefined) return inChildren;
      const inAssets = findNode(node.assets);
      if (inAssets !== undefined) return inAssets;
    }
    return undefined;
  }

  function collectKeys(node: OrgChartNode): void {
    for (const child of [...node.children, ...node.assets]) {
      keys.push(makeKey(child.entityType, child.entityUuid));
      collectKeys(child);
    }
  }

  const targetNode = findNode(tree.nodes);
  if (targetNode !== undefined) {
    collectKeys(targetNode);
  }

  return keys;
}

// --- Canvas Controls ---

/** Viewport-Größe (wird von OrgCanvas aktualisiert) */
let viewportWidth = 0;
let viewportHeight = 0;

export function setViewportSize(w: number, h: number): void {
  viewportWidth = w;
  viewportHeight = h;
}

export function setZoom(value: number): void {
  zoom = Math.max(LAYOUT.MIN_ZOOM, Math.min(LAYOUT.MAX_ZOOM, value));
  dirty = true;
}

/**
 * Zoom mit Fokuspunkt — der Punkt unter (focalX, focalY)
 * bleibt visuell an derselben Stelle.
 * Koordinaten relativ zum SVG-Element (screen-space).
 */
export function zoomAt(delta: number, focalX: number, focalY: number): void {
  const oldZoom = zoom;
  const newZoom = Math.max(
    LAYOUT.MIN_ZOOM,
    Math.min(LAYOUT.MAX_ZOOM, zoom + delta),
  );
  if (newZoom === oldZoom) return;

  const ratio = newZoom / oldZoom;
  panX = focalX - (focalX - panX) * ratio;
  panY = focalY - (focalY - panY) * ratio;
  zoom = newZoom;
  dirty = true;
}

/** Zoom Richtung Viewport-Mitte (für Toolbar-Buttons) */
export function adjustZoom(delta: number): void {
  zoomAt(delta, viewportWidth / 2, viewportHeight / 2);
}

export function setPan(x: number, y: number): void {
  panX = x;
  panY = y;
  dirty = true;
}

export function resetView(): void {
  zoom = 1;
  panX = 0;
  panY = 0;
  dirty = true;
}

// --- Auto-Layout (Re-Trigger) ---

/** Recompute auto-layout for all nodes, discard manual positions + overrides */
export function recomputeAutoLayout(): void {
  const autoPositions = computeAutoLayout(tree.nodes);
  nodePositions = autoPositions;
  hallOverrides = {};
  dirty = true;
}

// --- Hierarchy Labels ---

export function updateTreeLabels(labels: HierarchyLabels): void {
  tree = { ...tree, hierarchyLabels: labels };
}

// --- Save Helpers ---

export function setSaving(value: boolean): void {
  saving = value;
}

export function markSaved(): void {
  dirty = false;
  saving = false;
}

/** Alle ungespeicherten Änderungen verwerfen — zurück zum letzten gespeicherten Zustand */
export function resetToSaved(): void {
  initFromTree(tree);
}

export function setHallOverride(hallId: string, bounds: HallOverride): void {
  hallOverrides[hallId] = bounds;
  dirty = true;
}

export function getCanvasBgForSave(): string | null {
  return canvasBg;
}

export function getHallOverridesForSave(): Record<string, HallOverride> {
  return { ...hallOverrides };
}

export function getViewportForSave(): {
  zoom: number;
  panX: number;
  panY: number;
  fontSize: number;
  nodeWidth: number;
  nodeHeight: number;
} {
  return { zoom, panX, panY, fontSize, nodeWidth, nodeHeight };
}

export function getPositionsForSave(): {
  entityType: OrgEntityType;
  entityUuid: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
}[] {
  return Object.entries(nodePositions).map(([key, pos]) => {
    const [entityType, entityUuid] = key.split(':') as [OrgEntityType, string];
    return {
      entityType,
      entityUuid,
      positionX: pos.x,
      positionY: pos.y,
      width: pos.width,
      height: pos.height,
    };
  });
}

// --- Render Helpers ---

/** Flatten tree into a flat list of render-ready nodes with positions */
export function getRenderNodes(): RenderNode[] {
  const result: RenderNode[] = [];

  function walk(nodes: OrgChartNode[]): void {
    for (const node of nodes) {
      const key = makeKey(node.entityType, node.entityUuid);
      const pos = nodePositions[key];
      result.push({
        entityType: node.entityType,
        entityUuid: node.entityUuid,
        name: node.name,
        x: pos.x,
        y: pos.y,
        width: pos.width,
        height: pos.height,
        leadName: node.leadName,
        memberCount: node.memberCount,
      });
      walk(node.children);
      walk(node.assets);
    }
  }

  walk(tree.nodes);
  return result;
}

/** Get connection lines between parent and child nodes */
export function getConnections(): Connection[] {
  const connections: Connection[] = [];

  function walk(nodes: OrgChartNode[]): void {
    for (const node of nodes) {
      const parentKey = makeKey(node.entityType, node.entityUuid);
      const parentPos = nodePositions[parentKey];

      const allChildren = [...node.children, ...node.assets];
      for (const child of allChildren) {
        const childKey = makeKey(child.entityType, child.entityUuid);
        const childPos = nodePositions[childKey];

        connections.push({
          parentKey,
          childKey,
          x1: parentPos.x + parentPos.width / 2,
          y1: parentPos.y + parentPos.height,
          x2: childPos.x + childPos.width / 2,
          y2: childPos.y,
        });
      }

      walk(node.children);
      walk(node.assets);
    }
  }

  walk(tree.nodes);
  return connections;
}

/** Auto-computed content bounds für eine assigned Halle */
function computeAssignedHallBounds(
  hall: OrgTreeHall,
  areaNode: OrgChartNode,
): HallBounds {
  const PADDING = 24;
  const HEADER_HEIGHT = 32;

  const areaPos = nodePositions[makeKey('area', areaNode.entityUuid)];
  const rects = collectDescendantRects(areaNode);
  rects.push(areaPos);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }

  return {
    id: hall.uuid,
    hallName: hall.name,
    areaUuid: hall.areaUuid,
    leadName: undefined,
    x: minX - PADDING,
    y: minY - PADDING - HEADER_HEIGHT,
    width: maxX - minX + PADDING * 2,
    height: maxY - minY + PADDING * 1.6 + HEADER_HEIGHT * 2,
  };
}

/** Merge auto-bounds mit manuellem Override (Override gewinnt wenn größer) */
function mergeWithOverride(auto: HallBounds): HallBounds {
  if (!(auto.id in hallOverrides)) return auto;
  const override = hallOverrides[auto.id];

  const x = Math.min(auto.x, override.x);
  const y = Math.min(auto.y, override.y);
  const maxX = Math.max(auto.x + auto.width, override.x + override.width);
  const maxY = Math.max(auto.y + auto.height, override.y + override.height);

  return { ...auto, x, y, width: maxX - x, height: maxY - y };
}

/** Assigned-Hall mit Offset für n-te Halle derselben Area */
function computeOffsetHallBounds(
  hall: OrgTreeHall,
  areaNode: OrgChartNode,
  hallIndex: number,
): HallBounds {
  const auto = computeAssignedHallBounds(hall, areaNode);

  if (hallIndex === 0) {
    return mergeWithOverride(auto);
  }

  // Sekundäre Hallen: Override ersetzt Position komplett (unabhängig verschiebbar)
  const override = hallOverrides[hall.uuid] as HallOverride | undefined;
  if (override !== undefined) {
    return {
      ...auto,
      x: override.x,
      y: override.y,
      width: override.width,
      height: override.height,
    };
  }

  // Default: Offset rechts neben der primären Halle
  auto.x += hallIndex * (auto.width + 40);
  return auto;
}

/** Compute bounding boxes für Hallen-Container (assigned + unassigned) */
export function getHallBounds(): HallBounds[] {
  const bounds: HallBounds[] = [];
  const areaMap = new Map<string, OrgChartNode>();
  for (const node of tree.nodes) {
    if (node.entityType === 'area') {
      areaMap.set(node.entityUuid, node);
    }
  }

  const areaHallCount: Record<string, number> = {};
  let unassignedIdx = 0;
  for (const hall of tree.halls) {
    if (hall.areaUuid !== null) {
      const areaNode = areaMap.get(hall.areaUuid);
      if (areaNode !== undefined) {
        const idx = areaHallCount[hall.areaUuid] ?? 0;
        areaHallCount[hall.areaUuid] = idx + 1;
        bounds.push(computeOffsetHallBounds(hall, areaNode, idx));
        continue;
      }
    }
    bounds.push(computeUnassignedBounds(hall, unassignedIdx));
    unassignedIdx++;
  }

  return bounds;
}

/** Y-Position unterhalb aller Knoten (für unassigned Hallen) */
function computeContentBottomY(): number {
  let maxY = 0;
  for (const pos of Object.values(nodePositions)) {
    maxY = Math.max(maxY, pos.y + pos.height);
  }
  return maxY + 80;
}

/** Default-Bounds für eine Halle ohne Area-Zuweisung */
function computeUnassignedBounds(hall: OrgTreeHall, index: number): HallBounds {
  const DEFAULT_W = 200;
  const DEFAULT_H = 120;
  const GAP = 40;
  const override = hallOverrides[hall.uuid] as HallOverride | undefined;

  return {
    id: hall.uuid,
    hallName: hall.name,
    areaUuid: hall.areaUuid,
    x: override?.x ?? LAYOUT.CANVAS_PADDING + index * (DEFAULT_W + GAP),
    y: override?.y ?? computeContentBottomY(),
    width: override?.width ?? DEFAULT_W,
    height: override?.height ?? DEFAULT_H,
  };
}

/** Ist diese Halle die primäre (erste) für ihre Area? */
export function isHallPrimary(hallId: string): boolean {
  const hall = tree.halls.find((h: OrgTreeHall) => h.uuid === hallId);
  return (
    hall?.areaUuid !== undefined &&
    hall.areaUuid !== null &&
    tree.halls.find((h: OrgTreeHall) => h.areaUuid === hall.areaUuid)?.uuid ===
      hallId
  );
}

function collectDescendantRects(node: OrgChartNode): NodePosition[] {
  const rects: NodePosition[] = [];

  function walk(children: OrgChartNode[]): void {
    for (const child of children) {
      const key = makeKey(child.entityType, child.entityUuid);
      rects.push(nodePositions[key]);
      walk(child.children);
      walk(child.assets);
    }
  }

  walk(node.children);
  walk(node.assets);
  return rects;
}
