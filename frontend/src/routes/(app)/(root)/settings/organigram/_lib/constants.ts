/**
 * Organigramm — Constants
 * Default labels, entity colors, layout dimensions
 */
import type { HierarchyLabels, OrgEntityType } from './types.js';

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

interface EntityColor {
  bg: string;
  border: string;
  text: string;
  icon: string;
}

/** Hall color — not an OrgEntityType, used only in hierarchy labels modal */
export const HALL_COLOR: EntityColor = {
  bg: 'rgba(139, 92, 246, 0.25)',
  border: '#8b5cf6',
  text: '#8b5cf6',
  icon: 'fas fa-warehouse',
};

export const ENTITY_COLORS: Record<OrgEntityType, EntityColor> = {
  area: {
    bg: 'rgba(59, 130, 246, 0.35)',
    border: '#3b82f6',
    text: '#3b82f6',
    icon: 'fas fa-building',
  },
  department: {
    bg: 'rgba(34, 197, 94, 0.35)',
    border: '#22c55e',
    text: '#22c55e',
    icon: 'fas fa-layer-group',
  },
  team: {
    bg: 'rgba(245, 158, 11, 0.35)',
    border: '#f59e0b',
    text: '#f59e0b',
    icon: 'fas fa-users',
  },
  asset: {
    bg: 'rgba(6, 182, 212, 0.35)',
    border: '#06b6d4',
    text: '#06b6d4',
    icon: 'fas fa-cog',
  },
};

export const LAYOUT = {
  NODE_WIDTH: 200,
  NODE_HEIGHT: 80,
  HORIZONTAL_GAP: 40,
  VERTICAL_GAP: 100,
  /** Abstand vom Canvas-Rand zur ersten Node */
  CANVAS_PADDING: 60,
  /** Höhe des Hallen-Headers über dem Area-Node */
  AREA_HEADER_HEIGHT: 40,
  MIN_ZOOM: 0.05,
  MAX_ZOOM: 3,
  ZOOM_STEP: 0.05,
  GRID_SIZE: 20,
} as const;
