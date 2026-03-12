/** Die 4 festen Entity-Ebenen im Organigramm */
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

/** Gespeicherter Viewport-Zustand (Zoom + Pan + Font-Größe) */
export interface OrgViewport {
  zoom: number;
  panX: number;
  panY: number;
  fontSize: number;
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
  nodes: OrgChartNode[];
  halls: OrgTreeHall[];
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
  hall: 'Hallen',
  area: 'Bereiche',
  department: 'Abteilungen',
  team: 'Teams',
  asset: 'Anlagen',
};

/** Kategorien für Position-Optionen — mapped auf users_role (ohne dummy) */
export type PositionCategory = 'employee' | 'admin' | 'root';

/** Position-Optionen pro Kategorie */
export interface PositionOptions {
  employee: string[];
  admin: string[];
  root: string[];
}

/** Default-Positionen wenn tenants.settings.positionOptions nicht gesetzt */
export const DEFAULT_POSITION_OPTIONS: PositionOptions = {
  employee: [
    'Produktionsmitarbeiter',
    'Anlagenbediener',
    'Lagerarbeiter',
    'Qualitätsprüfer',
    'Schichtleiter',
    'team_lead',
    'Wartungstechniker',
    'Sonstiges',
  ],
  admin: [
    'area_lead',
    'department_lead',
    'Personalleiter',
    'Geschäftsführer',
    'Werksleiter',
    'Produktionsleiter',
    'Qualitätsleiter',
    'IT-Leiter',
    'Vertriebsleiter',
    'Mitarbeiter',
  ],
  root: [
    'CEO',
    'CTO',
    'CFO',
    'Geschäftsführer',
    'IT-Administrator',
    'Systemadministrator',
  ],
};
