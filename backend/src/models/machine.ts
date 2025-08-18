import { RowDataPacket, ResultSetHeader } from "mysql2";

import { executeQuery } from "../config/database.js";

export interface MachineStatistics extends RowDataPacket {
  total_machines: number;
  operational: number;
  in_maintenance: number;
  in_repair: number;
  standby: number;
  decommissioned: number;
  needs_maintenance_soon: number;
}

export interface MachineCategory extends RowDataPacket {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
}

export interface Machine extends RowDataPacket {
  id: number;
  tenant_id: number;
  name: string;
  model?: string;
  manufacturer?: string;
  serial_number?: string;
  asset_number?: string;
  department_id?: number;
  area_id?: number;
  location?: string;
  machine_type:
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
  purchase_date?: Date;
  installation_date?: Date;
  warranty_until?: Date;
  last_maintenance?: Date;
  next_maintenance?: Date;
  operating_hours?: number;
  production_capacity?: string;
  energy_consumption?: string;
  manual_url?: string;
  qr_code?: string;
  notes?: string;
  created_at: Date;
  updated_at: Date;
  created_by?: number;
  updated_by?: number;
  is_active: boolean;
}

export interface MachineMaintenanceHistory extends RowDataPacket {
  id: number;
  tenant_id: number;
  machine_id: number;
  maintenance_type:
    | "preventive"
    | "corrective"
    | "inspection"
    | "calibration"
    | "cleaning"
    | "other";
  performed_date: Date;
  performed_by?: number;
  external_company?: string;
  description?: string;
  parts_replaced?: string;
  cost?: number;
  duration_hours?: number;
  status_after: "operational" | "needs_repair" | "decommissioned";
  next_maintenance_date?: Date;
  report_url?: string;
  created_at: Date;
  created_by?: number;
}

export interface MachineFilters {
  status?: string;
  machine_type?: string;
  department_id?: number;
  search?: string;
  is_active?: boolean;
  needs_maintenance?: boolean;
}

class MachineModel {
  // Find all machines with filters
  async findAll(
    tenant_id: number,
    filters: MachineFilters = {},
  ): Promise<Machine[]> {
    let query = `
      SELECT m.*, 
             d.name as department_name,
             u1.username as created_by_name,
             u2.username as updated_by_name
      FROM machines m
      LEFT JOIN departments d ON m.department_id = d.id AND d.tenant_id = m.tenant_id
      LEFT JOIN users u1 ON m.created_by = u1.id
      LEFT JOIN users u2 ON m.updated_by = u2.id
      WHERE m.tenant_id = ?
    `;
    const params: (string | number | boolean | null)[] = [tenant_id];

    if (filters.status != null && filters.status !== "") {
      query += " AND m.status = ?";
      params.push(filters.status);
    }

    if (filters.machine_type != null && filters.machine_type !== "") {
      query += " AND m.machine_type = ?";
      params.push(filters.machine_type);
    }

    if (filters.department_id != null && filters.department_id !== 0) {
      query += " AND m.department_id = ?";
      params.push(filters.department_id);
    }

    if (filters.is_active !== undefined) {
      query += " AND m.is_active = ?";
      params.push(filters.is_active);
    }

    if (filters.needs_maintenance === true) {
      query +=
        " AND (m.next_maintenance <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) OR m.status = 'maintenance')";
    }

    if (filters.search != null && filters.search !== "") {
      query +=
        " AND (m.name LIKE ? OR m.model LIKE ? OR m.manufacturer LIKE ? OR m.serial_number LIKE ? OR m.asset_number LIKE ?)";
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += " ORDER BY m.name ASC";

    const [rows] = await executeQuery<Machine[]>(query, params);
    return rows;
  }

  // Find machine by ID
  async findById(id: number, tenant_id: number): Promise<Machine | null> {
    const query = `
      SELECT m.*, 
             d.name as department_name
      FROM machines m
      LEFT JOIN departments d ON m.department_id = d.id AND d.tenant_id = m.tenant_id
      WHERE m.id = ? AND m.tenant_id = ?
    `;
    const [rows] = await executeQuery<Machine[]>(query, [id, tenant_id]);
    return rows[0] ?? null;
  }

  // Create new machine
  async create(data: Partial<Machine>): Promise<number> {
    const query = `
      INSERT INTO machines (
        tenant_id, name, model, manufacturer, serial_number, asset_number,
        department_id, area_id, location, machine_type, status,
        purchase_date, installation_date, warranty_until, 
        last_maintenance, next_maintenance, operating_hours,
        production_capacity, energy_consumption, manual_url, 
        qr_code, notes, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      data.tenant_id,
      data.name,
      data.model ?? null,
      data.manufacturer ?? null,
      data.serial_number ?? null,
      data.asset_number ?? null,
      data.department_id ?? null,
      data.area_id ?? null,
      data.location ?? null,
      data.machine_type ?? "production",
      data.status ?? "operational",
      data.purchase_date ?? null,
      data.installation_date ?? null,
      data.warranty_until ?? null,
      data.last_maintenance ?? null,
      data.next_maintenance ?? null,
      data.operating_hours ?? 0,
      data.production_capacity ?? null,
      data.energy_consumption ?? null,
      data.manual_url ?? null,
      data.qr_code ?? null,
      data.notes ?? null,
      data.created_by ?? null,
      data.updated_by ?? null,
    ];

    const [result] = await executeQuery<ResultSetHeader>(query, params);
    return result.insertId;
  }

  // Update machine
  async update(
    id: number,
    tenant_id: number,
    data: Partial<Machine>,
  ): Promise<boolean> {
    const fields = [];
    const params = [];

    // Build dynamic update query
    const updateFields = [
      "name",
      "model",
      "manufacturer",
      "serial_number",
      "asset_number",
      "department_id",
      "area_id",
      "location",
      "machine_type",
      "status",
      "purchase_date",
      "installation_date",
      "warranty_until",
      "last_maintenance",
      "next_maintenance",
      "operating_hours",
      "production_capacity",
      "energy_consumption",
      "manual_url",
      "qr_code",
      "notes",
      "updated_by",
      "is_active",
    ];

    for (const field of updateFields) {
      if (data[field as keyof Machine] !== undefined) {
        fields.push(`${field} = ?`);
        params.push(data[field as keyof Machine]);
      }
    }

    if (fields.length === 0) {
      return false;
    }

    // Always update updated_at
    fields.push("updated_at = CURRENT_TIMESTAMP");

    const query = `
      UPDATE machines 
      SET ${fields.join(", ")}
      WHERE id = ? AND tenant_id = ?
    `;
    params.push(id, tenant_id);

    const [result] = await executeQuery<ResultSetHeader>(query, params);
    return result.affectedRows > 0;
  }

  // Delete machine (hard delete)
  async delete(id: number, tenant_id: number): Promise<boolean> {
    const query = `
      DELETE FROM machines 
      WHERE id = ? AND tenant_id = ?
    `;
    const [result] = await executeQuery<ResultSetHeader>(query, [
      id,
      tenant_id,
    ]);
    return result.affectedRows > 0;
  }

  // Deactivate machine (soft delete)
  async deactivate(id: number, tenant_id: number): Promise<boolean> {
    const query = `
      UPDATE machines 
      SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `;
    const [result] = await executeQuery<ResultSetHeader>(query, [
      id,
      tenant_id,
    ]);
    return result.affectedRows > 0;
  }

  // Activate machine
  async activate(id: number, tenant_id: number): Promise<boolean> {
    const query = `
      UPDATE machines 
      SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `;
    const [result] = await executeQuery<ResultSetHeader>(query, [
      id,
      tenant_id,
    ]);
    return result.affectedRows > 0;
  }

  // Get maintenance history
  async getMaintenanceHistory(
    machine_id: number,
    tenant_id: number,
  ): Promise<MachineMaintenanceHistory[]> {
    const query = `
      SELECT mh.*,
             u1.username as performed_by_name,
             u2.username as created_by_name
      FROM machine_maintenance_history mh
      LEFT JOIN users u1 ON mh.performed_by = u1.id
      LEFT JOIN users u2 ON mh.created_by = u2.id
      WHERE mh.machine_id = ? AND mh.tenant_id = ?
      ORDER BY mh.performed_date DESC
    `;
    const [rows] = await executeQuery<MachineMaintenanceHistory[]>(query, [
      machine_id,
      tenant_id,
    ]);
    return rows;
  }

  // Add maintenance record
  async addMaintenanceRecord(
    data: Partial<MachineMaintenanceHistory>,
  ): Promise<number> {
    const query = `
      INSERT INTO machine_maintenance_history (
        tenant_id, machine_id, maintenance_type, performed_date,
        performed_by, external_company, description, parts_replaced,
        cost, duration_hours, status_after, next_maintenance_date,
        report_url, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      data.tenant_id,
      data.machine_id,
      data.maintenance_type,
      data.performed_date,
      data.performed_by ?? null,
      data.external_company ?? null,
      data.description ?? null,
      data.parts_replaced ?? null,
      data.cost ?? null,
      data.duration_hours ?? null,
      data.status_after ?? "operational",
      data.next_maintenance_date ?? null,
      data.report_url ?? null,
      data.created_by ?? null,
    ];

    const [result] = await executeQuery<ResultSetHeader>(query, params);

    // Update machine's last_maintenance and next_maintenance dates
    if (result.insertId) {
      // Update machine's last_maintenance and next_maintenance dates
      interface MachineUpdateData {
        last_maintenance?: Date;
        next_maintenance?: Date;
        status?: Machine["status"];
      }
      const updateData: MachineUpdateData = {
        last_maintenance: data.performed_date,
        next_maintenance: data.next_maintenance_date,
        status:
          data.status_after === "needs_repair"
            ? "repair"
            : (data.status_after ?? "operational"),
      };
      if (
        data.machine_id != null &&
        data.machine_id !== 0 &&
        data.tenant_id != null &&
        data.tenant_id !== 0
      ) {
        await this.update(
          data.machine_id,
          data.tenant_id,
          updateData as Partial<Machine>,
        );
      }
    }

    return result.insertId;
  }

  // Get upcoming maintenance
  async getUpcomingMaintenance(
    tenant_id: number,
    days = 30,
  ): Promise<Machine[]> {
    const query = `
      SELECT m.*, d.name as department_name
      FROM machines m
      LEFT JOIN departments d ON m.department_id = d.id AND d.tenant_id = m.tenant_id
      WHERE m.tenant_id = ? 
        AND m.is_active = TRUE
        AND m.next_maintenance <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
        AND m.status != 'decommissioned'
      ORDER BY m.next_maintenance ASC
    `;
    const [rows] = await executeQuery<Machine[]>(query, [tenant_id, days]);
    return rows;
  }

  // Get statistics
  async getStatistics(tenant_id: number): Promise<MachineStatistics> {
    const query = `
      SELECT 
        COUNT(*) as total_machines,
        SUM(CASE WHEN status = 'operational' THEN 1 ELSE 0 END) as operational,
        SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as in_maintenance,
        SUM(CASE WHEN status = 'repair' THEN 1 ELSE 0 END) as in_repair,
        SUM(CASE WHEN status = 'standby' THEN 1 ELSE 0 END) as standby,
        SUM(CASE WHEN status = 'decommissioned' THEN 1 ELSE 0 END) as decommissioned,
        SUM(CASE WHEN next_maintenance <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) AND status != 'decommissioned' THEN 1 ELSE 0 END) as needs_maintenance_soon
      FROM machines
      WHERE tenant_id = ? AND is_active = TRUE
    `;
    const [rows] = await executeQuery<MachineStatistics[]>(query, [tenant_id]);
    return rows[0];
  }

  // Get machine categories
  async getCategories(): Promise<MachineCategory[]> {
    const query = `
      SELECT * FROM machine_categories 
      WHERE is_active = TRUE 
      ORDER BY sort_order ASC, name ASC
    `;
    const [rows] = await executeQuery<MachineCategory[]>(query);
    return rows;
  }
}

export default new MachineModel();
