const blackboardService = require('../services/blackboard.service');

class BlackboardController {
  /**
   * Holt alle Blackboard Einträge
   * GET /api/blackboard
   */
  async getAll(req, res) {
    try {
      const result = await blackboardService.getAll(req.tenantDb, req.query);
      res.json(result);
    } catch (error) {
      console.error('Error in BlackboardController.getAll:', error);
      res.status(500).json({ 
        error: 'Fehler beim Abrufen der Daten',
        message: error.message 
      });
    }
  }

  /**
   * Holt einen Blackboard Eintrag per ID
   * GET /api/blackboard/:id
   */
  async getById(req, res) {
    try {
      const result = await blackboardService.getById(req.tenantDb, req.params.id);
      if (!result) {
        return res.status(404).json({ error: 'Nicht gefunden' });
      }
      res.json(result);
    } catch (error) {
      console.error('Error in BlackboardController.getById:', error);
      res.status(500).json({ 
        error: 'Fehler beim Abrufen der Daten',
        message: error.message 
      });
    }
  }

  /**
   * Erstellt einen neuen Blackboard Eintrag
   * POST /api/blackboard
   */
  async create(req, res) {
    try {
      const result = await blackboardService.create(req.tenantDb, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error('Error in BlackboardController.create:', error);
      res.status(500).json({ 
        error: 'Fehler beim Erstellen',
        message: error.message 
      });
    }
  }

  /**
   * Aktualisiert einen Blackboard Eintrag
   * PUT /api/blackboard/:id
   */
  async update(req, res) {
    try {
      const result = await blackboardService.update(
        req.tenantDb, 
        req.params.id, 
        req.body
      );
      res.json(result);
    } catch (error) {
      console.error('Error in BlackboardController.update:', error);
      res.status(500).json({ 
        error: 'Fehler beim Aktualisieren',
        message: error.message 
      });
    }
  }

  /**
   * Löscht einen Blackboard Eintrag
   * DELETE /api/blackboard/:id
   */
  async delete(req, res) {
    try {
      await blackboardService.delete(req.tenantDb, req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error in BlackboardController.delete:', error);
      res.status(500).json({ 
        error: 'Fehler beim Löschen',
        message: error.message 
      });
    }
  }
}

module.exports = new BlackboardController();