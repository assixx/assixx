/**
 * Organigramm — Frontend Type Definitions
 * Mirror of backend types (organigram.types.ts)
 */

export type OrgEntityType = 'area' | 'department' | 'team' | 'asset';

export interface HierarchyLabel {
  singular: string;
  plural: string;
}

export interface HierarchyLabels {
  area: HierarchyLabel;
  department: HierarchyLabel;
  team: HierarchyLabel;
  asset: HierarchyLabel;
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

export interface OrgChartTree {
  companyName: string;
  address: string | null;
  hierarchyLabels: HierarchyLabels;
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
