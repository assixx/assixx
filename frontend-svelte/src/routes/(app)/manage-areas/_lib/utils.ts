// =============================================================================
// MANAGE AREAS - UTILITY FUNCTIONS
// =============================================================================

import type {
  Area,
  AdminUser,
  Department,
  IsActiveStatus,
  AreaType,
  FormIsActiveStatus,
} from './types';
import { STATUS_BADGE_CLASSES, STATUS_LABELS, TYPE_LABELS, FORM_DEFAULTS } from './constants';

// =============================================================================
// STATUS HELPERS
// =============================================================================

/**
 * Get status badge class based on is_active value
 * @param isActive - Status value (0, 1, 3, 4)
 * @returns CSS class for badge
 */
export function getStatusBadgeClass(isActive: IsActiveStatus): string {
  return STATUS_BADGE_CLASSES[isActive] ?? 'badge--secondary';
}

/**
 * Get status label for display
 * @param isActive - Status value (0, 1, 3, 4)
 * @returns Human-readable status label
 */
export function getStatusLabel(isActive: IsActiveStatus): string {
  return STATUS_LABELS[isActive] ?? 'Unbekannt';
}

// =============================================================================
// TYPE HELPERS
// =============================================================================

/**
 * Get type label for display
 * @param type - Area type
 * @returns Human-readable type label
 */
export function getTypeLabel(type: AreaType | string): string {
  return TYPE_LABELS[type as AreaType] ?? type;
}

// =============================================================================
// SEARCH HELPERS
// =============================================================================

/**
 * Escape HTML to prevent XSS
 * @param text - Text to escape
 * @returns Escaped text
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Highlight search term in text
 * Wraps matches in <strong> tags for display
 * @param text - Text to search in
 * @param query - Search query
 * @returns HTML string with highlighted matches
 */
export function highlightMatch(text: string, query: string): string {
  if (!query.trim()) return escapeHtml(text);
  const escaped = query.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return escapeHtml(text).replace(regex, '<strong>$1</strong>');
}

// =============================================================================
// AREA LEAD HELPERS
// =============================================================================

/**
 * Get area lead display name for dropdown
 * @param areaLeadId - Selected area lead ID
 * @param areaLeads - Available area leads
 * @returns Display name string
 */
export function getAreaLeadDisplayName(areaLeadId: number | null, areaLeads: AdminUser[]): string {
  if (!areaLeadId) return 'Kein Bereichsleiter';
  const lead = areaLeads.find((u) => u.id === areaLeadId);
  if (!lead) return 'Kein Bereichsleiter';
  const roleLabel = lead.role === 'root' ? '(Root)' : '(Admin)';
  return `${lead.firstName} ${lead.lastName} ${roleLabel}`;
}

// =============================================================================
// DEPARTMENT HELPERS
// =============================================================================

/**
 * Get department IDs assigned to an area
 * @param areaId - Area ID
 * @param departments - All departments
 * @returns Array of department IDs
 */
export function getDepartmentIdsForArea(areaId: number, departments: Department[]): number[] {
  return departments.filter((d) => d.area_id === areaId).map((d) => d.id);
}

/**
 * Get department count display text
 * @param count - Number of departments
 * @returns Display text
 */
export function getDepartmentCountText(count: number): string {
  if (count === 0) return 'Keine';
  if (count === 1) return '1 Abteilung';
  return `${count} Abteilungen`;
}

// =============================================================================
// FORM HELPERS
// =============================================================================

/**
 * Populate form from area data (for edit mode)
 * @param area - Area to edit
 * @param departments - All departments
 * @returns Form data object
 */
export function populateFormFromArea(
  area: Area,
  departments: Department[],
): {
  name: string;
  description: string;
  areaLeadId: number | null;
  type: AreaType;
  capacity: number | null;
  address: string;
  departmentIds: number[];
  isActive: FormIsActiveStatus;
} {
  return {
    name: area.name,
    description: area.description ?? '',
    areaLeadId: area.area_lead_id ?? null,
    type: area.type,
    capacity: area.capacity ?? null,
    address: area.address ?? '',
    departmentIds: getDepartmentIdsForArea(area.id, departments),
    isActive: (area.is_active === 4 ? 0 : area.is_active) as FormIsActiveStatus,
  };
}

/**
 * Get default form values for new area
 * @returns Default form data object
 */
export function getDefaultFormValues(): typeof FORM_DEFAULTS {
  return { ...FORM_DEFAULTS };
}
