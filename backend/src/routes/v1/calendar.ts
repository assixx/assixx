/**
 * Calendar API Routes
 * Handles all operations related to the company calendar system
 */
import express, { Router } from 'express';
import { body, param, query } from 'express-validator';

import { security } from '../../middleware/security';
import { apiLimiter } from '../../middleware/security-enhanced';
import { createValidation } from '../../middleware/validation';
import calendarModel, { EventUpdateData } from '../../models/calendar';
import type { AuthenticatedRequest } from '../../types/request.types';
import { errorResponse, successResponse } from '../../types/response.types';
import { getErrorMessage } from '../../utils/errorHandler';
import { typed } from '../../utils/routeHandlers';

const router: Router = express.Router();

// Import calendar model (keeping require pattern for compatibility)
// Request body interfaces
interface CalendarEventBody {
  title: string;
  description?: string;
  location?: string;
  start_time: string;
  end_time: string;
  all_day?: boolean;
  org_level?: string;
  org_id?: number | string; // Deprecated, use department_id and team_id
  department_id?: number | string;
  team_id?: number | string;
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
  status: 'active' | 'cancelled';
  filter: 'all' | 'company' | 'department' | 'team' | 'personal';
  search: string;
  start_date?: string;
  end_date?: string;
  page: number;
  limit: number;
  sortBy: string;
  sortDir: 'ASC' | 'DESC';
}

// Extended Request interfaces for middleware
// EventManagementRequest was removed as it's no longer needed with typed handlers

// Helper function to get tenant ID from user object
function getTenantId(user: AuthenticatedRequest['user']): number {
  return user.tenant_id;
}

// Validation schemas
const getEventsValidation = createValidation([
  query('status')
    .optional()
    .isIn(['active', 'cancelled'])
    .withMessage('Status muss active oder cancelled sein'),
  query('filter')
    .optional()
    .isIn(['all', 'company', 'department', 'team', 'personal'])
    .withMessage('Ungültiger Filter'),
  query('search').optional().isString().trim(),
  query('start_date').optional().isISO8601(),
  query('end_date').optional().isISO8601(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('sortBy').optional().isIn(['start_date', 'end_date', 'title', 'created_at']),
  query('sortDir').optional().isIn(['ASC', 'DESC']),
]);

const createEventValidation = createValidation([
  body('title').notEmpty().trim().withMessage('Titel ist erforderlich'),
  body('start_time').isISO8601().withMessage('Ungültiges Startdatum'),
  body('end_time').isISO8601().withMessage('Ungültiges Enddatum'),
  body('all_day').optional().isBoolean(),
  body('org_level').optional().isIn(['company', 'department', 'team', 'personal']),
  body('org_id').optional().isInt({ min: 1 }),
  body('description').optional().trim(),
  body('location').optional().trim(),
  body('reminder_time').optional().isInt({ min: 0 }),
  body('color')
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('Ungültiges Farbformat'),
]);

const updateEventValidation = createValidation([
  param('id').isInt({ min: 1 }).withMessage('Ungültige Event-ID'),
  body('title').optional().notEmpty().trim(),
  body('start_time').optional().isISO8601(),
  body('end_time').optional().isISO8601(),
  body('all_day').optional().isBoolean(),
  body('org_level').optional().isIn(['company', 'department', 'team', 'personal']),
  body('org_id').optional().isInt({ min: 1 }),
  body('description').optional().trim(),
  body('location').optional().trim(),
  body('reminder_time').optional().isInt({ min: 0 }),
  body('color')
    .optional()
    .matches(/^#[0-9A-F]{6}$/i),
  body('status').optional().isIn(['active', 'cancelled']),
]);

// Helper function to check if user can manage the event
const canManageEvent = typed.params<{ id: string }>(async (req, res, next) => {
  try {
    const eventId = req.params.id;
    const tenantId = getTenantId(req.user);

    // Get user role, department, and team info for permissions
    const userInfo = {
      role: req.user.role || null,
      departmentId: req.user.department_id ?? null,
      teamId: null as number | null,
    };

    // Check if user can manage this event
    const canManage = await calendarModel.canManageEvent(
      Number.parseInt(eventId, 10),
      req.user.id,
      userInfo,
    );

    if (!canManage) {
      res
        .status(403)
        .json(errorResponse('Sie haben keine Berechtigung, dieses Event zu verwalten', 403));
      return;
    }

    // Get event details for the request
    const event = await calendarModel.getEventById(
      Number.parseInt(eventId, 10),
      tenantId,
      req.user.id,
    );

    if (!event) {
      res.status(404).json(errorResponse('Event nicht gefunden', 404));
      return;
    }

    // Add event to request for later use
    (req as CalendarEventRequest).event = event;
    next();
  } catch (error: unknown) {
    console.error('Error in canManageEvent middleware:', getErrorMessage(error));
    res.status(500).json(errorResponse('Interner Serverfehler', 500));
  }
});

/**
 * Swagger API Documentation
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
 * Get all calendar events visible to the user
 * Route: GET /api/calendar
 */
router.get(
  '/',
  apiLimiter,
  ...security.user(getEventsValidation),
  typed.auth(async (req, res) => {
    try {
      const tenantId = getTenantId(req.user);

      const options: CalendarQueryOptions = {
        status:
          req.query.status !== undefined ? (req.query.status as 'active' | 'cancelled') : 'active',
        filter:
          req.query.filter !== undefined ?
            (req.query.filter as 'all' | 'company' | 'department' | 'team' | 'personal')
          : 'all',
        search: req.query.search !== undefined ? (req.query.search as string) : '',
        start_date: (req.query.start ?? req.query.start_date) as string | undefined,
        end_date: (req.query.end ?? req.query.end_date) as string | undefined,
        page: req.query.page !== undefined ? Number.parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit !== undefined ? Number.parseInt(req.query.limit as string, 10) : 50,
        sortBy: req.query.sortBy !== undefined ? (req.query.sortBy as string) : 'start_date',
        sortDir: req.query.sortDir !== undefined ? (req.query.sortDir as 'ASC' | 'DESC') : 'ASC',
      };

      const result = await calendarModel.getAllEvents(tenantId, req.user.id, options);

      res.json(successResponse(result));
    } catch (error: unknown) {
      console.error('Error in GET /api/calendar:', getErrorMessage(error));
      res.status(500).json(errorResponse('Fehler beim Abrufen der Kalendereinträge', 500));
    }
  }),
);

/**
 * Get upcoming events for dashboard widget
 * Route: GET /api/calendar/dashboard
 */
router.get(
  '/dashboard',
  apiLimiter,
  ...security.user(
    createValidation([
      query('days').optional().isInt({ min: 1, max: 365 }),
      query('limit').optional().isInt({ min: 1, max: 50 }),
    ]),
  ),
  typed.auth(async (req, res) => {
    try {
      const tenantId = getTenantId(req.user);

      const days = Number.parseInt((req.query.days as string) || '7', 10);
      const limit = Number.parseInt((req.query.limit as string) || '5', 10);

      const events = await calendarModel.getDashboardEvents(tenantId, req.user.id, days, limit);

      res.json(successResponse(events));
    } catch (error: unknown) {
      console.error('Error in GET /api/calendar/dashboard:', getErrorMessage(error));
      res.status(500).json(errorResponse('Fehler beim Abrufen der Dashboard-Events', 500));
    }
  }),
);

/**
 * Get a specific calendar event
 * Route: GET /api/calendar/:id
 */
router.get(
  '/:id',
  apiLimiter,
  ...security.user(
    createValidation([param('id').isInt({ min: 1 }).withMessage('Ungültige Event-ID')]),
  ),
  typed.params<{ id: string }>(async (req, res) => {
    try {
      const tenantId = getTenantId(req.user);

      const event = await calendarModel.getEventById(
        Number.parseInt(req.params.id, 10),
        tenantId,
        req.user.id,
      );

      if (!event) {
        res.status(404).json(errorResponse('Event nicht gefunden', 404));
        return;
      }

      res.json(successResponse(event));
    } catch (error: unknown) {
      console.error('Error in GET /api/calendar/:id:', getErrorMessage(error));
      res.status(500).json(errorResponse('Fehler beim Abrufen des Events', 500));
    }
  }),
);

/**
 * Create a new calendar event
 * Route: POST /api/calendar
 */
router.post(
  '/',
  apiLimiter,
  ...security.user(createEventValidation),
  typed.body<CalendarEventBody>(async (req, res) => {
    try {
      const tenantId = getTenantId(req.user);

      // Convert org_id to number if it's a string
      let orgId = req.body.org_id;
      if (typeof orgId === 'string') {
        orgId = Number.parseInt(orgId, 10);
      }

      const eventData = {
        tenant_id: tenantId,
        title: req.body.title,
        description: req.body.description,
        location: req.body.location,
        start_time: req.body.start_time,
        end_time: req.body.end_time,
        all_day: req.body.all_day,
        org_level: req.body.org_level as 'company' | 'team' | 'department' | 'personal',
        org_id: orgId,
        created_by: req.user.id,
        reminder_time: req.body.reminder_time,
        color: req.body.color,
        recurrence_rule: req.body.recurrence_rule,
      };

      const event = await calendarModel.createEvent(eventData);
      res.status(201).json(successResponse(event, 'Event erfolgreich erstellt'));
    } catch (error: unknown) {
      console.error('Error in POST /api/calendar:', getErrorMessage(error));
      res.status(500).json(errorResponse('Fehler beim Erstellen des Events', 500));
    }
  }),
);

/**
 * Update a calendar event
 * Route: PUT /api/calendar/:id
 */
router.put(
  '/:id',
  apiLimiter,
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
        org_level: req.body.org_level as 'company' | 'department' | 'team' | 'personal' | undefined,
        department_id:
          req.body.department_id != null && req.body.department_id !== '' ?
            Number.parseInt(String(req.body.department_id), 10)
          : undefined,
        team_id:
          req.body.team_id != null && req.body.team_id !== '' ?
            Number.parseInt(String(req.body.team_id), 10)
          : undefined,
        reminder_time: req.body.reminder_time,
        color: req.body.color,
        status: req.body.status as 'active' | 'cancelled' | undefined,
        recurrence_rule: req.body.recurring === true ? (req.body.recurring_pattern ?? null) : null,
      };

      const tenantId = getTenantId(req.user);
      const updatedEvent = await calendarModel.updateEvent(
        Number.parseInt(req.params.id, 10),
        eventData,
        tenantId,
      );

      res.json(successResponse(updatedEvent, 'Event erfolgreich aktualisiert'));
    } catch (error: unknown) {
      console.error('Error in PUT /api/calendar/:id:', getErrorMessage(error));
      res.status(500).json(errorResponse('Fehler beim Aktualisieren des Events', 500));
    }
  }),
);

/**
 * Delete a calendar event
 * Route: DELETE /api/calendar/:id
 */
router.delete(
  '/:id',
  apiLimiter,
  ...security.user(
    createValidation([param('id').isInt({ min: 1 }).withMessage('Ungültige Event-ID')]),
  ),
  canManageEvent,
  typed.params<{ id: string }>(async (req, res) => {
    try {
      const tenantId = getTenantId(req.user);
      const success = await calendarModel.deleteEvent(Number.parseInt(req.params.id, 10), tenantId);

      if (!success) {
        res.status(404).json(errorResponse('Event nicht gefunden', 404));
        return;
      }

      res.json(successResponse(null, 'Event erfolgreich gelöscht'));
    } catch (error: unknown) {
      console.error('Error in DELETE /api/calendar/:id:', getErrorMessage(error));
      res.status(500).json(errorResponse('Fehler beim Löschen des Events', 500));
    }
  }),
);

export default router;

// CommonJS compatibility
