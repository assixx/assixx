import pool from '../database';
import { logger } from '../utils/logger';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

// Helper function to handle both real pool and mock database
async function executeQuery<T extends RowDataPacket[] | ResultSetHeader>(
  sql: string,
  params?: any[]
): Promise<[T, any]> {
  const result = await (pool as any).query(sql, params);
  if (Array.isArray(result) && result.length === 2) {
    return result as [T, any];
  }
  return [result as T, null];
}

// Database interfaces
interface DbAdminLog extends RowDataPacket {
  id: number;
  user_id: number;
  action: string;
  ip_address?: string;
  status: string;
  details?: string;
  timestamp: Date;
}

interface AdminLogCreateData {
  user_id: number;
  action: string;
  ip_address?: string;
  status: string;
  details?: string;
}

export class AdminLog {
  static async create(logData: AdminLogCreateData): Promise<number> {
    const { user_id, action, ip_address, status, details } = logData;

    const query = `INSERT INTO admin_logs (user_id, action, ip_address, status, details) 
                   VALUES (?, ?, ?, ?, ?)`;

    try {
      const [result] = await executeQuery<ResultSetHeader>(query, [
        user_id,
        action,
        ip_address,
        status,
        details,
      ]);
      return result.insertId;
    } catch (error) {
      logger.error(`Error creating admin log: ${(error as Error).message}`);
      throw error;
    }
  }

  static async getByUserId(userId: number, days = 0): Promise<DbAdminLog[]> {
    let query = `SELECT * FROM admin_logs WHERE user_id = ?`;
    const params: any[] = [userId];

    // Wenn days > 0, dann nur Logs der letzten X Tage abrufen
    if (days > 0) {
      query += ` AND timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)`;
      params.push(days);
    }

    // Nach Zeitstempel absteigend sortieren (neueste zuerst)
    query += ` ORDER BY timestamp DESC`;

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
                   WHERE user_id = ? AND action = 'login' AND status = 'success' 
                   ORDER BY timestamp DESC LIMIT 1`;

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
