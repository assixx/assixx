/**
 * Calendar v2 Routes
 * RESTful API endpoints for calendar management
 */
import { Router } from 'express';

import { apiLimiter } from '../../../middleware/security-enhanced.js';
import { authenticateV2 } from '../../../middleware/v2/auth.middleware.js';
import {
  validate,
  validateBody,
  validateParams,
  validateQuery,
  z,
} from '../../../middleware/validation.zod.js';
import { typed } from '../../../utils/routeHandlers.js';
import * as calendarController from './calendar.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticateV2);

// Validation schemas
const eventValidation = validateBody(
  z
    .object({
      title: z.string().min(1, 'Title is required'),
      startTime: z.iso.datetime({ message: 'Valid start time is required' }),
      endTime: z.iso.datetime({ message: 'Valid end time is required' }),
      allDay: z.boolean().optional(),
      orgLevel: z.enum(['company', 'department', 'team', 'personal'], {
        message: 'Valid organization level is required',
      }),
      orgId: z.number().int().min(1).optional(),
      description: z.string().optional(),
      location: z.string().optional(),
      reminderMinutes: z.number().int().min(0).optional(),
      color: z
        .string()
        .regex(/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color')
        .optional(),
      recurrenceRule: z.string().optional(),
      attendeeIds: z.array(z.number().int().min(1, 'Invalid attendee ID')).optional(),
    })
    .refine(
      (data: { endTime: string; startTime: string }) =>
        new Date(data.endTime) > new Date(data.startTime),
      {
        message: 'End time must be after start time',
        path: ['endTime'],
      },
    )
    .refine(
      (data: { orgLevel: string; orgId?: number }) => {
        if (data.orgLevel === 'department' || data.orgLevel === 'team') {
          return data.orgId !== undefined;
        }
        return true;
      },
      {
        message: 'Organization ID is required for department/team events',
        path: ['orgId'],
      },
    ),
);

const updateEventValidation = validateBody(
  z
    .object({
      title: z.string().min(1).optional(),
      startTime: z.iso.datetime().optional(),
      endTime: z.iso.datetime().optional(),
      allDay: z.boolean().optional(),
      orgLevel: z.enum(['company', 'department', 'team', 'personal']).optional(),
      orgId: z.number().int().min(1).optional(),
      description: z.string().optional(),
      location: z.string().optional(),
      reminderMinutes: z.number().int().min(0).optional(),
      color: z
        .string()
        .regex(/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color')
        .optional(),
      recurrenceRule: z.string().optional(),
      status: z.enum(['tentative', 'confirmed', 'cancelled']).optional(),
    })
    .refine(
      (data: { startTime?: string; endTime?: string }) => {
        if (data.startTime && data.endTime) {
          return new Date(data.endTime) > new Date(data.startTime);
        }
        return true;
      },
      {
        message: 'End time must be after start time',
        path: ['endTime'],
      },
    ),
);

const listEventsValidation = validateQuery(
  z.object({
    status: z.enum(['active', 'cancelled']).optional(),
    filter: z.enum(['all', 'company', 'department', 'team', 'personal']).optional(),
    search: z.string().optional(),
    startDate: z.iso.datetime().optional(),
    endDate: z.iso.datetime().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z.enum(['startDate', 'endDate', 'title', 'createdAt']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
);

const idValidation = validateParams(
  z.object({
    id: z.coerce.number().int().min(1, 'Valid event ID is required'),
  }),
);

const attendeeResponseValidation = validate({
  params: z.object({
    id: z.coerce.number().int().min(1, 'Valid event ID is required'),
  }),
  body: z.object({
    response: z.enum(['accepted', 'declined', 'tentative'], {
      message: 'Valid response is required',
    }),
  }),
});

const exportValidation = validateQuery(
  z.object({
    format: z.enum(['ics', 'csv'], {
      message: 'Valid format is required (ics or csv)',
    }),
  }),
);

const dashboardValidation = validateQuery(
  z.object({
    days: z.coerce.number().int().min(1).max(365).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  }),
);

// Routes
router.get('/events', apiLimiter, listEventsValidation, typed.auth(calendarController.listEvents));

router.get('/events/:id', apiLimiter, idValidation, typed.auth(calendarController.getEvent));

router.post('/events', apiLimiter, eventValidation, typed.auth(calendarController.createEvent));

router.put(
  '/events/:id',
  apiLimiter,
  idValidation,
  updateEventValidation,
  typed.auth(calendarController.updateEvent),
);

router.delete('/events/:id', apiLimiter, idValidation, typed.auth(calendarController.deleteEvent));

router.put(
  '/events/:id/attendees/response',
  apiLimiter,
  attendeeResponseValidation,
  typed.auth(calendarController.updateAttendeeResponse),
);

router.get('/export', apiLimiter, exportValidation, typed.auth(calendarController.exportEvents));

router.get(
  '/dashboard',
  apiLimiter,
  dashboardValidation,
  typed.auth(calendarController.getDashboardEvents),
);

router.get('/unread-events', apiLimiter, typed.auth(calendarController.getUnreadEvents));

export default router;
