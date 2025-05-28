/**
 * Areas Routes
 * API endpoints for area/location management
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../auth');

/**
 * Get all areas
 * GET /api/areas
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    // For now, return dummy area data
    // In production, this would query the areas table
    const areas = [
      {
        id: 1,
        name: 'Halle A',
        description: 'Produktionsbereich A',
        type: 'production',
      },
      {
        id: 2,
        name: 'Halle B',
        description: 'Produktionsbereich B',
        type: 'production',
      },
      {
        id: 3,
        name: 'Lager Nord',
        description: 'Eingangslager',
        type: 'warehouse',
      },
      {
        id: 4,
        name: 'Lager Süd',
        description: 'Ausgangslager',
        type: 'warehouse',
      },
      {
        id: 5,
        name: 'Bürobereich',
        description: 'Verwaltung und Büros',
        type: 'office',
      },
      {
        id: 6,
        name: 'Qualitätsprüfung',
        description: 'QS-Bereich',
        type: 'quality',
      },
      {
        id: 7,
        name: 'Wartung',
        description: 'Werkstatt und Wartung',
        type: 'maintenance',
      },
    ];

    // Filter by type if requested
    const areaType = req.query.type;
    let filteredAreas = areas;

    if (areaType) {
      filteredAreas = areas.filter((area) => area.type === areaType);
    }

    res.json({
      success: true,
      areas: filteredAreas,
    });
  } catch (error) {
    console.error('Error fetching areas:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden der Bereiche',
    });
  }
});

/**
 * Get area by ID
 * GET /api/areas/:id
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const areaId = parseInt(req.params.id);

    // Dummy area data
    const area = {
      id: areaId,
      name: `Bereich ${areaId}`,
      description: 'Automatisch generierter Bereich',
      type: 'production',
      capacity: 50,
      supervisor: 'Max Mustermann',
    };

    res.json({
      success: true,
      area,
    });
  } catch (error) {
    console.error('Error fetching area:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden des Bereichs',
    });
  }
});

/**
 * Create new area (Admin only)
 * POST /api/areas
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    // Check admin permission
    if (!['admin', 'root', 'manager'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Keine Berechtigung zum Erstellen von Bereichen',
      });
    }

    const { name, description, type, capacity } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Name ist erforderlich',
      });
    }

    // For now, return dummy created area
    const area = {
      id: Date.now(),
      name,
      description: description || null,
      type: type || 'production',
      capacity: capacity || null,
      created_at: new Date(),
    };

    res.status(201).json({
      success: true,
      message: 'Bereich erfolgreich erstellt',
      area,
    });
  } catch (error) {
    console.error('Error creating area:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Erstellen des Bereichs',
    });
  }
});

module.exports = router;
