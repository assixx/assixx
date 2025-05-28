const surveyService = require('../services/survey.service');

class SurveyController {
  /**
   * Holt alle Survey Einträge
   * GET /api/survey
   */
  async getAll(req, res) {
    try {
      const result = await surveyService.getAll(req.tenantDb, req.query);
      res.json(result);
    } catch (error) {
      console.error('Error in SurveyController.getAll:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error.message,
      });
    }
  }

  /**
   * Holt einen Survey Eintrag per ID
   * GET /api/survey/:id
   */
  async getById(req, res) {
    try {
      const result = await surveyService.getById(req.tenantDb, req.params.id);
      if (!result) {
        return res.status(404).json({ error: 'Nicht gefunden' });
      }
      res.json(result);
    } catch (error) {
      console.error('Error in SurveyController.getById:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error.message,
      });
    }
  }

  /**
   * Erstellt einen neuen Survey Eintrag
   * POST /api/survey
   */
  async create(req, res) {
    try {
      const result = await surveyService.create(req.tenantDb, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error('Error in SurveyController.create:', error);
      res.status(500).json({
        error: 'Fehler beim Erstellen',
        message: error.message,
      });
    }
  }

  /**
   * Aktualisiert einen Survey Eintrag
   * PUT /api/survey/:id
   */
  async update(req, res) {
    try {
      const result = await surveyService.update(
        req.tenantDb,
        req.params.id,
        req.body
      );
      res.json(result);
    } catch (error) {
      console.error('Error in SurveyController.update:', error);
      res.status(500).json({
        error: 'Fehler beim Aktualisieren',
        message: error.message,
      });
    }
  }

  /**
   * Löscht einen Survey Eintrag
   * DELETE /api/survey/:id
   */
  async delete(req, res) {
    try {
      await surveyService.delete(req.tenantDb, req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error in SurveyController.delete:', error);
      res.status(500).json({
        error: 'Fehler beim Löschen',
        message: error.message,
      });
    }
  }
}

module.exports = new SurveyController();
