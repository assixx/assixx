/** Die 4 festen Entity-Ebenen im Organigramm */
export type OrgEntityType = 'area' | 'department' | 'team' | 'asset';

/** Label pro Ebene — ein einziger String (Plural-Form als Standard) */
export interface HierarchyLabels {
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

export interface OrgChartTree {
  companyName: string;
  address: string | null;
  hierarchyLabels: HierarchyLabels;
  nodes: OrgChartNode[];
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

/** Default-Labels wenn tenants.settings.orgHierarchy nicht gesetzt */
export const DEFAULT_HIERARCHY_LABELS: HierarchyLabels = {
  area: 'Bereiche',
  department: 'Abteilungen',
  team: 'Teams',
  asset: 'Anlagen',
};
