import bcrypt from 'bcryptjs';
import express, { Router } from 'express';
import { body, query, validationResult } from 'express-validator';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

import { authenticateToken, authorizeRole } from '../auth.js';
import { executeQuery } from '../database.js';
import type { AuthenticatedRequest } from '../types/request.types.js';
import { logger } from '../utils/logger.js';

interface LogEntry extends RowDataPacket {
  id: number;
  tenant_id: number;
  user_id: number;
  user_name: string;
  user_role: string;
  action: string;
  entity_type: string;
  entity_id: number | null;
  details: string | Buffer;
  ip_address: string;
  user_agent: string;
  created_at: Date;
}

interface CountResult extends RowDataPacket {
  total: number;
}

interface UserInfo extends RowDataPacket {
  name: string;
}

interface RootUser extends RowDataPacket {
  password: string;
}

const router: Router = express.Router();

// Logs abrufen (nur für Root)
router.get(
  '/',
  authenticateToken,
  authorizeRole('root'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit muss zwischen 1 und 100 liegen'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset muss positiv sein'),
  query('user_id').optional().isInt({ min: 1 }).withMessage('Ungültige User ID'),
  query('action').optional().isString().withMessage('Action muss ein String sein'),
  query('entity_type').optional().isString().withMessage('Entity Type muss ein String sein'),
  query('timerange').optional().isString().withMessage('Timerange muss ein String sein'),
  async (req, res) => {
    // Type assertion after authentication middleware
    const authReq = req as AuthenticatedRequest;

    const errors = validationResult(authReq);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const limit = authReq.query.limit != null ? Number.parseInt(authReq.query.limit as string) : 20;
    const offset =
      authReq.query.offset != null ? Number.parseInt(authReq.query.offset as string) : 0;
    const userId =
      authReq.query.user_id != null ? Number.parseInt(authReq.query.user_id as string) : null;
    const action = authReq.query.action != null ? (authReq.query.action as string) : null;
    const entityType =
      authReq.query.entity_type != null ? (authReq.query.entity_type as string) : null;
    const timerange = authReq.query.timerange != null ? (authReq.query.timerange as string) : null;

    try {
      // Build WHERE conditions
      const conditions: string[] = [];
      const params: (string | number | null)[] = [];

      // WICHTIG: Immer nach tenant_id filtern!
      conditions.push('al.tenant_id = ?');
      params.push(authReq.user.tenant_id);

      if (userId != null && userId !== 0) {
        conditions.push('al.user_id = ?');
        params.push(userId);
      }

      if (action !== null && action !== '') {
        conditions.push('al.action = ?');
        params.push(action);
      }

      if (entityType !== null && entityType !== '') {
        conditions.push('al.entity_type = ?');
        params.push(entityType);
      }

      if (timerange !== null && timerange !== '') {
        let dateCondition = '';

        switch (timerange) {
          case 'today':
            dateCondition = 'DATE(al.created_at) = CURDATE()';
            break;
          case 'yesterday':
            dateCondition = 'DATE(al.created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)';
            break;
          case 'week':
            dateCondition = 'al.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
            break;
          case 'month':
            dateCondition = 'al.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)';
            break;
          case '3months':
            dateCondition = 'al.created_at >= DATE_SUB(NOW(), INTERVAL 3 MONTH)';
            break;
          case '6months':
            dateCondition = 'al.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)';
            break;
          case 'year':
            dateCondition = 'al.created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)';
            break;
        }

        if (dateCondition !== '') {
          conditions.push(`(${dateCondition})`);
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Logs mit User-Informationen abrufen
      const [logs] = await executeQuery<LogEntry[]>(
        `
        SELECT 
          al.id,
          al.tenant_id,
          al.user_id,
          CONCAT(u.first_name, ' ', u.last_name) as user_name,
          u.role as user_role,
          al.action,
          al.entity_type,
          al.entity_id,
          CAST(al.details AS CHAR) as details,
          al.ip_address,
          al.user_agent,
          al.created_at
        FROM root_logs al
        JOIN users u ON al.user_id = u.id
        ${whereClause}
        ORDER BY al.created_at DESC
        LIMIT ? OFFSET ?
      `,
        [...params, limit, offset],
      );

      // Total count für Pagination
      const [countResult] = await executeQuery<CountResult[]>(
        `
        SELECT COUNT(*) as total
        FROM root_logs al
        ${whereClause}
      `,
        params,
      );

      const total = countResult[0]?.total ?? 0;

      // Convert Buffer objects to strings
      const processedLogs = logs.map((log) => ({
        ...log,
        details:
          typeof log.details === 'object' && Buffer.isBuffer(log.details) ?
            log.details.toString('utf8')
          : log.details,
        user_name:
          log.user_name && typeof log.user_name === 'object' && Buffer.isBuffer(log.user_name) ?
            (log.user_name as Buffer).toString('utf8')
          : log.user_name,
      }));

      res.json({
        success: true,
        data: {
          logs: processedLogs,
          pagination: {
            limit,
            offset,
            total,
            hasMore: offset + limit < total,
          },
        },
      });
    } catch (error: unknown) {
      logger.error('Error fetching logs:', error);
      logger.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userId: authReq.user.id,
        tenantId: authReq.user.tenant_id,
        query: authReq.query,
      });
      res.status(500).json({
        success: false,
        error: 'Fehler beim Abrufen der Logs',
      });
    }
  },
);

// Logs löschen (nur für Root)
router.delete(
  '/',
  authenticateToken,
  authorizeRole('root'),
  query('user_id').optional().isInt({ min: 1 }).withMessage('Ungültige User ID'),
  query('action').optional().isString().withMessage('Action muss ein String sein'),
  query('entity_type').optional().isString().withMessage('Entity Type muss ein String sein'),
  query('timerange').optional().isString().withMessage('Timerange muss ein String sein'),
  body('password').optional().isString().withMessage('Passwort muss ein String sein'),
  async (req, res) => {
    // Type assertion after authentication middleware
    const authReq = req as AuthenticatedRequest;

    const errors = validationResult(authReq);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const userId =
      authReq.query.user_id != null ? Number.parseInt(authReq.query.user_id as string) : null;
    const action = authReq.query.action != null ? (authReq.query.action as string) : null;
    const entityType =
      authReq.query.entity_type != null ? (authReq.query.entity_type as string) : null;
    const timerange = authReq.query.timerange != null ? (authReq.query.timerange as string) : null;
    const password = (authReq.body as { password?: string }).password;

    // Check if no specific filters are provided (meaning "all actions" deletion)
    const noSpecificFilters =
      (userId == null || userId === 0) &&
      (action === null || action === '') &&
      (entityType === null || entityType === '') &&
      (timerange === null || timerange === '');

    // If deleting all logs (no filters), require password verification
    if (noSpecificFilters) {
      if (password == null || password === '') {
        res.status(403).json({
          success: false,
          error: 'Root-Passwort erforderlich für das Löschen aller Logs',
        });
        return;
      }

      // Verify root password
      try {
        const [rootUser] = await executeQuery<RootUser[]>(
          'SELECT password FROM users WHERE id = ? AND role = "root"',
          [authReq.user.id],
        );

        if (!rootUser.length) {
          res.status(403).json({
            success: false,
            error: 'Zugriff verweigert',
          });
          return;
        }

        const passwordMatch = await bcrypt.compare(password, rootUser[0].password);
        if (!passwordMatch) {
          res.status(403).json({
            success: false,
            error: 'Ungültiges Root-Passwort',
          });
          return;
        }
      } catch (error: unknown) {
        logger.error('Error verifying root password:', error);
        res.status(500).json({
          success: false,
          error: 'Fehler bei der Passwortverifizierung',
        });
        return;
      }
    }

    try {
      // Build WHERE conditions
      const conditions: string[] = [];
      const params: (string | number | null)[] = [];

      // WICHTIG: Immer nach tenant_id filtern!
      conditions.push('tenant_id = ?');
      params.push(authReq.user.tenant_id);

      if (userId != null && userId !== 0) {
        conditions.push('user_id = ?');
        params.push(userId);
      }

      if (action !== null && action !== '') {
        conditions.push('action = ?');
        params.push(action);
      }

      if (entityType !== null && entityType !== '') {
        conditions.push('entity_type = ?');
        params.push(entityType);
      }

      if (timerange !== null && timerange !== '') {
        let dateCondition = '';

        switch (timerange) {
          case 'today':
            dateCondition = 'DATE(created_at) = CURDATE()';
            break;
          case 'yesterday':
            dateCondition = 'DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)';
            break;
          case 'week':
            dateCondition = 'created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
            break;
          case 'month':
            dateCondition = 'created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)';
            break;
          case '3months':
            dateCondition = 'created_at >= DATE_SUB(NOW(), INTERVAL 3 MONTH)';
            break;
          case '6months':
            dateCondition = 'created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)';
            break;
          case 'year':
            dateCondition = 'created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)';
            break;
        }

        if (dateCondition !== '') {
          conditions.push(`(${dateCondition})`);
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Delete logs matching the filters
      const [result] = await executeQuery<ResultSetHeader>(
        `
        DELETE FROM root_logs
        ${whereClause}
      `,
        params,
      );

      const deletedCount = result.affectedRows;

      // Create a human-readable description of what was deleted
      const filterDescriptions: string[] = [];
      if (userId != null && userId !== 0) {
        // Get username for the filter
        const [userInfo] = await executeQuery<UserInfo[]>(
          'SELECT CONCAT(first_name, " ", last_name) as name FROM users WHERE id = ?',
          [userId],
        );
        filterDescriptions.push(`Benutzer: ${userInfo[0]?.name ?? `ID ${userId}`}`);
      }
      if (action !== null && action !== '') {
        const actionLabels: Record<string, string> = {
          login: 'Anmeldungen',
          logout: 'Abmeldungen',
          create: 'Erstellungen',
          update: 'Aktualisierungen',
          delete: 'Löschungen',
          upload: 'Uploads',
          download: 'Downloads',
          view: 'Ansichten',
          assign: 'Zuweisungen',
          unassign: 'Entfernungen',
        };
        filterDescriptions.push(`Aktion: ${actionLabels[action] ?? action}`);
      }
      if (entityType !== null && entityType !== '') {
        filterDescriptions.push(`Typ: ${entityType}`);
      }
      if (timerange !== null && timerange !== '') {
        const timeLabels: Record<string, string> = {
          today: 'Heute',
          yesterday: 'Gestern',
          week: 'Letzte 7 Tage',
          month: 'Letzter Monat',
          '3months': 'Letzte 3 Monate',
          '6months': 'Letzte 6 Monate',
          year: 'Letztes Jahr',
        };
        filterDescriptions.push(`Zeitraum: ${timeLabels[timerange] ?? timerange}`);
      }

      const detailsText = `${deletedCount} Logs gelöscht. Filter: ${filterDescriptions.join(', ')}`;

      // Log this deletion action with better details
      await createLog(
        authReq.user.id,
        authReq.user.tenant_id,
        'delete',
        'logs',
        undefined,
        detailsText,
        authReq.ip,
        authReq.get('user-agent'),
      );

      logger.info(`User ${authReq.user.id} deleted ${deletedCount} logs with filters:`, {
        userId,
        action,
        entityType,
        timerange,
      });

      res.json({
        success: true,
        deletedCount,
        message: `${deletedCount} Logs wurden erfolgreich gelöscht.`,
      });
    } catch (error: unknown) {
      logger.error('Error deleting logs:', error);
      res.status(500).json({
        success: false,
        error: 'Fehler beim Löschen der Logs',
      });
    }
  },
);

// Log-Eintrag erstellen (interne Funktion)
// DEPRECATED: Use RootLog.create() instead - this function now writes to root_logs for compatibility
export async function createLog(
  userId: number,
  tenantId: number | null,
  action: string,
  entityType?: string,
  entityId?: number,
  details?: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> {
  try {
    await executeQuery(
      `
      INSERT INTO root_logs 
      (tenant_id, user_id, action, entity_type, entity_id, details, ip_address, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `,
      [tenantId, userId, action, entityType, entityId, details, ipAddress, userAgent],
    );
  } catch (error: unknown) {
    logger.error('Error creating log entry:', error);
  }
}

export default router;
