import machineModel, { Machine, MachineMaintenanceHistory } from '../../../models/machine.js';
import rootLog from '../../../models/rootLog';
import { ServiceError } from '../../../utils/ServiceError.js';
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
 *
 */
export class MachinesService {
  // List all machines with filters
  /**
   *
   * @param tenantId - The tenant ID
   * @param filters - The filter criteria
   */
  async listMachines(tenantId: number, filters: MachineFilters = {}): Promise<MachineResponse[]> {
    const machines = await machineModel.findAll(tenantId, filters);
    return machines.map((machine) => this.formatMachineResponse(machine));
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

  // Create new machine
  /**
   *
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
    // Validate serial number uniqueness if provided
    if (data.serialNumber) {
      const existingMachines = await machineModel.findAll(tenantId, {
        search: data.serialNumber,
      });
      const duplicate = existingMachines.find((m) => m.serial_number === data.serialNumber);
      if (duplicate) {
        throw new ServiceError('VALIDATION_ERROR', 'Serial number already exists', {
          field: 'serialNumber',
          message: 'Serial number already exists',
        });
      }
    }

    // Convert API fields to DB fields
    const dbData = {
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
      purchase_date: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
      installation_date: data.installationDate ? new Date(data.installationDate) : undefined,
      warranty_until: data.warrantyUntil ? new Date(data.warrantyUntil) : undefined,
      last_maintenance: data.lastMaintenance ? new Date(data.lastMaintenance) : undefined,
      next_maintenance: data.nextMaintenance ? new Date(data.nextMaintenance) : undefined,
      operating_hours: data.operatingHours,
      production_capacity: data.productionCapacity,
      energy_consumption: data.energyConsumption,
      manual_url: data.manualUrl,
      qr_code: data.qrCode,
      notes: data.notes,
      created_by: userId,
      updated_by: userId,
    };

    const machineId = await machineModel.create(dbData as Partial<Machine>);

    // Log the action
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
    return dateString ? new Date(dateString) : undefined;
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
   * Map date fields from API to DB format
   * @param data - The machine update data
   * @param dbData - The DB data object to populate
   */
  private mapDateFields(data: MachineUpdateRequest, dbData: Partial<Machine>): void {
    if (data.purchaseDate !== undefined) {
      dbData.purchase_date = this.convertToDate(data.purchaseDate);
    }
    if (data.installationDate !== undefined) {
      dbData.installation_date = this.convertToDate(data.installationDate);
    }
    if (data.warrantyUntil !== undefined) {
      dbData.warranty_until = this.convertToDate(data.warrantyUntil);
    }
    if (data.lastMaintenance !== undefined) {
      dbData.last_maintenance = this.convertToDate(data.lastMaintenance);
    }
    if (data.nextMaintenance !== undefined) {
      dbData.next_maintenance = this.convertToDate(data.nextMaintenance);
    }
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
    // Check if machine exists
    const existingMachine = await this.getMachineById(id, tenantId);

    // Validate serial number uniqueness if changed
    if (data.serialNumber && data.serialNumber !== existingMachine.serialNumber) {
      const machines = await machineModel.findAll(tenantId, {
        search: data.serialNumber,
      });
      const duplicate = machines.find((m) => m.serial_number === data.serialNumber && m.id !== id);
      if (duplicate) {
        throw new ServiceError('VALIDATION_ERROR', 'Serial number already exists', {
          field: 'serialNumber',
          message: 'Serial number already exists',
        });
      }
    }

    // Convert API fields to DB fields
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
    return history.map((record) => this.formatMaintenanceResponse(record));
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
        data.nextMaintenanceDate ? new Date(data.nextMaintenanceDate) : undefined,
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
    const record = history.find((h) => h.id === recordId);
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
  async getUpcomingMaintenance(tenantId: number, days = 30): Promise<MachineResponse[]> {
    const machines = await machineModel.getUpcomingMaintenance(tenantId, days);
    return machines.map((machine) => this.formatMachineResponse(machine));
  }

  // Get statistics
  /**
   *
   * @param tenantId - The tenant ID
   */
  async getStatistics(tenantId: number): Promise<MachineStatistics> {
    const stats = await machineModel.getStatistics(tenantId);
    return {
      totalMachines: Number.parseInt(String(stats.total_machines)) || 0,
      operational: Number.parseInt(String(stats.operational)) || 0,
      inMaintenance: Number.parseInt(String(stats.in_maintenance)) || 0,
      inRepair: Number.parseInt(String(stats.in_repair)) || 0,
      standby: Number.parseInt(String(stats.standby)) || 0,
      decommissioned: Number.parseInt(String(stats.decommissioned)) || 0,
      needsMaintenanceSoon: Number.parseInt(String(stats.needs_maintenance_soon)) || 0,
    };
  }

  // Get machine categories
  /**
   *
   */
  async getCategories(): Promise<MachineCategory[]> {
    const categories = await machineModel.getCategories();
    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      icon: cat.icon,
      sortOrder: cat.sort_order,
      isActive: cat.is_active,
    }));
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
    return {
      id: machine.id,
      tenantId: machine.tenant_id,
      name: machine.name,
      model: machine.model,
      manufacturer: machine.manufacturer,
      serialNumber: machine.serial_number,
      assetNumber: machine.asset_number,
      departmentId: machine.department_id,
      departmentName: machine.department_name,
      areaId: machine.area_id,
      location: machine.location,
      machineType: machine.machine_type,
      status: machine.status,
      purchaseDate: machine.purchase_date?.toISOString(),
      installationDate: machine.installation_date?.toISOString(),
      warrantyUntil: machine.warranty_until?.toISOString(),
      lastMaintenance: machine.last_maintenance?.toISOString(),
      nextMaintenance: machine.next_maintenance?.toISOString(),
      operatingHours: machine.operating_hours,
      productionCapacity: machine.production_capacity,
      energyConsumption: machine.energy_consumption,
      manualUrl: machine.manual_url,
      qrCode: machine.qr_code,
      notes: machine.notes,
      createdAt: machine.created_at.toISOString(),
      updatedAt: machine.updated_at.toISOString(),
      createdBy: machine.created_by,
      createdByName: machine.created_by_name,
      updatedBy: machine.updated_by,
      updatedByName: machine.updated_by_name,
      isActive: machine.is_active,
    };
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
    return {
      id: record.id,
      tenantId: record.tenant_id,
      machineId: record.machine_id,
      maintenanceType: record.maintenance_type,
      performedDate: record.performed_date.toISOString(),
      performedBy: record.performed_by,
      performedByName: record.performed_by_name,
      externalCompany: record.external_company,
      description: record.description,
      partsReplaced: record.parts_replaced,
      cost: record.cost ? Number.parseFloat(String(record.cost)) : undefined,
      durationHours:
        record.duration_hours ? Number.parseFloat(String(record.duration_hours)) : undefined,
      statusAfter: record.status_after,
      nextMaintenanceDate: record.next_maintenance_date?.toISOString(),
      reportUrl: record.report_url,
      createdAt: record.created_at.toISOString(),
      createdBy: record.created_by,
      createdByName: record.created_by_name,
    };
  }
}

export const machinesService = new MachinesService();
