import express, { Router } from 'express';
import { authenticateToken, authorizeRole } from '../auth.js';
import { executeQuery } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { query, body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';

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
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset muss positiv sein'),
  query('user_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Ungültige User ID'),
  query('action')
    .optional()
    .isString()
    .withMessage('Action muss ein String sein'),
  query('entity_type')
    .optional()
    .isString()
    .withMessage('Entity Type muss ein String sein'),
  query('timerange')
    .optional()
    .isString()
    .withMessage('Timerange muss ein String sein'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const userId = req.query.user_id
      ? parseInt(req.query.user_id as string)
      : null;
    const action = (req.query.action as string) || null;
    const entityType = (req.query.entity_type as string) || null;
    const timerange = (req.query.timerange as string) || null;

    try {
      // Build WHERE conditions
      const conditions: string[] = [];
      const params: any[] = [];

      if (userId) {
        conditions.push('al.user_id = ?');
        params.push(userId);
      }

      if (action) {
        conditions.push('al.action = ?');
        params.push(action);
      }

      if (entityType) {
        conditions.push('al.entity_type = ?');
        params.push(entityType);
      }

      if (timerange) {
        let dateCondition = '';

        switch (timerange) {
          case 'today':
            dateCondition = 'DATE(al.created_at) = CURDATE()';
            break;
          case 'yesterday':
            dateCondition =
              'DATE(al.created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)';
            break;
          case 'week':
            dateCondition = 'al.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
            break;
          case 'month':
            dateCondition =
              'al.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)';
            break;
          case '3months':
            dateCondition =
              'al.created_at >= DATE_SUB(NOW(), INTERVAL 3 MONTH)';
            break;
          case '6months':
            dateCondition =
              'al.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)';
            break;
          case 'year':
            dateCondition = 'al.created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)';
            break;
        }

        if (dateCondition) {
          conditions.push(`(${dateCondition})`);
        }
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Logs mit User-Informationen abrufen
      const [logs] = await executeQuery<any[]>(
        `
        SELECT 
          al.id,
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
        FROM activity_logs al
        JOIN users u ON al.user_id = u.id
        ${whereClause}
        ORDER BY al.created_at DESC
        LIMIT ? OFFSET ?
      `,
        [...params, limit, offset]
      );

      // Total count für Pagination
      const [countResult] = await executeQuery<any[]>(
        `
        SELECT COUNT(*) as total
        FROM activity_logs al
        ${whereClause}
      `,
        params
      );

      const total = countResult[0]?.total || 0;

      // Convert Buffer objects to strings
      const processedLogs = logs.map((log) => ({
        ...log,
        details:
          log.details &&
          typeof log.details === 'object' &&
          Buffer.isBuffer(log.details)
            ? log.details.toString('utf8')
            : log.details,
        user_name:
          log.user_name &&
          typeof log.user_name === 'object' &&
          Buffer.isBuffer(log.user_name)
            ? log.user_name.toString('utf8')
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
    } catch (error) {
      logger.error('Error fetching logs:', error);
      res.status(500).json({
        success: false,
        error: 'Fehler beim Abrufen der Logs',
      });
    }
  }
);

// Logs löschen (nur für Root)
router.delete(
  '/',
  authenticateToken,
  authorizeRole('root'),
  query('user_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Ungültige User ID'),
  query('action')
    .optional()
    .isString()
    .withMessage('Action muss ein String sein'),
  query('entity_type')
    .optional()
    .isString()
    .withMessage('Entity Type muss ein String sein'),
  query('timerange')
    .optional()
    .isString()
    .withMessage('Timerange muss ein String sein'),
  body('password')
    .optional()
    .isString()
    .withMessage('Passwort muss ein String sein'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const userId = req.query.user_id
      ? parseInt(req.query.user_id as string)
      : null;
    const action = (req.query.action as string) || null;
    const entityType = (req.query.entity_type as string) || null;
    const timerange = (req.query.timerange as string) || null;
    const password = req.body.password;

    // Check if no specific filters are provided (meaning "all actions" deletion)
    const noSpecificFilters = !userId && !action && !entityType && !timerange;

    // If deleting all logs (no filters), require password verification
    if (noSpecificFilters) {
      if (!password) {
        res.status(403).json({
          success: false,
          error: 'Root-Passwort erforderlich für das Löschen aller Logs',
        });
        return;
      }

      // Verify root password
      try {
        const [rootUser] = await executeQuery<any[]>(
          'SELECT password FROM users WHERE id = ? AND role = "root"',
          [req.user.id]
        );

        if (!rootUser.length) {
          res.status(403).json({
            success: false,
            error: 'Zugriff verweigert',
          });
          return;
        }

        const passwordMatch = await bcrypt.compare(
          password,
          rootUser[0].password
        );
        if (!passwordMatch) {
          res.status(403).json({
            success: false,
            error: 'Ungültiges Root-Passwort',
          });
          return;
        }
      } catch (error) {
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
      const params: any[] = [];

      if (userId) {
        conditions.push('user_id = ?');
        params.push(userId);
      }

      if (action) {
        conditions.push('action = ?');
        params.push(action);
      }

      if (entityType) {
        conditions.push('entity_type = ?');
        params.push(entityType);
      }

      if (timerange) {
        let dateCondition = '';

        switch (timerange) {
          case 'today':
            dateCondition = 'DATE(created_at) = CURDATE()';
            break;
          case 'yesterday':
            dateCondition =
              'DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)';
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

        if (dateCondition) {
          conditions.push(`(${dateCondition})`);
        }
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Delete logs matching the filters
      const [result] = await executeQuery<any>(
        `
        DELETE FROM activity_logs
        ${whereClause}
      `,
        params
      );

      const deletedCount = result.affectedRows || 0;

      // Create a human-readable description of what was deleted
      const filterDescriptions: string[] = [];
      if (userId) {
        // Get username for the filter
        const [userInfo] = await executeQuery<any[]>(
          'SELECT CONCAT(first_name, " ", last_name) as name FROM users WHERE id = ?',
          [userId]
        );
        filterDescriptions.push(
          `Benutzer: ${userInfo[0]?.name || `ID ${userId}`}`
        );
      }
      if (action) {
        const actionLabels: { [key: string]: string } = {
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
        filterDescriptions.push(`Aktion: ${actionLabels[action] || action}`);
      }
      if (entityType) {
        filterDescriptions.push(`Typ: ${entityType}`);
      }
      if (timerange) {
        const timeLabels: { [key: string]: string } = {
          today: 'Heute',
          yesterday: 'Gestern',
          week: 'Letzte 7 Tage',
          month: 'Letzter Monat',
          '3months': 'Letzte 3 Monate',
          '6months': 'Letzte 6 Monate',
          year: 'Letztes Jahr',
        };
        filterDescriptions.push(
          `Zeitraum: ${timeLabels[timerange] || timerange}`
        );
      }

      const detailsText = `${deletedCount} Logs gelöscht. Filter: ${filterDescriptions.join(', ')}`;

      // Log this deletion action with better details
      await createLog(
        req.user.id,
        'delete',
        'logs',
        undefined,
        detailsText,
        req.ip,
        req.get('user-agent')
      );

      logger.info(
        `User ${req.user.id} deleted ${deletedCount} logs with filters:`,
        { userId, action, entityType, timerange }
      );

      res.json({
        success: true,
        deletedCount,
        message: `${deletedCount} Logs wurden erfolgreich gelöscht.`,
      });
    } catch (error) {
      logger.error('Error deleting logs:', error);
      res.status(500).json({
        success: false,
        error: 'Fehler beim Löschen der Logs',
      });
    }
  }
);

// Log-Eintrag erstellen (interne Funktion)
export async function createLog(
  userId: number,
  action: string,
  entityType?: string,
  entityId?: number,
  details?: string,
  ipAddress?: string,
  userAgent?: string
) {
  try {
    await executeQuery(
      `
      INSERT INTO activity_logs 
      (user_id, action, entity_type, entity_id, details, ip_address, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `,
      [userId, action, entityType, entityId, details, ipAddress, userAgent]
    );
  } catch (error) {
    logger.error('Error creating log entry:', error);
  }
}

export default router;
