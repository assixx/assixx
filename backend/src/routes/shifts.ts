/**
 * Shift Planning Routes
 * API endpoints for shift planning system
 * @swagger
 * tags:
 *   name: Shifts
 *   description: Shift planning and management
 */

import { body, param, query } from "express-validator";
import { RowDataPacket, ResultSetHeader } from "mysql2";

import express, { Router } from "express";

import db, { executeQuery } from "../database";
import { security } from "../middleware/security";
import { createValidation } from "../middleware/validation";
import Shift, { ShiftPlanFilters, ShiftExchangeFilters } from "../models/shift";
import { successResponse, errorResponse } from "../types/response.types";
import { getErrorMessage } from "../utils/errorHandler";
import { typed } from "../utils/routeHandlers";

// Import models (now ES modules)

const router: Router = express.Router();

// Request body interfaces
interface ShiftTemplateBody {
  name: string;
  start_time: string;
  end_time: string;
  break_duration?: number;
  required_staff?: number;
  description?: string;
  color?: string;
  is_active?: boolean;
}

interface ShiftPlanBody {
  name: string;
  start_date: string;
  end_date: string;
  department_id?: number;
  team_id?: number;
  description?: string;
  status?: string;
}

interface ShiftBody {
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
}

interface WeeklyShiftBody {
  week_start: string;
  week_end: string;
  assignments: {
    employee_id: number;
    shift_date: string;
    shift_type: string;
    department_id?: number;
  }[];
  notes?: string;
}

interface AvailabilityRecord {
  availability_type: string;
  date?: string;
  [key: string]: unknown;
}

interface ShiftAssignmentBody {
  user_id: number;
  role?: string;
  notes?: string;
  status?: string;
}

interface AvailabilityBody {
  user_id?: number;
  date: string;
  availability_type: string;
  start_time?: string;
  end_time?: string;
  notes?: string;
}

interface ShiftExchangeBody {
  original_shift_id: number;
  requested_date?: string;
  requested_time?: string;
  reason?: string;
  notes?: string;
}

interface WeeklyNotesBody {
  week: string;
  notes?: string;
  department_id?: number;
  year?: string;
  context?: string;
}

// Validation schemas
const shiftTemplateValidation = createValidation([
  body("name").notEmpty().trim().withMessage("Name ist erforderlich"),
  body("start_time")
    .matches(/^\d{2}:\d{2}(:\d{2})?$/)
    .withMessage("Ungültige Startzeit"),
  body("end_time")
    .matches(/^\d{2}:\d{2}(:\d{2})?$/)
    .withMessage("Ungültige Endzeit"),
  body("break_duration").optional().isInt({ min: 0 }),
  body("required_staff").optional().isInt({ min: 1 }),
  body("color").optional().isIn(["blue", "green", "yellow", "red", "purple"]),
  body("is_active").optional().isBoolean(),
]);

const shiftPlanValidation = createValidation([
  body("name").notEmpty().trim().withMessage("Name ist erforderlich"),
  body("start_date").isISO8601().withMessage("Ungültiges Startdatum"),
  body("end_date").isISO8601().withMessage("Ungültiges Enddatum"),
  body("department_id").optional().isInt({ min: 1 }),
  body("team_id").optional().isInt({ min: 1 }),
  body("status").optional().isIn(["draft", "published", "archived"]),
]);

// Commented out - kept for future use
// const weeklyShiftValidation = createValidation([
//   body('week_start').isISO8601().withMessage('Ungültiges Startdatum'),
//   body('week_end').isISO8601().withMessage('Ungültiges Enddatum'),
//   body('assignments').isArray().withMessage('Zuweisungen müssen ein Array sein'),
//   body('assignments.*.employee_id').isInt({ min: 1 }),
//   body('assignments.*.shift_date').isISO8601(),
//   body('assignments.*.shift_type').notEmpty(),
//   body('assignments.*.department_id').optional().isInt({ min: 1 }),
//   body('notes').optional().isString()
// ]);

const assignmentValidation = createValidation([
  param("shiftId").isInt({ min: 1 }).withMessage("Ungültige Schicht-ID"),
  body("user_id").isInt({ min: 1 }).withMessage("Ungültige Benutzer-ID"),
  body("role").optional().isString(),
  body("status").optional().isIn(["pending", "accepted", "rejected"]),
]);

const availabilityValidation = createValidation([
  body("date").isISO8601().withMessage("Ungültiges Datum"),
  body("availability_type")
    .notEmpty()
    .withMessage("Verfügbarkeitstyp ist erforderlich"),
  body("user_id").optional().isInt({ min: 1 }),
  body("start_time")
    .optional()
    .matches(/^\d{2}:\d{2}(:\d{2})?$/),
  body("end_time")
    .optional()
    .matches(/^\d{2}:\d{2}(:\d{2})?$/),
]);

const exchangeRequestValidation = createValidation([
  body("original_shift_id")
    .isInt({ min: 1 })
    .withMessage("Ungültige Schicht-ID"),
  body("requested_date").optional().isISO8601(),
  body("requested_time")
    .optional()
    .matches(/^\d{2}:\d{2}(:\d{2})?$/),
  body("reason").optional().trim(),
]);

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
router.get(
  "/templates",
  ...security.user(),
  typed.auth(async (req, res) => {
    try {
      // Use default tenant ID 1 for now (can be improved later)
      const tenantId = req.user.tenant_id;
      const templates = await Shift.getShiftTemplates(tenantId);
      res.json(successResponse({ templates }));
    } catch (error: unknown) {
      console.error("Error fetching shift templates:", error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Laden der Schichtvorlagen", 500));
    }
  }),
);

/**
 * Create a new shift template
 * POST /api/shifts/templates
 */
router.post(
  "/templates",
  ...security.user(shiftTemplateValidation),
  typed.body<ShiftTemplateBody>(async (req, res) => {
    try {
      // Check if user has permission to create templates (admin, manager, team_lead)
      const userRole = req.user.role;
      if (!["admin", "root", "manager", "team_lead"].includes(userRole)) {
        res
          .status(403)
          .json(
            errorResponse(
              "Keine Berechtigung zum Erstellen von Schichtvorlagen",
              403,
            ),
          );
        return;
      }

      // Calculate duration_hours from start_time and end_time
      const startTime = new Date(`2000-01-01T${req.body.start_time}`);
      const endTime = new Date(`2000-01-01T${req.body.end_time}`);
      const durationMs = endTime.getTime() - startTime.getTime();
      const duration_hours = durationMs / (1000 * 60 * 60);

      const templateData = {
        ...req.body,
        tenant_id: req.user.tenant_id,
        created_by: req.user.id,
        duration_hours:
          duration_hours > 0 ? duration_hours : 24 + duration_hours, // Handle overnight shifts
      };

      const template = await Shift.createShiftTemplate(templateData);
      res
        .status(201)
        .json(successResponse(template, "Schichtvorlage erfolgreich erstellt"));
    } catch (error: unknown) {
      console.error("Error creating shift template:", error);
      res
        .status(500)
        .json(
          errorResponse(
            getErrorMessage(error) ||
              "Fehler beim Erstellen der Schichtvorlage",
            500,
          ),
        );
    }
  }),
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
router.get(
  "/plans",
  ...security.user(
    createValidation([
      query("department_id").optional().isInt({ min: 1 }),
      query("team_id").optional().isInt({ min: 1 }),
      query("start_date").optional().isISO8601(),
      query("end_date").optional().isISO8601(),
      query("status").optional().isIn(["draft", "published", "archived"]),
      query("page").optional().isInt({ min: 1 }),
      query("limit").optional().isInt({ min: 1, max: 100 }),
    ]),
  ),
  typed.auth(async (req, res) => {
    try {
      const options: ShiftPlanFilters = {
        department_id:
          req.query.department_id != null && req.query.department_id !== ""
            ? Number.parseInt(
                typeof req.query.department_id === "string"
                  ? req.query.department_id
                  : typeof req.query.department_id === "number"
                    ? String(req.query.department_id)
                    : "0",
                10,
              )
            : undefined,
        team_id:
          req.query.team_id != null && req.query.team_id !== ""
            ? Number.parseInt(
                typeof req.query.team_id === "string"
                  ? req.query.team_id
                  : typeof req.query.team_id === "number"
                    ? String(req.query.team_id)
                    : "0",
                10,
              )
            : undefined,
        start_date:
          req.query.start_date != null && req.query.start_date !== ""
            ? typeof req.query.start_date === "string"
              ? req.query.start_date
              : typeof req.query.start_date === "object"
                ? JSON.stringify(req.query.start_date)
                : String(req.query.start_date)
            : undefined,
        end_date:
          req.query.end_date != null && req.query.end_date !== ""
            ? typeof req.query.end_date === "string"
              ? req.query.end_date
              : typeof req.query.end_date === "object"
                ? JSON.stringify(req.query.end_date)
                : String(req.query.end_date)
            : undefined,
        status:
          req.query.status != null && req.query.status !== ""
            ? ((typeof req.query.status === "string"
                ? req.query.status
                : typeof req.query.status === "object"
                  ? JSON.stringify(req.query.status)
                  : String(req.query.status)) as
                | "draft"
                | "published"
                | "archived")
            : undefined,
        page: Number.parseInt(
          typeof req.query.page === "string"
            ? req.query.page
            : req.query.page != null
              ? typeof req.query.page === "number"
                ? String(req.query.page)
                : "1"
              : "1",
          10,
        ),
        limit: Number.parseInt(
          typeof req.query.limit === "string"
            ? req.query.limit
            : req.query.limit != null
              ? typeof req.query.limit === "number"
                ? String(req.query.limit)
                : "20"
              : "20",
          10,
        ),
      };

      // Use the actual model function
      const tenantId = req.user.tenant_id;
      const userId = req.user.id;
      const result = await Shift.getShiftPlans(tenantId, userId, options);
      res.json(successResponse(result));
    } catch (error: unknown) {
      console.error("Error fetching shift plans:", error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Laden der Schichtpläne", 500));
    }
  }),
);

/**
 * Create a new shift plan
 * POST /api/shifts/plans
 */
router.post(
  "/plans",
  ...security.user(shiftPlanValidation),
  typed.body<ShiftPlanBody>(async (req, res) => {
    try {
      // Check if user has permission to create plans (admin, manager, team_lead)
      const userRole = req.user.role;
      if (!["admin", "root", "manager", "team_lead"].includes(userRole)) {
        res
          .status(403)
          .json(
            errorResponse(
              "Keine Berechtigung zum Erstellen von Schichtplänen",
              403,
            ),
          );
        return;
      }

      const planData = {
        ...req.body,
        tenant_id: req.user.tenant_id,
        created_by: req.user.id,
      };

      // Use the actual model function
      const plan = await Shift.createShiftPlan(planData);
      res
        .status(201)
        .json(successResponse(plan, "Schichtplan erfolgreich erstellt"));
    } catch (error: unknown) {
      console.error("Error creating shift plan:", error);
      res.status(500).json(errorResponse(getErrorMessage(error), 500));
    }
  }),
);

/**
 * Get shifts for a specific plan
 * GET /api/shifts/plans/:planId/shifts
 */
router.get(
  "/plans/:planId/shifts",
  ...security.user(
    createValidation([
      param("planId").isInt({ min: 1 }).withMessage("Ungültige Plan-ID"),
    ]),
  ),
  typed.params<{ planId: string }>(async (req, res) => {
    try {
      const planId = Number.parseInt(req.params.planId);
      const shifts = await Shift.getShiftsByPlan(
        planId,
        req.user.tenant_id,
        req.user.id,
      );
      res.json(successResponse({ shifts }));
    } catch (error: unknown) {
      console.error("Error fetching shifts for plan:", error);
      res.status(500).json(errorResponse(getErrorMessage(error), 500));
    }
  }),
);

/**
 * Get shifts for date range
 * GET /api/shifts?start=...&end=...
 */
router.get(
  "/",
  ...security.user(
    createValidation([
      query("start")
        .notEmpty()
        .isISO8601()
        .withMessage("Startdatum ist erforderlich"),
      query("end")
        .notEmpty()
        .isISO8601()
        .withMessage("Enddatum ist erforderlich"),
    ]),
  ),
  typed.auth(async (req, res) => {
    try {
      const { start, end } = req.query;

      // Parse dates from query strings
      const startDate = new Date(
        typeof start === "string"
          ? start
          : typeof start === "object"
            ? JSON.stringify(start)
            : String(start),
      );
      const endDate = new Date(
        typeof end === "string"
          ? end
          : typeof end === "object"
            ? JSON.stringify(end)
            : String(end),
      );

      // Format dates for SQL query
      const startStr = startDate.toISOString().split("T")[0];
      const endStr = endDate.toISOString().split("T")[0];

      const tenantId = req.user.tenant_id;

      try {
        // Build query based on user role
        let sqlQuery = `
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

        const queryParams: unknown[] = [tenantId, startStr, endStr];

        // For employees, filter by their department
        if (req.user.role === "employee") {
          // First get the employee's department
          const [userRows] = await executeQuery<RowDataPacket[]>(
            "SELECT department_id FROM users WHERE id = ? AND tenant_id = ?",
            [req.user.id, tenantId],
          );

          if (
            userRows.length > 0 &&
            userRows[0].department_id != null &&
            userRows[0].department_id !== 0
          ) {
            sqlQuery += " AND s.department_id = ?";
            queryParams.push(userRows[0].department_id);
          }
        }

        sqlQuery += " ORDER BY s.date, s.start_time";

        const [rows] = await executeQuery<RowDataPacket[]>(
          sqlQuery,
          queryParams,
        );

        res.json(
          successResponse({
            shifts: rows,
          }),
        );
      } catch (error: unknown) {
        console.error("Error fetching shifts:", error);
        // Return empty array on error
        res.json(
          successResponse({
            shifts: [],
          }),
        );
      }
    } catch (error: unknown) {
      console.error("Error fetching shifts:", error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Laden der Schichten", 500));
    }
  }),
);

/**
 * Get shift notes for a week
 * GET /api/shifts/notes?week=...
 */
router.get(
  "/notes",
  ...security.user(
    createValidation([
      query("week")
        .notEmpty()
        .isISO8601()
        .withMessage("Woche ist erforderlich"),
      query("department_id").optional().isInt({ min: 1 }),
    ]),
  ),
  typed.auth(async (req, res) => {
    try {
      const { week, department_id } = req.query;

      // Parse week date
      const weekDate = new Date(
        typeof week === "string"
          ? week
          : typeof week === "object"
            ? JSON.stringify(week)
            : String(week),
      );
      const weekStart = weekDate.toISOString().split("T")[0];

      const tenantId = req.user.tenant_id;

      try {
        let departmentId: number | null = null;

        // For employees, get their department
        if (req.user.role === "employee") {
          const [userRows] = await executeQuery<RowDataPacket[]>(
            "SELECT department_id FROM users WHERE id = ? AND tenant_id = ?",
            [req.user.id, tenantId],
          );
          if (
            userRows.length > 0 &&
            userRows[0].department_id != null &&
            userRows[0].department_id !== 0
          ) {
            departmentId = userRows[0].department_id as number;
          }
        } else if (department_id !== undefined && department_id !== "") {
          // For admins, use the provided department_id
          departmentId = Number.parseInt(
            typeof department_id === "string"
              ? department_id
              : typeof department_id === "number"
                ? String(department_id)
                : "0",
            10,
          );
        }

        if (departmentId == null || departmentId === 0) {
          console.info(
            "[SHIFTS NOTES] No department_id available, returning empty notes",
          );
          res.json(
            successResponse({
              notes: "",
            }),
          );
          return;
        }

        // Query shift notes for the week and department
        const sqlQuery = `
        SELECT notes
        FROM weekly_shift_notes
        WHERE tenant_id = ?
          AND department_id = ?
          AND date = ?
        LIMIT 1
      `;

        console.info("[SHIFTS NOTES] Querying notes:", {
          tenantId,
          departmentId,
          weekStart,
        });
        const [rows] = await executeQuery<RowDataPacket[]>(sqlQuery, [
          tenantId,
          departmentId,
          weekStart,
        ]);
        console.info("[SHIFTS NOTES] Query result rows:", rows);

        let notes = "";
        if (rows.length > 0 && rows[0].notes != null) {
          // Convert Buffer to string if necessary
          if (Buffer.isBuffer(rows[0].notes)) {
            notes = rows[0].notes.toString("utf8");
            console.info("[SHIFTS NOTES] Converted buffer to string:", notes);
          } else if (
            typeof rows[0].notes === "object" &&
            (rows[0].notes as { type?: string }).type === "Buffer"
          ) {
            // Handle the case where it's a plain object with Buffer data
            notes = Buffer.from(
              (rows[0].notes as { data: number[] }).data,
            ).toString("utf8");
            console.info(
              "[SHIFTS NOTES] Converted buffer object to string:",
              notes,
            );
          } else {
            notes = rows[0].notes as string;
          }
        }

        console.info(
          "[SHIFTS NOTES] Found notes:",
          notes ? `Yes: "${notes}"` : "No",
        );
        console.info("[SHIFTS NOTES] Returning notes:", notes);

        res.json(
          successResponse({
            notes,
          }),
        );
      } catch (error: unknown) {
        console.error("Error fetching shift notes:", error);
        // Return empty notes on error
        res.json(
          successResponse({
            notes: "",
          }),
        );
      }
    } catch (error: unknown) {
      console.error("Error fetching shift notes:", error);
      res.status(500).json(errorResponse("Fehler beim Laden der Notizen", 500));
    }
  }),
);

/**
 * Create a new shift or save weekly shift plan
 * POST /api/shifts
 */
router.post(
  "/",
  ...security.user(
    createValidation([
      body("date").optional().isISO8601(),
      body("start_time")
        .optional()
        .matches(/^\d{2}:\d{2}(:\d{2})?$/),
      body("end_time")
        .optional()
        .matches(/^\d{2}:\d{2}(:\d{2})?$/),
      body("week_start").optional().isISO8601(),
      body("week_end").optional().isISO8601(),
      body("assignments").optional().isArray(),
      body("notes").optional().isString(),
    ]),
  ),
  typed.body<ShiftBody | WeeklyShiftBody>(async (req, res) => {
    try {
      // Check if user has permission to create shifts (admin, manager, team_lead)
      const userRole = req.user.role;
      if (!["admin", "root", "manager", "team_lead"].includes(userRole)) {
        res
          .status(403)
          .json(
            errorResponse(
              "Keine Berechtigung zum Erstellen von Schichten",
              403,
            ),
          );
        return;
      }

      const tenantId = req.user.tenant_id;
      const { week_start, week_end, assignments, notes } =
        req.body as WeeklyShiftBody;

      // Check if this is a weekly shift plan save
      if (week_start !== "" && week_end !== "" && assignments.length > 0) {
        // Validate that all assignments have department_id
        const invalidAssignments = assignments.filter(
          (a) => a.department_id == null || a.department_id === 0,
        );
        if (invalidAssignments.length > 0) {
          res
            .status(400)
            .json(
              errorResponse(
                "Abteilung muss für alle Schichten ausgewählt werden",
                400,
              ),
            );
          return;
        }
        // Get a connection for transaction
        const connection = await db.getConnection();

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
          await connection.execute(deleteQuery, [
            tenantId,
            week_start,
            week_end,
          ]);

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
              early: { start: "06:00:00", end: "14:00:00" },
              late: { start: "14:00:00", end: "22:00:00" },
              night: { start: "22:00:00", end: "06:00:00" },
            };
            const shiftTime =
              shiftTimes[assignment.shift_type as keyof typeof shiftTimes];

            // Convert date and time to datetime
            const startDateTime = `${assignment.shift_date} ${shiftTime.start}`;
            const endDateTime =
              assignment.shift_type === "night"
                ? `${assignment.shift_date} ${shiftTime.end}` // Night shift ends next day at 6am, handle this later
                : `${assignment.shift_date} ${shiftTime.end}`;

            const [shiftResult] = await connection.execute<ResultSetHeader>(
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
                assignment.department_id ?? null,
                req.user.id,
              ],
            );

            const shiftId = shiftResult.insertId;

            // Then create the assignment
            await connection.execute(
              `INSERT INTO shift_assignments (tenant_id, shift_id, user_id, assignment_type, status, assigned_by)
             VALUES (?, ?, ?, 'assigned', 'accepted', ?)`,
              [tenantId, shiftId, assignment.employee_id, req.user.id],
            );
          }

          // Save weekly notes if provided and department_id exists
          if (
            notes !== undefined &&
            assignments.length > 0 &&
            assignments[0].department_id != null &&
            assignments[0].department_id !== 0
          ) {
            // Ensure notes is a string
            const notesString = notes || "";
            console.info("[SHIFTS SAVE] Saving weekly notes:", {
              tenantId,
              departmentId: assignments[0].department_id,
              weekStart: week_start,
              notes: notesString ? "Yes" : "Empty",
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
                req.user.id,
              ],
            );
          }

          // Commit transaction
          await connection.commit();

          res.json(
            successResponse(null, "Schichtplan erfolgreich gespeichert"),
          );
        } catch (error: unknown) {
          // Rollback on error
          await connection.rollback();
          throw error;
        } finally {
          // Always release the connection
          connection.release();
        }
      } else {
        // Single shift creation (existing logic)
        const shiftBody = req.body as ShiftBody;
        const shiftData = {
          tenant_id: tenantId,
          plan_id: 1, // Default plan_id, should be provided by the frontend
          template_id: shiftBody.template_id,
          date: shiftBody.date,
          start_time: shiftBody.start_time,
          end_time: shiftBody.end_time,
          required_employees: shiftBody.required_staff,
          created_by: req.user.id,
        };

        const shift = await Shift.createShift(shiftData);
        res
          .status(201)
          .json(successResponse(shift, "Schicht erfolgreich erstellt"));
      }
    } catch (error: unknown) {
      console.error("Error creating shift:", error);
      res.status(500).json(errorResponse(getErrorMessage(error), 500));
    }
  }),
);

/**
 * Assign employee to shift
 * POST /api/shifts/:shiftId/assign
 */
router.post(
  "/:shiftId/assign",
  ...security.user(assignmentValidation),
  typed.paramsBody<{ shiftId: string }, ShiftAssignmentBody>(
    async (req, res) => {
      try {
        // Check if user has permission to assign shifts (admin, manager, team_lead)
        const userRole = req.user.role;
        if (!["admin", "root", "manager", "team_lead"].includes(userRole)) {
          res
            .status(403)
            .json(
              errorResponse(
                "Keine Berechtigung zum Zuweisen von Schichten",
                403,
              ),
            );
          return;
        }

        const shiftId = Number.parseInt(req.params.shiftId);
        const assignmentData = {
          ...req.body,
          tenant_id: req.user.tenant_id,
          shift_id: shiftId,
          assigned_by: req.user.id,
        };

        const assignment = await Shift.assignEmployeeToShift(assignmentData);
        res
          .status(201)
          .json(
            successResponse(assignment, "Mitarbeiter erfolgreich zugewiesen"),
          );
      } catch (error: unknown) {
        console.error("Error assigning employee to shift:", error);
        res.status(500).json(errorResponse(getErrorMessage(error), 500));
      }
    },
  ),
);

/**
 * Get employee availability
 * GET /api/shifts/availability
 */
router.get(
  "/availability",
  ...security.user(
    createValidation([
      query("start_date")
        .notEmpty()
        .isISO8601()
        .withMessage("Startdatum ist erforderlich"),
      query("end_date")
        .notEmpty()
        .isISO8601()
        .withMessage("Enddatum ist erforderlich"),
      query("user_id").optional().isInt({ min: 1 }),
    ]),
  ),
  typed.auth(async (req, res) => {
    try {
      const { start_date, end_date, user_id } = req.query;

      // Use provided user_id or current user's id
      const targetUserId =
        user_id != null && user_id !== ""
          ? Number.parseInt(user_id as string)
          : req.user.id;

      // Check if user can view this availability
      if (targetUserId !== req.user.id) {
        const userRole = req.user.role;
        if (!["admin", "root", "manager", "team_lead"].includes(userRole)) {
          res
            .status(403)
            .json(
              errorResponse(
                "Keine Berechtigung zum Anzeigen der Verfügbarkeit",
                403,
              ),
            );
          return;
        }
      }

      const availability = await Shift.getEmployeeAvailability(
        req.user.tenant_id,
        targetUserId,
        typeof start_date === "string"
          ? start_date
          : typeof start_date === "object"
            ? JSON.stringify(start_date)
            : String(start_date),
        typeof end_date === "string"
          ? end_date
          : typeof end_date === "object"
            ? JSON.stringify(end_date)
            : String(end_date),
      );

      res.json(successResponse({ availability }));
    } catch (error: unknown) {
      console.error("Error fetching employee availability:", error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Laden der Verfügbarkeit", 500));
    }
  }),
);

/**
 * Set employee availability
 * POST /api/shifts/availability
 */
router.post(
  "/availability",
  ...security.user(availabilityValidation),
  typed.body<AvailabilityBody>(async (req, res) => {
    try {
      const availabilityData = {
        tenant_id: req.user.tenant_id,
        user_id: req.body.user_id ?? req.user.id,
        date: req.body.date,
        availability_type: req.body.availability_type as
          | "available"
          | "unavailable"
          | "partial",
        start_time: req.body.start_time,
        end_time: req.body.end_time,
        notes: req.body.notes,
      };

      // Check if user can set this availability
      if (availabilityData.user_id !== req.user.id) {
        const userRole = req.user.role;
        if (!["admin", "root", "manager", "team_lead"].includes(userRole)) {
          res
            .status(403)
            .json(
              errorResponse(
                "Keine Berechtigung zum Setzen der Verfügbarkeit",
                403,
              ),
            );
          return;
        }
      }

      const availability =
        await Shift.setEmployeeAvailability(availabilityData);
      res.json(
        successResponse(availability, "Verfügbarkeit erfolgreich gesetzt"),
      );
    } catch (error: unknown) {
      console.error("Error setting employee availability:", error);
      res.status(500).json(errorResponse(getErrorMessage(error), 500));
    }
  }),
);

/**
 * Get shift exchange requests
 * GET /api/shifts/exchange-requests
 */
router.get(
  "/exchange-requests",
  ...security.user(
    createValidation([
      query("status")
        .optional()
        .isIn(["pending", "approved", "rejected", "cancelled"]),
      query("limit").optional().isInt({ min: 1, max: 100 }),
    ]),
  ),
  typed.auth(async (req, res) => {
    try {
      const options: ShiftExchangeFilters = {
        status:
          req.query.status != null && req.query.status !== ""
            ? ((typeof req.query.status === "string"
                ? req.query.status
                : typeof req.query.status === "object"
                  ? JSON.stringify(req.query.status)
                  : String(req.query.status)) as
                | "pending"
                | "approved"
                | "rejected"
                | "cancelled")
            : "pending",
        limit: Number.parseInt(
          typeof req.query.limit === "string"
            ? req.query.limit
            : req.query.limit != null
              ? typeof req.query.limit === "number"
                ? String(req.query.limit)
                : "50"
              : "50",
          10,
        ),
      };

      const requests = await Shift.getShiftExchangeRequests(
        req.user.tenant_id,
        req.user.id,
        options,
      );

      res.json(successResponse({ requests }));
    } catch (error: unknown) {
      console.error("Error fetching shift exchange requests:", error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Laden der Tauschbörse", 500));
    }
  }),
);

/**
 * Create shift exchange request
 * POST /api/shifts/exchange-requests
 */
router.post(
  "/exchange-requests",
  ...security.user(exchangeRequestValidation),
  typed.body<ShiftExchangeBody>(async (req, res) => {
    try {
      const requestData = {
        tenant_id: req.user.tenant_id,
        shift_id: req.body.original_shift_id,
        requester_id: req.user.id,
        target_user_id: null as number | null,
        exchange_type: "swap" as "swap" | "giveaway",
        target_shift_id: null as number | null,
        message: req.body.reason,
      };

      const request = await Shift.createShiftExchangeRequest(requestData);
      res
        .status(201)
        .json(successResponse(request, "Tauschantrag erfolgreich erstellt"));
    } catch (error: unknown) {
      console.error("Error creating shift exchange request:", error);
      res.status(500).json(errorResponse(getErrorMessage(error), 500));
    }
  }),
);

/**
 * Get employee shifts
 * GET /api/shifts/my-shifts
 */
router.get(
  "/my-shifts",
  ...security.user(
    createValidation([
      query("start_date")
        .notEmpty()
        .isISO8601()
        .withMessage("Startdatum ist erforderlich"),
      query("end_date")
        .notEmpty()
        .isISO8601()
        .withMessage("Enddatum ist erforderlich"),
    ]),
  ),
  typed.auth(async (req, res) => {
    try {
      const { start_date, end_date } = req.query;

      const shifts = await Shift.getEmployeeShifts(
        req.user.tenant_id,
        req.user.id,
        typeof start_date === "string"
          ? start_date
          : typeof start_date === "object"
            ? JSON.stringify(start_date)
            : String(start_date),
        typeof end_date === "string"
          ? end_date
          : typeof end_date === "object"
            ? JSON.stringify(end_date)
            : String(end_date),
      );

      res.json(successResponse({ shifts }));
    } catch (error: unknown) {
      console.error("Error fetching employee shifts:", error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Laden der eigenen Schichten", 500));
    }
  }),
);

/**
 * Get dashboard summary for shift planning
 * GET /api/shifts/dashboard
 */
router.get(
  "/dashboard",
  ...security.user(),
  typed.auth(async (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const userId = req.user.id;

      // Get upcoming shifts for this week
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);

      const upcomingShifts = await Shift.getEmployeeShifts(
        tenantId,
        userId,
        today.toISOString().split("T")[0],
        nextWeek.toISOString().split("T")[0],
      );

      // Get pending exchange requests
      const exchangeRequests = await Shift.getShiftExchangeRequests(
        tenantId,
        userId,
        { status: "pending", limit: 5 },
      );

      // Get availability status for this week
      const availability = await Shift.getEmployeeAvailability(
        tenantId,
        userId,
        today.toISOString().split("T")[0],
        nextWeek.toISOString().split("T")[0],
      );

      res.json(
        successResponse({
          upcomingShifts: upcomingShifts.slice(0, 5), // Next 5 shifts
          exchangeRequests,
          availability,
          stats: {
            totalUpcomingShifts: upcomingShifts.length,
            pendingExchanges: exchangeRequests.length,
            availabilityDays: (
              availability as unknown as AvailabilityRecord[]
            ).filter((a) => a.availability_type === "available").length,
          },
        }),
      );
    } catch (error: unknown) {
      console.error("Error fetching shift dashboard:", error);
      res
        .status(500)
        .json(
          errorResponse("Fehler beim Laden des Schichtplan-Dashboards", 500),
        );
    }
  }),
);

/**
 * Get weekly shifts with assignments
 * GET /api/shifts/weekly
 */
router.get(
  "/weekly",
  ...security.user(
    createValidation([
      query("start_date")
        .notEmpty()
        .isISO8601()
        .withMessage("Startdatum ist erforderlich"),
      query("end_date")
        .notEmpty()
        .isISO8601()
        .withMessage("Enddatum ist erforderlich"),
    ]),
  ),
  typed.auth(async (req, res) => {
    try {
      const { start_date, end_date } = req.query;

      const tenantId = req.user.tenant_id;

      // Get shifts with assignments for the week
      const sqlQuery = `
      SELECT s.*, sa.user_id, sa.status as assignment_status,
             u.first_name, u.last_name, u.username,
             CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as employee_name
      FROM shifts s
      LEFT JOIN shift_assignments sa ON s.id = sa.shift_id
      LEFT JOIN users u ON sa.user_id = u.id
      WHERE s.tenant_id = ? AND s.date >= ? AND s.date <= ?
      ORDER BY s.date ASC, s.start_time ASC
    `;

      const [shifts] = await executeQuery<RowDataPacket[]>(sqlQuery, [
        tenantId,
        start_date,
        end_date,
      ]);

      res.json(
        successResponse({
          shifts,
        }),
      );
    } catch (error: unknown) {
      console.error("Error fetching weekly shifts:", error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Laden der Wochenschichten", 500));
    }
  }),
);

/**
 * Get weekly notes
 * GET /api/shifts/weekly-notes
 */
router.get(
  "/weekly-notes",
  ...security.user(
    createValidation([
      query("week").notEmpty().withMessage("Week is required"),
      query("year").notEmpty().withMessage("Year is required"),
    ]),
  ),
  typed.auth((_req, res) => {
    try {
      // const { week, year } = req.query; // TODO: Use these when implementing weekly notes

      // For now, return empty notes
      res.json(successResponse({ notes: "" }));
    } catch (error: unknown) {
      console.error("Error fetching weekly notes:", error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Laden der Wochennotizen", 500));
    }
  }),
);

/**
 * Save weekly notes
 * POST /api/shifts/notes
 */
router.post(
  "/notes",
  ...security.user(
    createValidation([
      body("week")
        .notEmpty()
        .isISO8601()
        .withMessage("Wochendatum ist erforderlich"),
      body("notes").optional().isString(),
      body("department_id").optional().isInt({ min: 1 }),
    ]),
  ),
  typed.body<WeeklyNotesBody>(async (req, res) => {
    try {
      const { week, notes, department_id } = req.body;

      const tenantId = req.user.tenant_id;
      const weekDate = new Date(week).toISOString().split("T")[0];

      let departmentId: number | null = null;

      // For employees, get their department
      if (req.user.role === "employee") {
        const [userRows] = await executeQuery<RowDataPacket[]>(
          "SELECT department_id FROM users WHERE id = ? AND tenant_id = ?",
          [req.user.id, tenantId],
        );
        if (
          userRows.length > 0 &&
          userRows[0].department_id != null &&
          userRows[0].department_id !== 0
        ) {
          departmentId = userRows[0].department_id as number;
        }
      } else if (department_id != null && department_id !== 0) {
        // For admins, use the provided department_id
        departmentId = Number.parseInt(String(department_id), 10);
      }

      if (departmentId == null || departmentId === 0) {
        console.error(
          "[SHIFTS NOTES] No department_id available for saving notes",
        );
        res.status(400).json(errorResponse("Abteilung ist erforderlich", 400));
        return;
      }

      console.info("[SHIFTS NOTES] Saving notes:", {
        tenantId,
        departmentId,
        weekDate,
        notes: notes != null && notes !== "" ? "Yes" : "No",
      });

      // Insert or update notes
      const sqlQuery = `
        INSERT INTO weekly_shift_notes (tenant_id, department_id, date, notes, created_by)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          notes = VALUES(notes),
          updated_at = NOW()
      `;

      await executeQuery(sqlQuery, [
        tenantId,
        departmentId,
        weekDate,
        notes ?? "",
        req.user.id,
      ]);

      res.json(successResponse(null, "Notizen gespeichert"));
    } catch (error: unknown) {
      console.error("Error saving weekly notes:", error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Speichern der Wochennotizen", 500));
    }
  }),
);

/**
 * Save weekly notes (legacy endpoint for compatibility)
 * POST /api/shifts/weekly-notes
 */
router.post(
  "/weekly-notes",
  ...security.user(
    createValidation([
      body("week").notEmpty().withMessage("Week is required"),
      body("year").notEmpty().withMessage("Year is required"),
      body("notes").optional().isString(),
    ]),
  ),
  typed.body<{ week: string; year: string; notes?: string }>(
    async (req, res) => {
      try {
        const { week, year, notes } = req.body;

        // Convert week/year to date
        const weekDate = new Date();
        weekDate.setFullYear(Number.parseInt(year));
        weekDate.setDate(weekDate.getDate() + (Number.parseInt(week) - 1) * 7);
        const weekStart = weekDate.toISOString().split("T")[0];

        const tenantId = req.user.tenant_id;

        // Insert or update notes
        const notesQuery = `
        INSERT INTO shift_notes (tenant_id, date, notes, created_by)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          notes = VALUES(notes),
          updated_at = NOW()
      `;

        await executeQuery(notesQuery, [
          tenantId,
          weekStart,
          notes ?? "",
          req.user.id,
        ]);

        res.json(successResponse(null, "Notizen gespeichert"));
      } catch (error: unknown) {
        console.error("Error saving weekly notes:", error);
        res
          .status(500)
          .json(errorResponse("Fehler beim Speichern der Wochennotizen", 500));
      }
    },
  ),
);

export default router;

// CommonJS compatibility
