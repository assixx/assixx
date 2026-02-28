/**
 * Machine Helpers - Pure functions for mapping and query building
 *
 * Stateless helper functions extracted from MachinesService.
 * No DI, no DB calls, no side effects.
 */
import type {
  DbMachineRow,
  DbMaintenanceRow,
  MachineCreateRequest,
  MachineFilters,
  MachineResponse,
  MachineTeamInfo,
  MachineUpdateRequest,
  MaintenanceHistoryResponse,
  MaintenanceRecordRequest,
} from './machines.types.js';

// ============================================================================
// GENERAL HELPERS
// ============================================================================

/** Check if a string has content (not null, undefined, or empty) */
export function hasContent(value: string | undefined | null): value is string {
  return value !== undefined && value !== null && value !== '';
}

/** Build WHERE clauses from MachineFilters (pure — no DB access) */
export function buildMachineFilterClauses(
  filters: MachineFilters,
  startIndex: number,
): { clauses: string; params: unknown[]; nextIndex: number } {
  const parts: string[] = [];
  const params: unknown[] = [];
  let idx = startIndex;

  if (hasContent(filters.status)) {
    parts.push(`AND m.status = $${idx}`);
    params.push(filters.status);
    idx++;
  }
  if (hasContent(filters.machine_type)) {
    parts.push(`AND m.machine_type = $${idx}`);
    params.push(filters.machine_type);
    idx++;
  }
  if (filters.department_id !== undefined && filters.department_id !== 0) {
    parts.push(`AND m.department_id = $${idx}`);
    params.push(filters.department_id);
    idx++;
  }
  if (filters.team_id !== undefined && filters.team_id !== 0) {
    parts.push(
      `AND EXISTS (SELECT 1 FROM machine_teams mt2 WHERE mt2.machine_id = m.id AND mt2.team_id = $${idx})`,
    );
    params.push(filters.team_id);
    idx++;
  }
  if (filters.is_active !== undefined) {
    parts.push(`AND m.is_active = $${idx}`);
    params.push(filters.is_active);
    idx++;
  }
  if (filters.needs_maintenance === true) {
    parts.push(
      `AND (m.next_maintenance <= CURRENT_DATE + INTERVAL '30 days' OR m.status = 'maintenance')`,
    );
  }
  if (hasContent(filters.search)) {
    parts.push(
      `AND (m.name ILIKE $${idx} OR m.model ILIKE $${idx} OR m.manufacturer ILIKE $${idx} OR m.serial_number ILIKE $${idx} OR m.asset_number ILIKE $${idx})`,
    );
    params.push(`%${filters.search}%`);
    idx++;
  }

  return { clauses: parts.join(' '), params, nextIndex: idx };
}

/** Parse int or return 0 */
export function parseIntOrZero(value: unknown): number {
  const parsed = Number.parseInt(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Parse float or return undefined */
export function parseFloatOrUndefined(value: unknown): number | undefined {
  const parsed = Number.parseFloat(String(value));
  return Number.isNaN(parsed) ? undefined : parsed;
}

// ============================================================================
// MACHINE MAPPERS
// ============================================================================

/** Build optional string fields from machine row */
export function buildMachineStringFields(
  row: DbMachineRow,
): Partial<MachineResponse> {
  const fields: Partial<MachineResponse> = {};
  if (row.model !== null) fields.model = row.model;
  if (row.manufacturer !== null) fields.manufacturer = row.manufacturer;
  if (row.serial_number !== null) fields.serialNumber = row.serial_number;
  if (row.asset_number !== null) fields.assetNumber = row.asset_number;
  if (row.location !== null) fields.location = row.location;
  if (row.production_capacity !== null)
    fields.productionCapacity = row.production_capacity;
  if (row.energy_consumption !== null)
    fields.energyConsumption = row.energy_consumption;
  if (row.manual_url !== null) fields.manualUrl = row.manual_url;
  if (row.qr_code !== null) fields.qrCode = row.qr_code;
  if (row.notes !== null) fields.notes = row.notes;
  return fields;
}

/** Build optional date fields from machine row */
export function buildMachineDateFields(
  row: DbMachineRow,
): Partial<MachineResponse> {
  const fields: Partial<MachineResponse> = {};
  if (row.purchase_date !== null)
    fields.purchaseDate = new Date(row.purchase_date).toISOString();
  if (row.installation_date !== null)
    fields.installationDate = new Date(row.installation_date).toISOString();
  if (row.warranty_until !== null)
    fields.warrantyUntil = new Date(row.warranty_until).toISOString();
  if (row.last_maintenance !== null)
    fields.lastMaintenance = new Date(row.last_maintenance).toISOString();
  if (row.next_maintenance !== null)
    fields.nextMaintenance = new Date(row.next_maintenance).toISOString();
  return fields;
}

/** Parse teams JSON from database (string or already parsed array) */
export function parseTeamsJson(
  teams: MachineTeamInfo[] | string | undefined,
): MachineTeamInfo[] | undefined {
  if (teams === undefined) {
    return undefined;
  }
  if (typeof teams !== 'string') {
    return teams;
  }
  try {
    return JSON.parse(teams) as MachineTeamInfo[];
  } catch {
    return [];
  }
}

/** Build optional reference fields from machine row */
export function buildMachineReferenceFields(
  row: DbMachineRow,
): Partial<MachineResponse> {
  const fields: Partial<MachineResponse> = {};
  if (row.department_id !== null) fields.departmentId = row.department_id;
  if (row.department_name !== undefined)
    fields.departmentName = row.department_name;
  if (row.area_id !== null) fields.areaId = row.area_id;
  if (row.area_name !== undefined) fields.areaName = row.area_name;
  if (row.operating_hours !== null) fields.operatingHours = row.operating_hours;
  if (row.created_by !== null) fields.createdBy = row.created_by;
  if (row.created_by_name !== undefined)
    fields.createdByName = row.created_by_name;
  if (row.updated_by !== null) fields.updatedBy = row.updated_by;
  if (row.updated_by_name !== undefined)
    fields.updatedByName = row.updated_by_name;
  const parsedTeams = parseTeamsJson(row.teams);
  if (parsedTeams !== undefined) fields.teams = parsedTeams;
  return fields;
}

/** Map database row to API response */
export function mapDbMachineToApi(row: DbMachineRow): MachineResponse {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    uuid: row.uuid.trim(),
    name: row.name,
    machineType: row.machine_type,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    isActive: Boolean(row.is_active),
    // Availability defaults — overwritten by controller via addAvailabilityInfo()
    availabilityStatus: null,
    availabilityStart: null,
    availabilityEnd: null,
    availabilityNotes: null,
    ...buildMachineStringFields(row),
    ...buildMachineDateFields(row),
    ...buildMachineReferenceFields(row),
  };
}

// ============================================================================
// MAINTENANCE MAPPERS
// ============================================================================

/** Build optional detail fields from maintenance row */
export function buildMaintenanceDetailFields(
  row: DbMaintenanceRow,
): Partial<MaintenanceHistoryResponse> {
  const fields: Partial<MaintenanceHistoryResponse> = {};
  if (row.performed_by !== null) fields.performedBy = row.performed_by;
  if (row.performed_by_name !== undefined)
    fields.performedByName = row.performed_by_name;
  if (row.external_company !== null)
    fields.externalCompany = row.external_company;
  if (row.description !== null) fields.description = row.description;
  if (row.parts_replaced !== null) fields.partsReplaced = row.parts_replaced;
  if (row.report_url !== null) fields.reportUrl = row.report_url;
  if (row.created_by !== null) fields.createdBy = row.created_by;
  if (row.created_by_name !== undefined)
    fields.createdByName = row.created_by_name;
  if (row.next_maintenance_date !== null)
    fields.nextMaintenanceDate = new Date(
      row.next_maintenance_date,
    ).toISOString();
  return fields;
}

/** Build optional numeric fields from maintenance row (with parsing) */
export function buildMaintenanceNumericFields(
  row: DbMaintenanceRow,
): Partial<MaintenanceHistoryResponse> {
  const fields: Partial<MaintenanceHistoryResponse> = {};
  if (row.cost !== null) {
    const parsedCost = parseFloatOrUndefined(row.cost);
    if (parsedCost !== undefined) fields.cost = parsedCost;
  }
  if (row.duration_hours !== null) {
    const parsedDuration = parseFloatOrUndefined(row.duration_hours);
    if (parsedDuration !== undefined) fields.durationHours = parsedDuration;
  }
  return fields;
}

/** Map maintenance row to API response */
export function mapMaintenanceToApi(
  row: DbMaintenanceRow,
): MaintenanceHistoryResponse {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    machineId: row.machine_id,
    maintenanceType: row.maintenance_type,
    performedDate: new Date(row.performed_date).toISOString(),
    statusAfter: row.status_after,
    createdAt: new Date(row.created_at).toISOString(),
    ...buildMaintenanceDetailFields(row),
    ...buildMaintenanceNumericFields(row),
  };
}

// ============================================================================
// QUERY BUILDERS
// ============================================================================

/** Build INSERT parameters for machine creation */
export function buildMachineInsertParams(
  data: MachineCreateRequest,
  tenantId: number,
  userId: number,
  machineUuid: string,
): unknown[] {
  return [
    tenantId,
    data.name,
    data.model ?? null,
    data.manufacturer ?? null,
    data.serialNumber ?? null,
    data.assetNumber ?? null,
    data.departmentId ?? null,
    data.areaId ?? null,
    data.location ?? null,
    data.machineType ?? 'production',
    data.status ?? 'operational',
    hasContent(data.purchaseDate) ? new Date(data.purchaseDate) : null,
    hasContent(data.installationDate) ? new Date(data.installationDate) : null,
    hasContent(data.warrantyUntil) ? new Date(data.warrantyUntil) : null,
    hasContent(data.lastMaintenance) ? new Date(data.lastMaintenance) : null,
    hasContent(data.nextMaintenance) ? new Date(data.nextMaintenance) : null,
    data.operatingHours ?? 0,
    data.productionCapacity ?? null,
    data.energyConsumption ?? null,
    data.manualUrl ?? null,
    data.qrCode ?? null,
    data.notes ?? null,
    userId,
    userId,
    machineUuid,
  ];
}

/** Field mappings for machine update (API field to DB column) */
export const MACHINE_FIELD_MAPPINGS: [keyof MachineUpdateRequest, string][] = [
  ['name', 'name'],
  ['model', 'model'],
  ['manufacturer', 'manufacturer'],
  ['serialNumber', 'serial_number'],
  ['assetNumber', 'asset_number'],
  ['departmentId', 'department_id'],
  ['areaId', 'area_id'],
  ['location', 'location'],
  ['machineType', 'machine_type'],
  ['status', 'status'],
  ['operatingHours', 'operating_hours'],
  ['productionCapacity', 'production_capacity'],
  ['energyConsumption', 'energy_consumption'],
  ['manualUrl', 'manual_url'],
  ['qrCode', 'qr_code'],
  ['notes', 'notes'],
  ['isActive', 'is_active'],
];

/** Date field mappings for machine update */
export const MACHINE_DATE_FIELD_MAPPINGS: [
  keyof MachineUpdateRequest,
  string,
][] = [
  ['purchaseDate', 'purchase_date'],
  ['installationDate', 'installation_date'],
  ['warrantyUntil', 'warranty_until'],
  ['lastMaintenance', 'last_maintenance'],
  ['nextMaintenance', 'next_maintenance'],
];

/** Build SET clause fields for machine update */
export function buildMachineUpdateFields(
  data: MachineUpdateRequest,
  userId: number,
): { fields: string[]; params: unknown[]; paramIndex: number } {
  const fields: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  for (const [apiField, dbField] of MACHINE_FIELD_MAPPINGS) {
    const fieldValue = data[apiField];
    if (fieldValue !== undefined) {
      fields.push(`${dbField} = $${paramIndex++}`);
      params.push(fieldValue);
    }
  }

  for (const [apiField, dbField] of MACHINE_DATE_FIELD_MAPPINGS) {
    const value = data[apiField] as string | undefined;
    if (hasContent(value)) {
      fields.push(`${dbField} = $${paramIndex++}`);
      params.push(new Date(value));
    }
  }

  fields.push(`updated_by = $${paramIndex++}`);
  params.push(userId);
  fields.push('updated_at = CURRENT_TIMESTAMP');

  return { fields, params, paramIndex };
}

/** Build maintenance record INSERT params */
export function buildMaintenanceInsertParams(
  data: MaintenanceRecordRequest,
  tenantId: number,
  userId: number,
): unknown[] {
  return [
    tenantId,
    data.machineId,
    data.maintenanceType,
    new Date(data.performedDate),
    data.performedBy ?? userId,
    data.externalCompany ?? null,
    data.description ?? null,
    data.partsReplaced ?? null,
    data.cost ?? null,
    data.durationHours ?? null,
    data.statusAfter ?? 'operational',
    hasContent(data.nextMaintenanceDate) ?
      new Date(data.nextMaintenanceDate)
    : null,
    data.reportUrl ?? null,
    userId,
  ];
}
