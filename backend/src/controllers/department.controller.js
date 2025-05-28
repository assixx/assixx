const departmentService = require('../services/department.service');

class DepartmentController {
  /**
   * Holt alle Department Einträge
   * GET /api/department
   */
  async getAll(req, res) {
    try {
      const result = await departmentService.getAll(req.tenantDb, req.query);
      res.json(result);
    } catch (error) {
      console.error('Error in DepartmentController.getAll:', error);
      res.status(500).json({ 
        error: 'Fehler beim Abrufen der Daten',
        message: error.message 
      });
    }
  }

  /**
   * Holt einen Department Eintrag per ID
   * GET /api/department/:id
   */
  async getById(req, res) {
    try {
      const result = await departmentService.getById(req.tenantDb, req.params.id);
      if (!result) {
        return res.status(404).json({ error: 'Nicht gefunden' });
      }
      res.json(result);
    } catch (error) {
      console.error('Error in DepartmentController.getById:', error);
      res.status(500).json({ 
        error: 'Fehler beim Abrufen der Daten',
        message: error.message 
      });
    }
  }

  /**
   * Erstellt einen neuen Department Eintrag
   * POST /api/department
   */
  async create(req, res) {
    try {
      const result = await departmentService.create(req.tenantDb, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error('Error in DepartmentController.create:', error);
      res.status(500).json({ 
        error: 'Fehler beim Erstellen',
        message: error.message 
      });
    }
  }

  /**
   * Aktualisiert einen Department Eintrag
   * PUT /api/department/:id
   */
  async update(req, res) {
    try {
      const result = await departmentService.update(
        req.tenantDb, 
        req.params.id, 
        req.body
      );
      res.json(result);
    } catch (error) {
      console.error('Error in DepartmentController.update:', error);
      res.status(500).json({ 
        error: 'Fehler beim Aktualisieren',
        message: error.message 
      });
    }
  }

  /**
   * Löscht einen Department Eintrag
   * DELETE /api/department/:id
   */
  async delete(req, res) {
    try {
      await departmentService.delete(req.tenantDb, req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error in DepartmentController.delete:', error);
      res.status(500).json({ 
        error: 'Fehler beim Löschen',
        message: error.message 
      });
    }
  }
}

module.exports = new DepartmentController();