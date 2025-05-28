const employeeService = require('../services/employee.service');

class UserController {
  /**
   * Holt alle User Einträge
   * GET /api/employee
   */
  async getAll(req, res) {
    try {
      const result = await employeeService.getAll(req.tenantDb, req.query);
      res.json(result);
    } catch (error) {
      console.error('Error in UserController.getAll:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error.message,
      });
    }
  }

  /**
   * Holt einen User Eintrag per ID
   * GET /api/employee/:id
   */
  async getById(req, res) {
    try {
      const result = await employeeService.getById(req.tenantDb, req.params.id);
      if (!result) {
        return res.status(404).json({ error: 'Nicht gefunden' });
      }
      res.json(result);
    } catch (error) {
      console.error('Error in UserController.getById:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error.message,
      });
    }
  }

  /**
   * Erstellt einen neuen User Eintrag
   * POST /api/employee
   */
  async create(req, res) {
    try {
      const result = await employeeService.create(req.tenantDb, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error('Error in UserController.create:', error);
      res.status(500).json({
        error: 'Fehler beim Erstellen',
        message: error.message,
      });
    }
  }

  /**
   * Aktualisiert einen User Eintrag
   * PUT /api/employee/:id
   */
  async update(req, res) {
    try {
      const result = await employeeService.update(
        req.tenantDb,
        req.params.id,
        req.body
      );
      res.json(result);
    } catch (error) {
      console.error('Error in UserController.update:', error);
      res.status(500).json({
        error: 'Fehler beim Aktualisieren',
        message: error.message,
      });
    }
  }

  /**
   * Löscht einen User Eintrag
   * DELETE /api/employee/:id
   */
  async delete(req, res) {
    try {
      await employeeService.delete(req.tenantDb, req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error in UserController.delete:', error);
      res.status(500).json({
        error: 'Fehler beim Löschen',
        message: error.message,
      });
    }
  }
}

module.exports = new UserController();
