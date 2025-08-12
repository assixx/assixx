import {
  query as executeQuery,
  RowDataPacket,
  ResultSetHeader,
} from "../utils/db";
import { logger } from "../utils/logger";

// Database interfaces
interface DbRootLog extends RowDataPacket {
  id: number;
  tenant_id: number;
  user_id: number;
  action: string;
  entity_type?: string;
  entity_id?: number;
  details?: string;
  old_values?: string | Record<string, unknown> | null;
  new_values?: string | Record<string, unknown> | null;
  ip_address?: string;
  user_agent?: string;
  was_role_switched?: boolean;
  created_at: Date;
}

interface RootLogCreateData {
  user_id: number;
  tenant_id: number;
  action: string;
  ip_address?: string;
  entity_type?: string;
  entity_id?: number;
  details?: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  user_agent?: string;
  was_role_switched?: boolean;
}

// Convenience method for simple logging
export async function logRootAction(
  action: string,
  userId: number,
  tenantId: number,
  details?: string | Record<string, unknown>,
): Promise<number> {
  const logData: RootLogCreateData = {
    user_id: userId,
    tenant_id: tenantId,
    action,
    new_values: typeof details === "string" ? { details } : details,
  };
  return createRootLog(logData);
}

export async function createRootLog(
  logData: RootLogCreateData,
): Promise<number> {
  const {
    user_id,
    action,
    ip_address,
    tenant_id,
    entity_type,
    entity_id,
    details,
    old_values,
    new_values,
    user_agent,
    was_role_switched,
  } = logData;

  const query = `INSERT INTO root_logs (tenant_id, user_id, action, entity_type, entity_id, details, old_values, new_values, ip_address, user_agent, was_role_switched) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  try {
    const [result] = await executeQuery<ResultSetHeader>(query, [
      tenant_id,
      user_id,
      action,
      entity_type ?? null,
      entity_id ?? null,
      details ?? null,
      old_values ? JSON.stringify(old_values) : null,
      new_values ? JSON.stringify(new_values) : null,
      ip_address ?? null,
      user_agent ?? null,
      was_role_switched ?? false,
    ]);
    return result.insertId;
  } catch (error: unknown) {
    logger.error(`Error creating root log: ${(error as Error).message}`);
    throw error;
  }
}

export async function getRootLogsByUserId(
  userId: number,
  days = 0,
): Promise<DbRootLog[]> {
  let query = `SELECT * FROM root_logs WHERE user_id = ?`;
  const params: unknown[] = [userId];

  // Wenn days > 0, dann nur Logs der letzten X Tage abrufen
  if (days > 0) {
    query += ` AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`;
    params.push(days);
  }

  // Nach Zeitstempel absteigend sortieren (neueste zuerst)
  query += ` ORDER BY created_at DESC`;

  try {
    const [rows] = await executeQuery<DbRootLog[]>(query, params);
    return rows;
  } catch (error: unknown) {
    logger.error(
      `Error fetching root logs for user ${userId}: ${(error as Error).message}`,
    );
    throw error;
  }
}

export async function getLastRootLogin(
  userId: number,
): Promise<DbRootLog | null> {
  const query = `SELECT * FROM root_logs 
                   WHERE user_id = ? AND action = 'login' 
                   ORDER BY created_at DESC LIMIT 1`;

  try {
    const [rows] = await executeQuery<DbRootLog[]>(query, [userId]);
    return rows.length > 0 ? rows[0] : null;
  } catch (error: unknown) {
    logger.error(
      `Error fetching last login for user ${userId}: ${(error as Error).message}`,
    );
    throw error;
  }
}

/**
 * Get all logs with pagination and filters
 * For root user to see all system logs
 */
export async function getAllRootLogs(options: {
  limit?: number;
  offset?: number;
  userId?: number;
  action?: string;
  entityType?: string;
  tenantId?: number;
  startDate?: Date;
  endDate?: Date;
}): Promise<{ logs: DbRootLog[]; total: number }> {
  const {
    limit = 50,
    offset = 0,
    userId,
    action,
    entityType,
    tenantId,
    startDate,
    endDate,
  } = options;

  let whereConditions: string[] = ["1=1"];
  const params: unknown[] = [];

  if (userId != null && userId !== 0) {
    whereConditions.push("user_id = ?");
    params.push(userId);
  }

  if (action != null && action !== "") {
    whereConditions.push("action = ?");
    params.push(action);
  }

  if (entityType != null && entityType !== "") {
    whereConditions.push("entity_type = ?");
    params.push(entityType);
  }

  if (tenantId != null && tenantId !== 0) {
    whereConditions.push("tenant_id = ?");
    params.push(tenantId);
  }

  if (startDate) {
    whereConditions.push("created_at >= ?");
    params.push(startDate);
  }

  if (endDate) {
    whereConditions.push("created_at <= ?");
    params.push(endDate);
  }

  const whereClause = whereConditions.join(" AND ");

  try {
    // Get total count
    const [countResult] = await executeQuery<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM root_logs WHERE ${whereClause}`,
      params,
    );
    const total = (countResult[0] as { total: number }).total;

    // Get paginated logs
    const [logs] = await executeQuery<DbRootLog[]>(
      `SELECT * FROM root_logs 
         WHERE ${whereClause}
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return { logs, total: total };
  } catch (error: unknown) {
    logger.error(`Error fetching root logs: ${(error as Error).message}`);
    throw error;
  }
}

// Backward compatibility object
const RootLog = {
  log: logRootAction,
  create: createRootLog,
  getByUserId: getRootLogsByUserId,
  getLastLogin: getLastRootLogin,
  getAll: getAllRootLogs,
};

// Export types
export type { DbRootLog, RootLogCreateData };

// Default export for CommonJS compatibility
export default RootLog;
