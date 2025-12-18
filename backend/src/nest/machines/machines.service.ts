/**
 * Machines Service (Native NestJS)
 *
 * Business logic for machine management.
 * Uses DatabaseService directly - NO Express delegation.
 */
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';

/**
 * Machine type enum
 */
type MachineType =
  | 'production'
  | 'packaging'
  | 'quality_control'
  | 'logistics'
  | 'utility'
  | 'other';

/**
 * Machine status enum
 */
type MachineStatus = 'operational' | 'maintenance' | 'repair' | 'standby' | 'decommissioned';

/**
 * Maintenance type enum
 */
type MaintenanceType =
  | 'preventive'
  | 'corrective'
  | 'inspection'
  | 'calibration'
  | 'cleaning'
  | 'other';

/**
 * Status after maintenance enum
 */
type StatusAfter = 'operational' | 'needs_repair' | 'decommissioned';

/**
 * Database row for machines table
 */
interface DbMachineRow {
  id: number;
  tenant_id: number;
  name: string;
  model: string | null;
  manufacturer: string | null;
  serial_number: string | null;
  asset_number: string | null;
  department_id: number | null;
  department_name?: string;
  area_id: number | null;
  location: string | null;
  machine_type: MachineType;
  status: MachineStatus;
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
}

/**
 * Database row for maintenance history
 */
interface DbMaintenanceRow {
  id: number;
  tenant_id: number;
  machine_id: number;
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

/**
 * Database row for statistics
 */
interface DbStatisticsRow {
  total_machines: number | string;
  operational: number | string;
  in_maintenance: number | string;
  in_repair: number | string;
  standby: number | string;
  decommissioned: number | string;
  needs_maintenance_soon: number | string;
}

/**
 * Database row for categories
 */
interface DbCategoryRow {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean | number;
}

/**
 * Machine filters
 */
export interface MachineFilters {
  status?: string;
  machine_type?: string;
  department_id?: number;
  is_active?: boolean;
  needs_maintenance?: boolean;
  search?: string;
}

/**
 * API Machine response
 */
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
  machineType: MachineType;
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
  createdAt: string;
  updatedAt: string;
  createdBy?: number;
  createdByName?: string;
  updatedBy?: number;
  updatedByName?: string;
  isActive: boolean;
}

/**
 * Maintenance history response
 */
export interface MaintenanceHistoryResponse {
  id: number;
  tenantId: number;
  machineId: number;
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

/**
 * Machine create request
 */
export interface MachineCreateRequest {
  name: string;
  model?: string;
  manufacturer?: string;
  serialNumber?: string;
  assetNumber?: string;
  departmentId?: number;
  areaId?: number;
  location?: string;
  machineType?: MachineType;
  status?: MachineStatus;
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

/**
 * Machine update request
 */
export interface MachineUpdateRequest extends Partial<MachineCreateRequest> {
  isActive?: boolean;
}

/**
 * Maintenance record request
 */
export interface MaintenanceRecordRequest {
  machineId: number;
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

/**
 * Machine statistics
 */
export interface MachineStatistics {
  totalMachines: number;
  operational: number;
  inMaintenance: number;
  inRepair: number;
  standby: number;
  decommissioned: number;
  needsMaintenanceSoon: number;
}

/**
 * Machine category
 */
export interface MachineCategory {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
}

@Injectable()
export class MachinesService {
  private readonly logger = new Logger(MachinesService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Helper: parse int or return 0
   */
  private parseIntOrZero(value: unknown): number {
    const parsed = Number.parseInt(String(value));
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Helper: parse float or return undefined
   */
  private parseFloatOrUndefined(value: unknown): number | undefined {
    const parsed = Number.parseFloat(String(value));
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  /**
   * Helper: check if string has content
   */
  private hasContent(value: string | undefined | null): value is string {
    return value !== undefined && value !== null && value !== '';
  }

  /**
   * Build optional string fields from machine row
   */
  private buildMachineStringFields(row: DbMachineRow): Partial<MachineResponse> {
    const fields: Partial<MachineResponse> = {};
    if (row.model !== null) fields.model = row.model;
    if (row.manufacturer !== null) fields.manufacturer = row.manufacturer;
    if (row.serial_number !== null) fields.serialNumber = row.serial_number;
    if (row.asset_number !== null) fields.assetNumber = row.asset_number;
    if (row.location !== null) fields.location = row.location;
    if (row.production_capacity !== null) fields.productionCapacity = row.production_capacity;
    if (row.energy_consumption !== null) fields.energyConsumption = row.energy_consumption;
    if (row.manual_url !== null) fields.manualUrl = row.manual_url;
    if (row.qr_code !== null) fields.qrCode = row.qr_code;
    if (row.notes !== null) fields.notes = row.notes;
    return fields;
  }

  /**
   * Build optional date fields from machine row
   */
  private buildMachineDateFields(row: DbMachineRow): Partial<MachineResponse> {
    const fields: Partial<MachineResponse> = {};
    if (row.purchase_date !== null) fields.purchaseDate = new Date(row.purchase_date).toISOString();
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

  /**
   * Build optional reference fields from machine row
   */
  private buildMachineReferenceFields(row: DbMachineRow): Partial<MachineResponse> {
    const fields: Partial<MachineResponse> = {};
    if (row.department_id !== null) fields.departmentId = row.department_id;
    if (row.department_name !== undefined) fields.departmentName = row.department_name;
    if (row.area_id !== null) fields.areaId = row.area_id;
    if (row.operating_hours !== null) fields.operatingHours = row.operating_hours;
    if (row.created_by !== null) fields.createdBy = row.created_by;
    if (row.created_by_name !== undefined) fields.createdByName = row.created_by_name;
    if (row.updated_by !== null) fields.updatedBy = row.updated_by;
    if (row.updated_by_name !== undefined) fields.updatedByName = row.updated_by_name;
    return fields;
  }

  /**
   * Map database row to API response
   */
  private mapDbMachineToApi(row: DbMachineRow): MachineResponse {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      machineType: row.machine_type,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      isActive: Boolean(row.is_active),
      ...this.buildMachineStringFields(row),
      ...this.buildMachineDateFields(row),
      ...this.buildMachineReferenceFields(row),
    };
  }

  /**
   * Build optional detail fields from maintenance row
   */
  private buildMaintenanceDetailFields(row: DbMaintenanceRow): Partial<MaintenanceHistoryResponse> {
    const fields: Partial<MaintenanceHistoryResponse> = {};
    if (row.performed_by !== null) fields.performedBy = row.performed_by;
    if (row.performed_by_name !== undefined) fields.performedByName = row.performed_by_name;
    if (row.external_company !== null) fields.externalCompany = row.external_company;
    if (row.description !== null) fields.description = row.description;
    if (row.parts_replaced !== null) fields.partsReplaced = row.parts_replaced;
    if (row.report_url !== null) fields.reportUrl = row.report_url;
    if (row.created_by !== null) fields.createdBy = row.created_by;
    if (row.created_by_name !== undefined) fields.createdByName = row.created_by_name;
    if (row.next_maintenance_date !== null)
      fields.nextMaintenanceDate = new Date(row.next_maintenance_date).toISOString();
    return fields;
  }

  /**
   * Build optional numeric fields from maintenance row (with parsing)
   */
  private buildMaintenanceNumericFields(
    row: DbMaintenanceRow,
  ): Partial<MaintenanceHistoryResponse> {
    const fields: Partial<MaintenanceHistoryResponse> = {};
    if (row.cost !== null) {
      const parsedCost = this.parseFloatOrUndefined(row.cost);
      if (parsedCost !== undefined) fields.cost = parsedCost;
    }
    if (row.duration_hours !== null) {
      const parsedDuration = this.parseFloatOrUndefined(row.duration_hours);
      if (parsedDuration !== undefined) fields.durationHours = parsedDuration;
    }
    return fields;
  }

  /**
   * Map maintenance row to API response
   */
  private mapMaintenanceToApi(row: DbMaintenanceRow): MaintenanceHistoryResponse {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      machineId: row.machine_id,
      maintenanceType: row.maintenance_type,
      performedDate: new Date(row.performed_date).toISOString(),
      statusAfter: row.status_after,
      createdAt: new Date(row.created_at).toISOString(),
      ...this.buildMaintenanceDetailFields(row),
      ...this.buildMaintenanceNumericFields(row),
    };
  }

  /**
   * List all machines with filters
   */
  async listMachines(tenantId: number, filters: MachineFilters = {}): Promise<MachineResponse[]> {
    this.logger.log(`Listing machines for tenant ${tenantId}`);

    let sql = `
      SELECT m.*,
             d.name as department_name,
             u1.username as created_by_name,
             u2.username as updated_by_name
      FROM machines m
      LEFT JOIN departments d ON m.department_id = d.id AND d.tenant_id = m.tenant_id
      LEFT JOIN users u1 ON m.created_by = u1.id
      LEFT JOIN users u2 ON m.updated_by = u2.id
      WHERE m.tenant_id = $1
    `;
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (this.hasContent(filters.status)) {
      sql += ` AND m.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (this.hasContent(filters.machine_type)) {
      sql += ` AND m.machine_type = $${paramIndex}`;
      params.push(filters.machine_type);
      paramIndex++;
    }

    if (filters.department_id !== undefined && filters.department_id !== 0) {
      sql += ` AND m.department_id = $${paramIndex}`;
      params.push(filters.department_id);
      paramIndex++;
    }

    if (filters.is_active !== undefined) {
      sql += ` AND m.is_active = $${paramIndex}`;
      params.push(filters.is_active);
      paramIndex++;
    }

    if (filters.needs_maintenance === true) {
      sql += ` AND (m.next_maintenance <= CURRENT_DATE + INTERVAL '30 days' OR m.status = 'maintenance')`;
    }

    if (this.hasContent(filters.search)) {
      sql += ` AND (m.name ILIKE $${paramIndex} OR m.model ILIKE $${paramIndex} OR m.manufacturer ILIKE $${paramIndex} OR m.serial_number ILIKE $${paramIndex} OR m.asset_number ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
    }

    sql += ' ORDER BY m.name ASC';

    const rows = await this.db.query<DbMachineRow>(sql, params);
    return rows.map((row: DbMachineRow) => this.mapDbMachineToApi(row));
  }

  /**
   * Get machine by ID
   */
  async getMachineById(id: number, tenantId: number): Promise<MachineResponse> {
    this.logger.log(`Getting machine ${id}`);

    const row = await this.db.queryOne<DbMachineRow>(
      `
      SELECT m.*,
             d.name as department_name
      FROM machines m
      LEFT JOIN departments d ON m.department_id = d.id AND d.tenant_id = m.tenant_id
      WHERE m.id = $1 AND m.tenant_id = $2
      `,
      [id, tenantId],
    );

    if (row === null) {
      throw new NotFoundException('Machine not found');
    }

    return this.mapDbMachineToApi(row);
  }

  /**
   * Validate serial number uniqueness
   */
  private async validateSerialNumberUnique(
    serialNumber: string | undefined,
    tenantId: number,
    excludeId?: number,
  ): Promise<void> {
    if (!this.hasContent(serialNumber)) return;

    let sql = `SELECT id FROM machines WHERE tenant_id = $1 AND serial_number = $2`;
    const params: unknown[] = [tenantId, serialNumber];

    if (excludeId !== undefined) {
      sql += ' AND id != $3';
      params.push(excludeId);
    }

    const existing = await this.db.queryOne<{ id: number }>(sql, params);
    if (existing !== null) {
      throw new BadRequestException('Serial number already exists');
    }
  }

  /**
   * Create new machine
   */
  async createMachine(
    data: MachineCreateRequest,
    tenantId: number,
    userId: number,
    _ipAddress?: string,
    _userAgent?: string,
  ): Promise<MachineResponse> {
    this.logger.log(`Creating machine: ${data.name}`);

    await this.validateSerialNumberUnique(data.serialNumber, tenantId);

    const rows = await this.db.query<{ id: number }>(
      `
      INSERT INTO machines (
        tenant_id, name, model, manufacturer, serial_number, asset_number,
        department_id, area_id, location, machine_type, status,
        purchase_date, installation_date, warranty_until,
        last_maintenance, next_maintenance, operating_hours,
        production_capacity, energy_consumption, manual_url,
        qr_code, notes, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
      RETURNING id
      `,
      [
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
        this.hasContent(data.purchaseDate) ? new Date(data.purchaseDate) : null,
        this.hasContent(data.installationDate) ? new Date(data.installationDate) : null,
        this.hasContent(data.warrantyUntil) ? new Date(data.warrantyUntil) : null,
        this.hasContent(data.lastMaintenance) ? new Date(data.lastMaintenance) : null,
        this.hasContent(data.nextMaintenance) ? new Date(data.nextMaintenance) : null,
        data.operatingHours ?? 0,
        data.productionCapacity ?? null,
        data.energyConsumption ?? null,
        data.manualUrl ?? null,
        data.qrCode ?? null,
        data.notes ?? null,
        userId,
        userId,
      ],
    );

    if (rows.length === 0 || rows[0] === undefined) {
      throw new InternalServerErrorException('Failed to create machine');
    }

    return await this.getMachineById(rows[0].id, tenantId);
  }

  /**
   * Field mappings for machine update (API field to DB column)
   */
  private readonly machineFieldMappings: [keyof MachineUpdateRequest, string][] = [
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

  /**
   * Date field mappings for machine update
   */
  private readonly machineDateFieldMappings: [keyof MachineUpdateRequest, string][] = [
    ['purchaseDate', 'purchase_date'],
    ['installationDate', 'installation_date'],
    ['warrantyUntil', 'warranty_until'],
    ['lastMaintenance', 'last_maintenance'],
    ['nextMaintenance', 'next_maintenance'],
  ];

  /**
   * Build SET clause fields for machine update
   */
  private buildMachineUpdateFields(
    data: MachineUpdateRequest,
    userId: number,
  ): { fields: string[]; params: unknown[]; paramIndex: number } {
    const fields: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    for (const [apiField, dbField] of this.machineFieldMappings) {
      // eslint-disable-next-line security/detect-object-injection -- apiField is from static readonly array, not user input
      const fieldValue = data[apiField];
      if (fieldValue !== undefined) {
        fields.push(`${dbField} = $${paramIndex++}`);
        params.push(fieldValue);
      }
    }

    for (const [apiField, dbField] of this.machineDateFieldMappings) {
      // eslint-disable-next-line security/detect-object-injection -- apiField is from static readonly array, not user input
      const value = data[apiField] as string | undefined;
      if (this.hasContent(value)) {
        fields.push(`${dbField} = $${paramIndex++}`);
        params.push(new Date(value));
      }
    }

    fields.push(`updated_by = $${paramIndex++}`);
    params.push(userId);
    fields.push('updated_at = CURRENT_TIMESTAMP');

    return { fields, params, paramIndex };
  }

  /**
   * Update machine
   */
  async updateMachine(
    id: number,
    data: MachineUpdateRequest,
    tenantId: number,
    userId: number,
    _ipAddress?: string,
    _userAgent?: string,
  ): Promise<MachineResponse> {
    this.logger.log(`Updating machine ${id}`);

    const existing = await this.getMachineById(id, tenantId);
    if (this.hasContent(data.serialNumber) && data.serialNumber !== existing.serialNumber) {
      await this.validateSerialNumberUnique(data.serialNumber, tenantId, id);
    }

    const { fields, params, paramIndex } = this.buildMachineUpdateFields(data, userId);
    params.push(id, tenantId);

    const sql = `
      UPDATE machines
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
    `;

    await this.db.query(sql, params);
    return await this.getMachineById(id, tenantId);
  }

  /**
   * Delete machine
   */
  async deleteMachine(
    id: number,
    tenantId: number,
    _userId: number,
    _ipAddress?: string,
    _userAgent?: string,
  ): Promise<void> {
    this.logger.log(`Deleting machine ${id}`);

    await this.getMachineById(id, tenantId);

    await this.db.query('DELETE FROM machines WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
  }

  /**
   * Deactivate machine
   */
  async deactivateMachine(
    id: number,
    tenantId: number,
    _userId: number,
    _ipAddress?: string,
    _userAgent?: string,
  ): Promise<void> {
    this.logger.log(`Deactivating machine ${id}`);

    await this.getMachineById(id, tenantId);

    await this.db.query(
      'UPDATE machines SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );
  }

  /**
   * Activate machine
   */
  async activateMachine(
    id: number,
    tenantId: number,
    _userId: number,
    _ipAddress?: string,
    _userAgent?: string,
  ): Promise<void> {
    this.logger.log(`Activating machine ${id}`);

    await this.getMachineById(id, tenantId);

    await this.db.query(
      'UPDATE machines SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );
  }

  /**
   * Get maintenance history
   */
  async getMaintenanceHistory(
    machineId: number,
    tenantId: number,
  ): Promise<MaintenanceHistoryResponse[]> {
    this.logger.log(`Getting maintenance history for machine ${machineId}`);

    await this.getMachineById(machineId, tenantId);

    const rows = await this.db.query<DbMaintenanceRow>(
      `
      SELECT mh.*,
             u1.username as performed_by_name,
             u2.username as created_by_name
      FROM machine_maintenance_history mh
      LEFT JOIN users u1 ON mh.performed_by = u1.id
      LEFT JOIN users u2 ON mh.created_by = u2.id
      WHERE mh.machine_id = $1 AND mh.tenant_id = $2
      ORDER BY mh.performed_date DESC
      `,
      [machineId, tenantId],
    );

    return rows.map((row: DbMaintenanceRow) => this.mapMaintenanceToApi(row));
  }

  /**
   * Update machine after maintenance record is added
   */
  private async updateMachineAfterMaintenance(
    machineId: number,
    tenantId: number,
    performedDate: string,
    nextMaintenanceDate: string | undefined,
    statusAfter: StatusAfter,
  ): Promise<void> {
    const machineStatus: MachineStatus = statusAfter === 'needs_repair' ? 'repair' : 'operational';
    const nextDate = this.hasContent(nextMaintenanceDate) ? new Date(nextMaintenanceDate) : null;

    await this.db.query(
      `UPDATE machines SET last_maintenance = $1, next_maintenance = $2, status = $3,
       updated_at = CURRENT_TIMESTAMP WHERE id = $4 AND tenant_id = $5`,
      [new Date(performedDate), nextDate, machineStatus, machineId, tenantId],
    );
  }

  /**
   * Build maintenance record insert params
   */
  private buildMaintenanceInsertParams(
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
      this.hasContent(data.nextMaintenanceDate) ? new Date(data.nextMaintenanceDate) : null,
      data.reportUrl ?? null,
      userId,
    ];
  }

  /**
   * Add maintenance record
   */
  async addMaintenanceRecord(
    data: MaintenanceRecordRequest,
    tenantId: number,
    userId: number,
    _ipAddress?: string,
    _userAgent?: string,
  ): Promise<MaintenanceHistoryResponse> {
    this.logger.log(`Adding maintenance record for machine ${data.machineId}`);
    await this.getMachineById(data.machineId, tenantId);

    const rows = await this.db.query<{ id: number }>(
      `INSERT INTO machine_maintenance_history (
        tenant_id, machine_id, maintenance_type, performed_date, performed_by,
        external_company, description, parts_replaced, cost, duration_hours,
        status_after, next_maintenance_date, report_url, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
      this.buildMaintenanceInsertParams(data, tenantId, userId),
    );

    if (rows.length === 0 || rows[0] === undefined) {
      throw new InternalServerErrorException('Failed to add maintenance record');
    }

    const recordId = rows[0].id;
    const statusAfter = data.statusAfter ?? 'operational';
    await this.updateMachineAfterMaintenance(
      data.machineId,
      tenantId,
      data.performedDate,
      data.nextMaintenanceDate,
      statusAfter,
    );

    const history = await this.getMaintenanceHistory(data.machineId, tenantId);
    const record = history.find((h: MaintenanceHistoryResponse) => h.id === recordId);
    if (record === undefined) {
      throw new NotFoundException('Maintenance record not found');
    }
    return record;
  }

  /**
   * Get upcoming maintenance
   */
  async getUpcomingMaintenance(tenantId: number, days: number = 30): Promise<MachineResponse[]> {
    this.logger.log(`Getting upcoming maintenance for tenant ${tenantId}`);

    const rows = await this.db.query<DbMachineRow>(
      `
      SELECT m.*, d.name as department_name
      FROM machines m
      LEFT JOIN departments d ON m.department_id = d.id AND d.tenant_id = m.tenant_id
      WHERE m.tenant_id = $1
        AND m.is_active = 1
        AND m.next_maintenance <= CURRENT_DATE + ($2 * INTERVAL '1 day')
        AND m.status != 'decommissioned'
      ORDER BY m.next_maintenance ASC
      `,
      [tenantId, days],
    );

    return rows.map((row: DbMachineRow) => this.mapDbMachineToApi(row));
  }

  /**
   * Get statistics
   */
  async getStatistics(tenantId: number): Promise<MachineStatistics> {
    this.logger.log(`Getting machine statistics for tenant ${tenantId}`);

    const row = await this.db.queryOne<DbStatisticsRow>(
      `
      SELECT
        COUNT(*) as total_machines,
        SUM(CASE WHEN status = 'operational' THEN 1 ELSE 0 END) as operational,
        SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as in_maintenance,
        SUM(CASE WHEN status = 'repair' THEN 1 ELSE 0 END) as in_repair,
        SUM(CASE WHEN status = 'standby' THEN 1 ELSE 0 END) as standby,
        SUM(CASE WHEN status = 'decommissioned' THEN 1 ELSE 0 END) as decommissioned,
        SUM(CASE WHEN next_maintenance <= CURRENT_DATE + INTERVAL '30 days' AND status != 'decommissioned' THEN 1 ELSE 0 END) as needs_maintenance_soon
      FROM machines
      WHERE tenant_id = $1 AND is_active = 1
      `,
      [tenantId],
    );

    if (row === null) {
      return {
        totalMachines: 0,
        operational: 0,
        inMaintenance: 0,
        inRepair: 0,
        standby: 0,
        decommissioned: 0,
        needsMaintenanceSoon: 0,
      };
    }

    return {
      totalMachines: this.parseIntOrZero(row.total_machines),
      operational: this.parseIntOrZero(row.operational),
      inMaintenance: this.parseIntOrZero(row.in_maintenance),
      inRepair: this.parseIntOrZero(row.in_repair),
      standby: this.parseIntOrZero(row.standby),
      decommissioned: this.parseIntOrZero(row.decommissioned),
      needsMaintenanceSoon: this.parseIntOrZero(row.needs_maintenance_soon),
    };
  }

  /**
   * Get machine categories
   */
  async getCategories(): Promise<MachineCategory[]> {
    this.logger.log('Getting machine categories');

    const rows = await this.db.query<DbCategoryRow>(
      `
      SELECT * FROM machine_categories
      WHERE is_active = 1
      ORDER BY sort_order ASC, name ASC
      `,
    );

    return rows.map((row: DbCategoryRow) => {
      const category: MachineCategory = {
        id: row.id,
        name: row.name,
        sortOrder: row.sort_order,
        isActive: Boolean(row.is_active),
      };

      if (row.description !== null) category.description = row.description;
      if (row.icon !== null) category.icon = row.icon;

      return category;
    });
  }
}
