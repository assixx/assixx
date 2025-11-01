/**
 * Machine Management - Type Definitions
 * All interfaces and types for machine management module
 */

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
  machineType?: 'production' | 'packaging' | 'quality_control' | 'logistics' | 'utility' | 'other';
  status: 'operational' | 'maintenance' | 'repair' | 'standby' | 'decommissioned';
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
 * Window interface for global machine management functions
 */
export interface ManageMachinesWindow extends Window {
  editMachine: ((machineId: number) => Promise<void>) | null;
  deleteMachine: ((machineId: number) => Promise<void>) | null;
  viewMachineDetails: ((machineId: number) => Promise<void>) | null;
  showMachineModal: (() => void) | null;
  closeMachineModal: (() => void) | null;
}
