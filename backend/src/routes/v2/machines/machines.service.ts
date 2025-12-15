import { ServiceError } from '../../../utils/ServiceError.js';
import rootLog from '../logs/logs.service.js';
import machineModel, { Machine, MachineMaintenanceHistory } from './machine.model.js';
import {
  MachineCategory,
  MachineCreateRequest,
  MachineFilters,
  MachineResponse,
  MachineStatistics,
  MachineUpdateRequest,
  MaintenanceHistoryResponse,
  MaintenanceRecordRequest,
} from './types.js';

/**
 * Data structure for creating a new machine
 * Uses explicit undefined to satisfy exactOptionalPropertyTypes
 */
interface MachineCreateData {
  tenant_id: number;
  name: string;
  model: string | undefined;
  manufacturer: string | undefined;
  serial_number: string | undefined;
  asset_number: string | undefined;
  department_id: number | undefined;
  area_id: number | undefined;
  location: string | undefined;
  machine_type: Machine['machine_type'];
  status: Machine['status'];
  purchase_date: Date | undefined;
  installation_date: Date | undefined;
  warranty_until: Date | undefined;
  last_maintenance: Date | undefined;
  next_maintenance: Date | undefined;
  operating_hours: number | undefined;
  production_capacity: string | undefined;
  energy_consumption: string | undefined;
  manual_url: string | undefined;
  qr_code: string | undefined;
  notes: string | undefined;
  created_by: number;
  updated_by: number;
}

/**
 * Parse a value as integer, returning 0 for NaN
 */
function parseIntOrZero(value: unknown): number {
  const parsed = Number.parseInt(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Parse a value as float, returning undefined for NaN
 */
function parseFloatOrUndefined(value: unknown): number | undefined {
  const parsed = Number.parseFloat(String(value));
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Check if string has content (not undefined and not empty)
 */
function hasContent(value: string | undefined): value is string {
  return value !== undefined && value !== '';
}

/**
 *
 */
class MachinesService {
  // List all machines with filters
  /**
   *
   * @param tenantId - The tenant ID
   * @param filters - The filter criteria
   */
  async listMachines(tenantId: number, filters: MachineFilters = {}): Promise<MachineResponse[]> {
    const machines = await machineModel.findAll(tenantId, filters);
    return machines.map((machine: Machine) => this.formatMachineResponse(machine));
  }

  // Get machine by ID
  /**
   *
   * @param id - The resource ID
   * @param tenantId - The tenant ID
   */
  async getMachineById(id: number, tenantId: number): Promise<MachineResponse> {
    const machine = await machineModel.findById(id, tenantId);
    if (!machine) {
      throw new ServiceError('NOT_FOUND', 'Machine not found');
    }
    return this.formatMachineResponse(machine);
  }

  /**
   * Validate serial number is unique for tenant
   */
  private async validateSerialNumberUnique(
    serialNumber: string | undefined,
    tenantId: number,
    excludeId?: number,
  ): Promise<void> {
    if (!hasContent(serialNumber)) return;

    const existingMachines = await machineModel.findAll(tenantId, { search: serialNumber });
    const duplicate = existingMachines.find(
      (m: Machine) => m.serial_number === serialNumber && m.id !== excludeId,
    );
    if (duplicate !== undefined) {
      throw new ServiceError('VALIDATION_ERROR', 'Serial number already exists', {
        field: 'serialNumber',
        message: 'Serial number already exists',
      });
    }
  }

  /**
   * Build DB data object from API create request
   */
  private buildCreateDbData(
    data: MachineCreateRequest,
    tenantId: number,
    userId: number,
  ): MachineCreateData {
    return {
      tenant_id: tenantId,
      name: data.name,
      model: data.model,
      manufacturer: data.manufacturer,
      serial_number: data.serialNumber,
      asset_number: data.assetNumber,
      department_id: data.departmentId,
      area_id: data.areaId,
      location: data.location,
      machine_type: data.machineType ?? 'production',
      status: data.status ?? 'operational',
      purchase_date: hasContent(data.purchaseDate) ? new Date(data.purchaseDate) : undefined,
      installation_date:
        hasContent(data.installationDate) ? new Date(data.installationDate) : undefined,
      warranty_until: hasContent(data.warrantyUntil) ? new Date(data.warrantyUntil) : undefined,
      last_maintenance:
        hasContent(data.lastMaintenance) ? new Date(data.lastMaintenance) : undefined,
      next_maintenance:
        hasContent(data.nextMaintenance) ? new Date(data.nextMaintenance) : undefined,
      operating_hours: data.operatingHours,
      production_capacity: data.productionCapacity,
      energy_consumption: data.energyConsumption,
      manual_url: data.manualUrl,
      qr_code: data.qrCode,
      notes: data.notes,
      created_by: userId,
      updated_by: userId,
    };
  }

  // Create new machine
  /**
   * @param data - The data object
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param ipAddress - The ipAddress parameter
   * @param userAgent - The userAgent parameter
   */
  async createMachine(
    data: MachineCreateRequest,
    tenantId: number,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<MachineResponse> {
    await this.validateSerialNumberUnique(data.serialNumber, tenantId);
    const dbData = this.buildCreateDbData(data, tenantId, userId);
    const machineId = await machineModel.create(dbData as Partial<Machine>);

    await rootLog.create({
      tenant_id: tenantId,
      user_id: userId,
      action: 'create_machine',
      entity_type: 'machine',
      entity_id: machineId,
      new_values: data as unknown as Record<string, unknown>,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    return await this.getMachineById(machineId, tenantId);
  }

  /**
   * Helper to convert date string to Date object or undefined
   * @param dateString - The date string to convert
   */
  private convertToDate(dateString: string | undefined): Date | undefined {
    return hasContent(dateString) ? new Date(dateString) : undefined;
  }

  /**
   * Map simple fields from API to DB format
   * @param data - The machine update data
   * @param dbData - The DB data object to populate
   */
  private mapSimpleFields(data: MachineUpdateRequest, dbData: Partial<Machine>): void {
    const fieldMappings: [keyof MachineUpdateRequest, keyof Machine][] = [
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

    for (const [apiField, dbField] of fieldMappings) {
      // Safe: apiField comes from hardcoded fieldMappings array, not user input
      // eslint-disable-next-line security/detect-object-injection
      if (Object.prototype.hasOwnProperty.call(data, apiField) && data[apiField] !== undefined) {
        // Safe: apiField and dbField from hardcoded array, data[apiField] validated above
        // eslint-disable-next-line security/detect-object-injection
        Object.assign(dbData, { [dbField]: data[apiField] });
      }
    }
  }

  /**
   * Assign date field if source value has content
   */
  private assignDateField(
    dbData: Partial<Machine>,
    fieldName: keyof Machine,
    sourceValue: string | undefined,
  ): void {
    if (sourceValue === undefined) return;
    const converted = this.convertToDate(sourceValue);
    if (converted === undefined) return;
    Object.assign(dbData, { [fieldName]: converted });
  }

  /**
   * Map date fields from API to DB format
   * @param data - The machine update data
   * @param dbData - The DB data object to populate
   */
  private mapDateFields(data: MachineUpdateRequest, dbData: Partial<Machine>): void {
    this.assignDateField(dbData, 'purchase_date', data.purchaseDate);
    this.assignDateField(dbData, 'installation_date', data.installationDate);
    this.assignDateField(dbData, 'warranty_until', data.warrantyUntil);
    this.assignDateField(dbData, 'last_maintenance', data.lastMaintenance);
    this.assignDateField(dbData, 'next_maintenance', data.nextMaintenance);
  }

  /**
   * Convert API fields to DB fields for update
   * @param data - The machine update data
   * @param userId - The user ID for updated_by field
   */
  private convertUpdateFieldsToDb(data: MachineUpdateRequest, userId: number): Partial<Machine> {
    const dbData: Partial<Machine> = {};

    this.mapSimpleFields(data, dbData);
    this.mapDateFields(data, dbData);

    dbData.updated_by = userId;
    return dbData;
  }

  // Update machine
  /**
   *
   * @param id - The resource ID
   * @param data - The data object
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param ipAddress - The ipAddress parameter
   * @param userAgent - The userAgent parameter
   */
  async updateMachine(
    id: number,
    data: MachineUpdateRequest,
    tenantId: number,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<MachineResponse> {
    const existingMachine = await this.getMachineById(id, tenantId);

    // Validate serial number uniqueness if changed
    if (hasContent(data.serialNumber) && data.serialNumber !== existingMachine.serialNumber) {
      await this.validateSerialNumberUnique(data.serialNumber, tenantId, id);
    }

    const dbData = this.convertUpdateFieldsToDb(data, userId);

    const success = await machineModel.update(id, tenantId, dbData);
    if (!success) {
      throw new ServiceError('UPDATE_FAILED', 'Failed to update machine', 500);
    }

    // Log the action
    await rootLog.create({
      tenant_id: tenantId,
      user_id: userId,
      action: 'update_machine',
      entity_type: 'machine',
      entity_id: id,
      old_values: existingMachine as unknown as Record<string, unknown>,
      new_values: data as unknown as Record<string, unknown>,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    return await this.getMachineById(id, tenantId);
  }

  // Delete machine (hard delete)
  /**
   *
   * @param id - The resource ID
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param ipAddress - The ipAddress parameter
   * @param userAgent - The userAgent parameter
   */
  async deleteMachine(
    id: number,
    tenantId: number,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const machine = await this.getMachineById(id, tenantId);

    const success = await machineModel.delete(id, tenantId);
    if (!success) {
      throw new ServiceError('DELETE_FAILED', 'Failed to delete machine', 500);
    }

    // Log the action
    await rootLog.create({
      tenant_id: tenantId,
      user_id: userId,
      action: 'delete_machine',
      entity_type: 'machine',
      entity_id: id,
      old_values: machine as unknown as Record<string, unknown>,
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  }

  // Deactivate machine
  /**
   *
   * @param id - The resource ID
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param ipAddress - The ipAddress parameter
   * @param userAgent - The userAgent parameter
   */
  async deactivateMachine(
    id: number,
    tenantId: number,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    // Verify machine exists
    await this.getMachineById(id, tenantId);

    const success = await machineModel.deactivate(id, tenantId);
    if (!success) {
      throw new ServiceError('UPDATE_FAILED', 'Failed to deactivate machine', 500);
    }

    // Log the action
    await rootLog.create({
      tenant_id: tenantId,
      user_id: userId,
      action: 'deactivate_machine',
      entity_type: 'machine',
      entity_id: id,
      old_values: { is_active: true },
      new_values: { is_active: false },
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  }

  // Activate machine
  /**
   *
   * @param id - The resource ID
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param ipAddress - The ipAddress parameter
   * @param userAgent - The userAgent parameter
   */
  async activateMachine(
    id: number,
    tenantId: number,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    // Verify machine exists
    await this.getMachineById(id, tenantId);

    const success = await machineModel.activate(id, tenantId);
    if (!success) {
      throw new ServiceError('UPDATE_FAILED', 'Failed to activate machine', 500);
    }

    // Log the action
    await rootLog.create({
      tenant_id: tenantId,
      user_id: userId,
      action: 'activate_machine',
      entity_type: 'machine',
      entity_id: id,
      old_values: { is_active: false },
      new_values: { is_active: true },
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  }

  // Get maintenance history
  /**
   *
   * @param machineId - The machineId parameter
   * @param tenantId - The tenant ID
   */
  async getMaintenanceHistory(
    machineId: number,
    tenantId: number,
  ): Promise<MaintenanceHistoryResponse[]> {
    // Verify machine exists and belongs to tenant
    await this.getMachineById(machineId, tenantId);

    const history = await machineModel.getMaintenanceHistory(machineId, tenantId);
    return history.map((record: MachineMaintenanceHistory) =>
      this.formatMaintenanceResponse(record),
    );
  }

  // Add maintenance record
  /**
   *
   * @param data - The data object
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param ipAddress - The ipAddress parameter
   * @param userAgent - The userAgent parameter
   */
  async addMaintenanceRecord(
    data: MaintenanceRecordRequest,
    tenantId: number,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<MaintenanceHistoryResponse> {
    // Verify machine exists and belongs to tenant
    await this.getMachineById(data.machineId, tenantId);

    // Convert API fields to DB fields
    const dbData = {
      tenant_id: tenantId,
      machine_id: data.machineId,
      maintenance_type: data.maintenanceType,
      performed_date: new Date(data.performedDate),
      performed_by: data.performedBy ?? userId,
      external_company: data.externalCompany,
      description: data.description,
      parts_replaced: data.partsReplaced,
      cost: data.cost,
      duration_hours: data.durationHours,
      status_after: data.statusAfter ?? 'operational',
      next_maintenance_date:
        hasContent(data.nextMaintenanceDate) ? new Date(data.nextMaintenanceDate) : undefined,
      report_url: data.reportUrl,
      created_by: userId,
    };

    const recordId = await machineModel.addMaintenanceRecord(
      dbData as Partial<MachineMaintenanceHistory>,
    );

    // Log the action
    await rootLog.create({
      tenant_id: tenantId,
      user_id: userId,
      action: 'add_maintenance_record',
      entity_type: 'machine_maintenance',
      entity_id: recordId,
      new_values: data as unknown as Record<string, unknown>,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    // Get the created record
    const history = await machineModel.getMaintenanceHistory(data.machineId, tenantId);
    const record = history.find((h: MachineMaintenanceHistory) => h.id === recordId);
    if (!record) {
      throw new ServiceError('NOT_FOUND', 'Maintenance record not found');
    }

    return this.formatMaintenanceResponse(record);
  }

  // Get upcoming maintenance
  /**
   *
   * @param tenantId - The tenant ID
   * @param days - The days parameter
   */
  async getUpcomingMaintenance(tenantId: number, days: number = 30): Promise<MachineResponse[]> {
    const machines = await machineModel.getUpcomingMaintenance(tenantId, days);
    return machines.map((machine: Machine) => this.formatMachineResponse(machine));
  }

  // Get statistics
  /**
   *
   * @param tenantId - The tenant ID
   */
  async getStatistics(tenantId: number): Promise<MachineStatistics> {
    const stats = await machineModel.getStatistics(tenantId);
    return {
      totalMachines: parseIntOrZero(stats.total_machines),
      operational: parseIntOrZero(stats.operational),
      inMaintenance: parseIntOrZero(stats.in_maintenance),
      inRepair: parseIntOrZero(stats.in_repair),
      standby: parseIntOrZero(stats.standby),
      decommissioned: parseIntOrZero(stats.decommissioned),
      needsMaintenanceSoon: parseIntOrZero(stats.needs_maintenance_soon),
    };
  }

  // Get machine categories
  /**
   *
   */
  async getCategories(): Promise<MachineCategory[]> {
    const categories = await machineModel.getCategories();
    // DB returns snake_case, we map to camelCase for API
    return categories.map(
      (cat: {
        id: number;
        name: string;
        description?: string;
        icon?: string;
        sort_order: number;
        is_active: boolean;
      }): MachineCategory => {
        const result: MachineCategory = {
          id: cat.id,
          name: cat.name,
          sortOrder: cat.sort_order,
          isActive: cat.is_active,
        };

        if (cat.description !== undefined) {
          result.description = cat.description;
        }
        if (cat.icon !== undefined) {
          result.icon = cat.icon;
        }

        return result;
      },
    );
  }

  /**
   * Add basic info fields to machine response
   */
  private addMachineBasicFields(
    machine: Machine & { department_name?: string },
    response: MachineResponse,
  ): void {
    if (machine.model !== undefined) response.model = machine.model;
    if (machine.manufacturer !== undefined) response.manufacturer = machine.manufacturer;
    if (machine.serial_number !== undefined) response.serialNumber = machine.serial_number;
    if (machine.asset_number !== undefined) response.assetNumber = machine.asset_number;
    if (machine.department_id !== undefined) response.departmentId = machine.department_id;
    if (machine.department_name !== undefined) response.departmentName = machine.department_name;
    if (machine.area_id !== undefined) response.areaId = machine.area_id;
    if (machine.location !== undefined) response.location = machine.location;
  }

  /**
   * Add date fields to machine response
   * Use != null to check for both null and undefined (DB can return null)
   */
  private addMachineDateFields(machine: Machine, response: MachineResponse): void {
    if (machine.purchase_date != null) response.purchaseDate = machine.purchase_date.toISOString();
    if (machine.installation_date != null)
      response.installationDate = machine.installation_date.toISOString();
    if (machine.warranty_until != null)
      response.warrantyUntil = machine.warranty_until.toISOString();
    if (machine.last_maintenance != null)
      response.lastMaintenance = machine.last_maintenance.toISOString();
    if (machine.next_maintenance != null)
      response.nextMaintenance = machine.next_maintenance.toISOString();
  }

  /**
   * Add operational and meta fields to machine response
   */
  private addMachineMetaFields(
    machine: Machine & { created_by_name?: string; updated_by_name?: string },
    response: MachineResponse,
  ): void {
    if (machine.operating_hours !== undefined) response.operatingHours = machine.operating_hours;
    if (machine.production_capacity !== undefined)
      response.productionCapacity = machine.production_capacity;
    if (machine.energy_consumption !== undefined)
      response.energyConsumption = machine.energy_consumption;
    if (machine.manual_url !== undefined) response.manualUrl = machine.manual_url;
    if (machine.qr_code !== undefined) response.qrCode = machine.qr_code;
    if (machine.notes !== undefined) response.notes = machine.notes;
    if (machine.created_by !== undefined) response.createdBy = machine.created_by;
    if (machine.created_by_name !== undefined) response.createdByName = machine.created_by_name;
    if (machine.updated_by !== undefined) response.updatedBy = machine.updated_by;
    if (machine.updated_by_name !== undefined) response.updatedByName = machine.updated_by_name;
  }

  // Helper: Format machine response
  /**
   *
   * @param machine - The machine parameter
   */
  private formatMachineResponse(
    machine: Machine & {
      department_name?: string;
      created_by_name?: string;
      updated_by_name?: string;
    },
  ): MachineResponse {
    const response: MachineResponse = {
      id: machine.id,
      tenantId: machine.tenant_id,
      name: machine.name,
      machineType: machine.machine_type,
      status: machine.status,
      createdAt: machine.created_at.toISOString(),
      updatedAt: machine.updated_at.toISOString(),
      isActive: machine.is_active,
    };

    this.addMachineBasicFields(machine, response);
    this.addMachineDateFields(machine, response);
    this.addMachineMetaFields(machine, response);

    return response;
  }

  /**
   * Add optional fields to maintenance response
   */
  private addMaintenanceOptionalFields(
    record: MachineMaintenanceHistory & { performed_by_name?: string; created_by_name?: string },
    response: MaintenanceHistoryResponse,
  ): void {
    if (record.performed_by !== undefined) response.performedBy = record.performed_by;
    if (record.performed_by_name !== undefined) response.performedByName = record.performed_by_name;
    if (record.external_company !== undefined) response.externalCompany = record.external_company;
    if (record.description !== undefined) response.description = record.description;
    if (record.parts_replaced !== undefined) response.partsReplaced = record.parts_replaced;
    // Use != null to check for both null and undefined (DB can return null)
    if (record.next_maintenance_date != null)
      response.nextMaintenanceDate = record.next_maintenance_date.toISOString();
    if (record.report_url !== undefined) response.reportUrl = record.report_url;
    if (record.created_by !== undefined) response.createdBy = record.created_by;
    if (record.created_by_name !== undefined) response.createdByName = record.created_by_name;
  }

  /**
   * Add numeric fields to maintenance response (cost, duration)
   */
  private addMaintenanceNumericFields(
    record: MachineMaintenanceHistory,
    response: MaintenanceHistoryResponse,
  ): void {
    if (record.cost !== undefined) {
      const parsedCost = parseFloatOrUndefined(record.cost);
      if (parsedCost !== undefined) response.cost = parsedCost;
    }
    if (record.duration_hours !== undefined) {
      const parsedDuration = parseFloatOrUndefined(record.duration_hours);
      if (parsedDuration !== undefined) response.durationHours = parsedDuration;
    }
  }

  // Helper: Format maintenance response
  /**
   *
   * @param record - The record parameter
   */
  private formatMaintenanceResponse(
    record: MachineMaintenanceHistory & {
      performed_by_name?: string;
      created_by_name?: string;
    },
  ): MaintenanceHistoryResponse {
    const response: MaintenanceHistoryResponse = {
      id: record.id,
      tenantId: record.tenant_id,
      machineId: record.machine_id,
      maintenanceType: record.maintenance_type,
      performedDate: record.performed_date.toISOString(),
      statusAfter: record.status_after,
      createdAt: record.created_at.toISOString(),
    };

    this.addMaintenanceOptionalFields(record, response);
    this.addMaintenanceNumericFields(record, response);

    return response;
  }
}

export const machinesService = new MachinesService();
