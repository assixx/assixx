/**
 * Calendar API Routes
 * Handles all operations related to the company calendar system
 */

const express = require('express');
const router = express.Router();
const calendarModel = require('../models/calendar');
const { authenticateToken } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');
const { checkFeature } = require('../middleware/features');

// Fallback tenant ID falls tenant middleware nicht funktioniert
const DEFAULT_TENANT_ID = 1;

// Debug log zum Überwachen der Datenbankverbindungen
console.log("Calendar API Routes geladen - Benutze Standard-DB:", process.env.DB_NAME);

// Helper function to check if user can manage the event
async function canManageEvent(req, res, next) {
  try {
    const eventId = req.params.id;
    // Use tenant ID from middleware or fallback to default
    req.tenantId = req.tenantId || DEFAULT_TENANT_ID;
    
    // Da die tenant_id in der DB ein Integer ist, konvertieren wir auf einen Standardwert
    const numericTenantId = 1; // Standard-Tenant-ID für die Entwicklung
    
    // Get user role, department, and team info for permissions
    const userInfo = {
      role: req.user.role,
      departmentId: req.user.departmentId,
      teamId: req.user.teamId
    };
    
    // Check if user can manage this event
    const canManage = await calendarModel.canManageEvent(eventId, req.user.id, userInfo);
    
    if (!canManage) {
      return res.status(403).json({ 
        message: 'You do not have permission to manage this event' 
      });
    }
    
    // Get event details for the request
    const event = await calendarModel.getEventById(eventId, numericTenantId, req.user.id);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Add event to request for later use
    req.event = event;
    next();
  } catch (error) {
    console.error('Error in canManageEvent middleware:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * @route GET /api/calendar
 * @desc Get all calendar events visible to the user
 */
router.get('/api/calendar', 
  authenticateToken, 
  tenantMiddleware, 
  checkFeature('calendar_system'),
  async (req, res) => {
    try {
      // Use tenant ID from middleware or fallback to default
      req.tenantId = req.tenantId || DEFAULT_TENANT_ID;
      
      // Da die tenant_id in der DB ein Integer ist, konvertieren wir auf einen Standardwert
      const numericTenantId = 1; // Standard-Tenant-ID für die Entwicklung
      
      const options = {
        status: req.query.status || 'active',
        filter: req.query.filter || 'all',
        search: req.query.search || '',
        start_date: req.query.start_date,
        end_date: req.query.end_date,
        page: parseInt(req.query.page || '1', 10),
        limit: parseInt(req.query.limit || '50', 10),
        sortBy: req.query.sortBy || 'start_time',
        sortDir: req.query.sortDir || 'ASC'
      };
      
      const result = await calendarModel.getAllEvents(numericTenantId, req.user.id, options);
      
      res.json(result);
    } catch (error) {
      console.error('Error in GET /api/calendar:', error);
      res.status(500).json({ message: 'Error retrieving calendar events' });
    }
  });

/**
 * @route GET /api/calendar/dashboard
 * @desc Get upcoming events for dashboard widget
 */
router.get('/api/calendar/dashboard', 
  authenticateToken, 
  tenantMiddleware, 
  checkFeature('calendar_system'),
  async (req, res) => {
    try {
      // Use tenant ID from middleware or fallback to default
      req.tenantId = req.tenantId || DEFAULT_TENANT_ID;
      
      // Da die tenant_id in der DB ein Integer ist, konvertieren wir auf einen Standardwert
      const numericTenantId = 1; // Standard-Tenant-ID für die Entwicklung
      
      const days = parseInt(req.query.days || '7', 10);
      const limit = parseInt(req.query.limit || '5', 10);
      
      const events = await calendarModel.getDashboardEvents(
        numericTenantId, 
        req.user.id, 
        days, 
        limit
      );
      
      res.json(events);
    } catch (error) {
      console.error('Error in GET /api/calendar/dashboard:', error);
      res.status(500).json({ message: 'Error retrieving dashboard events' });
    }
  });

/**
 * @route GET /api/calendar/:id
 * @desc Get a specific calendar event
 */
router.get('/api/calendar/:id', 
  authenticateToken, 
  tenantMiddleware, 
  checkFeature('calendar_system'),
  async (req, res) => {
    try {
      // Use tenant ID from middleware or fallback to default
      req.tenantId = req.tenantId || DEFAULT_TENANT_ID;
      
      // Da die tenant_id in der DB ein Integer ist, konvertieren wir auf einen Standardwert
      const numericTenantId = 1; // Standard-Tenant-ID für die Entwicklung
      
      const event = await calendarModel.getEventById(
        req.params.id, 
        numericTenantId, 
        req.user.id
      );
      
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }
      
      res.json(event);
    } catch (error) {
      console.error('Error in GET /api/calendar/:id:', error);
      res.status(500).json({ message: 'Error retrieving calendar event' });
    }
});

/**
 * @route POST /api/calendar
 * @desc Create a new calendar event
 */
router.post('/api/calendar', 
  authenticateToken, 
  tenantMiddleware, 
  checkFeature('calendar_system'),
  async (req, res) => {
    try {
      // Use tenant ID from middleware or fallback to default
      req.tenantId = req.tenantId || DEFAULT_TENANT_ID;
      
      // Da die tenant_id in der DB ein Integer ist, müssen wir sie konvertieren
      const numericTenantId = 1; // Standard-Tenant-ID für die Entwicklung
      
      console.log(`Creating calendar event with tenant ID: ${numericTenantId} (konvertiert von ${req.tenantId})`);
      
      // Die org_id muss als Zahl vorliegen
      let org_id = req.body.org_id;
      if (typeof org_id === 'string') {
        org_id = parseInt(org_id, 10);
      }
      
      const eventData = {
        tenant_id: numericTenantId,
        title: req.body.title,
        description: req.body.description,
        location: req.body.location,
        start_time: req.body.start_time,
        end_time: req.body.end_time,
        all_day: req.body.all_day,
        org_level: req.body.org_level,
        org_id: org_id,
        created_by: req.user.id,
        reminder_time: req.body.reminder_time,
        color: req.body.color
      };
      
      console.log("Calendar event data:", eventData);
      
      // Validate required fields
      if (!eventData.title || !eventData.start_time || !eventData.end_time || 
          !eventData.org_level || !eventData.org_id) {
        return res.status(400).json({ 
          message: 'Missing required fields (title, start_time, end_time, org_level, org_id)' 
        });
      }
      
      // Ensure start_time is before end_time
      if (new Date(eventData.start_time) > new Date(eventData.end_time)) {
        return res.status(400).json({ 
          message: 'Start time must be before end time' 
        });
      }
      
      const event = await calendarModel.createEvent(eventData);
      
      // Add attendees if provided
      if (req.body.attendees && Array.isArray(req.body.attendees)) {
        for (const userId of req.body.attendees) {
          await calendarModel.addEventAttendee(event.id, userId);
        }
        
        // Reload event with attendees
        const updatedEvent = await calendarModel.getEventById(
          event.id, 
          numericTenantId, 
          req.user.id
        );
        
        return res.status(201).json(updatedEvent);
      }
      
      res.status(201).json(event);
    } catch (error) {
      console.error('Error in POST /api/calendar:', error);
      res.status(500).json({ message: 'Error creating calendar event' });
    }
  });

/**
 * @route PUT /api/calendar/:id
 * @desc Update a calendar event
 */
router.put('/api/calendar/:id', 
  authenticateToken, 
  tenantMiddleware, 
  checkFeature('calendar_system'),
  canManageEvent,
  async (req, res) => {
    try {
      const eventData = {
        created_by: req.user.id,
        ...req.body
      };
      
      // Da die tenant_id in der DB ein Integer ist, konvertieren wir auf einen Standardwert
      const numericTenantId = 1; // Standard-Tenant-ID für die Entwicklung
      
      // Validate time constraints if updating times
      if (eventData.start_time && eventData.end_time) {
        if (new Date(eventData.start_time) > new Date(eventData.end_time)) {
          return res.status(400).json({ message: 'Start time must be before end time' });
        }
      } else if (eventData.start_time && !eventData.end_time) {
        if (new Date(eventData.start_time) > new Date(req.event.end_time)) {
          return res.status(400).json({ message: 'Start time must be before end time' });
        }
      } else if (!eventData.start_time && eventData.end_time) {
        if (new Date(req.event.start_time) > new Date(eventData.end_time)) {
          return res.status(400).json({ message: 'Start time must be before end time' });
        }
      }
      
      console.log('Updating event with data:', eventData);
      const updatedEvent = await calendarModel.updateEvent(
        req.params.id, 
        eventData, 
        numericTenantId
      );
      
      res.json(updatedEvent);
    } catch (error) {
      console.error('Error in PUT /api/calendar/:id:', error);
      res.status(500).json({ message: 'Error updating calendar event' });
    }
  });

/**
 * @route DELETE /api/calendar/:id
 * @desc Delete a calendar event
 */
router.delete('/api/calendar/:id', 
  authenticateToken, 
  tenantMiddleware, 
  checkFeature('calendar_system'),
  canManageEvent,
  async (req, res) => {
    try {
      // Da die tenant_id in der DB ein Integer ist, konvertieren wir auf einen Standardwert
      const numericTenantId = 1; // Standard-Tenant-ID für die Entwicklung
      
      const success = await calendarModel.deleteEvent(req.params.id, numericTenantId);
      
      if (!success) {
        return res.status(404).json({ message: 'Event not found' });
      }
      
      res.json({ message: 'Event deleted successfully' });
    } catch (error) {
      console.error('Error in DELETE /api/calendar/:id:', error);
      res.status(500).json({ message: 'Error deleting calendar event' });
    }
  });

/**
 * @route GET /api/calendar/:id/attendees
 * @desc Get attendees for a calendar event
 */
router.get('/api/calendar/:id/attendees', 
  authenticateToken, 
  tenantMiddleware, 
  checkFeature('calendar_system'),
  async (req, res) => {
    try {
      // Da die tenant_id in der DB ein Integer ist, konvertieren wir auf einen Standardwert
      const numericTenantId = 1; // Standard-Tenant-ID für die Entwicklung
      
      // Check if event exists and user has access
      const event = await calendarModel.getEventById(
        req.params.id, 
        numericTenantId, 
        req.user.id
      );
      
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }
      
      const attendees = await calendarModel.getEventAttendees(
        req.params.id, 
        numericTenantId
      );
      
      res.json(attendees);
    } catch (error) {
      console.error('Error in GET /api/calendar/:id/attendees:', error);
      res.status(500).json({ message: 'Error retrieving event attendees' });
    }
  });

/**
 * @route POST /api/calendar/:id/respond
 * @desc Respond to a calendar event invitation
 */
router.post('/api/calendar/:id/respond', 
  authenticateToken, 
  tenantMiddleware, 
  checkFeature('calendar_system'),
  async (req, res) => {
    try {
      const eventId = req.params.id;
      const userId = req.user.id;
      const response = req.body.response;
      
      // Validate response
      if (!['accepted', 'declined', 'tentative'].includes(response)) {
        return res.status(400).json({ 
          message: 'Invalid response. Must be "accepted", "declined", or "tentative"' 
        });
      }
      
      // Check if event exists
      const numericTenantId = 1; // Standard-Tenant-ID für die Entwicklung
      
      const event = await calendarModel.getEventById(eventId, numericTenantId, userId);
      
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }
      
      // Record user's response
      await calendarModel.respondToEvent(eventId, userId, response);
      
      res.json({ message: 'Response recorded successfully' });
    } catch (error) {
      console.error('Error in POST /api/calendar/:id/respond:', error);
      res.status(500).json({ message: 'Error responding to event' });
    }
  });

/**
 * @route POST /api/calendar/:id/attendees
 * @desc Add attendees to a calendar event
 */
router.post('/api/calendar/:id/attendees', 
  authenticateToken, 
  tenantMiddleware, 
  checkFeature('calendar_system'),
  canManageEvent,
  async (req, res) => {
    try {
      const eventId = req.params.id;
      const { attendees } = req.body;
      
      if (!attendees || !Array.isArray(attendees) || attendees.length === 0) {
        return res.status(400).json({ message: 'No attendees provided' });
      }
      
      // Add each attendee
      for (const userId of attendees) {
        await calendarModel.addEventAttendee(eventId, userId);
      }
      
      // Get updated attendee list
      const numericTenantId = 1; // Standard-Tenant-ID für die Entwicklung
      
      const updatedAttendees = await calendarModel.getEventAttendees(
        eventId, 
        numericTenantId
      );
      
      res.json(updatedAttendees);
    } catch (error) {
      console.error('Error in POST /api/calendar/:id/attendees:', error);
      res.status(500).json({ message: 'Error adding attendees' });
    }
  });

/**
 * @route DELETE /api/calendar/:id/attendees/:userId
 * @desc Remove an attendee from a calendar event
 */
router.delete('/api/calendar/:id/attendees/:userId', 
  authenticateToken, 
  tenantMiddleware, 
  checkFeature('calendar_system'),
  canManageEvent,
  async (req, res) => {
    try {
      const eventId = req.params.id;
      const userId = req.params.userId;
      
      // Allow users to remove themselves or admins to remove anyone
      if (userId != req.user.id && req.user.role !== 'admin' && req.user.role !== 'root') {
        return res.status(403).json({ 
          message: 'You can only remove yourself from attendees' 
        });
      }
      
      const success = await calendarModel.removeEventAttendee(eventId, userId);
      
      if (!success) {
        return res.status(404).json({ message: 'Attendee not found' });
      }
      
      res.json({ message: 'Attendee removed successfully' });
    } catch (error) {
      console.error('Error in DELETE /api/calendar/:id/attendees/:userId:', error);
      res.status(500).json({ message: 'Error removing attendee' });
    }
  });

module.exports = router;