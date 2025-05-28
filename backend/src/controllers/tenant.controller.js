const tenantService = require('../services/tenant.service');

class TenantController {
  /**
   * Holt alle Tenant Einträge
   * GET /api/tenant
   */
  async getAll(req, res) {
    try {
      const result = await tenantService.getAll(req.tenantDb, req.query);
      res.json(result);
    } catch (error) {
      console.error('Error in TenantController.getAll:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error.message,
      });
    }
  }

  /**
   * Holt einen Tenant Eintrag per ID
   * GET /api/tenant/:id
   */
  async getById(req, res) {
    try {
      const result = await tenantService.getById(req.tenantDb, req.params.id);
      if (!result) {
        return res.status(404).json({ error: 'Nicht gefunden' });
      }
      res.json(result);
    } catch (error) {
      console.error('Error in TenantController.getById:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error.message,
      });
    }
  }

  /**
   * Erstellt einen neuen Tenant Eintrag
   * POST /api/tenant
   */
  async create(req, res) {
    try {
      const result = await tenantService.create(req.tenantDb, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error('Error in TenantController.create:', error);
      res.status(500).json({
        error: 'Fehler beim Erstellen',
        message: error.message,
      });
    }
  }

  /**
   * Aktualisiert einen Tenant Eintrag
   * PUT /api/tenant/:id
   */
  async update(req, res) {
    try {
      const result = await tenantService.update(
        req.tenantDb,
        req.params.id,
        req.body
      );
      res.json(result);
    } catch (error) {
      console.error('Error in TenantController.update:', error);
      res.status(500).json({
        error: 'Fehler beim Aktualisieren',
        message: error.message,
      });
    }
  }

  /**
   * Löscht einen Tenant Eintrag
   * DELETE /api/tenant/:id
   */
  async delete(req, res) {
    try {
      await tenantService.delete(req.tenantDb, req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error in TenantController.delete:', error);
      res.status(500).json({
        error: 'Fehler beim Löschen',
        message: error.message,
      });
    }
  }
}

module.exports = new TenantController();
