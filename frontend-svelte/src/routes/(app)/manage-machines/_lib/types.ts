// =============================================================================
// MANAGE MACHINES - TYPE DEFINITIONS
// =============================================================================

/**
 * Machine entity with all properties
 */
export interface Machine {
  id: number;
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
export type MachineStatus = 'operational' | 'maintenance' | 'repair' | 'standby' | 'decommissioned';

/**
 * Department entity
 */
export interface Department {
  id: number;
  name: string;
  description?: string;
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
export type MachineStatusFilter = 'all' | 'operational' | 'maintenance' | 'repair';

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  data?: T;
  success?: boolean;
}
