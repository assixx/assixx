const teamService = require('../services/team.service');

class TeamController {
  /**
   * Holt alle Team Einträge
   * GET /api/team
   */
  async getAll(req, res) {
    try {
      const result = await teamService.getAll(req.tenantDb, req.query);
      res.json(result);
    } catch (error) {
      console.error('Error in TeamController.getAll:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error.message,
      });
    }
  }

  /**
   * Holt einen Team Eintrag per ID
   * GET /api/team/:id
   */
  async getById(req, res) {
    try {
      const result = await teamService.getById(req.tenantDb, req.params.id);
      if (!result) {
        return res.status(404).json({ error: 'Nicht gefunden' });
      }
      res.json(result);
    } catch (error) {
      console.error('Error in TeamController.getById:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error.message,
      });
    }
  }

  /**
   * Erstellt einen neuen Team Eintrag
   * POST /api/team
   */
  async create(req, res) {
    try {
      const result = await teamService.create(req.tenantDb, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error('Error in TeamController.create:', error);
      res.status(500).json({
        error: 'Fehler beim Erstellen',
        message: error.message,
      });
    }
  }

  /**
   * Aktualisiert einen Team Eintrag
   * PUT /api/team/:id
   */
  async update(req, res) {
    try {
      const result = await teamService.update(
        req.tenantDb,
        req.params.id,
        req.body
      );
      res.json(result);
    } catch (error) {
      console.error('Error in TeamController.update:', error);
      res.status(500).json({
        error: 'Fehler beim Aktualisieren',
        message: error.message,
      });
    }
  }

  /**
   * Löscht einen Team Eintrag
   * DELETE /api/team/:id
   */
  async delete(req, res) {
    try {
      await teamService.delete(req.tenantDb, req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error in TeamController.delete:', error);
      res.status(500).json({
        error: 'Fehler beim Löschen',
        message: error.message,
      });
    }
  }
}

module.exports = new TeamController();
