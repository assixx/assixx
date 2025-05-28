const kvpService = require('../services/kvp.service');

class KvpController {
  /**
   * Holt alle Kvp Einträge
   * GET /api/kvp
   */
  async getAll(req, res) {
    try {
      const result = await kvpService.getAll(req.tenantDb, req.query);
      res.json(result);
    } catch (error) {
      console.error('Error in KvpController.getAll:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error.message,
      });
    }
  }

  /**
   * Holt einen Kvp Eintrag per ID
   * GET /api/kvp/:id
   */
  async getById(req, res) {
    try {
      const result = await kvpService.getById(req.tenantDb, req.params.id);
      if (!result) {
        return res.status(404).json({ error: 'Nicht gefunden' });
      }
      res.json(result);
    } catch (error) {
      console.error('Error in KvpController.getById:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error.message,
      });
    }
  }

  /**
   * Erstellt einen neuen Kvp Eintrag
   * POST /api/kvp
   */
  async create(req, res) {
    try {
      const result = await kvpService.create(req.tenantDb, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error('Error in KvpController.create:', error);
      res.status(500).json({
        error: 'Fehler beim Erstellen',
        message: error.message,
      });
    }
  }

  /**
   * Aktualisiert einen Kvp Eintrag
   * PUT /api/kvp/:id
   */
  async update(req, res) {
    try {
      const result = await kvpService.update(
        req.tenantDb,
        req.params.id,
        req.body
      );
      res.json(result);
    } catch (error) {
      console.error('Error in KvpController.update:', error);
      res.status(500).json({
        error: 'Fehler beim Aktualisieren',
        message: error.message,
      });
    }
  }

  /**
   * Löscht einen Kvp Eintrag
   * DELETE /api/kvp/:id
   */
  async delete(req, res) {
    try {
      await kvpService.delete(req.tenantDb, req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error in KvpController.delete:', error);
      res.status(500).json({
        error: 'Fehler beim Löschen',
        message: error.message,
      });
    }
  }
}

module.exports = new KvpController();
