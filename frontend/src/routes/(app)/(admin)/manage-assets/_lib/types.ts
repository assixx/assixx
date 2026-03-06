// =============================================================================
// MANAGE MACHINES - TYPE DEFINITIONS
// =============================================================================

/**
 * Team info for list display (embedded in Asset for badge display)
 */
export interface AssetTeamInfo {
  id: number;
  name: string;
}

/**
 * Asset entity with all properties
 */
export interface Asset {
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
  assetType?: AssetType;
  status: AssetStatus;
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
  // Teams assigned to this asset (for list display with badges)
  teams?: AssetTeamInfo[];
  // Availability info (next relevant entry from asset_availability table)
  availabilityStatus?: string;
  availabilityStart?: string;
  availabilityEnd?: string;
  availabilityNotes?: string;
}

/**
 * Asset type options
 */
export type AssetType =
  | 'production'
  | 'packaging'
  | 'quality_control'
  | 'logistics'
  | 'utility'
  | 'other';

/**
 * Asset status options
 */
export type AssetStatus =
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
 * Form data for asset creation/update
 */
export interface AssetFormData {
  name: string;
  model?: string;
  manufacturer?: string;
  serialNumber?: string;
  departmentId?: number;
  areaId?: number;
  assetType?: string;
  status: string;
  operatingHours?: number;
  nextMaintenance?: string;
}

/**
 * Asset status filter types
 */
export type AssetStatusFilter =
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
 * Asset team assignment (from API response)
 */
export interface AssetTeam {
  id: number;
  teamId: number;
  teamName: string;
  departmentId?: number;
  departmentName?: string;
  isPrimary: boolean;
  assignedAt?: string;
  notes?: string;
}
