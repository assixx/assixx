/**
 * Shift Planning Routes
 * API endpoints for shift planning system
 */

const express = require('express');
const router = express.Router();
const Shift = require('../models/shift');
const db = require('../database');
const { authenticateToken } = require('../auth');
// const { checkFeature } = require('../middleware/features');

// Middleware to check shift planning feature - temporarily disabled
// router.use(checkFeature('shift_planning'));

/**
 * Get all shift templates
 * GET /api/shifts/templates
 */
router.get('/templates', authenticateToken, async (req, res) => {
  try {
    // Use default tenant ID 1 for now (can be improved later)
    const tenantId = req.user.tenantId || 1;
    const templates = await Shift.getShiftTemplates(tenantId);
    res.json({ templates });
  } catch (error) {
    console.error('Error fetching shift templates:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Fehler beim Laden der Schichtvorlagen' 
    });
  }
});

/**
 * Create a new shift template
 * POST /api/shifts/templates
 */
router.post('/templates', authenticateToken, async (req, res) => {
  try {
    // Check if user has permission to create templates (admin, manager, team_lead)
    const userRole = req.user.role;
    if (!['admin', 'root', 'manager', 'team_lead'].includes(userRole)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Keine Berechtigung zum Erstellen von Schichtvorlagen' 
      });
    }

    const templateData = {
      ...req.body,
      tenant_id: req.user.tenantId || 1,
      created_by: req.user.id
    };

    const template = await Shift.createShiftTemplate(templateData);
    res.status(201).json({ 
      success: true, 
      message: 'Schichtvorlage erfolgreich erstellt',
      template 
    });
  } catch (error) {
    console.error('Error creating shift template:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Fehler beim Erstellen der Schichtvorlage' 
    });
  }
});

/**
 * Get all shift plans
 * GET /api/shifts/plans
 */
router.get('/plans', authenticateToken, async (req, res) => {
  try {
    const options = {
      department_id: req.query.department_id,
      team_id: req.query.team_id,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      status: req.query.status,
      page: req.query.page || 1,
      limit: req.query.limit || 20
    };

    // Use the actual model function
    const tenantId = req.user.tenantId || 1;
    const userId = req.user.id;
    const result = await Shift.getShiftPlans(tenantId, userId, options);
    res.json(result);
  } catch (error) {
    console.error('Error fetching shift plans:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Fehler beim Laden der Schichtpläne' 
    });
  }
});

/**
 * Create a new shift plan
 * POST /api/shifts/plans
 */
router.post('/plans', authenticateToken, async (req, res) => {
  try {
    // Check if user has permission to create plans (admin, manager, team_lead)
    const userRole = req.user.role;
    if (!['admin', 'root', 'manager', 'team_lead'].includes(userRole)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Keine Berechtigung zum Erstellen von Schichtplänen' 
      });
    }

    // Validate required fields
    const { name, start_date, end_date } = req.body;
    if (!name || !start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Name, Startdatum und Enddatum sind erforderlich'
      });
    }

    const planData = {
      ...req.body,
      tenant_id: req.user.tenantId || 1,
      created_by: req.user.id
    };

    console.log('Creating shift plan with data:', planData);

    // Use the actual model function
    const plan = await Shift.createShiftPlan(planData);
    res.status(201).json({ 
      success: true, 
      message: 'Schichtplan erfolgreich erstellt',
      plan 
    });
  } catch (error) {
    console.error('Error creating shift plan:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Fehler beim Erstellen des Schichtplans' 
    });
  }
});

/**
 * Get shifts for a specific plan
 * GET /api/shifts/plans/:planId/shifts
 */
router.get('/plans/:planId/shifts', authenticateToken, async (req, res) => {
  try {
    const planId = parseInt(req.params.planId);
    const shifts = await Shift.getShiftsByPlan(planId, req.user.tenantId || 1, req.user.id);
    res.json({ shifts });
  } catch (error) {
    console.error('Error fetching shifts for plan:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Fehler beim Laden der Schichten' 
    });
  }
});

/**
 * Create a new shift
 * POST /api/shifts
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    // Check if user has permission to create shifts (admin, manager, team_lead)
    const userRole = req.user.role;
    if (!['admin', 'root', 'manager', 'team_lead'].includes(userRole)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Keine Berechtigung zum Erstellen von Schichten' 
      });
    }

    const shiftData = {
      ...req.body,
      tenant_id: req.user.tenantId || 1,
      created_by: req.user.id
    };

    const shift = await Shift.createShift(shiftData);
    res.status(201).json({ 
      success: true, 
      message: 'Schicht erfolgreich erstellt',
      shift 
    });
  } catch (error) {
    console.error('Error creating shift:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Fehler beim Erstellen der Schicht' 
    });
  }
});

/**
 * Assign employee to shift
 * POST /api/shifts/:shiftId/assign
 */
router.post('/:shiftId/assign', authenticateToken, async (req, res) => {
  try {
    // Check if user has permission to assign shifts (admin, manager, team_lead)
    const userRole = req.user.role;
    if (!['admin', 'root', 'manager', 'team_lead'].includes(userRole)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Keine Berechtigung zum Zuweisen von Schichten' 
      });
    }

    const shiftId = parseInt(req.params.shiftId);
    const assignmentData = {
      ...req.body,
      tenant_id: req.user.tenantId || 1,
      shift_id: shiftId,
      assigned_by: req.user.id
    };

    const assignment = await Shift.assignEmployeeToShift(assignmentData);
    res.status(201).json({ 
      success: true, 
      message: 'Mitarbeiter erfolgreich zugewiesen',
      assignment 
    });
  } catch (error) {
    console.error('Error assigning employee to shift:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Fehler beim Zuweisen des Mitarbeiters' 
    });
  }
});

/**
 * Get employee availability
 * GET /api/shifts/availability
 */
router.get('/availability', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, user_id } = req.query;
    
    if (!start_date || !end_date) {
      return res.status(400).json({ 
        success: false, 
        message: 'Start- und Enddatum sind erforderlich' 
      });
    }

    // Use provided user_id or current user's id
    const targetUserId = user_id ? parseInt(user_id) : req.user.id;
    
    // Check if user can view this availability
    if (targetUserId !== req.user.id) {
      const userRole = req.user.role;
      if (!['admin', 'root', 'manager', 'team_lead'].includes(userRole)) {
        return res.status(403).json({ 
          success: false, 
          message: 'Keine Berechtigung zum Anzeigen der Verfügbarkeit' 
        });
      }
    }

    const availability = await Shift.getEmployeeAvailability(
      req.user.tenantId || 1, 
      targetUserId, 
      start_date, 
      end_date
    );
    
    res.json({ availability });
  } catch (error) {
    console.error('Error fetching employee availability:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Fehler beim Laden der Verfügbarkeit' 
    });
  }
});

/**
 * Set employee availability
 * POST /api/shifts/availability
 */
router.post('/availability', authenticateToken, async (req, res) => {
  try {
    const availabilityData = {
      ...req.body,
      tenant_id: req.user.tenantId || 1,
      user_id: req.body.user_id || req.user.id
    };

    // Check if user can set this availability
    if (availabilityData.user_id !== req.user.id) {
      const userRole = req.user.role;
      if (!['admin', 'root', 'manager', 'team_lead'].includes(userRole)) {
        return res.status(403).json({ 
          success: false, 
          message: 'Keine Berechtigung zum Setzen der Verfügbarkeit' 
        });
      }
    }

    const availability = await Shift.setEmployeeAvailability(availabilityData);
    res.json({ 
      success: true, 
      message: 'Verfügbarkeit erfolgreich gesetzt',
      availability 
    });
  } catch (error) {
    console.error('Error setting employee availability:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Fehler beim Setzen der Verfügbarkeit' 
    });
  }
});

/**
 * Get shift exchange requests
 * GET /api/shifts/exchange-requests
 */
router.get('/exchange-requests', authenticateToken, async (req, res) => {
  try {
    const options = {
      status: req.query.status || 'pending',
      limit: req.query.limit || 50
    };

    const requests = await Shift.getShiftExchangeRequests(
      req.user.tenantId || 1, 
      req.user.id, 
      options
    );
    
    res.json({ requests });
  } catch (error) {
    console.error('Error fetching shift exchange requests:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Fehler beim Laden der Tauschbörse' 
    });
  }
});

/**
 * Create shift exchange request
 * POST /api/shifts/exchange-requests
 */
router.post('/exchange-requests', authenticateToken, async (req, res) => {
  try {
    const requestData = {
      ...req.body,
      tenant_id: req.user.tenantId || 1,
      requester_id: req.user.id
    };

    const request = await Shift.createShiftExchangeRequest(requestData);
    res.status(201).json({ 
      success: true, 
      message: 'Tauschantrag erfolgreich erstellt',
      request 
    });
  } catch (error) {
    console.error('Error creating shift exchange request:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Fehler beim Erstellen des Tauschantrags' 
    });
  }
});

/**
 * Get employee shifts
 * GET /api/shifts/my-shifts
 */
router.get('/my-shifts', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    if (!start_date || !end_date) {
      return res.status(400).json({ 
        success: false, 
        message: 'Start- und Enddatum sind erforderlich' 
      });
    }

    const shifts = await Shift.getEmployeeShifts(
      req.user.tenantId || 1, 
      req.user.id, 
      start_date, 
      end_date
    );
    
    res.json({ shifts });
  } catch (error) {
    console.error('Error fetching employee shifts:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Fehler beim Laden der eigenen Schichten' 
    });
  }
});

/**
 * Get dashboard summary for shift planning
 * GET /api/shifts/dashboard
 */
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const tenantId = req.user.tenantId || 1;
    const userId = req.user.id;
    
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
        availabilityDays: availability.filter(a => a.availability_type === 'available').length
      }
    });
  } catch (error) {
    console.error('Error fetching shift dashboard:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Fehler beim Laden des Schichtplan-Dashboards' 
    });
  }
});

/**
 * Get weekly shifts with assignments
 * GET /api/shifts/weekly
 */
router.get('/weekly', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Start- und Enddatum sind erforderlich'
      });
    }
    
    const tenantId = req.user.tenantId || 1;
    
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
    
    const [shifts] = await db.query(query, [
      tenantId,
      start_date,
      end_date
    ]);
    
    res.json({ 
      success: true,
      shifts 
    });
  } catch (error) {
    console.error('Error fetching weekly shifts:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Fehler beim Laden der Wochenschichten' 
    });
  }
});

/**
 * Get weekly notes
 * GET /api/shifts/weekly-notes
 */
router.get('/weekly-notes', authenticateToken, async (req, res) => {
  try {
    const { week, year } = req.query;
    
    if (!week || !year) {
      return res.status(400).json({
        success: false,
        message: 'Week and year are required'
      });
    }
    
    // For now, return empty notes
    res.json({ notes: '' });
  } catch (error) {
    console.error('Error fetching weekly notes:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Fehler beim Laden der Wochennotizen' 
    });
  }
});

/**
 * Save weekly notes
 * POST /api/shifts/weekly-notes
 */
router.post('/weekly-notes', authenticateToken, async (req, res) => {
  try {
    const { week, year, notes, context } = req.body;
    
    if (!week || !year) {
      return res.status(400).json({
        success: false,
        message: 'Week and year are required'
      });
    }
    
    // For now, just return success
    res.json({ 
      success: true,
      message: 'Notizen gespeichert'
    });
  } catch (error) {
    console.error('Error saving weekly notes:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Fehler beim Speichern der Wochennotizen' 
    });
  }
});

module.exports = router;