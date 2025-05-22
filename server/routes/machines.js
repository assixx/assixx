/**
 * Machines Routes
 * API endpoints for machine management
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../auth');

/**
 * Get all machines
 * GET /api/machines
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    // For now, return dummy machine data
    // In production, this would query the machines table
    const machines = [
      { id: 1, name: 'Anlage 01', department_id: 1, status: 'active' },
      { id: 2, name: 'Anlage 02', department_id: 1, status: 'active' },
      { id: 3, name: 'Förderband A', department_id: 2, status: 'active' },
      { id: 4, name: 'Förderband B', department_id: 2, status: 'active' },
      { id: 5, name: 'Prüfstand 01', department_id: 3, status: 'maintenance' },
      { id: 6, name: 'Prüfstand 02', department_id: 3, status: 'active' }
    ];

    // Filter by department if requested
    const departmentId = req.query.department_id;
    let filteredMachines = machines;
    
    if (departmentId) {
      filteredMachines = machines.filter(machine => 
        machine.department_id == departmentId
      );
    }

    res.json({ 
      success: true,
      machines: filteredMachines 
    });
  } catch (error) {
    console.error('Error fetching machines:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Fehler beim Laden der Maschinen' 
    });
  }
});

/**
 * Get machine by ID
 * GET /api/machines/:id
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const machineId = parseInt(req.params.id);
    
    // Dummy machine data
    const machine = {
      id: machineId,
      name: `Maschine ${machineId}`,
      department_id: 1,
      status: 'active',
      description: 'Automatisch generierte Maschine',
      location: 'Halle A',
      maintenance_schedule: 'Wöchentlich'
    };

    res.json({ 
      success: true,
      machine 
    });
  } catch (error) {
    console.error('Error fetching machine:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Fehler beim Laden der Maschine' 
    });
  }
});

/**
 * Create new machine (Admin only)
 * POST /api/machines
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    // Check admin permission
    if (!['admin', 'root', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Keine Berechtigung zum Erstellen von Maschinen' 
      });
    }

    const { name, department_id, description, location } = req.body;

    if (!name || !department_id) {
      return res.status(400).json({
        success: false,
        message: 'Name und Abteilung sind erforderlich'
      });
    }

    // For now, return dummy created machine
    const machine = {
      id: Date.now(),
      name,
      department_id,
      description: description || null,
      location: location || null,
      status: 'active',
      created_at: new Date()
    };

    res.status(201).json({ 
      success: true, 
      message: 'Maschine erfolgreich erstellt',
      machine 
    });
  } catch (error) {
    console.error('Error creating machine:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Fehler beim Erstellen der Maschine' 
    });
  }
});

module.exports = router;