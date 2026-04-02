/* eslint-disable max-lines -- Multi-hall ghost system adds necessary complexity, refactor planned */
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
  PerimeterAnchor,
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
    areaLeadPrefix: 'Bereichs',
    department: 'Abteilungen',
    departmentLeadPrefix: 'Abteilungs',
    team: 'Teams',
    teamLeadPrefix: 'Team',
    asset: 'Anlagen',
  },
  viewport: { zoom: 1, panX: 0, panY: 0, fontSize: 13 },
  hallOverrides: {},
  hallConnectionAnchors: {},
  canvasBg: null,
  nodes: [],
  halls: [],
  departmentHallMap: {},
  teamHallMap: {},
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
let hallConnectionAnchors = $state<Record<string, PerimeterAnchor>>({});
let canvasBg = $state<string | null>(null);
let nodeWidth: number = $state(LAYOUT.NODE_WIDTH);
let nodeHeight: number = $state(LAYOUT.NODE_HEIGHT);

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
  locked = true;
  hoveredNodeKey = '';
  ghostEntries = [];

  // 1. Restore node dimensions BEFORE auto-layout (ghost nodes need correct sizes)
  nodeWidth = data.viewport.nodeWidth ?? LAYOUT.NODE_WIDTH;
  nodeHeight = data.viewport.nodeHeight ?? LAYOUT.NODE_HEIGHT;

  // 2. Compute auto-layout for ALL nodes (populates ghostEntries for multi-hall depts)
  const autoPositions = computeAutoLayout(data.nodes);

  // 3. Override with saved positions (skip multi-hall areas — auto-layout is authoritative)
  const multiHallAreas = getMultiHallAreaUuids();
  overlaySavedPositions(data.nodes, autoPositions, multiHallAreas);

  nodePositions = autoPositions;

  // 4. Restore saved viewport
  zoom = data.viewport.zoom;
  panX = data.viewport.panX;
  panY = data.viewport.panY;
  fontSize = data.viewport.fontSize;

  // 5. Restore hall overrides (clear stale overrides for multi-hall areas)
  hallOverrides = clearMultiHallOverrides(data.hallOverrides);
  hallConnectionAnchors = data.hallConnectionAnchors;

  // 6. Restore canvas background
  canvasBg = data.canvasBg;
}

/** Remove stale hall overrides for halls belonging to multi-hall areas */
function clearMultiHallOverrides(
  overrides: Record<string, HallOverride>,
): Record<string, HallOverride> {
  const multiHallUuids = new Set<string>();
  const areaHallCounts = new Map<string, number>();
  for (const hall of tree.halls) {
    if (hall.areaUuid !== null) {
      areaHallCounts.set(hall.areaUuid, (areaHallCounts.get(hall.areaUuid) ?? 0) + 1);
    }
  }
  for (const hall of tree.halls) {
    if (hall.areaUuid !== null && (areaHallCounts.get(hall.areaUuid) ?? 0) > 1) {
      multiHallUuids.add(hall.uuid);
    }
  }

  const cleaned: Record<string, HallOverride> = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (!multiHallUuids.has(key)) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/** UUIDs of areas that span multiple halls — skip saved positions for these */
function getMultiHallAreaUuids(): Set<string> {
  const areaHallCounts = new Map<string, number>();
  for (const hall of tree.halls) {
    if (hall.areaUuid !== null) {
      areaHallCounts.set(hall.areaUuid, (areaHallCounts.get(hall.areaUuid) ?? 0) + 1);
    }
  }
  const result = new Set<string>();
  for (const [uuid, count] of areaHallCounts) {
    if (count > 1) result.add(uuid);
  }
  return result;
}

function overlaySavedPositions(
  nodes: OrgChartNode[],
  target: Record<string, NodePosition>,
  skipAreaUuids: Set<string>,
): void {
  for (const node of nodes) {
    // Skip saved positions for multi-hall areas (auto-layout is authoritative)
    const isMultiHallArea = node.entityType === 'area' && skipAreaUuids.has(node.entityUuid);
    const isChildOfMultiHallArea = isNodeUnderMultiHallArea(node, skipAreaUuids);

    if (node.position !== null && !isMultiHallArea && !isChildOfMultiHallArea) {
      const key = makeKey(node.entityType, node.entityUuid);
      target[key] = {
        x: node.position.positionX,
        y: node.position.positionY,
        width: node.position.width,
        height: node.position.height,
      };
    }
    overlaySavedPositions(node.children, target, skipAreaUuids);
    overlaySavedPositions(node.assets, target, skipAreaUuids);
  }
}

/** Check if a node is a descendant of a multi-hall area */
function isNodeUnderMultiHallArea(node: OrgChartNode, skipAreaUuids: Set<string>): boolean {
  if (node.entityType === 'area') return false;

  for (const topNode of tree.nodes) {
    if (topNode.entityType !== 'area') continue;
    if (!skipAreaUuids.has(topNode.entityUuid)) continue;
    if (isDescendantOf(topNode, node.entityUuid)) return true;
  }
  return false;
}

/** Check if targetUuid is a descendant of parentNode */
function isDescendantOf(parentNode: OrgChartNode, targetUuid: string): boolean {
  for (const child of [...parentNode.children, ...parentNode.assets]) {
    if (child.entityUuid === targetUuid) return true;
    if (isDescendantOf(child, targetUuid)) return true;
  }
  return false;
}

// --- Auto-Layout (Top-Down Tree) ---

/** Shared mutable context for auto-layout computation */
interface LayoutCtx {
  result: Record<string, NodePosition>;
  nextLeafX: number;
  /** Optional suffix appended to position keys (for ghost copies in secondary halls) */
  keySuffix: string;
}

/** Ghost copy: a department rendered in an additional hall */
interface GhostEntry {
  suffix: string;
  node: OrgChartNode;
}

/** Ghost copies for departments appearing in multiple halls */
let ghostEntries: GhostEntry[] = [];

/** Get hall UUIDs assigned to an area */
function getAreaHallUuids(areaUuid: string): string[] {
  return tree.halls
    .filter((h: OrgTreeHall) => h.areaUuid === areaUuid)
    .map((h: OrgTreeHall) => h.uuid);
}

/** Get explicit hall assignments for a department (empty = all halls) */
function getDeptHallAssignments(deptUuid: string): string[] {
  return tree.departmentHallMap[deptUuid] ?? [];
}

/** Get explicit hall assignments for a team (empty = all halls) */
function getTeamHallAssignments(teamUuid: string): string[] {
  return tree.teamHallMap[teamUuid] ?? [];
}

/** Check if a team belongs to a specific hall (empty assignments = all halls) */
function isTeamInHall(teamUuid: string, hallUuid: string): boolean {
  const assigned = getTeamHallAssignments(teamUuid);
  return assigned.length === 0 || assigned.includes(hallUuid);
}

/** Filter a department's team children to only those assigned to a specific hall */
function filterDeptChildrenByHall(dept: OrgChartNode, hallUuid: string): OrgChartNode {
  if (dept.entityType !== 'department') return dept;
  return {
    ...dept,
    children: dept.children.filter((child: OrgChartNode) => {
      if (child.entityType !== 'team') return true;
      return isTeamInHall(child.entityUuid, hallUuid);
    }),
  };
}

/** Build a position key with optional suffix for ghost copies */
function makeCtxKey(ctx: LayoutCtx, entityType: OrgEntityType, entityUuid: string): PositionKey {
  return `${entityType}:${entityUuid}${ctx.keySuffix}` as PositionKey;
}

/** Place a single node at the next leaf position */
function placeLeafNode(
  ctx: LayoutCtx,
  key: PositionKey,
  y: number,
): { left: number; right: number } {
  const x = ctx.nextLeafX;
  ctx.nextLeafX += nodeWidth + LAYOUT.HORIZONTAL_GAP;
  ctx.result[key] = { x, y, width: nodeWidth, height: nodeHeight };
  return { left: x, right: x + nodeWidth };
}

/** Recursively layout a single node and its children */
function layoutNode(
  ctx: LayoutCtx,
  node: OrgChartNode,
  depth: number,
): { left: number; right: number } {
  const pad = LAYOUT.CANVAS_PADDING;
  const y = pad + LAYOUT.AREA_HEADER_HEIGHT + depth * (nodeHeight + LAYOUT.VERTICAL_GAP);
  const key = makeCtxKey(ctx, node.entityType, node.entityUuid);
  const allChildren = [...node.children, ...node.assets];

  if (allChildren.length === 0) return placeLeafNode(ctx, key, y);

  let groupLeft = Infinity;
  let groupRight = -Infinity;
  for (const child of allChildren) {
    const bounds = layoutNode(ctx, child, depth + 1);
    groupLeft = Math.min(groupLeft, bounds.left);
    groupRight = Math.max(groupRight, bounds.right);
  }

  const x = (groupLeft + groupRight) / 2 - nodeWidth / 2;
  ctx.result[key] = { x, y, width: nodeWidth, height: nodeHeight };
  return {
    left: Math.min(x, groupLeft),
    right: Math.max(x + nodeWidth, groupRight),
  };
}

/** Group area children by their hall assignment (departments can appear in multiple groups) */
function groupChildrenByHall(
  children: OrgChartNode[],
  hallUuids: string[],
): Map<string, OrgChartNode[]> {
  const groups = new Map<string, OrgChartNode[]>(hallUuids.map((id: string) => [id, []]));
  const primaryHall = hallUuids[0] ?? '';

  for (const child of children) {
    const targetHalls = findTargetHalls(child, hallUuids, primaryHall);
    for (const hallUuid of targetHalls) {
      groups.get(hallUuid)?.push(child);
    }
  }
  return groups;
}

/** Determine which halls a child node belongs to */
function findTargetHalls(child: OrgChartNode, hallUuids: string[], primaryHall: string): string[] {
  if (child.entityType !== 'department') return [primaryHall];

  const assigned = getDeptHallAssignments(child.entityUuid);
  if (assigned.length === 0) return [primaryHall];

  const matches = hallUuids.filter((h: string) => assigned.includes(h));
  return matches.length > 0 ? matches : [primaryHall];
}

/** Layout a list of nodes at depth 1, returning min/max extents */
function layoutNodesAtDepth1(
  ctx: LayoutCtx,
  nodes: OrgChartNode[],
): { left: number; right: number } {
  let left = Infinity;
  let right = -Infinity;
  for (const node of nodes) {
    const bounds = layoutNode(ctx, node, 1);
    left = Math.min(left, bounds.left);
    right = Math.max(right, bounds.right);
  }
  return { left, right };
}

/** Layout a single hall group (primary or ghost) */
function layoutSingleHallGroup(
  ctx: LayoutCtx,
  hallUuid: string,
  depts: OrgChartNode[],
  isPrimary: boolean,
  areaNode: OrgChartNode,
): { left: number; right: number } {
  const suffix = `#${hallUuid}`;
  ctx.keySuffix = isPrimary ? '' : suffix;

  // Filter team children by hall assignment (teams not in this hall are excluded)
  const filteredDepts = depts.map((dept: OrgChartNode) => filterDeptChildrenByHall(dept, hallUuid));

  if (!isPrimary) {
    // Register area ghost for the secondary hall
    ghostEntries.push({ suffix, node: areaNode });
    for (const dept of filteredDepts) {
      registerGhostSubtree(dept, suffix);
    }
  }

  const deptExtents = layoutNodesAtDepth1(ctx, filteredDepts);

  // Position area ghost centered above departments in secondary halls
  if (!isPrimary && deptExtents.left !== Infinity) {
    const areaX = (deptExtents.left + deptExtents.right) / 2 - nodeWidth / 2;
    const areaY = LAYOUT.CANVAS_PADDING + LAYOUT.AREA_HEADER_HEIGHT;
    const areaKey = makeCtxKey(ctx, 'area', areaNode.entityUuid);
    ctx.result[areaKey] = {
      x: areaX,
      y: areaY,
      width: nodeWidth,
      height: nodeHeight,
    };
  }

  return deptExtents;
}

/** Layout departments of each hall group, return area extents */
function layoutHallGroups(
  ctx: LayoutCtx,
  groups: Map<string, OrgChartNode[]>,
  assets: OrgChartNode[],
  areaNode: OrgChartNode,
): { primaryLeft: number; primaryRight: number } {
  let primaryLeft = Infinity;
  let primaryRight = -Infinity;
  let hasPrimary = false;

  for (const [hallUuid, depts] of groups) {
    // Empty hall before any primary is chosen: skip, don't consume the primary slot
    if (depts.length === 0 && !hasPrimary) continue;

    if (hasPrimary) ctx.nextLeafX += LAYOUT.HORIZONTAL_GAP * 2;

    // Secondary hall with no departments: create standalone ghost area node
    if (depts.length === 0) {
      const suffix = `#${hallUuid}`;
      ctx.keySuffix = suffix;
      ghostEntries.push({ suffix, node: areaNode });
      const areaKey = makeCtxKey(ctx, 'area', areaNode.entityUuid);
      ctx.result[areaKey] = {
        x: ctx.nextLeafX,
        y: LAYOUT.CANVAS_PADDING + LAYOUT.AREA_HEADER_HEIGHT,
        width: nodeWidth,
        height: nodeHeight,
      };
      ctx.nextLeafX += nodeWidth + LAYOUT.HORIZONTAL_GAP;
      ctx.keySuffix = '';
      continue;
    }

    const isPrimary = !hasPrimary;
    const extents = layoutSingleHallGroup(ctx, hallUuid, depts, isPrimary, areaNode);

    if (isPrimary) {
      primaryLeft = extents.left;
      primaryRight = extents.right;
      hasPrimary = true;
    }
  }

  ctx.keySuffix = '';
  const assetExtents = layoutNodesAtDepth1(ctx, assets);
  primaryLeft = Math.min(primaryLeft, assetExtents.left);
  primaryRight = Math.max(primaryRight, assetExtents.right);

  return { primaryLeft, primaryRight };
}

/** Register a department and all its descendants as ghost entries */
function registerGhostSubtree(node: OrgChartNode, suffix: string): void {
  ghostEntries.push({ suffix, node });
  for (const child of [...node.children, ...node.assets]) {
    registerGhostSubtree(child, suffix);
  }
}

/** Layout an area whose departments span multiple halls */
function layoutAreaMultiHall(ctx: LayoutCtx, areaNode: OrgChartNode, hallUuids: string[]): void {
  const areaY = LAYOUT.CANVAS_PADDING + LAYOUT.AREA_HEADER_HEIGHT;
  const groups = groupChildrenByHall(areaNode.children, hallUuids);
  const { primaryLeft, primaryRight } = layoutHallGroups(ctx, groups, areaNode.assets, areaNode);

  const x =
    primaryLeft === Infinity ? ctx.nextLeafX : (primaryLeft + primaryRight) / 2 - nodeWidth / 2;

  if (primaryLeft === Infinity) {
    ctx.nextLeafX += nodeWidth + LAYOUT.HORIZONTAL_GAP;
  }

  ctx.result[makeKey('area', areaNode.entityUuid)] = {
    x,
    y: areaY,
    width: nodeWidth,
    height: nodeHeight,
  };
}

function computeAutoLayout(nodes: OrgChartNode[]): Record<string, NodePosition> {
  ghostEntries = [];
  const ctx: LayoutCtx = {
    result: {},
    nextLeafX: LAYOUT.CANVAS_PADDING,
    keySuffix: '',
  };

  for (const node of nodes) {
    if (node.entityType === 'area') {
      const hallUuids = getAreaHallUuids(node.entityUuid);
      if (hallUuids.length > 1) {
        layoutAreaMultiHall(ctx, node, hallUuids);
        ctx.nextLeafX += LAYOUT.HORIZONTAL_GAP;
        continue;
      }
    }
    layoutNode(ctx, node, 0);
    ctx.nextLeafX += LAYOUT.HORIZONTAL_GAP;
  }

  return ctx.result;
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
  moveNodeByKey(makeKey(entityType, entityUuid), newX, newY);
}

/** Move a node by its render key (supports ghost keys with #hallUuid suffix) */
export function moveNodeByKey(renderKey: string, newX: number, newY: number): void {
  const key = renderKey as PositionKey;
  const oldPos = nodePositions[key];
  nodePositions[key] = {
    x: newX,
    y: newY,
    width: oldPos.width,
    height: oldPos.height,
  };
  dirty = true;
}

/** Move all ghost nodes belonging to a specific hall by delta */
export function moveGhostNodesByHall(hallUuid: string, dx: number, dy: number): void {
  const suffix = `#${hallUuid}`;
  for (const key of Object.keys(nodePositions)) {
    if (key.includes(suffix)) {
      const pos = nodePositions[key as PositionKey];
      nodePositions[key as PositionKey] = {
        x: pos.x + dx,
        y: pos.y + dy,
        width: pos.width,
        height: pos.height,
      };
    }
  }
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

function findDescendantKeys(entityType: OrgEntityType, entityUuid: string): PositionKey[] {
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
  const newZoom = Math.max(LAYOUT.MIN_ZOOM, Math.min(LAYOUT.MAX_ZOOM, zoom + delta));
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
  hallConnectionAnchors = {};
  dirty = true;
}

/** Alles auf Werkseinstellungen: Positionen, Viewport, Größen, Farbe */
export function resetToDefaults(): void {
  nodeWidth = LAYOUT.NODE_WIDTH;
  nodeHeight = LAYOUT.NODE_HEIGHT;
  const autoPositions = computeAutoLayout(tree.nodes);
  nodePositions = autoPositions;
  hallOverrides = {};
  hallConnectionAnchors = {};
  zoom = 1;
  panX = 0;
  panY = 0;
  fontSize = 13;
  canvasBg = null;
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

export function getHallConnectionAnchors(): Record<string, PerimeterAnchor> {
  return hallConnectionAnchors;
}

export function setHallConnectionAnchor(key: string, anchor: PerimeterAnchor): void {
  hallConnectionAnchors[key] = anchor;
  dirty = true;
}

export function getHallConnectionAnchorsForSave(): Record<string, PerimeterAnchor> {
  return { ...hallConnectionAnchors };
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
  return Object.entries(nodePositions)
    .filter(([key]) => !key.includes('#'))
    .map(([key, pos]) => {
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
      if (!(key in nodePositions)) continue;
      const pos = nodePositions[key];
      result.push({
        renderKey: key,
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

  // Emit ghost copies (departments in secondary halls)
  for (const ghost of ghostEntries) {
    const ghostKey =
      `${ghost.node.entityType}:${ghost.node.entityUuid}${ghost.suffix}` as PositionKey;
    if (!(ghostKey in nodePositions)) continue;
    const pos = nodePositions[ghostKey];
    result.push({
      renderKey: ghostKey,
      entityType: ghost.node.entityType,
      entityUuid: ghost.node.entityUuid,
      name: ghost.node.name,
      x: pos.x,
      y: pos.y,
      width: pos.width,
      height: pos.height,
      leadName: ghost.node.leadName,
      memberCount: ghost.node.memberCount,
      isGhost: true,
    });
  }

  return result;
}

/** Create connection from parent to child using given positions */
function addConnection(
  connections: Connection[],
  parentKey: string,
  childKey: string,
  parentPos: NodePosition,
  childPos: NodePosition,
): void {
  connections.push({
    parentKey,
    childKey,
    x1: parentPos.x + parentPos.width / 2,
    y1: parentPos.y + parentPos.height,
    x2: childPos.x + childPos.width / 2,
    y2: childPos.y,
  });
}

/** Get connection lines between parent and child nodes */
export function getConnections(): Connection[] {
  const connections: Connection[] = [];

  function walk(nodes: OrgChartNode[]): void {
    for (const node of nodes) {
      const parentKey = makeKey(node.entityType, node.entityUuid);
      if (!(parentKey in nodePositions)) continue;
      const parentPos = nodePositions[parentKey];

      for (const child of [...node.children, ...node.assets]) {
        const childKey = makeKey(child.entityType, child.entityUuid);
        if (!(childKey in nodePositions)) continue;
        const childPos = nodePositions[childKey];
        addConnection(connections, parentKey, childKey, parentPos, childPos);
      }

      walk(node.children);
      walk(node.assets);
    }
  }

  walk(tree.nodes);

  // Ghost connections (secondary hall copies)
  for (const ghost of ghostEntries) {
    const suffix = ghost.suffix;
    const ghostKey = `${ghost.node.entityType}:${ghost.node.entityUuid}${suffix}` as PositionKey;
    if (!(ghostKey in nodePositions)) continue;
    const ghostPos = nodePositions[ghostKey];

    for (const child of [...ghost.node.children, ...ghost.node.assets]) {
      const childGhostKey = `${child.entityType}:${child.entityUuid}${suffix}` as PositionKey;
      if (!(childGhostKey in nodePositions)) continue;
      addConnection(connections, ghostKey, childGhostKey, ghostPos, nodePositions[childGhostKey]);
    }
  }

  return connections;
}

/** Check if a department belongs to a specific hall (empty assignments = all halls) */
function isDepartmentInHall(deptUuid: string, hallUuid: string): boolean {
  const assigned = getDeptHallAssignments(deptUuid);
  return assigned.length === 0 || assigned.includes(hallUuid);
}

/** Collect rects for area children assigned to a specific hall */
function collectHallFilteredRects(areaNode: OrgChartNode, hallUuid: string): NodePosition[] {
  const rects: NodePosition[] = [];
  const suffix = `#${hallUuid}`;

  for (const child of areaNode.children) {
    if (child.entityType === 'department' && !isDepartmentInHall(child.entityUuid, hallUuid)) {
      continue;
    }
    // Filter team children by hall assignment before collecting rects
    const filtered = filterDeptChildrenByHall(child, hallUuid);
    collectRectsWithSuffix(filtered, suffix, rects);
  }

  for (const asset of areaNode.assets) {
    const key = makeKey(asset.entityType, asset.entityUuid);
    rects.push(nodePositions[key]);
  }

  return rects;
}

/** Collect rects using ghost-suffixed keys, falling back to normal keys */
function collectRectsWithSuffix(node: OrgChartNode, suffix: string, rects: NodePosition[]): void {
  const ghostKey = `${node.entityType}:${node.entityUuid}${suffix}` as PositionKey;
  const normalKey = makeKey(node.entityType, node.entityUuid);
  const pos = nodePositions[ghostKey] ?? nodePositions[normalKey];
  rects.push(pos);

  for (const child of [...node.children, ...node.assets]) {
    collectRectsWithSuffix(child, suffix, rects);
  }
}

/** Auto-computed content bounds für eine assigned Halle */
function computeAssignedHallBounds(hall: OrgTreeHall, areaNode: OrgChartNode): HallBounds {
  const PADDING = 24;
  const HEADER_HEIGHT = 32;

  const rects = collectHallFilteredRects(areaNode, hall.uuid);

  // Include area node position (primary uses normal key, secondary uses ghost key)
  const areaSuffix = isHallPrimary(hall.uuid) ? '' : `#${hall.uuid}`;
  const areaKey = `area:${areaNode.entityUuid}${areaSuffix}` as PositionKey;
  if (areaKey in nodePositions) {
    rects.push(nodePositions[areaKey]);
  } else if (isHallPrimary(hall.uuid)) {
    rects.push(nodePositions[makeKey('area', areaNode.entityUuid)]);
  }

  if (rects.length === 0) {
    return computeEmptySecondaryBounds(hall);
  }

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

/** Default bounds for a secondary hall with no assigned departments */
function computeEmptySecondaryBounds(hall: OrgTreeHall): HallBounds {
  const override = hallOverrides[hall.uuid] as HallOverride | undefined;
  return {
    id: hall.uuid,
    hallName: hall.name,
    areaUuid: hall.areaUuid,
    x: override?.x ?? computeContentBottomX(),
    y: override?.y ?? LAYOUT.CANVAS_PADDING,
    width: override?.width ?? 200,
    height: override?.height ?? 120,
  };
}

/** X-Position rechts neben allen Knoten */
function computeContentBottomX(): number {
  let maxX = 0;
  for (const pos of Object.values(nodePositions)) {
    maxX = Math.max(maxX, pos.x + pos.width);
  }
  return maxX + 80;
}

/** Merge auto-bounds mit manuellem Override (user drag/resize) */
function mergeWithOverride(auto: HallBounds): HallBounds {
  if (!(auto.id in hallOverrides)) return auto;
  const override = hallOverrides[auto.id];

  const x = Math.min(auto.x, override.x);
  const y = Math.min(auto.y, override.y);
  const maxX = Math.max(auto.x + auto.width, override.x + override.width);
  const maxY = Math.max(auto.y + auto.height, override.y + override.height);

  return { ...auto, x, y, width: maxX - x, height: maxY - y };
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

  let unassignedIdx = 0;
  for (const hall of tree.halls) {
    if (hall.areaUuid !== null) {
      const areaNode = areaMap.get(hall.areaUuid);
      if (areaNode !== undefined) {
        bounds.push(mergeWithOverride(computeAssignedHallBounds(hall, areaNode)));
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
  const PADDING = 0;
  const defaultW = nodeWidth + PADDING * 2;
  const defaultH = nodeHeight + PADDING * 2;
  const GAP = 40;
  const override = hallOverrides[hall.uuid] as HallOverride | undefined;

  return {
    id: hall.uuid,
    hallName: hall.name,
    areaUuid: hall.areaUuid,
    x: override?.x ?? LAYOUT.CANVAS_PADDING + index * (defaultW + GAP),
    y: override?.y ?? computeContentBottomY() + 90,
    width: override?.width ?? defaultW,
    height: override?.height ?? defaultH,
  };
}

/** Ist diese Halle die primäre (erste) für ihre Area? */
export function isHallPrimary(hallId: string): boolean {
  const hall = tree.halls.find((h: OrgTreeHall) => h.uuid === hallId);
  return (
    hall?.areaUuid !== undefined &&
    hall.areaUuid !== null &&
    tree.halls.find((h: OrgTreeHall) => h.areaUuid === hall.areaUuid)?.uuid === hallId
  );
}
