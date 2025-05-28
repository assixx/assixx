const calendarService = require('../services/calendar.service');

class CalendarController {
  /**
   * Holt alle Calendar Einträge
   * GET /api/calendar
   */
  async getAll(req, res) {
    try {
      const result = await calendarService.getAll(req.tenantDb, req.query);
      res.json(result);
    } catch (error) {
      console.error('Error in CalendarController.getAll:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error.message,
      });
    }
  }

  /**
   * Holt einen Calendar Eintrag per ID
   * GET /api/calendar/:id
   */
  async getById(req, res) {
    try {
      const result = await calendarService.getById(req.tenantDb, req.params.id);
      if (!result) {
        return res.status(404).json({ error: 'Nicht gefunden' });
      }
      res.json(result);
    } catch (error) {
      console.error('Error in CalendarController.getById:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error.message,
      });
    }
  }

  /**
   * Erstellt einen neuen Calendar Eintrag
   * POST /api/calendar
   */
  async create(req, res) {
    try {
      const result = await calendarService.create(req.tenantDb, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error('Error in CalendarController.create:', error);
      res.status(500).json({
        error: 'Fehler beim Erstellen',
        message: error.message,
      });
    }
  }

  /**
   * Aktualisiert einen Calendar Eintrag
   * PUT /api/calendar/:id
   */
  async update(req, res) {
    try {
      const result = await calendarService.update(
        req.tenantDb,
        req.params.id,
        req.body
      );
      res.json(result);
    } catch (error) {
      console.error('Error in CalendarController.update:', error);
      res.status(500).json({
        error: 'Fehler beim Aktualisieren',
        message: error.message,
      });
    }
  }

  /**
   * Löscht einen Calendar Eintrag
   * DELETE /api/calendar/:id
   */
  async delete(req, res) {
    try {
      await calendarService.delete(req.tenantDb, req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error in CalendarController.delete:', error);
      res.status(500).json({
        error: 'Fehler beim Löschen',
        message: error.message,
      });
    }
  }
}

module.exports = new CalendarController();
