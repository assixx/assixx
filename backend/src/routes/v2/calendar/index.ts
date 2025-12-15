/**
 * Calendar v2 Routes
 * RESTful API endpoints for calendar management
 */
import { Router } from 'express';

import { apiLimiter } from '../../../middleware/security-enhanced.js';
import { authenticateV2 } from '../../../middleware/v2/auth.middleware.js';
import { typed } from '../../../utils/routeHandlers.js';
import * as calendarController from './calendar.controller.js';
import { calendarValidationZod } from './calendar.validation.zod.js';

const router = Router();

// All routes require authentication
router.use(authenticateV2);

// Routes
router.get(
  '/events',
  apiLimiter,
  calendarValidationZod.list,
  typed.auth(calendarController.listEvents),
);

router.get(
  '/events/:id',
  apiLimiter,
  calendarValidationZod.getById,
  typed.auth(calendarController.getEvent),
);

router.post(
  '/events',
  apiLimiter,
  calendarValidationZod.create,
  typed.auth(calendarController.createEvent),
);

router.put(
  '/events/:id',
  apiLimiter,
  ...calendarValidationZod.update,
  typed.auth(calendarController.updateEvent),
);

router.delete(
  '/events/:id',
  apiLimiter,
  calendarValidationZod.delete,
  typed.auth(calendarController.deleteEvent),
);

router.get(
  '/export',
  apiLimiter,
  calendarValidationZod.export,
  typed.auth(calendarController.exportEvents),
);

router.get(
  '/dashboard',
  apiLimiter,
  calendarValidationZod.dashboard,
  typed.auth(calendarController.getDashboardEvents),
);

router.get('/unread-events', apiLimiter, typed.auth(calendarController.getUnreadEvents));

export default router;
