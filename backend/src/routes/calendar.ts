/**
 * Calendar API Routes
 * Handles all operations related to the company calendar system
 * @swagger
 * tags:
 *   name: Calendar
 *   description: Event and calendar management
 */

import express, { Router } from "express";
import { security } from "../middleware/security";
import { body, param, query } from "express-validator";
import { createValidation } from "../middleware/validation";
import { successResponse, errorResponse } from "../types/response.types";
import { typed } from "../utils/routeHandlers";
import { AuthenticatedRequest } from "../types/request.types";

// Import calendar model (keeping require pattern for compatibility)
import calendarModel from "../models/calendar";
import type { EventUpdateData } from "../models/calendar";
import { getErrorMessage } from "../utils/errorHandler";

const router: Router = express.Router();

// Request body interfaces
interface CalendarEventBody {
  title: string;
  description?: string;
  location?: string;
  start_time: string;
  end_time: string;
  all_day?: boolean;
  org_level?: string;
  org_id?: number | string;
  reminder_time?: number;
  color?: string;
  recurrence_rule?: string;
  status?: string;
  recurring?: boolean;
  recurring_pattern?: string;
}

// Extended request interface for middleware
interface CalendarEventRequest extends AuthenticatedRequest {
  event?: unknown; // Event from database, type depends on model
}

// Query interfaces
interface CalendarQueryOptions {
  status: "active" | "cancelled";
  filter: "all" | "company" | "department" | "team" | "personal";
  search: string;
  start_date?: string;
  end_date?: string;
  page: number;
  limit: number;
  sortBy: string;
  sortDir: "ASC" | "DESC";
}

// Extended Request interfaces for middleware
// EventManagementRequest was removed as it's no longer needed with typed handlers

// Helper function to get tenant ID from user object
function getTenantId(user: AuthenticatedRequest["user"]): number {
  return user.tenant_id || 1;
}

// Validation schemas
const getEventsValidation = createValidation([
  query("status")
    .optional()
    .isIn(["active", "cancelled"])
    .withMessage("Status muss active oder cancelled sein"),
  query("filter")
    .optional()
    .isIn(["all", "company", "department", "team", "personal"])
    .withMessage("Ungültiger Filter"),
  query("search").optional().isString().trim(),
  query("start_date").optional().isISO8601(),
  query("end_date").optional().isISO8601(),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("sortBy")
    .optional()
    .isIn(["start_date", "end_date", "title", "created_at"]),
  query("sortDir").optional().isIn(["ASC", "DESC"]),
]);

const createEventValidation = createValidation([
  body("title").notEmpty().trim().withMessage("Titel ist erforderlich"),
  body("start_time").isISO8601().withMessage("Ungültiges Startdatum"),
  body("end_time").isISO8601().withMessage("Ungültiges Enddatum"),
  body("all_day").optional().isBoolean(),
  body("org_level")
    .optional()
    .isIn(["company", "department", "team", "personal"]),
  body("org_id").optional().isInt({ min: 1 }),
  body("description").optional().trim(),
  body("location").optional().trim(),
  body("reminder_time").optional().isInt({ min: 0 }),
  body("color")
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage("Ungültiges Farbformat"),
]);

const updateEventValidation = createValidation([
  param("id").isInt({ min: 1 }).withMessage("Ungültige Event-ID"),
  body("title").optional().notEmpty().trim(),
  body("start_time").optional().isISO8601(),
  body("end_time").optional().isISO8601(),
  body("all_day").optional().isBoolean(),
  body("org_level")
    .optional()
    .isIn(["company", "department", "team", "personal"]),
  body("org_id").optional().isInt({ min: 1 }),
  body("description").optional().trim(),
  body("location").optional().trim(),
  body("reminder_time").optional().isInt({ min: 0 }),
  body("color")
    .optional()
    .matches(/^#[0-9A-F]{6}$/i),
  body("status").optional().isIn(["active", "cancelled"]),
]);

// Helper function to check if user can manage the event
const canManageEvent = typed.params<{ id: string }>(async (req, res, next) => {
  try {
    const eventId = req.params.id;
    const tenantId = getTenantId(req.user);

    // Get user role, department, and team info for permissions
    const userInfo = {
      role: req.user.role || null,
      departmentId: req.user.department_id || null,
      teamId: null as number | null,
    };

    // Check if user can manage this event
    const canManage = await calendarModel.canManageEvent(
      parseInt(eventId, 10),
      req.user.id,
      userInfo,
    );

    if (!canManage) {
      res
        .status(403)
        .json(
          errorResponse(
            "Sie haben keine Berechtigung, dieses Event zu verwalten",
            403,
          ),
        );
      return;
    }

    // Get event details for the request
    const event = await calendarModel.getEventById(
      parseInt(eventId, 10),
      tenantId,
      req.user.id,
    );

    if (!event) {
      res.status(404).json(errorResponse("Event nicht gefunden", 404));
      return;
    }

    // Add event to request for later use
    (req as CalendarEventRequest).event = event;
    next();
  } catch (error) {
    console.error(
      "Error in canManageEvent middleware:",
      getErrorMessage(error),
    );
    res.status(500).json(errorResponse("Interner Serverfehler", 500));
  }
});

/**
 * @swagger
 * /calendar:
 *   get:
 *     summary: Get all calendar events
 *     description: Retrieve all calendar events visible to the user with pagination and filtering
 *     tags: [Calendar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, cancelled]
 *           default: active
 *         description: Filter by event status
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *           enum: [all, company, department, team, personal]
 *           default: all
 *         description: Filter by visibility scope
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in title and description
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter events starting from this date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter events ending before this date
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
 *           default: 50
 *         description: Items per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [start_date, end_date, title, created_at]
 *           default: start_date
 *         description: Sort by field
 *       - in: query
 *         name: sortDir
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: ASC
 *         description: Sort direction
 *     responses:
 *       200:
 *         description: Calendar events retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 events:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CalendarEvent'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalItems:
 *                       type: integer
 *                     itemsPerPage:
 *                       type: integer
 *                     hasNext:
 *                       type: boolean
 *                     hasPrev:
 *                       type: boolean
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
 *               $ref: '#/components/schemas/Error'
 */
/**
 * @route GET /api/calendar
 * @desc Get all calendar events visible to the user
 */
router.get(
  "/",
  ...security.user(getEventsValidation),
  typed.auth(async (req, res) => {
    try {
      const tenantId = getTenantId(req.user);

      const options: CalendarQueryOptions = {
        status: (req.query.status as "active" | "cancelled") || "active",
        filter:
          (req.query.filter as
            | "all"
            | "company"
            | "department"
            | "team"
            | "personal") || "all",
        search: (req.query.search as string) || "",
        start_date: (req.query.start || req.query.start_date) as
          | string
          | undefined,
        end_date: (req.query.end || req.query.end_date) as string | undefined,
        page: parseInt((req.query.page as string) || "1", 10),
        limit: parseInt((req.query.limit as string) || "50", 10),
        sortBy: (req.query.sortBy as string) || "start_date",
        sortDir: (req.query.sortDir as "ASC" | "DESC") || "ASC",
      };

      const result = await calendarModel.getAllEvents(
        tenantId,
        req.user.id,
        options,
      );

      res.json(successResponse(result));
    } catch (error) {
      console.error("Error in GET /api/calendar:", getErrorMessage(error));
      res
        .status(500)
        .json(errorResponse("Fehler beim Abrufen der Kalendereinträge", 500));
    }
  }),
);

/**
 * @route GET /api/calendar/dashboard
 * @desc Get upcoming events for dashboard widget
 */
router.get(
  "/dashboard",
  ...security.user(
    createValidation([
      query("days").optional().isInt({ min: 1, max: 365 }),
      query("limit").optional().isInt({ min: 1, max: 50 }),
    ]),
  ),
  typed.auth(async (req, res) => {
    try {
      const tenantId = getTenantId(req.user);

      const days = parseInt((req.query.days as string) || "7", 10);
      const limit = parseInt((req.query.limit as string) || "5", 10);

      const events = await calendarModel.getDashboardEvents(
        tenantId,
        req.user.id,
        days,
        limit,
      );

      res.json(successResponse(events));
    } catch (error) {
      console.error(
        "Error in GET /api/calendar/dashboard:",
        getErrorMessage(error),
      );
      res
        .status(500)
        .json(errorResponse("Fehler beim Abrufen der Dashboard-Events", 500));
    }
  }),
);

/**
 * @route GET /api/calendar/:id
 * @desc Get a specific calendar event
 */
router.get(
  "/:id",
  ...security.user(
    createValidation([
      param("id").isInt({ min: 1 }).withMessage("Ungültige Event-ID"),
    ]),
  ),
  typed.params<{ id: string }>(async (req, res) => {
    try {
      const tenantId = getTenantId(req.user);

      const event = await calendarModel.getEventById(
        parseInt(req.params.id, 10),
        tenantId,
        req.user.id,
      );

      if (!event) {
        res.status(404).json(errorResponse("Event nicht gefunden", 404));
        return;
      }

      res.json(successResponse(event));
    } catch (error) {
      console.error("Error in GET /api/calendar/:id:", getErrorMessage(error));
      res
        .status(500)
        .json(errorResponse("Fehler beim Abrufen des Events", 500));
    }
  }),
);

/**
 * @route POST /api/calendar
 * @desc Create a new calendar event
 */
router.post(
  "/",
  ...security.user(createEventValidation),
  typed.body<CalendarEventBody>(async (req, res) => {
    try {
      const tenantId = getTenantId(req.user);

      // Convert org_id to number if it's a string
      let org_id = req.body.org_id;
      if (typeof org_id === "string") {
        org_id = parseInt(org_id, 10);
      }

      const eventData = {
        tenant_id: tenantId,
        title: req.body.title,
        description: req.body.description,
        location: req.body.location,
        start_time: req.body.start_time,
        end_time: req.body.end_time,
        all_day: req.body.all_day,
        org_level: req.body.org_level as
          | "company"
          | "team"
          | "department"
          | "personal",
        org_id,
        created_by: req.user.id,
        reminder_time: req.body.reminder_time,
        color: req.body.color,
        recurrence_rule: req.body.recurrence_rule,
      };

      const event = await calendarModel.createEvent(eventData);
      res
        .status(201)
        .json(successResponse(event, "Event erfolgreich erstellt"));
    } catch (error) {
      console.error("Error in POST /api/calendar:", getErrorMessage(error));
      res
        .status(500)
        .json(errorResponse("Fehler beim Erstellen des Events", 500));
    }
  }),
);

/**
 * @route PUT /api/calendar/:id
 * @desc Update a calendar event
 */
router.put(
  "/:id",
  ...security.user(updateEventValidation),
  canManageEvent,
  typed.paramsBody<{ id: string }, CalendarEventBody>(async (req, res) => {
    try {
      const eventData: Partial<EventUpdateData> = {
        title: req.body.title,
        description: req.body.description,
        location: req.body.location,
        start_time: req.body.start_time,
        end_time: req.body.end_time,
        all_day: req.body.all_day,
        org_level: req.body.org_level as
          | "company"
          | "department"
          | "team"
          | "personal"
          | undefined,
        org_id: req.body.org_id
          ? parseInt(String(req.body.org_id), 10)
          : undefined,
        reminder_time: req.body.reminder_time,
        color: req.body.color,
        status: req.body.status as "active" | "cancelled" | undefined,
        recurrence_rule: req.body.recurring ? req.body.recurring_pattern : null,
      };

      const tenantId = getTenantId(req.user);
      const updatedEvent = await calendarModel.updateEvent(
        parseInt(req.params.id, 10),
        eventData,
        tenantId,
      );

      res.json(successResponse(updatedEvent, "Event erfolgreich aktualisiert"));
    } catch (error) {
      console.error("Error in PUT /api/calendar/:id:", getErrorMessage(error));
      res
        .status(500)
        .json(errorResponse("Fehler beim Aktualisieren des Events", 500));
    }
  }),
);

/**
 * @route DELETE /api/calendar/:id
 * @desc Delete a calendar event
 */
router.delete(
  "/:id",
  ...security.user(
    createValidation([
      param("id").isInt({ min: 1 }).withMessage("Ungültige Event-ID"),
    ]),
  ),
  canManageEvent,
  typed.params<{ id: string }>(async (req, res) => {
    try {
      const tenantId = getTenantId(req.user);
      const success = await calendarModel.deleteEvent(
        parseInt(req.params.id, 10),
        tenantId,
      );

      if (!success) {
        res.status(404).json(errorResponse("Event nicht gefunden", 404));
        return;
      }

      res.json(successResponse(null, "Event erfolgreich gelöscht"));
    } catch (error) {
      console.error(
        "Error in DELETE /api/calendar/:id:",
        getErrorMessage(error),
      );
      res
        .status(500)
        .json(errorResponse("Fehler beim Löschen des Events", 500));
    }
  }),
);

export default router;

// CommonJS compatibility
