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
}

export interface OrgViewport {
  zoom: number;
  panX: number;
  panY: number;
  fontSize: number;
  nodeWidth?: number;
  nodeHeight?: number;
}

/** Manuelle Hallen-Bounds (Override über Auto-Compute) */
export interface HallOverride {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Seite eines Rechtecks für Ankerpunkte */
export type AnchorSide = 'top' | 'right' | 'bottom' | 'left';

/** Ankerpunkt auf dem Rand einer Halle — side + t (0–1 entlang der Kante) */
export interface PerimeterAnchor {
  side: AnchorSide;
  t: number;
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

/** Halle im Organigramm (mit oder ohne Area-Zuweisung) */
export interface OrgTreeHall {
  uuid: string;
  name: string;
  areaUuid: string | null;
}

export interface OrgChartTree {
  companyName: string;
  address: string | null;
  hierarchyLabels: HierarchyLabels;
  viewport: OrgViewport;
  hallOverrides: Record<string, HallOverride>;
  hallConnectionAnchors: Record<string, PerimeterAnchor>;
  canvasBg: string | null;
  nodes: OrgChartNode[];
  halls: OrgTreeHall[];
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

// ---- Node Detail Types ----

export interface OrgNodeDetailPerson {
  name: string;
  uuid: string;
}

export interface OrgNodeDetailEntry {
  uuid: string;
  name: string;
  extra?: string;
}

export interface OrgNodeDetail {
  entityType: OrgEntityType;
  entityUuid: string;
  name: string;
  areaType?: string;
  assetStatus?: string;
  assetType?: string;
  lead?: OrgNodeDetailPerson;
  deputyLead?: OrgNodeDetailPerson;
  parentArea?: OrgNodeDetailEntry;
  parentDepartment?: OrgNodeDetailEntry;
  halls?: OrgNodeDetailEntry[];
  departments?: OrgNodeDetailEntry[];
  teams?: OrgNodeDetailEntry[];
  members?: OrgNodeDetailEntry[];
  employees?: OrgNodeDetailEntry[];
  assets?: OrgNodeDetailEntry[];
  assignedTeams?: OrgNodeDetailEntry[];
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

/** Bounding box für Hallen-Container — id ist immer hall UUID */
export interface HallBounds {
  id: string;
  hallName: string;
  areaUuid: string | null;
  leadName?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
