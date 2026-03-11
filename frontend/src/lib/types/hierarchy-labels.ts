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
