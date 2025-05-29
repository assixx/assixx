/**
 * Calendar API Routes
 * Handles all operations related to the company calendar system
 */

import express, { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth';

// Import calendar model (keeping require pattern for compatibility)
import calendarModel from '../models/calendar';

const router: Router = express.Router();

// Extended Request interfaces
interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    tenant_id?: number;
    tenantId?: number;
    role: string;
    departmentId?: number;
    teamId?: number;
    username?: string;
    email?: string;
  };
  event?: any; // Set by middleware
}

// Helper function to get tenant ID from user object
function getTenantId(user: AuthenticatedRequest['user']): number {
  return user.tenant_id || user.tenantId || 1;
}

// Helper function to check if user can manage the event
async function canManageEvent(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const eventId = req.params.id;
    const tenantId = getTenantId(req.user);

    // Get user role, department, and team info for permissions
    const userInfo = {
      role: req.user.role,
      departmentId: req.user.departmentId,
      teamId: req.user.teamId,
    };

    // Check if user can manage this event
    const canManage = await calendarModel.canManageEvent(
      eventId,
      req.user.id,
      userInfo
    );

    if (!canManage) {
      res.status(403).json({
        message: 'You do not have permission to manage this event',
      });
      return;
    }

    // Get event details for the request
    const event = await calendarModel.getEventById(
      eventId,
      tenantId,
      req.user.id
    );

    if (!event) {
      res.status(404).json({ message: 'Event not found' });
      return;
    }

    // Add event to request for later use
    req.event = event;
    next();
  } catch (error: any) {
    console.error('Error in canManageEvent middleware:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * @route GET /api/calendar
 * @desc Get all calendar events visible to the user
 */
router.get('/', authenticateToken, async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = getTenantId(req.user);

    const options = {
      status: String(req.query.status) || 'active',
      filter: String(req.query.filter) || 'all',
      search: String(req.query.search) || '',
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      page: parseInt(String(req.query.page) || '1', 10),
      limit: parseInt(String(req.query.limit) || '50', 10),
      sortBy: String(req.query.sortBy) || 'start_time',
      sortDir: String(req.query.sortDir) || 'ASC',
    };

    const result = await calendarModel.getAllEvents(
      tenantId,
      authReq.user.id,
      options
    );

    res.json(result);
  } catch (error: any) {
    console.error('Error in GET /api/calendar:', error);
    res.status(500).json({ message: 'Error retrieving calendar events' });
  }
});

/**
 * @route GET /api/calendar/dashboard
 * @desc Get upcoming events for dashboard widget
 */
router.get('/dashboard', authenticateToken, async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = getTenantId(req.user);
    const days = parseInt(String(req.query.days) || '7', 10);
    const limit = parseInt(String(req.query.limit) || '5', 10);

    const events = await calendarModel.getDashboardEvents(
      tenantId,
      authReq.user.id,
      days,
      limit
    );

    res.json(events);
  } catch (error: any) {
    console.error('Error in GET /api/calendar/dashboard:', error);
    res.status(500).json({ message: 'Error retrieving dashboard events' });
  }
});

/**
 * @route GET /api/calendar/:id
 * @desc Get a specific calendar event
 */
router.get('/:id', authenticateToken, async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = getTenantId(req.user);

    const event = await calendarModel.getEventById(
      req.params.id,
      tenantId,
      authReq.user.id
    );

    if (!event) {
      res.status(404).json({ message: 'Event not found' });
      return;
    }

    res.json(event);
  } catch (error: any) {
    console.error('Error in GET /api/calendar/:id:', error);
    res.status(500).json({ message: 'Error retrieving calendar event' });
  }
});

/**
 * @route POST /api/calendar
 * @desc Create a new calendar event
 */
router.post('/', authenticateToken, async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = getTenantId(req.user);

    // Convert org_id to number if it's a string
    let org_id = req.body.org_id;
    if (typeof org_id === 'string') {
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
      org_level: req.body.org_level,
      org_id,
      created_by: authReq.user.id,
      reminder_time: req.body.reminder_time,
      color: req.body.color,
      recurring: req.body.recurring || false,
      recurring_pattern: req.body.recurring_pattern,
    };

    const event = await calendarModel.createEvent(eventData);
    res.status(201).json(event);
  } catch (error: any) {
    console.error('Error in POST /api/calendar:', error);
    res.status(500).json({
      message: 'Error creating calendar event',
      error: error.message,
    });
  }
});

/**
 * @route PUT /api/calendar/:id
 * @desc Update a calendar event
 */
router.put(
  '/:id',
  authenticateToken,
  canManageEvent as any,
  async (req, res): Promise<void> => {
    try {
      const eventData = {
        title: req.body.title,
        description: req.body.description,
        location: req.body.location,
        start_time: req.body.start_time,
        end_time: req.body.end_time,
        all_day: req.body.all_day,
        org_level: req.body.org_level,
        org_id: req.body.org_id,
        reminder_time: req.body.reminder_time,
        color: req.body.color,
        status: req.body.status,
        recurring: req.body.recurring,
        recurring_pattern: req.body.recurring_pattern,
      };

      const tenantId = getTenantId(req.user);
      const updatedEvent = await calendarModel.updateEvent(
        req.params.id,
        eventData,
        tenantId
      );

      res.json(updatedEvent);
    } catch (error: any) {
      console.error('Error in PUT /api/calendar/:id:', error);
      res.status(500).json({ message: 'Error updating calendar event' });
    }
  }
);

/**
 * @route DELETE /api/calendar/:id
 * @desc Delete a calendar event
 */
router.delete(
  '/:id',
  authenticateToken,
  canManageEvent as any,
  async (req, res): Promise<void> => {
    try {
      const tenantId = getTenantId(req.user);
      const success = await calendarModel.deleteEvent(req.params.id, tenantId);

      if (!success) {
        res.status(404).json({ message: 'Event not found' });
        return;
      }

      res.json({ message: 'Event deleted successfully' });
    } catch (error: any) {
      console.error('Error in DELETE /api/calendar/:id:', error);
      res.status(500).json({ message: 'Error deleting calendar event' });
    }
  }
);

export default router;

// CommonJS compatibility
