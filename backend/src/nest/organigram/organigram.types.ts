/** Die 4 festen Entity-Ebenen im Organigramm */
export type OrgEntityType = 'area' | 'department' | 'team' | 'asset';

/** Label pro Ebene — ein einziger String (Plural-Form als Standard) */
export interface HierarchyLabels {
  hall: string;
  area: string;
  areaLeadPrefix: string;
  department: string;
  departmentLeadPrefix: string;
  team: string;
  teamLeadPrefix: string;
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

/**
 * Aggregierter Node für Frontend.
 *
 * Tatsächliche DB-Hierarchie (verifiziert):
 *   Area → Departments (area_id), Assets (area_id)
 *   Department → Teams (department_id), Assets (department_id)
 *   Team → (Blattknoten, hat member_count)
 *   Asset → (Blattknoten, KEIN team_id in DB!)
 */
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

/** Gespeicherter Viewport-Zustand (Zoom + Pan + Font-Größe + Node-Größe) */
export interface OrgViewport {
  zoom: number;
  panX: number;
  panY: number;
  fontSize: number;
  nodeWidth?: number;
  nodeHeight?: number;
}

export const DEFAULT_VIEWPORT: OrgViewport = {
  zoom: 1,
  panX: 0,
  panY: 0,
  fontSize: 13,
};

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
  /** Maps department UUID → assigned hall UUIDs (from department_halls) */
  departmentHallMap: Record<string, string[]>;
  /** Maps team UUID → assigned hall UUIDs (from team_halls) */
  teamHallMap: Record<string, string[]>;
}

/** DB row type for org_chart_positions table */
export interface OrgChartPositionRow {
  id: number;
  uuid: string;
  tenant_id: number;
  entity_type: OrgEntityType;
  entity_uuid: string;
  position_x: string;
  position_y: string;
  width: string;
  height: string;
  is_active: number;
  created_at: Date;
  updated_at: Date;
  uuid_created_at: Date;
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

/** Aggregated detail view for a single org entity (area/department/team/asset) */
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

/** Default-Labels wenn tenants.settings.orgHierarchy nicht gesetzt */
export const DEFAULT_HIERARCHY_LABELS: HierarchyLabels = {
  hall: 'Hallen',
  area: 'Bereiche',
  areaLeadPrefix: 'Bereichs',
  department: 'Abteilungen',
  departmentLeadPrefix: 'Abteilungs',
  team: 'Teams',
  teamLeadPrefix: 'Team',
  asset: 'Anlagen',
};
