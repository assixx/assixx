const surveyService = require('../services/survey.service');

class SurveyController {
  /**
   * Holt alle Survey Einträge für einen Tenant
   * GET /api/surveys
   */
  async getAll(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const result = await surveyService.getAllByTenant(tenantId, req.query);
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
   * Holt einen Survey Eintrag per ID mit Fragen und Optionen
   * GET /api/surveys/:id
   */
  async getById(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const Survey = require('../models/survey');
      const result = await Survey.getById(req.params.id, tenantId);
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
   * Erstellt einen neuen Survey
   * POST /api/surveys
   */
  async create(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const createdBy = req.user.id; // Changed from user_id to id
      const Survey = require('../models/survey');
      const surveyId = await Survey.create(req.body, tenantId, createdBy);
      res.status(201).json({ id: surveyId, message: 'Umfrage erfolgreich erstellt' });
    } catch (error) {
      console.error('Error in SurveyController.create:', error);
      res.status(500).json({
        error: 'Fehler beim Erstellen',
        message: error.message,
      });
    }
  }

  /**
   * Aktualisiert einen Survey
   * PUT /api/surveys/:id
   */
  async update(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const Survey = require('../models/survey');
      const result = await Survey.update(req.params.id, req.body, tenantId);
      res.json({ success: result, message: 'Umfrage erfolgreich aktualisiert' });
    } catch (error) {
      console.error('Error in SurveyController.update:', error);
      res.status(500).json({
        error: 'Fehler beim Aktualisieren',
        message: error.message,
      });
    }
  }

  /**
   * Löscht einen Survey
   * DELETE /api/surveys/:id
   */
  async delete(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const Survey = require('../models/survey');
      const result = await Survey.delete(req.params.id, tenantId);
      if (!result) {
        return res.status(404).json({ error: 'Umfrage nicht gefunden' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error in SurveyController.delete:', error);
      res.status(500).json({
        error: 'Fehler beim Löschen',
        message: error.message,
      });
    }
  }

  /**
   * Holt Templates
   * GET /api/surveys/templates
   */
  async getTemplates(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const templates = await surveyService.getTemplates(tenantId);
      res.json(templates);
    } catch (error) {
      console.error('Error in SurveyController.getTemplates:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Templates',
        message: error.message,
      });
    }
  }

  /**
   * Erstellt Survey aus Template
   * POST /api/surveys/from-template/:templateId
   */
  async createFromTemplate(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const createdBy = req.user.id; // Changed from user_id to id
      const surveyId = await surveyService.createFromTemplate(
        req.params.templateId,
        tenantId,
        createdBy
      );
      res.status(201).json({ id: surveyId, message: 'Umfrage aus Template erstellt' });
    } catch (error) {
      console.error('Error in SurveyController.createFromTemplate:', error);
      res.status(500).json({
        error: 'Fehler beim Erstellen aus Template',
        message: error.message,
      });
    }
  }

  /**
   * Holt Survey Statistiken
   * GET /api/surveys/:id/statistics
   */
  async getStatistics(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const statistics = await surveyService.getStatistics(req.params.id, tenantId);
      res.json(statistics);
    } catch (error) {
      console.error('Error in SurveyController.getStatistics:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Statistiken',
        message: error.message,
      });
    }
  }
}

module.exports = new SurveyController();
