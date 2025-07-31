// Machine Types for API v2

export interface MachineFilters {
  status?: string;
  machine_type?: string;
  department_id?: number;
  is_active?: boolean;
  needs_maintenance?: boolean;
  search?: string;
}

export interface MachineResponse {
  id: number;
  tenantId: number;
  name: string;
  model?: string;
  manufacturer?: string;
  serialNumber?: string;
  assetNumber?: string;
  departmentId?: number;
  departmentName?: string;
  areaId?: number;
  location?: string;
  machineType:
    | "production"
    | "packaging"
    | "quality_control"
    | "logistics"
    | "utility"
    | "other";
  status:
    | "operational"
    | "maintenance"
    | "repair"
    | "standby"
    | "decommissioned";
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
}

export interface MaintenanceHistoryResponse {
  id: number;
  tenantId: number;
  machineId: number;
  maintenanceType:
    | "preventive"
    | "corrective"
    | "inspection"
    | "calibration"
    | "cleaning"
    | "other";
  performedDate: string;
  performedBy?: number;
  performedByName?: string;
  externalCompany?: string;
  description?: string;
  partsReplaced?: string;
  cost?: number;
  durationHours?: number;
  statusAfter: "operational" | "needs_repair" | "decommissioned";
  nextMaintenanceDate?: string;
  reportUrl?: string;
  createdAt: string;
  createdBy?: number;
  createdByName?: string;
}

export interface MachineCreateRequest {
  name: string;
  model?: string;
  manufacturer?: string;
  serialNumber?: string;
  assetNumber?: string;
  departmentId?: number;
  areaId?: number;
  location?: string;
  machineType?:
    | "production"
    | "packaging"
    | "quality_control"
    | "logistics"
    | "utility"
    | "other";
  status?:
    | "operational"
    | "maintenance"
    | "repair"
    | "standby"
    | "decommissioned";
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

export interface MachineUpdateRequest extends Partial<MachineCreateRequest> {
  isActive?: boolean;
}

export interface MaintenanceRecordRequest {
  machineId: number;
  maintenanceType:
    | "preventive"
    | "corrective"
    | "inspection"
    | "calibration"
    | "cleaning"
    | "other";
  performedDate: string;
  performedBy?: number;
  externalCompany?: string;
  description?: string;
  partsReplaced?: string;
  cost?: number;
  durationHours?: number;
  statusAfter?: "operational" | "needs_repair" | "decommissioned";
  nextMaintenanceDate?: string;
  reportUrl?: string;
}

export interface MachineStatistics {
  totalMachines: number;
  operational: number;
  inMaintenance: number;
  inRepair: number;
  standby: number;
  decommissioned: number;
  needsMaintenanceSoon: number;
}

export interface MachineCategory {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
}
