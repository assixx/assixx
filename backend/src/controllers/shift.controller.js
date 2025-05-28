const shiftService = require('../services/shift.service');

class ShiftController {
  /**
   * Holt alle Shift Einträge
   * GET /api/shift
   */
  async getAll(req, res) {
    try {
      const result = await shiftService.getAll(req.tenantDb, req.query);
      res.json(result);
    } catch (error) {
      console.error('Error in ShiftController.getAll:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error.message,
      });
    }
  }

  /**
   * Holt einen Shift Eintrag per ID
   * GET /api/shift/:id
   */
  async getById(req, res) {
    try {
      const result = await shiftService.getById(req.tenantDb, req.params.id);
      if (!result) {
        return res.status(404).json({ error: 'Nicht gefunden' });
      }
      res.json(result);
    } catch (error) {
      console.error('Error in ShiftController.getById:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error.message,
      });
    }
  }

  /**
   * Erstellt einen neuen Shift Eintrag
   * POST /api/shift
   */
  async create(req, res) {
    try {
      const result = await shiftService.create(req.tenantDb, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error('Error in ShiftController.create:', error);
      res.status(500).json({
        error: 'Fehler beim Erstellen',
        message: error.message,
      });
    }
  }

  /**
   * Aktualisiert einen Shift Eintrag
   * PUT /api/shift/:id
   */
  async update(req, res) {
    try {
      const result = await shiftService.update(
        req.tenantDb,
        req.params.id,
        req.body
      );
      res.json(result);
    } catch (error) {
      console.error('Error in ShiftController.update:', error);
      res.status(500).json({
        error: 'Fehler beim Aktualisieren',
        message: error.message,
      });
    }
  }

  /**
   * Löscht einen Shift Eintrag
   * DELETE /api/shift/:id
   */
  async delete(req, res) {
    try {
      await shiftService.delete(req.tenantDb, req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error in ShiftController.delete:', error);
      res.status(500).json({
        error: 'Fehler beim Löschen',
        message: error.message,
      });
    }
  }
}

module.exports = new ShiftController();
