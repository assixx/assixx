/**
 * Calendar v2 Controller
 * Handles HTTP requests for calendar endpoints
 * @swagger
 * tags:
 *   name: Calendar v2
 *   description: Calendar event management (API v2)
 */

import { Response, NextFunction } from "express";

import { AuthenticatedRequest } from "../../../types/request.types.js";
import { successResponse, errorResponse } from "../../../utils/apiResponse.js";
import { ServiceError } from "../users/users.service.js";

import { calendarService } from "./calendar.service.js";
import type {
  CalendarEventData,
  CalendarEventUpdateData,
} from "./calendar.service.js";

/**
 * @swagger
 * /api/v2/calendar/events:
 *   get:
 *     summary: Get calendar events
 *     tags: [Calendar v2]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, cancelled]
 *         description: Filter by event status
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *           enum: [all, company, department, team, personal]
 *         description: Filter by visibility scope
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in title and description
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter events starting from this date
 *       - in: query
 *         name: endDate
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
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [startDate, endDate, title, createdAt]
 *           default: startDate
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CalendarEventsResponse'
 */
export async function listEvents(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const { user } = req;
    if (!user) {
      res
        .status(401)
        .json(errorResponse("UNAUTHORIZED", "Authentication required"));
      return;
    }
    const tenantId = user.tenant_id;
    const userId = user.id;
    const userDepartmentId = user.department_id ?? null;

    const result = await calendarService.listEvents(
      tenantId,
      userId,
      userDepartmentId,
      req.query as Record<string, unknown>,
    );

    res.json(successResponse(result));
  } catch (error) {
    if (error instanceof ServiceError) {
      const errorCode =
        error.code === "BAD_REQUEST" ? "VALIDATION_ERROR" : error.code;
      res
        .status(error.statusCode)
        .json(errorResponse(errorCode, error.message, error.details));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Internal server error"));
    }
  }
}

/**
 * @swagger
 * /api/v2/calendar/events/{id}:
 *   get:
 *     summary: Get event by ID
 *     tags: [Calendar v2]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Event ID
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CalendarEventResponse'
 *       404:
 *         description: Event not found
 */
export async function getEvent(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const eventId = parseInt(req.params.id, 10);
    const { user } = req;
    if (!user) {
      res
        .status(401)
        .json(errorResponse("UNAUTHORIZED", "Authentication required"));
      return;
    }
    const tenantId = user.tenant_id;
    const userId = user.id;
    const userDepartmentId = user.department_id ?? null;

    const event = await calendarService.getEventById(
      eventId,
      tenantId,
      userId,
      userDepartmentId,
    );

    res.json(successResponse({ event }));
  } catch (error) {
    if (error instanceof ServiceError) {
      const errorCode =
        error.code === "BAD_REQUEST" ? "VALIDATION_ERROR" : error.code;
      res
        .status(error.statusCode)
        .json(errorResponse(errorCode, error.message, error.details));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Internal server error"));
    }
  }
}

/**
 * @swagger
 * /api/v2/calendar/events:
 *   post:
 *     summary: Create a new event
 *     tags: [Calendar v2]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - startTime
 *               - endTime
 *               - orgLevel
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               location:
 *                 type: string
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *               allDay:
 *                 type: boolean
 *               orgLevel:
 *                 type: string
 *                 enum: [company, department, team, personal]
 *               orgId:
 *                 type: integer
 *               reminderMinutes:
 *                 type: integer
 *               color:
 *                 type: string
 *               recurrenceRule:
 *                 type: string
 *               attendeeIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       201:
 *         description: Event created successfully
 *       400:
 *         description: Validation error
 */
export async function createEvent(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const { user } = req;
    if (!user) {
      res
        .status(401)
        .json(errorResponse("UNAUTHORIZED", "Authentication required"));
      return;
    }
    const tenantId = user.tenant_id;
    const userId = user.id;

    const event = await calendarService.createEvent(
      req.body as CalendarEventData,
      tenantId,
      userId,
    );

    res.status(201).json(successResponse({ event }));
  } catch (error) {
    if (error instanceof ServiceError) {
      const errorCode =
        error.code === "BAD_REQUEST" ? "VALIDATION_ERROR" : error.code;
      res
        .status(error.statusCode)
        .json(errorResponse(errorCode, error.message, error.details));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Internal server error"));
    }
  }
}

/**
 * @swagger
 * /api/v2/calendar/events/{id}:
 *   put:
 *     summary: Update an event
 *     tags: [Calendar v2]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Event ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               location:
 *                 type: string
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *               allDay:
 *                 type: boolean
 *               orgLevel:
 *                 type: string
 *                 enum: [company, department, team, personal]
 *               orgId:
 *                 type: integer
 *               reminderMinutes:
 *                 type: integer
 *               color:
 *                 type: string
 *               recurrenceRule:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [tentative, confirmed, cancelled]
 *     responses:
 *       200:
 *         description: Event updated successfully
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Event not found
 */
export async function updateEvent(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const eventId = parseInt(req.params.id, 10);
    const { user } = req;
    if (!user) {
      res
        .status(401)
        .json(errorResponse("UNAUTHORIZED", "Authentication required"));
      return;
    }
    const tenantId = user.tenant_id;
    const userId = user.id;
    const userRole = user.role;

    const event = await calendarService.updateEvent(
      eventId,
      req.body as CalendarEventUpdateData,
      tenantId,
      userId,
      userRole,
    );

    res.json(successResponse({ event }));
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/v2/calendar/events/{id}:
 *   delete:
 *     summary: Delete an event
 *     tags: [Calendar v2]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Event ID
 *     responses:
 *       200:
 *         description: Event deleted successfully
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Event not found
 */
export async function deleteEvent(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const eventId = parseInt(req.params.id, 10);
    const { user } = req;
    if (!user) {
      res
        .status(401)
        .json(errorResponse("UNAUTHORIZED", "Authentication required"));
      return;
    }
    const tenantId = user.tenant_id;
    const userId = user.id;
    const userRole = user.role;

    await calendarService.deleteEvent(eventId, tenantId, userId, userRole);

    res.json(successResponse({ message: "Event deleted successfully" }));
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/v2/calendar/events/{id}/attendees/response:
 *   put:
 *     summary: Update attendee response
 *     tags: [Calendar v2]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Event ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - response
 *             properties:
 *               response:
 *                 type: string
 *                 enum: [accepted, declined, tentative]
 *     responses:
 *       200:
 *         description: Response updated successfully
 *       404:
 *         description: Event not found
 */
export async function updateAttendeeResponse(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const eventId = parseInt(req.params.id, 10);
    const { user } = req;
    if (!user) {
      res
        .status(401)
        .json(errorResponse("UNAUTHORIZED", "Authentication required"));
      return;
    }
    const tenantId = user.tenant_id;
    const userId = user.id;
    const { response } = req.body as {
      response: "accepted" | "declined" | "tentative";
    };

    await calendarService.updateAttendeeResponse(
      eventId,
      userId,
      response,
      tenantId,
    );

    res.json(successResponse({ message: "Response updated successfully" }));
  } catch (error) {
    if (error instanceof ServiceError) {
      const errorCode =
        error.code === "BAD_REQUEST" ? "VALIDATION_ERROR" : error.code;
      res
        .status(error.statusCode)
        .json(errorResponse(errorCode, error.message, error.details));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Internal server error"));
    }
  }
}

/**
 * @swagger
 * /api/v2/calendar/export:
 *   get:
 *     summary: Export calendar events
 *     tags: [Calendar v2]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         required: true
 *         schema:
 *           type: string
 *           enum: [ics, csv]
 *         description: Export format
 *     responses:
 *       200:
 *         description: Export file
 *         content:
 *           text/calendar:
 *             schema:
 *               type: string
 *           text/csv:
 *             schema:
 *               type: string
 */
export async function exportEvents(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const { user } = req;
    if (!user) {
      res
        .status(401)
        .json(errorResponse("UNAUTHORIZED", "Authentication required"));
      return;
    }
    const tenantId = user.tenant_id;
    const userId = user.id;
    const userDepartmentId = user.department_id ?? null;
    const format = req.query.format as "ics" | "csv";

    const data = await calendarService.exportEvents(
      tenantId,
      userId,
      userDepartmentId,
      format,
    );

    const contentType = format === "ics" ? "text/calendar" : "text/csv";
    const filename = format === "ics" ? "calendar.ics" : "calendar.csv";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(data);
  } catch (error) {
    if (error instanceof ServiceError) {
      const errorCode =
        error.code === "BAD_REQUEST" ? "VALIDATION_ERROR" : error.code;
      res
        .status(error.statusCode)
        .json(errorResponse(errorCode, error.message, error.details));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Internal server error"));
    }
  }
}
