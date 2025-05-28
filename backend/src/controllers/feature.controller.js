const featureService = require('../services/feature.service');

class FeatureController {
  /**
   * Holt alle Feature Einträge
   * GET /api/feature
   */
  async getAll(req, res) {
    try {
      const result = await featureService.getAll(req.tenantDb, req.query);
      res.json(result);
    } catch (error) {
      console.error('Error in FeatureController.getAll:', error);
      res.status(500).json({ 
        error: 'Fehler beim Abrufen der Daten',
        message: error.message 
      });
    }
  }

  /**
   * Holt einen Feature Eintrag per ID
   * GET /api/feature/:id
   */
  async getById(req, res) {
    try {
      const result = await featureService.getById(req.tenantDb, req.params.id);
      if (!result) {
        return res.status(404).json({ error: 'Nicht gefunden' });
      }
      res.json(result);
    } catch (error) {
      console.error('Error in FeatureController.getById:', error);
      res.status(500).json({ 
        error: 'Fehler beim Abrufen der Daten',
        message: error.message 
      });
    }
  }

  /**
   * Erstellt einen neuen Feature Eintrag
   * POST /api/feature
   */
  async create(req, res) {
    try {
      const result = await featureService.create(req.tenantDb, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error('Error in FeatureController.create:', error);
      res.status(500).json({ 
        error: 'Fehler beim Erstellen',
        message: error.message 
      });
    }
  }

  /**
   * Aktualisiert einen Feature Eintrag
   * PUT /api/feature/:id
   */
  async update(req, res) {
    try {
      const result = await featureService.update(
        req.tenantDb, 
        req.params.id, 
        req.body
      );
      res.json(result);
    } catch (error) {
      console.error('Error in FeatureController.update:', error);
      res.status(500).json({ 
        error: 'Fehler beim Aktualisieren',
        message: error.message 
      });
    }
  }

  /**
   * Löscht einen Feature Eintrag
   * DELETE /api/feature/:id
   */
  async delete(req, res) {
    try {
      await featureService.delete(req.tenantDb, req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error in FeatureController.delete:', error);
      res.status(500).json({ 
        error: 'Fehler beim Löschen',
        message: error.message 
      });
    }
  }
}

module.exports = new FeatureController();