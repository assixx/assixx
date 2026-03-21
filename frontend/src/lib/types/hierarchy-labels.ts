/** Hierarchy label for each organizational level (plural form) */
export interface HierarchyLabels {
  hall: string;
  area: string;
  department: string;
  team: string;
  asset: string;
}

/** Default German labels — used as fallback when API is unavailable */
export const DEFAULT_HIERARCHY_LABELS: HierarchyLabels = {
  hall: 'Hallen',
  area: 'Bereiche',
  department: 'Abteilungen',
  team: 'Teams',
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

/** Check if a position string is a system lead/deputy position key */
export function isLeadPosition(position: string): position is LeadPositionKey {
  return (Object.values(LEAD_POSITION_KEYS) as string[]).includes(position);
}

/** Resolve a position to its display name — lead keys become `${label}-Leiter`, deputy keys become `${label} Stellvertreter`, others pass through */
export function resolvePositionDisplay(position: string, labels: HierarchyLabels): string {
  switch (position) {
    case LEAD_POSITION_KEYS.AREA:
      return `${labels.area}-Leiter`;
    case LEAD_POSITION_KEYS.AREA_DEPUTY:
      return `${labels.area} Stellvertreter`;
    case LEAD_POSITION_KEYS.DEPARTMENT:
      return `${labels.department}-Leiter`;
    case LEAD_POSITION_KEYS.DEPARTMENT_DEPUTY:
      return `${labels.department} Stellvertreter`;
    case LEAD_POSITION_KEYS.TEAM:
      return `${labels.team}-Leiter`;
    case LEAD_POSITION_KEYS.TEAM_DEPUTY:
      return `${labels.team} Stellvertreter`;
    default:
      return position;
  }
}
