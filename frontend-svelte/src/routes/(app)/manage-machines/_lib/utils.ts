// =============================================================================
// MANAGE MACHINES - UTILITY FUNCTIONS
// =============================================================================

import type { Machine, MachineFormData, MachineStatus, MachineStatusFilter } from './types';
import { STATUS_BADGE_CLASSES, STATUS_LABELS, MACHINE_TYPE_LABELS, MESSAGES } from './constants';

// =============================================================================
// STATUS HELPERS
// =============================================================================

/**
 * Get CSS class for status badge
 */
export function getStatusBadgeClass(status: MachineStatus): string {
  return STATUS_BADGE_CLASSES[status] ?? 'badge--error';
}

/**
 * Get localized status label
 */
export function getStatusLabel(status: MachineStatus): string {
  return STATUS_LABELS[status] ?? status;
}

// =============================================================================
// MACHINE TYPE HELPERS
// =============================================================================

/**
 * Get display name for machine type
 */
export function getMachineTypeLabel(type: string): string {
  return MACHINE_TYPE_LABELS[type] ?? type;
}

// =============================================================================
// MAINTENANCE HELPERS
// =============================================================================

/**
 * Get maintenance warning status
 * @returns 'overdue' | 'soon' | 'ok' | null
 */
export function getMaintenanceWarningStatus(
  nextMaintenance?: string,
): 'overdue' | 'soon' | 'ok' | null {
  if (nextMaintenance === undefined || nextMaintenance === '') return null;

  const maintenanceDate = new Date(nextMaintenance);
  const today = new Date();
  const daysUntil = Math.floor(
    (maintenanceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysUntil < 0) {
    return 'overdue';
  } else if (daysUntil <= 7) {
    return 'soon';
  }
  return 'ok';
}

/**
 * Format date for German locale display
 */
export function formatDateDE(dateString?: string): string {
  if (dateString === undefined || dateString === '') return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE');
}

/**
 * Format operating hours for display
 */
export function formatOperatingHours(hours?: number): string {
  if (hours === undefined || hours <= 0) return '-';
  return `${hours}h`;
}

// =============================================================================
// EMPTY STATE HELPERS
// =============================================================================

/**
 * Get empty state title based on filter
 */
export function getEmptyStateTitle(statusFilter: MachineStatusFilter): string {
  switch (statusFilter) {
    case 'operational':
      return MESSAGES.EMPTY_OPERATIONAL;
    case 'maintenance':
      return MESSAGES.EMPTY_MAINTENANCE;
    case 'repair':
      return MESSAGES.EMPTY_REPAIR;
    default:
      return MESSAGES.EMPTY_TITLE;
  }
}

/**
 * Get empty state description based on filter
 */
export function getEmptyStateDescription(statusFilter: MachineStatusFilter): string {
  if (statusFilter !== 'all') {
    return MESSAGES.EMPTY_FILTER_DESC;
  }
  return MESSAGES.EMPTY_DESCRIPTION;
}

// =============================================================================
// SEARCH HELPERS
// =============================================================================

/**
 * Highlight search term in text with <strong> tags
 * @param text - Text to highlight in
 * @param query - Search query to highlight
 * @returns HTML string with highlighted matches
 */
export function highlightMatch(text: string, query: string): string {
  if (!query || !query.trim()) return text;
  const escaped = query.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return text.replace(regex, '<strong>$1</strong>');
}

// =============================================================================
// FORM DATA BUILDER
// =============================================================================

export interface FormState {
  name: string;
  model: string;
  manufacturer: string;
  serialNumber: string;
  departmentId: number | null;
  areaId: number | null;
  machineType: string;
  status: MachineStatus;
  operatingHours: number | null;
  nextMaintenance: string;
}

/**
 * Build MachineFormData from form state
 */
export function buildMachineFormData(form: FormState): MachineFormData {
  const data: MachineFormData = {
    name: form.name,
    status: form.status,
  };

  // Add optional fields only if they have values
  if (form.model) data.model = form.model;
  if (form.manufacturer) data.manufacturer = form.manufacturer;
  if (form.serialNumber) data.serialNumber = form.serialNumber;
  if (form.departmentId !== null) data.departmentId = form.departmentId;
  if (form.areaId !== null) data.areaId = form.areaId;
  if (form.machineType) data.machineType = form.machineType;
  if (form.operatingHours !== null) data.operatingHours = form.operatingHours;

  // Convert date to ISO format if provided
  if (form.nextMaintenance) {
    data.nextMaintenance = new Date(form.nextMaintenance).toISOString();
  }

  return data;
}

/**
 * Populate form state from existing machine
 */
export function populateFormFromMachine(machine: Machine): FormState {
  return {
    name: machine.name,
    model: machine.model ?? '',
    manufacturer: machine.manufacturer ?? '',
    serialNumber: machine.serialNumber ?? '',
    departmentId: machine.departmentId ?? null,
    areaId: machine.areaId ?? null,
    machineType: machine.machineType ?? '',
    status: machine.status,
    operatingHours: machine.operatingHours ?? null,
    nextMaintenance: machine.nextMaintenance
      ? (new Date(machine.nextMaintenance).toISOString().split('T')[0] ?? '')
      : '',
  };
}
