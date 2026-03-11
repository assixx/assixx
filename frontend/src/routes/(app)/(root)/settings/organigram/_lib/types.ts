/**
 * Organigramm — Frontend Type Definitions
 * Mirror of backend types (organigram.types.ts)
 */

export type OrgEntityType = 'area' | 'department' | 'team' | 'asset';

/** Label pro Ebene — ein einziger String (Plural-Form als Standard) */
export interface HierarchyLabels {
  hall: string;
  area: string;
  department: string;
  team: string;
  asset: string;
}

export interface OrgChartPosition {
  uuid: string;
  entityType: OrgEntityType;
  entityUuid: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
}

export interface OrgChartNode {
  entityType: OrgEntityType;
  entityUuid: string;
  name: string;
  position: OrgChartPosition | null;
  children: OrgChartNode[];
  assets: OrgChartNode[];
  leadName?: string;
  memberCount?: number;
  /** Hallen-Name — nur bei Areas, wenn eine Halle zugewiesen ist */
  hallName?: string;
}

export interface OrgViewport {
  zoom: number;
  panX: number;
  panY: number;
  fontSize: number;
}

/** Manuelle Hallen-Bounds (Override über Auto-Compute) */
export interface HallOverride {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ResizeEdge =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export interface OrgChartTree {
  companyName: string;
  address: string | null;
  hierarchyLabels: HierarchyLabels;
  viewport: OrgViewport;
  hallOverrides: Record<string, HallOverride>;
  nodes: OrgChartNode[];
}

export interface PositionPayload {
  entityType: OrgEntityType;
  entityUuid: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
}

export interface UpdateHierarchyLabelsPayload {
  levels: Partial<HierarchyLabels>;
}

/** Flattened node with resolved position for rendering */
export interface RenderNode {
  entityType: OrgEntityType;
  entityUuid: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  leadName?: string;
  memberCount?: number;
}

/** Connection line between parent and child */
export interface Connection {
  parentKey: string;
  childKey: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Bounding box für Hallen-Container (nur Areas mit zugewiesener Halle) */
export interface HallBounds {
  areaUuid: string;
  hallName: string;
  leadName?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
