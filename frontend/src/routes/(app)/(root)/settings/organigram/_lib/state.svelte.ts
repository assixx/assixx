/**
 * Organigramm — Reactive State (Svelte 5 Runes)
 * Manages tree data, node positions, canvas viewport, and dirty tracking.
 */
import { LAYOUT } from './constants.js';

import type {
  Connection,
  HallBounds,
  HierarchyLabels,
  OrgChartNode,
  OrgChartTree,
  OrgEntityType,
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
  nodes: [],
});
let nodePositions = $state<Record<PositionKey, NodePosition>>({});
let zoom = $state(1);
let panX = $state(0);
let panY = $state(0);
let dirty = $state(false);
let saving = $state(false);
let hoveredNodeKey = $state('');
let locked = $state(true);

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

  // 3. Reset viewport
  zoom = 1;
  panX = 0;
  panY = 0;
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
    const y =
      pad + headerOffset + depth * (LAYOUT.NODE_HEIGHT + LAYOUT.VERTICAL_GAP);
    const allChildren = [...node.children, ...node.assets];

    if (allChildren.length === 0) {
      const x = nextLeafX;
      nextLeafX += LAYOUT.NODE_WIDTH + LAYOUT.HORIZONTAL_GAP;
      result[makeKey(node.entityType, node.entityUuid)] = {
        x,
        y,
        width: LAYOUT.NODE_WIDTH,
        height: LAYOUT.NODE_HEIGHT,
      };
      return { left: x, right: x + LAYOUT.NODE_WIDTH };
    }

    let groupLeft = Infinity;
    let groupRight = -Infinity;
    for (const child of allChildren) {
      const bounds = layoutNode(child, depth + 1);
      groupLeft = Math.min(groupLeft, bounds.left);
      groupRight = Math.max(groupRight, bounds.right);
    }

    const x = (groupLeft + groupRight) / 2 - LAYOUT.NODE_WIDTH / 2;
    result[makeKey(node.entityType, node.entityUuid)] = {
      x,
      y,
      width: LAYOUT.NODE_WIDTH,
      height: LAYOUT.NODE_HEIGHT,
    };

    return {
      left: Math.min(x, groupLeft),
      right: Math.max(x + LAYOUT.NODE_WIDTH, groupRight),
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

export function setZoom(value: number): void {
  zoom = Math.max(LAYOUT.MIN_ZOOM, Math.min(LAYOUT.MAX_ZOOM, value));
}

export function adjustZoom(delta: number): void {
  setZoom(zoom + delta);
}

export function setPan(x: number, y: number): void {
  panX = x;
  panY = y;
}

export function resetView(): void {
  zoom = 1;
  panX = 0;
  panY = 0;
}

// --- Auto-Layout (Re-Trigger) ---

/** Recompute auto-layout for all nodes, discard manual positions */
export function recomputeAutoLayout(): void {
  const autoPositions = computeAutoLayout(tree.nodes);
  nodePositions = autoPositions;
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

/** Compute bounding boxes für Hallen-Container (nur Areas mit zugewiesener Halle) */
export function getHallBounds(): HallBounds[] {
  const PADDING = 24;
  const HEADER_HEIGHT = 32;
  const bounds: HallBounds[] = [];

  for (const node of tree.nodes) {
    if (node.entityType !== 'area') continue;
    if (node.hallName === undefined) continue;

    const areaKey = makeKey('area', node.entityUuid);
    const areaPos = nodePositions[areaKey];
    const rects = collectDescendantRects(node);
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

    bounds.push({
      areaUuid: node.entityUuid,
      hallName: node.hallName,
      leadName: node.leadName,
      x: minX - PADDING,
      y: minY - PADDING - HEADER_HEIGHT,
      width: maxX - minX + PADDING * 2,
      height: maxY - minY + PADDING * 1.6 + HEADER_HEIGHT * 2,
    });
  }

  return bounds;
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
