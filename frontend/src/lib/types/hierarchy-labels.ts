/** Hierarchy label for each organizational level (plural form) + position prefixes */
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

/** Default German labels — used as fallback when API is unavailable */
export const DEFAULT_HIERARCHY_LABELS: HierarchyLabels = {
  hall: 'Hallen',
  area: 'Bereiche',
  areaLeadPrefix: 'Bereichs',
  department: 'Abteilungen',
  departmentLeadPrefix: 'Abteilungs',
  team: 'Teams',
  teamLeadPrefix: 'Team',
  asset: 'Anlagen',
} as const;

// =============================================================================
// LEAD POSITION KEYS (ADR-034 — dynamic compound words)
// =============================================================================

/** Semantic keys for lead/deputy positions — stored in DB, resolved to display names via hierarchy labels */
export const LEAD_POSITION_KEYS = {
  AREA: 'area_lead',
  AREA_DEPUTY: 'area_deputy_lead',
  DEPARTMENT: 'department_lead',
  DEPARTMENT_DEPUTY: 'department_deputy_lead',
  TEAM: 'team_lead',
  TEAM_DEPUTY: 'team_deputy_lead',
} as const;

export type LeadPositionKey = (typeof LEAD_POSITION_KEYS)[keyof typeof LEAD_POSITION_KEYS];

/** Position option with role category — used in form modal dropdowns */
export interface PositionOption {
  name: string;
  roleCategory: string;
}

/** Maps each lead position key to its role category */
export const LEAD_POSITION_CATEGORY: Record<LeadPositionKey, string> = {
  [LEAD_POSITION_KEYS.AREA]: 'admin',
  [LEAD_POSITION_KEYS.AREA_DEPUTY]: 'admin',
  [LEAD_POSITION_KEYS.DEPARTMENT]: 'admin',
  [LEAD_POSITION_KEYS.DEPARTMENT_DEPUTY]: 'admin',
  [LEAD_POSITION_KEYS.TEAM]: 'employee',
  [LEAD_POSITION_KEYS.TEAM_DEPUTY]: 'employee',
} as const;

/** Role category display labels */
export const ROLE_CATEGORY_LABELS: Record<string, string> = {
  employee: 'Mitarbeiter',
  admin: 'Admin',
  root: 'Root',
};

/** Check if a position string is a system lead/deputy position key */
export function isLeadPosition(position: string): position is LeadPositionKey {
  return (Object.values(LEAD_POSITION_KEYS) as string[]).includes(position);
}

/** Resolve a position to its display name — lead keys become `${prefix}leiter`, deputy keys become `Stellv. ${prefix}leiter`, others pass through */
export function resolvePositionDisplay(position: string, labels: HierarchyLabels): string {
  switch (position) {
    case LEAD_POSITION_KEYS.AREA:
      return `${labels.areaLeadPrefix}leiter`;
    case LEAD_POSITION_KEYS.AREA_DEPUTY:
      return `Stellv. ${labels.areaLeadPrefix}leiter`;
    case LEAD_POSITION_KEYS.DEPARTMENT:
      return `${labels.departmentLeadPrefix}leiter`;
    case LEAD_POSITION_KEYS.DEPARTMENT_DEPUTY:
      return `Stellv. ${labels.departmentLeadPrefix}leiter`;
    case LEAD_POSITION_KEYS.TEAM:
      return `${labels.teamLeadPrefix}leiter`;
    case LEAD_POSITION_KEYS.TEAM_DEPUTY:
      return `Stellv. ${labels.teamLeadPrefix}leiter`;
    default:
      return position;
  }
}
