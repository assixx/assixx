import express from 'express';
import { authenticateToken, authorizeRole } from '../auth.js';
import { executeQuery } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { query, validationResult } from 'express-validator';

const router = express.Router();

// Logs abrufen (nur für Root)
router.get('/',
  authenticateToken,
  authorizeRole('root'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit muss zwischen 1 und 100 liegen'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset muss positiv sein'),
  query('user_id').optional().isInt({ min: 1 }).withMessage('Ungültige User ID'),
  query('action').optional().isString().withMessage('Action muss ein String sein'),
  query('entity_type').optional().isString().withMessage('Entity Type muss ein String sein'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const userId = req.query.user_id ? parseInt(req.query.user_id as string) : null;
    const action = req.query.action as string || null;
    const entityType = req.query.entity_type as string || null;

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

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Logs mit User-Informationen abrufen
      const [logs] = await executeQuery<any[]>(`
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
      `, [...params, limit, offset]);

      // Total count für Pagination
      const [countResult] = await executeQuery<any[]>(`
        SELECT COUNT(*) as total
        FROM activity_logs al
        ${whereClause}
      `, params);

      const total = countResult[0]?.total || 0;

      // Convert Buffer objects to strings
      const processedLogs = logs.map(log => ({
        ...log,
        details: log.details && typeof log.details === 'object' && Buffer.isBuffer(log.details) 
          ? log.details.toString('utf8') 
          : log.details,
        user_name: log.user_name && typeof log.user_name === 'object' && Buffer.isBuffer(log.user_name)
          ? log.user_name.toString('utf8')
          : log.user_name
      }));

      res.json({
        success: true,
        data: {
          logs: processedLogs,
          pagination: {
            limit,
            offset,
            total,
            hasMore: offset + limit < total
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching logs:', error);
      res.status(500).json({
        success: false,
        error: 'Fehler beim Abrufen der Logs'
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
    await executeQuery(`
      INSERT INTO activity_logs 
      (user_id, action, entity_type, entity_id, details, ip_address, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [userId, action, entityType, entityId, details, ipAddress, userAgent]);
  } catch (error) {
    logger.error('Error creating log entry:', error);
  }
}

export default router;