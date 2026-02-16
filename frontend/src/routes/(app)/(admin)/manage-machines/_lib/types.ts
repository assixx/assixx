// =============================================================================
// MANAGE MACHINES - TYPE DEFINITIONS
// =============================================================================

/**
 * Team info for list display (embedded in Machine for badge display)
 */
export interface MachineTeamInfo {
  id: number;
  name: string;
}

/**
 * Machine entity with all properties
 */
export interface Machine {
  id: number;
  uuid: string;
  name: string;
  model?: string;
  manufacturer?: string;
  serialNumber?: string;
  assetNumber?: string;
  departmentId?: number;
  departmentName?: string;
  areaId?: number;
  areaName?: string;
  location?: string;
  machineType?: MachineType;
  status: MachineStatus;
  purchaseDate?: string;
  installationDate?: string;
  warrantyUntil?: string;
  lastMaintenance?: string;
  nextMaintenance?: string;
  operatingHours?: number;
  productionCapacity?: string;
  energyConsumption?: string;
  manualUrl?: string;
  qrCode?: string;
  notes?: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
  // Teams assigned to this machine (for list display with badges)
  teams?: MachineTeamInfo[];
  // Availability info (next relevant entry from machine_availability table)
  availabilityStatus?: string;
  availabilityStart?: string;
  availabilityEnd?: string;
  availabilityNotes?: string;
}

/**
 * Machine type options
 */
export type MachineType =
  | 'production'
  | 'packaging'
  | 'quality_control'
  | 'logistics'
  | 'utility'
  | 'other';

/**
 * Machine status options
 */
export type MachineStatus =
  | 'operational'
  | 'maintenance'
  | 'repair'
  | 'standby'
  | 'decommissioned';

/**
 * Department entity
 */
export interface Department {
  id: number;
  name: string;
  description?: string;
  areaId?: number;
}

/**
 * Area entity
 */
export interface Area {
  id: number;
  name: string;
  description?: string;
  type?: string;
}

/**
 * Form data for machine creation/update
 */
export interface MachineFormData {
  name: string;
  model?: string;
  manufacturer?: string;
  serialNumber?: string;
  departmentId?: number;
  areaId?: number;
  machineType?: string;
  status: string;
  operatingHours?: number;
  nextMaintenance?: string;
}

/**
 * Machine status filter types
 */
export type MachineStatusFilter =
  | 'all'
  | 'operational'
  | 'maintenance'
  | 'repair'
  | 'standby'
  | 'cleaning'
  | 'other';

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  data?: T;
  success?: boolean;
}

/**
 * Team entity
 */
export interface Team {
  id: number;
  name: string;
  description?: string;
  departmentId?: number;
  departmentName?: string;
}

/**
 * Machine team assignment (from API response)
 */
export interface MachineTeam {
  id: number;
  teamId: number;
  teamName: string;
  departmentId?: number;
  departmentName?: string;
  isPrimary: boolean;
  assignedAt?: string;
  notes?: string;
}
