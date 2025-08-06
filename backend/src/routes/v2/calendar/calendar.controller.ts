/**
 * Calendar v2 Controller
 * Handles HTTP requests for calendar endpoints
 * @swagger
 * tags:
 *   name: Calendar v2
 *   description: Calendar event management (API v2)
 */

import { Response, NextFunction } from "express";

import type { CalendarEvent } from "../../../models/calendar.js";
import { RootLog } from "../../../models/rootLog.js";
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

    const eventData = req.body as CalendarEventData;
    const event = await calendarService.createEvent(
      eventData,
      tenantId,
      userId,
    );

    // Log calendar event creation
    await RootLog.create({
      tenant_id: tenantId,
      user_id: userId,
      action: "create",
      entity_type: "calendar_event",
      entity_id: (event as unknown as CalendarEvent).id,
      details: `Erstellt: ${eventData.title}`,
      new_values: {
        title: eventData.title,
        start_time: eventData.startTime,
        end_time: eventData.endTime,
        location: eventData.location,
        org_level: eventData.orgLevel,
        org_id: eventData.orgId,
        all_day: eventData.allDay,
        created_by: user.email,
      },
      ip_address: req.ip ?? req.socket.remoteAddress,
      user_agent: req.get("user-agent"),
      was_role_switched: false,
    });

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
    const userDepartmentId = user.department_id ?? null;

    // Try to get old event data for logging, but don't fail if user doesn't have permission
    let oldEvent: CalendarEvent | null = null;
    try {
      oldEvent = (await calendarService.getEventById(
        eventId,
        tenantId,
        userId,
        userDepartmentId,
      )) as unknown as CalendarEvent;
    } catch {
      // If we can't get the old event (e.g., no permission), that's okay
      // The updateEvent method will handle permission checks properly
    }

    const updateData = req.body as CalendarEventUpdateData;
    const event = await calendarService.updateEvent(
      eventId,
      updateData,
      tenantId,
      userId,
      userRole,
    );

    // Log calendar event update (only if we have old values)
    if (oldEvent) {
      await RootLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: "update",
        entity_type: "calendar_event",
        entity_id: eventId,
        details: `Aktualisiert: ${updateData.title ?? oldEvent.title}`,
        old_values: {
          title: oldEvent.title,
          start_time: oldEvent.startTime,
          end_time: oldEvent.endTime,
          location: oldEvent.location,
          status: oldEvent.status,
        },
        new_values: {
          title: updateData.title,
          start_time: updateData.startTime,
          end_time: updateData.endTime,
          location: updateData.location,
          status: updateData.status,
          updated_by: user.email,
        },
        ip_address: req.ip ?? req.socket.remoteAddress,
        user_agent: req.get("user-agent"),
        was_role_switched: false,
      });
    } else {
      // Log without old values if we couldn't access them
      await RootLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: "update",
        entity_type: "calendar_event",
        entity_id: eventId,
        details: `Aktualisiert: Event ID ${eventId}`,
        new_values: {
          title: updateData.title,
          start_time: updateData.startTime,
          end_time: updateData.endTime,
          location: updateData.location,
          status: updateData.status,
          updated_by: user.email,
        },
        ip_address: req.ip ?? req.socket.remoteAddress,
        user_agent: req.get("user-agent"),
        was_role_switched: false,
      });
    }

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
    const userDepartmentId = user.department_id ?? null;

    // Try to get event data before deletion for logging, but don't fail if user doesn't have permission
    let deletedEvent: CalendarEvent | null = null;
    try {
      deletedEvent = (await calendarService.getEventById(
        eventId,
        tenantId,
        userId,
        userDepartmentId,
      )) as unknown as CalendarEvent;
    } catch {
      // If we can't get the event (e.g., no permission), that's okay
      // The deleteEvent method will handle permission checks properly
    }

    await calendarService.deleteEvent(eventId, tenantId, userId, userRole);

    // Log calendar event deletion
    if (deletedEvent) {
      await RootLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: "delete",
        entity_type: "calendar_event",
        entity_id: eventId,
        details: `Gelöscht: ${deletedEvent.title}`,
        old_values: {
          title: deletedEvent.title,
          start_time: deletedEvent.startTime,
          end_time: deletedEvent.endTime,
          location: deletedEvent.location,
          org_level: deletedEvent.orgLevel,
          status: deletedEvent.status,
          deleted_by: user.email,
        },
        ip_address: req.ip ?? req.socket.remoteAddress,
        user_agent: req.get("user-agent"),
        was_role_switched: false,
      });
    } else {
      // Log without details if we couldn't access the event
      await RootLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: "delete",
        entity_type: "calendar_event",
        entity_id: eventId,
        details: `Gelöscht: Event ID ${eventId}`,
        old_values: {
          deleted_by: user.email,
        },
        ip_address: req.ip ?? req.socket.remoteAddress,
        user_agent: req.get("user-agent"),
        was_role_switched: false,
      });
    }

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

    // Log attendee response update
    await RootLog.create({
      tenant_id: tenantId,
      user_id: userId,
      action: "update_attendee_response",
      entity_type: "calendar_event",
      entity_id: eventId,
      details: `Teilnehmer Antwort: ${response}`,
      new_values: {
        attendee_response: response,
        responded_by: user.email,
      },
      ip_address: req.ip ?? req.socket.remoteAddress,
      user_agent: req.get("user-agent"),
      was_role_switched: false,
    });

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
