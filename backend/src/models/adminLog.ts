import {
  query as executeQuery,
  RowDataPacket,
  ResultSetHeader,
} from '../utils/db';
import { logger } from '../utils/logger';

// Database interfaces
interface DbAdminLog extends RowDataPacket {
  id: number;
  tenant_id: number;
  admin_id: number;
  action: string;
  entity_type?: string;
  entity_id?: number;
  old_values?: string | Record<string, unknown> | null;
  new_values?: string | Record<string, unknown> | null;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

interface AdminLogCreateData {
  user_id: number;
  tenant_id: number;
  action: string;
  ip_address?: string;
  entity_type?: string;
  entity_id?: number;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  user_agent?: string;
}

export class AdminLog {
  static async create(logData: AdminLogCreateData): Promise<number> {
    const {
      user_id,
      action,
      ip_address,
      tenant_id,
      entity_type,
      entity_id,
      old_values,
      new_values,
      user_agent,
    } = logData;

    const query = `INSERT INTO admin_logs (tenant_id, admin_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    try {
      const [result] = await executeQuery<ResultSetHeader>(query, [
        tenant_id,
        user_id,
        action,
        entity_type || null,
        entity_id || null,
        old_values ? JSON.stringify(old_values) : null,
        new_values ? JSON.stringify(new_values) : null,
        ip_address || null,
        user_agent || null,
      ]);
      return result.insertId;
    } catch (error) {
      logger.error(`Error creating admin log: ${(error as Error).message}`);
      throw error;
    }
  }

  static async getByUserId(userId: number, days = 0): Promise<DbAdminLog[]> {
    let query = `SELECT * FROM admin_logs WHERE admin_id = ?`;
    const params: unknown[] = [userId];

    // Wenn days > 0, dann nur Logs der letzten X Tage abrufen
    if (days > 0) {
      query += ` AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`;
      params.push(days);
    }

    // Nach Zeitstempel absteigend sortieren (neueste zuerst)
    query += ` ORDER BY created_at DESC`;

    try {
      const [rows] = await executeQuery<DbAdminLog[]>(query, params);
      return rows;
    } catch (error) {
      logger.error(
        `Error fetching admin logs for user ${userId}: ${(error as Error).message}`
      );
      throw error;
    }
  }

  static async getLastLogin(userId: number): Promise<DbAdminLog | null> {
    const query = `SELECT * FROM admin_logs 
                   WHERE admin_id = ? AND action = 'login' 
                   ORDER BY created_at DESC LIMIT 1`;

    try {
      const [rows] = await executeQuery<DbAdminLog[]>(query, [userId]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error(
        `Error fetching last login for user ${userId}: ${(error as Error).message}`
      );
      throw error;
    }
  }
}

// Export types
export type { DbAdminLog, AdminLogCreateData };

// Default export for CommonJS compatibility
export default AdminLog;

// CommonJS compatibility
