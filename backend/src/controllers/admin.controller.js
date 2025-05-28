const adminService = require('../services/admin.service');

class AdminLogController {
  /**
   * Holt alle AdminLog Einträge
   * GET /api/admin
   */
  async getAll(req, res) {
    try {
      const result = await adminService.getAll(req.tenantDb, req.query);
      res.json(result);
    } catch (error) {
      console.error('Error in AdminLogController.getAll:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error.message,
      });
    }
  }

  /**
   * Holt einen AdminLog Eintrag per ID
   * GET /api/admin/:id
   */
  async getById(req, res) {
    try {
      const result = await adminService.getById(req.tenantDb, req.params.id);
      if (!result) {
        return res.status(404).json({ error: 'Nicht gefunden' });
      }
      res.json(result);
    } catch (error) {
      console.error('Error in AdminLogController.getById:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error.message,
      });
    }
  }

  /**
   * Erstellt einen neuen AdminLog Eintrag
   * POST /api/admin
   */
  async create(req, res) {
    try {
      const result = await adminService.create(req.tenantDb, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error('Error in AdminLogController.create:', error);
      res.status(500).json({
        error: 'Fehler beim Erstellen',
        message: error.message,
      });
    }
  }

  /**
   * Aktualisiert einen AdminLog Eintrag
   * PUT /api/admin/:id
   */
  async update(req, res) {
    try {
      const result = await adminService.update(
        req.tenantDb,
        req.params.id,
        req.body
      );
      res.json(result);
    } catch (error) {
      console.error('Error in AdminLogController.update:', error);
      res.status(500).json({
        error: 'Fehler beim Aktualisieren',
        message: error.message,
      });
    }
  }

  /**
   * Löscht einen AdminLog Eintrag
   * DELETE /api/admin/:id
   */
  async delete(req, res) {
    try {
      await adminService.delete(req.tenantDb, req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error in AdminLogController.delete:', error);
      res.status(500).json({
        error: 'Fehler beim Löschen',
        message: error.message,
      });
    }
  }
}

module.exports = new AdminLogController();
