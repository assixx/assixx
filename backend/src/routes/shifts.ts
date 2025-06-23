/**
 * Shift Planning Routes
 * API endpoints for shift planning system
 * @swagger
 * tags:
 *   name: Shifts
 *   description: Shift planning and management
 */

import express, { Router, Request } from 'express';
import { authenticateToken } from '../auth';

// Import models (now ES modules)
import Shift, { ShiftPlanFilters, ShiftExchangeFilters } from '../models/shift';
import db from '../database';

const router: Router = express.Router();

// Extended Request interfaces
interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    username: string;
    email: string;
    role: string;
    tenant_id: number;
  };
}

/* Unused interfaces - kept for future reference
interface ShiftTemplatesRequest extends AuthenticatedRequest {}

interface ShiftCreateTemplateRequest extends AuthenticatedRequest {
  body: {
    name: string;
    start_time: string;
    end_time: string;
    break_duration?: number;
    required_staff?: number;
    description?: string;
    color?: string;
    is_active?: boolean;
  };
}

interface ShiftPlansRequest extends AuthenticatedRequest {
  query: {
    department_id?: string;
    team_id?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
    page?: string;
    limit?: string;
  };
}

interface ShiftCreatePlanRequest extends AuthenticatedRequest {
  body: {
    name: string;
    start_date: string;
    end_date: string;
    department_id?: number;
    team_id?: number;
    description?: string;
    status?: string;
  };
}

interface ShiftPlanByIdRequest extends AuthenticatedRequest {
  params: {
    planId: string;
  };
}

interface ShiftCreateRequest extends AuthenticatedRequest {
  body: {
    shift_plan_id?: number;
    template_id?: number;
    date: string;
    start_time: string;
    end_time: string;
    break_duration?: number;
    required_staff?: number;
    department_id?: number;
    team_id?: number;
    description?: string;
    notes?: string;
  };
}

interface ShiftAssignRequest extends AuthenticatedRequest {
  params: {
    shiftId: string;
  };
  body: {
    user_id: number;
    role?: string;
    notes?: string;
    status?: string;
  };
}

interface ShiftAvailabilityGetRequest extends AuthenticatedRequest {
  query: {
    start_date: string;
    end_date: string;
    user_id?: string;
  };
}

interface ShiftAvailabilitySetRequest extends AuthenticatedRequest {
  body: {
    user_id?: number;
    date: string;
    availability_type: string;
    start_time?: string;
    end_time?: string;
    notes?: string;
  };
}
*/

/* More unused interfaces - kept for future reference
interface ShiftExchangeRequestsRequest extends AuthenticatedRequest {
  query: {
    status?: string;
    limit?: string;
  };
}

interface ShiftCreateExchangeRequest extends AuthenticatedRequest {
  body: {
    original_shift_id: number;
    requested_date?: string;
    requested_time?: string;
    reason?: string;
    notes?: string;
  };
}

interface ShiftMyShiftsRequest extends AuthenticatedRequest {
  query: {
    start_date: string;
    end_date: string;
  };
}

interface ShiftDashboardRequest extends AuthenticatedRequest {}

interface ShiftWeeklyRequest extends AuthenticatedRequest {
  query: {
    start_date: string;
    end_date: string;
  };
}
*/

/* Unused interfaces - kept for future reference
interface ShiftWeeklyNotesGetRequest extends AuthenticatedRequest {
  query: {
    week: string;
    year: string;
  };
}

interface ShiftWeeklyNotesSetRequest extends AuthenticatedRequest {
  body: {
    week: string;
    year: string;
    notes?: string;
    context?: string;
  };
}
*/

// Middleware to check shift planning feature - temporarily disabled
// router.use(checkFeature('shift_planning'));

/**
 * @swagger
 * /shifts/templates:
 *   get:
 *     summary: Get all shift templates
 *     description: Retrieve all available shift templates for the tenant
 *     tags: [Shifts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Shift templates retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 templates:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ShiftTemplate'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Fehler beim Laden der Schichtvorlagen
 */
/**
 * Get all shift templates
 * GET /api/shifts/templates
 */
router.get('/templates', authenticateToken, async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    // Use default tenant ID 1 for now (can be improved later)
    const tenantId = authReq.user.tenant_id || 1;
    const templates = await Shift.getShiftTemplates(tenantId);
    res.json({ templates });
  } catch (error: any) {
    console.error('Error fetching shift templates:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden der Schichtvorlagen',
    });
  }
});

/**
 * Create a new shift template
 * POST /api/shifts/templates
 */
router.post(
  '/templates',
  authenticateToken,
  async (req, res): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      // Check if user has permission to create templates (admin, manager, team_lead)
      const userRole = authReq.user.role;
      if (!['admin', 'root', 'manager', 'team_lead'].includes(userRole)) {
        res.status(403).json({
          success: false,
          message: 'Keine Berechtigung zum Erstellen von Schichtvorlagen',
        });
        return;
      }

      const templateData = {
        ...req.body,
        tenant_id: authReq.user.tenant_id || 1,
        created_by: authReq.user.id,
      };

      const template = await Shift.createShiftTemplate(templateData);
      res.status(201).json({
        success: true,
        message: 'Schichtvorlage erfolgreich erstellt',
        template,
      });
    } catch (error: any) {
      console.error('Error creating shift template:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Fehler beim Erstellen der Schichtvorlage',
      });
    }
  }
);

/**
 * @swagger
 * /shifts/plans:
 *   get:
 *     summary: Get all shift plans
 *     description: Retrieve shift plans with optional filtering
 *     tags: [Shifts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: department_id
 *         schema:
 *           type: integer
 *         description: Filter by department ID
 *       - in: query
 *         name: team_id
 *         schema:
 *           type: integer
 *         description: Filter by team ID
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter plans starting from this date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter plans ending before this date
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, published, archived]
 *         description: Filter by plan status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Shift plans retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 plans:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ShiftPlan'
 *                 total:
 *                   type: integer
 *                   description: Total number of plans
 *                 page:
 *                   type: integer
 *                   description: Current page
 *                 limit:
 *                   type: integer
 *                   description: Items per page
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 */
/**
 * Get all shift plans
 * GET /api/shifts/plans
 */
router.get('/plans', authenticateToken, async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const options: ShiftPlanFilters = {
      department_id: req.query.department_id
        ? parseInt(String(req.query.department_id), 10)
        : undefined,
      team_id: req.query.team_id
        ? parseInt(String(req.query.team_id), 10)
        : undefined,
      start_date: req.query.start_date
        ? String(req.query.start_date)
        : undefined,
      end_date: req.query.end_date ? String(req.query.end_date) : undefined,
      status: req.query.status
        ? (String(req.query.status) as 'draft' | 'published' | 'archived')
        : undefined,
      page: parseInt(String(req.query.page || '1'), 10),
      limit: parseInt(String(req.query.limit || '20'), 10),
    };

    // Use the actual model function
    const tenantId = authReq.user.tenant_id || 1;
    const userId = authReq.user.id;
    const result = await Shift.getShiftPlans(tenantId, userId, options);
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching shift plans:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden der Schichtpläne',
    });
  }
});

/**
 * Create a new shift plan
 * POST /api/shifts/plans
 */
router.post('/plans', authenticateToken, async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    // Check if user has permission to create plans (admin, manager, team_lead)
    const userRole = authReq.user.role;
    if (!['admin', 'root', 'manager', 'team_lead'].includes(userRole)) {
      res.status(403).json({
        success: false,
        message: 'Keine Berechtigung zum Erstellen von Schichtplänen',
      });
      return;
    }

    // Validate required fields
    const { name, start_date, end_date } = req.body;
    if (!name || !start_date || !end_date) {
      res.status(400).json({
        success: false,
        message: 'Name, Startdatum und Enddatum sind erforderlich',
      });
      return;
    }

    const planData = {
      ...req.body,
      tenant_id: authReq.user.tenant_id || 1,
      created_by: authReq.user.id,
    };

    // Use the actual model function
    const plan = await Shift.createShiftPlan(planData);
    res.status(201).json({
      success: true,
      message: 'Schichtplan erfolgreich erstellt',
      plan,
    });
  } catch (error: any) {
    console.error('Error creating shift plan:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Fehler beim Erstellen des Schichtplans',
    });
  }
});

/**
 * Get shifts for a specific plan
 * GET /api/shifts/plans/:planId/shifts
 */
router.get(
  '/plans/:planId/shifts',
  authenticateToken,
  async (req, res): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const planId = parseInt(req.params.planId);
      const shifts = await Shift.getShiftsByPlan(
        planId,
        authReq.user.tenant_id || 1,
        authReq.user.id
      );
      res.json({ shifts });
    } catch (error: any) {
      console.error('Error fetching shifts for plan:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Fehler beim Laden der Schichten',
      });
    }
  }
);

/**
 * Get shifts for date range
 * GET /api/shifts?start=...&end=...
 */
router.get('/', authenticateToken, async (req, res): Promise<void> => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      res.status(400).json({
        success: false,
        message: 'Start- und Enddatum sind erforderlich',
      });
      return;
    }

    // Parse dates from query strings
    const startDate = new Date(String(start));
    const endDate = new Date(String(end));

    // Format dates for SQL query
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user.tenant_id || 1;

    try {
      // Build query based on user role
      let query = `
        SELECT 
          sa.id,
          sa.shift_id,
          sa.user_id as employee_id,
          s.date,
          s.start_time,
          s.end_time,
          CASE 
            WHEN TIME(s.start_time) = '06:00:00' THEN 'early'
            WHEN TIME(s.start_time) = '14:00:00' THEN 'late'
            WHEN TIME(s.start_time) = '22:00:00' THEN 'night'
            ELSE 'custom'
          END as shift_type,
          s.department_id,
          s.team_id,
          sa.notes,
          u.first_name,
          u.last_name,
          u.username
        FROM shift_assignments sa
        JOIN shifts s ON sa.shift_id = s.id
        JOIN users u ON sa.user_id = u.id
        WHERE s.tenant_id = ?
          AND s.date BETWEEN ? AND ?
          AND sa.status = 'accepted'
      `;

      const queryParams: any[] = [tenantId, startStr, endStr];

      // For employees, filter by their department
      if (authReq.user.role === 'employee') {
        // First get the employee's department
        const [userRows] = await (db as any).execute(
          'SELECT department_id FROM users WHERE id = ? AND tenant_id = ?',
          [authReq.user.id, tenantId]
        );

        if (userRows.length > 0 && userRows[0].department_id) {
          query += ' AND s.department_id = ?';
          queryParams.push(userRows[0].department_id);
        }
      }

      query += ' ORDER BY s.date, s.start_time';

      const [rows] = await (db as any).execute(query, queryParams);

      res.json({
        success: true,
        shifts: rows || [],
      });
    } catch (error) {
      console.error('Error fetching shifts:', error);
      // Return empty array on error
      res.json({
        success: true,
        shifts: [],
      });
    }
  } catch (error: any) {
    console.error('Error fetching shifts:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden der Schichten',
    });
  }
});

/**
 * Get shift notes for a week
 * GET /api/shifts/notes?week=...
 */
router.get('/notes', authenticateToken, async (req, res): Promise<void> => {
  try {
    const { week, department_id } = req.query;

    if (!week) {
      res.status(400).json({
        success: false,
        message: 'Woche ist erforderlich',
      });
      return;
    }

    // Parse week date
    const weekDate = new Date(String(week));
    const weekStart = weekDate.toISOString().split('T')[0];

    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user.tenant_id || 1;

    try {
      let departmentId: number | null = null;

      // For employees, get their department
      if (authReq.user.role === 'employee') {
        const [userRows] = await (db as any).execute(
          'SELECT department_id FROM users WHERE id = ? AND tenant_id = ?',
          [authReq.user.id, tenantId]
        );
        if (userRows.length > 0 && userRows[0].department_id) {
          departmentId = userRows[0].department_id;
        }
      } else if (department_id) {
        // For admins, use the provided department_id
        departmentId = parseInt(String(department_id), 10);
      }

      if (!departmentId) {
        console.log(
          '[SHIFTS NOTES] No department_id available, returning empty notes'
        );
        res.json({
          success: true,
          notes: '',
        });
        return;
      }

      // Query shift notes for the week and department
      const query = `
        SELECT notes
        FROM weekly_shift_notes
        WHERE tenant_id = ?
          AND department_id = ?
          AND date = ?
        LIMIT 1
      `;

      console.log('[SHIFTS NOTES] Querying notes:', {
        tenantId,
        departmentId,
        weekStart,
      });
      const [rows] = await (db as any).execute(query, [
        tenantId,
        departmentId,
        weekStart,
      ]);
      console.log('[SHIFTS NOTES] Query result rows:', rows);

      let notes = '';
      if (rows && rows.length > 0 && rows[0].notes) {
        // Convert Buffer to string if necessary
        if (Buffer.isBuffer(rows[0].notes)) {
          notes = rows[0].notes.toString('utf8');
          console.log('[SHIFTS NOTES] Converted buffer to string:', notes);
        } else if (
          typeof rows[0].notes === 'object' &&
          rows[0].notes.type === 'Buffer'
        ) {
          // Handle the case where it's a plain object with Buffer data
          notes = Buffer.from(rows[0].notes.data).toString('utf8');
          console.log(
            '[SHIFTS NOTES] Converted buffer object to string:',
            notes
          );
        } else {
          notes = rows[0].notes;
        }
      }

      console.log(
        '[SHIFTS NOTES] Found notes:',
        notes ? `Yes: "${notes}"` : 'No'
      );
      console.log('[SHIFTS NOTES] Returning notes:', notes);

      res.json({
        success: true,
        notes: notes || '',
      });
    } catch (error) {
      console.error('Error fetching shift notes:', error);
      // Return empty notes on error
      res.json({
        success: true,
        notes: '',
      });
    }
  } catch (error: any) {
    console.error('Error fetching shift notes:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden der Notizen',
    });
  }
});

/**
 * Create a new shift or save weekly shift plan
 * POST /api/shifts
 */
router.post('/', authenticateToken, async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    // Check if user has permission to create shifts (admin, manager, team_lead)
    const userRole = authReq.user.role;
    if (!['admin', 'root', 'manager', 'team_lead'].includes(userRole)) {
      res.status(403).json({
        success: false,
        message: 'Keine Berechtigung zum Erstellen von Schichten',
      });
      return;
    }

    const tenantId = authReq.user.tenant_id || 1;
    const { week_start, week_end, assignments, notes } = req.body;

    // Check if this is a weekly shift plan save
    if (week_start && week_end && assignments) {
      // Validate that all assignments have department_id
      const invalidAssignments = assignments.filter(
        (a: any) => !a.department_id
      );
      if (invalidAssignments.length > 0) {
        res.status(400).json({
          success: false,
          message: 'Abteilung muss für alle Schichten ausgewählt werden',
        });
        return;
      }
      // Get a connection for transaction
      const connection = await (db as any).getConnection();

      try {
        // Start transaction
        await connection.beginTransaction();

        // Delete existing assignments for this week
        const deleteQuery = `
          DELETE sa FROM shift_assignments sa
          JOIN shifts s ON sa.shift_id = s.id
          WHERE s.tenant_id = ?
            AND s.date BETWEEN ? AND ?
        `;
        await connection.execute(deleteQuery, [tenantId, week_start, week_end]);

        // Delete existing shifts for this week
        const deleteShiftsQuery = `
          DELETE FROM shifts
          WHERE tenant_id = ?
            AND date BETWEEN ? AND ?
        `;
        await connection.execute(deleteShiftsQuery, [
          tenantId,
          week_start,
          week_end,
        ]);

        // Create shifts and assignments
        for (const assignment of assignments) {
          // First create the shift
          const shiftTimes = {
            early: { start: '06:00:00', end: '14:00:00' },
            late: { start: '14:00:00', end: '22:00:00' },
            night: { start: '22:00:00', end: '06:00:00' },
          };
          const shiftTime = shiftTimes[
            assignment.shift_type as keyof typeof shiftTimes
          ] || { start: '08:00:00', end: '16:00:00' };

          // Convert date and time to datetime
          const startDateTime = `${assignment.shift_date} ${shiftTime.start}`;
          const endDateTime =
            assignment.shift_type === 'night'
              ? `${assignment.shift_date} ${shiftTime.end}` // Night shift ends next day at 6am, handle this later
              : `${assignment.shift_date} ${shiftTime.end}`;

          const [shiftResult] = await connection.execute(
            `INSERT INTO shifts (tenant_id, user_id, date, start_time, end_time, title, required_employees, department_id, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              tenantId,
              assignment.employee_id,
              assignment.shift_date,
              startDateTime,
              endDateTime,
              assignment.shift_type,
              1, // required_employees
              assignment.department_id || null,
              authReq.user.id,
            ]
          );

          const shiftId = shiftResult.insertId;

          // Then create the assignment
          await connection.execute(
            `INSERT INTO shift_assignments (tenant_id, shift_id, user_id, assignment_type, status, assigned_by)
             VALUES (?, ?, ?, 'assigned', 'accepted', ?)`,
            [tenantId, shiftId, assignment.employee_id, authReq.user.id]
          );
        }

        // Save weekly notes if provided and department_id exists
        if (
          notes !== undefined &&
          assignments.length > 0 &&
          assignments[0].department_id
        ) {
          // Ensure notes is a string
          const notesString = notes || '';
          console.log('[SHIFTS SAVE] Saving weekly notes:', {
            tenantId,
            departmentId: assignments[0].department_id,
            weekStart: week_start,
            notes: notesString ? 'Yes' : 'Empty',
          });

          await connection.execute(
            `INSERT INTO weekly_shift_notes (tenant_id, department_id, date, notes, created_by)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE notes = VALUES(notes), updated_at = NOW()`,
            [
              tenantId,
              assignments[0].department_id,
              week_start,
              notesString,
              authReq.user.id,
            ]
          );
        }

        // Commit transaction
        await connection.commit();

        res.json({
          success: true,
          message: 'Schichtplan erfolgreich gespeichert',
        });
      } catch (error) {
        // Rollback on error
        await connection.rollback();
        throw error;
      } finally {
        // Always release the connection
        connection.release();
      }
    } else {
      // Single shift creation (existing logic)
      const shiftData = {
        ...req.body,
        tenant_id: tenantId,
        created_by: authReq.user.id,
      };

      const shift = await Shift.createShift(shiftData);
      res.status(201).json({
        success: true,
        message: 'Schicht erfolgreich erstellt',
        shift,
      });
    }
  } catch (error: any) {
    console.error('Error creating shift:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Fehler beim Erstellen der Schicht',
    });
  }
});

/**
 * Assign employee to shift
 * POST /api/shifts/:shiftId/assign
 */
router.post(
  '/:shiftId/assign',
  authenticateToken,
  async (req, res): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      // Check if user has permission to assign shifts (admin, manager, team_lead)
      const userRole = authReq.user.role;
      if (!['admin', 'root', 'manager', 'team_lead'].includes(userRole)) {
        res.status(403).json({
          success: false,
          message: 'Keine Berechtigung zum Zuweisen von Schichten',
        });
        return;
      }

      const shiftId = parseInt(req.params.shiftId);
      const assignmentData = {
        ...req.body,
        tenant_id: authReq.user.tenant_id || 1,
        shift_id: shiftId,
        assigned_by: authReq.user.id,
      };

      const assignment = await Shift.assignEmployeeToShift(assignmentData);
      res.status(201).json({
        success: true,
        message: 'Mitarbeiter erfolgreich zugewiesen',
        assignment,
      });
    } catch (error: any) {
      console.error('Error assigning employee to shift:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Fehler beim Zuweisen des Mitarbeiters',
      });
    }
  }
);

/**
 * Get employee availability
 * GET /api/shifts/availability
 */
router.get(
  '/availability',
  authenticateToken,
  async (req, res): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { start_date, end_date, user_id } = req.query;

      if (!start_date || !end_date) {
        res.status(400).json({
          success: false,
          message: 'Start- und Enddatum sind erforderlich',
        });
        return;
      }

      // Use provided user_id or current user's id
      const targetUserId = user_id
        ? parseInt(user_id as string)
        : authReq.user.id;

      // Check if user can view this availability
      if (targetUserId !== authReq.user.id) {
        const userRole = authReq.user.role;
        if (!['admin', 'root', 'manager', 'team_lead'].includes(userRole)) {
          res.status(403).json({
            success: false,
            message: 'Keine Berechtigung zum Anzeigen der Verfügbarkeit',
          });
          return;
        }
      }

      const availability = await Shift.getEmployeeAvailability(
        authReq.user.tenant_id || 1,
        targetUserId,
        String(start_date),
        String(end_date)
      );

      res.json({ availability });
    } catch (error: any) {
      console.error('Error fetching employee availability:', error);
      res.status(500).json({
        success: false,
        message: 'Fehler beim Laden der Verfügbarkeit',
      });
    }
  }
);

/**
 * Set employee availability
 * POST /api/shifts/availability
 */
router.post(
  '/availability',
  authenticateToken,
  async (req, res): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const availabilityData = {
        ...req.body,
        tenant_id: authReq.user.tenant_id || 1,
        user_id: req.body.user_id || authReq.user.id,
      };

      // Check if user can set this availability
      if (availabilityData.user_id !== authReq.user.id) {
        const userRole = authReq.user.role;
        if (!['admin', 'root', 'manager', 'team_lead'].includes(userRole)) {
          res.status(403).json({
            success: false,
            message: 'Keine Berechtigung zum Setzen der Verfügbarkeit',
          });
          return;
        }
      }

      const availability =
        await Shift.setEmployeeAvailability(availabilityData);
      res.json({
        success: true,
        message: 'Verfügbarkeit erfolgreich gesetzt',
        availability,
      });
    } catch (error: any) {
      console.error('Error setting employee availability:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Fehler beim Setzen der Verfügbarkeit',
      });
    }
  }
);

/**
 * Get shift exchange requests
 * GET /api/shifts/exchange-requests
 */
router.get(
  '/exchange-requests',
  authenticateToken,
  async (req, res): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const options: ShiftExchangeFilters = {
        status: req.query.status
          ? (String(req.query.status) as
              | 'pending'
              | 'approved'
              | 'rejected'
              | 'cancelled')
          : 'pending',
        limit: parseInt(String(req.query.limit || '50'), 10),
      };

      const requests = await Shift.getShiftExchangeRequests(
        authReq.user.tenant_id || 1,
        authReq.user.id,
        options
      );

      res.json({ requests });
    } catch (error: any) {
      console.error('Error fetching shift exchange requests:', error);
      res.status(500).json({
        success: false,
        message: 'Fehler beim Laden der Tauschbörse',
      });
    }
  }
);

/**
 * Create shift exchange request
 * POST /api/shifts/exchange-requests
 */
router.post(
  '/exchange-requests',
  authenticateToken,
  async (req, res): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const requestData = {
        ...req.body,
        tenant_id: authReq.user.tenant_id || 1,
        requester_id: authReq.user.id,
      };

      const request = await Shift.createShiftExchangeRequest(requestData);
      res.status(201).json({
        success: true,
        message: 'Tauschantrag erfolgreich erstellt',
        request,
      });
    } catch (error: any) {
      console.error('Error creating shift exchange request:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Fehler beim Erstellen des Tauschantrags',
      });
    }
  }
);

/**
 * Get employee shifts
 * GET /api/shifts/my-shifts
 */
router.get('/my-shifts', authenticateToken, async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      res.status(400).json({
        success: false,
        message: 'Start- und Enddatum sind erforderlich',
      });
      return;
    }

    const shifts = await Shift.getEmployeeShifts(
      authReq.user.tenant_id || 1,
      authReq.user.id,
      String(start_date),
      String(end_date)
    );

    res.json({ shifts });
  } catch (error: any) {
    console.error('Error fetching employee shifts:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden der eigenen Schichten',
    });
  }
});

/**
 * Get dashboard summary for shift planning
 * GET /api/shifts/dashboard
 */
router.get('/dashboard', authenticateToken, async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user.tenant_id || 1;
    const userId = authReq.user.id;

    // Get upcoming shifts for this week
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    const upcomingShifts = await Shift.getEmployeeShifts(
      tenantId,
      userId,
      today.toISOString().split('T')[0],
      nextWeek.toISOString().split('T')[0]
    );

    // Get pending exchange requests
    const exchangeRequests = await Shift.getShiftExchangeRequests(
      tenantId,
      userId,
      { status: 'pending', limit: 5 }
    );

    // Get availability status for this week
    const availability = await Shift.getEmployeeAvailability(
      tenantId,
      userId,
      today.toISOString().split('T')[0],
      nextWeek.toISOString().split('T')[0]
    );

    res.json({
      upcomingShifts: upcomingShifts.slice(0, 5), // Next 5 shifts
      exchangeRequests,
      availability,
      stats: {
        totalUpcomingShifts: upcomingShifts.length,
        pendingExchanges: exchangeRequests.length,
        availabilityDays: availability.filter(
          (a: any) => a.availability_type === 'available'
        ).length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching shift dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden des Schichtplan-Dashboards',
    });
  }
});

/**
 * Get weekly shifts with assignments
 * GET /api/shifts/weekly
 */
router.get('/weekly', authenticateToken, async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      res.status(400).json({
        success: false,
        message: 'Start- und Enddatum sind erforderlich',
      });
      return;
    }

    const tenantId = authReq.user.tenant_id || 1;

    // Get shifts with assignments for the week
    const query = `
      SELECT s.*, sa.user_id, sa.status as assignment_status,
             u.first_name, u.last_name, u.username,
             CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as employee_name
      FROM shifts s
      LEFT JOIN shift_assignments sa ON s.id = sa.shift_id
      LEFT JOIN users u ON sa.user_id = u.id
      WHERE s.tenant_id = ? AND s.date >= ? AND s.date <= ?
      ORDER BY s.date ASC, s.start_time ASC
    `;

    const [shifts] = await (db as any).execute(query, [
      tenantId,
      start_date,
      end_date,
    ]);

    res.json({
      success: true,
      shifts,
    });
  } catch (error: any) {
    console.error('Error fetching weekly shifts:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden der Wochenschichten',
    });
  }
});

/**
 * Get weekly notes
 * GET /api/shifts/weekly-notes
 */
router.get(
  '/weekly-notes',
  authenticateToken as any,
  async (req: any, res: any): Promise<void> => {
    try {
      // const authReq = req as AuthenticatedRequest; // Unused
      const { week, year } = req.query;

      if (!week || !year) {
        res.status(400).json({
          success: false,
          message: 'Week and year are required',
        });
        return;
      }

      // For now, return empty notes
      res.json({ notes: '' });
    } catch (error: any) {
      console.error('Error fetching weekly notes:', error);
      res.status(500).json({
        success: false,
        message: 'Fehler beim Laden der Wochennotizen',
      });
    }
  }
);

/**
 * Save weekly notes
 * POST /api/shifts/notes
 */
router.post('/notes', authenticateToken, async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { week, notes, department_id } = req.body;

    if (!week) {
      res.status(400).json({
        success: false,
        message: 'Week date is required',
      });
      return;
    }

    const tenantId = authReq.user.tenant_id || 1;
    const weekDate = new Date(week).toISOString().split('T')[0];

    let departmentId: number | null = null;

    // For employees, get their department
    if (authReq.user.role === 'employee') {
      const [userRows] = await (db as any).execute(
        'SELECT department_id FROM users WHERE id = ? AND tenant_id = ?',
        [authReq.user.id, tenantId]
      );
      if (userRows.length > 0 && userRows[0].department_id) {
        departmentId = userRows[0].department_id;
      }
    } else if (department_id) {
      // For admins, use the provided department_id
      departmentId = parseInt(String(department_id), 10);
    }

    if (!departmentId) {
      console.error(
        '[SHIFTS NOTES] No department_id available for saving notes'
      );
      res.status(400).json({
        success: false,
        message: 'Abteilung ist erforderlich',
      });
      return;
    }

    console.log('[SHIFTS NOTES] Saving notes:', {
      tenantId,
      departmentId,
      weekDate,
      notes: notes ? 'Yes' : 'No',
    });

    // Insert or update notes
    const query = `
        INSERT INTO weekly_shift_notes (tenant_id, department_id, date, notes, created_by)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          notes = VALUES(notes),
          updated_at = NOW()
      `;

    await (db as any).execute(query, [
      tenantId,
      departmentId,
      weekDate,
      notes || '',
      authReq.user.id,
    ]);

    res.json({
      success: true,
      message: 'Notizen gespeichert',
    });
  } catch (error: any) {
    console.error('Error saving weekly notes:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Speichern der Wochennotizen',
    });
  }
});

/**
 * Save weekly notes (legacy endpoint for compatibility)
 * POST /api/shifts/weekly-notes
 */
router.post(
  '/weekly-notes',
  authenticateToken,
  async (req, res): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { week, year, notes } = req.body;

      if (!week || !year) {
        res.status(400).json({
          success: false,
          message: 'Week and year are required',
        });
        return;
      }

      // Convert week/year to date
      const weekDate = new Date();
      weekDate.setFullYear(parseInt(year));
      weekDate.setDate(weekDate.getDate() + (parseInt(week) - 1) * 7);
      const weekStart = weekDate.toISOString().split('T')[0];

      const tenantId = authReq.user.tenant_id || 1;

      // Insert or update notes
      const query = `
        INSERT INTO shift_notes (tenant_id, date, notes, created_by)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          notes = VALUES(notes),
          updated_at = NOW()
      `;

      await (db as any).execute(query, [
        tenantId,
        weekStart,
        notes || '',
        authReq.user.id,
      ]);

      res.json({
        success: true,
        message: 'Notizen gespeichert',
      });
    } catch (error: any) {
      console.error('Error saving weekly notes:', error);
      res.status(500).json({
        success: false,
        message: 'Fehler beim Speichern der Wochennotizen',
      });
    }
  }
);

export default router;

// CommonJS compatibility
