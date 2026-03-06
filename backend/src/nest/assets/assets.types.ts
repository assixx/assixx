/**
 * Asset Types - Database and API interfaces
 *
 * Separated from service for cleaner code organization and ESLint max-lines compliance.
 */

// ============================================================================
// ENUMS / TYPE ALIASES
// ============================================================================

/** Asset type enum */
export type AssetType =
  | 'production'
  | 'packaging'
  | 'quality_control'
  | 'logistics'
  | 'utility'
  | 'other';

/** Asset status enum */
export type AssetStatus =
  | 'operational'
  | 'maintenance'
  | 'repair'
  | 'standby'
  | 'decommissioned';

/** Maintenance type enum */
export type MaintenanceType =
  | 'preventive'
  | 'corrective'
  | 'inspection'
  | 'calibration'
  | 'cleaning'
  | 'other';

/** Status after maintenance enum */
export type StatusAfter = 'operational' | 'needs_repair' | 'decommissioned';

// ============================================================================
// DATABASE TYPES (internal — used by sub-services and helpers)
// ============================================================================

/** Team info for list display (embedded in asset response) */
export interface AssetTeamInfo {
  id: number;
  name: string;
}

/** Database row for assets table */
export interface DbAssetRow {
  id: number;
  tenant_id: number;
  uuid: string;
  name: string;
  model: string | null;
  manufacturer: string | null;
  serial_number: string | null;
  asset_number: string | null;
  department_id: number | null;
  department_name?: string;
  area_id: number | null;
  area_name?: string;
  location: string | null;
  asset_type: AssetType;
  status: AssetStatus;
  purchase_date: Date | null;
  installation_date: Date | null;
  warranty_until: Date | null;
  last_maintenance: Date | null;
  next_maintenance: Date | null;
  operating_hours: number | null;
  production_capacity: string | null;
  energy_consumption: string | null;
  manual_url: string | null;
  qr_code: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  created_by: number | null;
  created_by_name?: string;
  updated_by: number | null;
  updated_by_name?: string;
  is_active: boolean | number;
  // Teams as JSON array from subquery
  teams?: AssetTeamInfo[] | string;
}

/** Database row for maintenance history */
export interface DbMaintenanceRow {
  id: number;
  tenant_id: number;
  asset_id: number;
  maintenance_type: MaintenanceType;
  performed_date: Date;
  performed_by: number | null;
  performed_by_name?: string;
  external_company: string | null;
  description: string | null;
  parts_replaced: string | null;
  cost: number | string | null;
  duration_hours: number | string | null;
  status_after: StatusAfter;
  next_maintenance_date: Date | null;
  report_url: string | null;
  created_at: Date;
  created_by: number | null;
  created_by_name?: string;
}

/** Database row for statistics */
export interface DbStatisticsRow {
  total_assets: number | string;
  operational: number | string;
  in_maintenance: number | string;
  in_repair: number | string;
  standby: number | string;
  decommissioned: number | string;
  needs_maintenance_soon: number | string;
}

/** Database row for categories */
export interface DbCategoryRow {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean | number;
}

/** Database row for asset_teams join */
export interface DbAssetTeamRow {
  id: number;
  team_id: number;
  team_name: string;
  department_id: number | null;
  department_name: string | null;
  is_primary: boolean;
  assigned_at: Date | null;
  notes: string | null;
}

// ============================================================================
// API TYPES (exported for controller use)
// ============================================================================

/** Asset filters */
export interface AssetFilters {
  status?: string;
  asset_type?: string;
  department_id?: number;
  team_id?: number;
  is_active?: boolean;
  needs_maintenance?: boolean;
  search?: string;
}

/** API Asset response */
export interface AssetResponse {
  id: number;
  tenantId: number;
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
  assetType: AssetType;
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
  createdAt: string;
  updatedAt: string;
  createdBy?: number;
  createdByName?: string;
  updatedBy?: number;
  updatedByName?: string;
  isActive: boolean;
  // Teams assigned to this asset (for list display)
  teams?: AssetTeamInfo[];
  // Availability info (next relevant entry from asset_availability table)
  availabilityStatus: string | null;
  availabilityStart: string | null;
  availabilityEnd: string | null;
  availabilityNotes: string | null;
}

/** Maintenance history response */
export interface MaintenanceHistoryResponse {
  id: number;
  tenantId: number;
  assetId: number;
  maintenanceType: MaintenanceType;
  performedDate: string;
  performedBy?: number;
  performedByName?: string;
  externalCompany?: string;
  description?: string;
  partsReplaced?: string;
  cost?: number;
  durationHours?: number;
  statusAfter: StatusAfter;
  nextMaintenanceDate?: string;
  reportUrl?: string;
  createdAt: string;
  createdBy?: number;
  createdByName?: string;
}

/** Asset create request */
export interface AssetCreateRequest {
  name: string;
  model?: string;
  manufacturer?: string;
  serialNumber?: string;
  assetNumber?: string;
  departmentId?: number;
  areaId?: number;
  location?: string;
  assetType?: AssetType;
  status?: AssetStatus;
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
}

/** Asset update request */
export interface AssetUpdateRequest extends Partial<AssetCreateRequest> {
  isActive?: boolean;
}

/** Maintenance record request */
export interface MaintenanceRecordRequest {
  assetId: number;
  maintenanceType: MaintenanceType;
  performedDate: string;
  performedBy?: number;
  externalCompany?: string;
  description?: string;
  partsReplaced?: string;
  cost?: number;
  durationHours?: number;
  statusAfter?: StatusAfter;
  nextMaintenanceDate?: string;
  reportUrl?: string;
}

/** Asset statistics */
export interface AssetStatistics {
  totalAssets: number;
  operational: number;
  inMaintenance: number;
  inRepair: number;
  standby: number;
  decommissioned: number;
  needsMaintenanceSoon: number;
}

/** Asset category */
export interface AssetCategory {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
}

/** Asset team assignment response */
export interface AssetTeamResponse {
  id: number;
  teamId: number;
  teamName: string;
  departmentId?: number;
  departmentName?: string;
  isPrimary: boolean;
  assignedAt?: string;
  notes?: string;
}
