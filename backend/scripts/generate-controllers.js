#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

// Liste der zu generierenden Controller/Services
const features = [
  { name: 'blackboard', model: 'Blackboard' },
  { name: 'calendar', model: 'Calendar' },
  { name: 'kvp', model: 'Kvp' },
  { name: 'survey', model: 'Survey' },
  { name: 'team', model: 'Team' },
  { name: 'department', model: 'Department' },
  { name: 'shift', model: 'Shift' },
  { name: 'tenant', model: 'Tenant' },
  { name: 'feature', model: 'Feature' },
  { name: 'admin', model: 'AdminLog' },
  { name: 'employee', model: 'User' },
];

// Service Template
const serviceTemplate = (name, model) => `const ${model} = require('../models/${name}');
const db = require('../database');

class ${model}Service {
  /**
   * Holt alle ${model} Einträge für einen Tenant
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {Object} filters - Optionale Filter
   * @returns {Promise<Array>} Liste der Einträge
   */
  async getAll(tenantDb, filters = {}) {
    try {
      return await ${model}.getAll(tenantDb, filters);
    } catch (error) {
      console.error('Error in ${model}Service.getAll:', error);
      throw error;
    }
  }

  /**
   * Holt einen ${model} Eintrag per ID
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @returns {Promise<Object>} Der Eintrag
   */
  async getById(tenantDb, id) {
    try {
      return await ${model}.getById(tenantDb, id);
    } catch (error) {
      console.error('Error in ${model}Service.getById:', error);
      throw error;
    }
  }

  /**
   * Erstellt einen neuen ${model} Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {Object} data - Die Daten
   * @returns {Promise<Object>} Der erstellte Eintrag
   */
  async create(tenantDb, data) {
    try {
      return await ${model}.create(tenantDb, data);
    } catch (error) {
      console.error('Error in ${model}Service.create:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert einen ${model} Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @param {Object} data - Die neuen Daten
   * @returns {Promise<Object>} Der aktualisierte Eintrag
   */
  async update(tenantDb, id, data) {
    try {
      return await ${model}.update(tenantDb, id, data);
    } catch (error) {
      console.error('Error in ${model}Service.update:', error);
      throw error;
    }
  }

  /**
   * Löscht einen ${model} Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @returns {Promise<boolean>} Erfolg
   */
  async delete(tenantDb, id) {
    try {
      return await ${model}.delete(tenantDb, id);
    } catch (error) {
      console.error('Error in ${model}Service.delete:', error);
      throw error;
    }
  }
}

module.exports = new ${model}Service();`;

// Controller Template
const controllerTemplate = (
  name,
  model,
) => `const ${name}Service = require('../services/${name}.service');

class ${model}Controller {
  /**
   * Holt alle ${model} Einträge
   * GET /api/${name}
   */
  async getAll(req, res) {
    try {
      const result = await ${name}Service.getAll(req.tenantDb, req.query);
      res.json(result);
    } catch (error) {
      console.error('Error in ${model}Controller.getAll:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error.message
      });
    }
  }

  /**
   * Holt einen ${model} Eintrag per ID
   * GET /api/${name}/:id
   */
  async getById(req, res) {
    try {
      const result = await ${name}Service.getById(req.tenantDb, req.params.id);
      if (!result) {
        return res.status(404).json({ error: 'Nicht gefunden' });
      }
      res.json(result);
    } catch (error) {
      console.error('Error in ${model}Controller.getById:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error.message
      });
    }
  }

  /**
   * Erstellt einen neuen ${model} Eintrag
   * POST /api/${name}
   */
  async create(req, res) {
    try {
      const result = await ${name}Service.create(req.tenantDb, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error('Error in ${model}Controller.create:', error);
      res.status(500).json({
        error: 'Fehler beim Erstellen',
        message: error.message
      });
    }
  }

  /**
   * Aktualisiert einen ${model} Eintrag
   * PUT /api/${name}/:id
   */
  async update(req, res) {
    try {
      const result = await ${name}Service.update(
        req.tenantDb,
        req.params.id,
        req.body
      );
      res.json(result);
    } catch (error) {
      console.error('Error in ${model}Controller.update:', error);
      res.status(500).json({
        error: 'Fehler beim Aktualisieren',
        message: error.message
      });
    }
  }

  /**
   * Löscht einen ${model} Eintrag
   * DELETE /api/${name}/:id
   */
  async delete(req, res) {
    try {
      await ${name}Service.delete(req.tenantDb, req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error in ${model}Controller.delete:', error);
      res.status(500).json({
        error: 'Fehler beim Löschen',
        message: error.message
      });
    }
  }
}

module.exports = new ${model}Controller();`;

// Generiere alle Controller und Services
async function generateAll() {
  const controllersPath = path.join(__dirname, '../src/controllers');
  const servicesPath = path.join(__dirname, '../src/services');

  for (const feature of features) {
    const controllerFile = path.join(controllersPath, `${feature.name}.controller.js`);
    const serviceFile = path.join(servicesPath, `${feature.name}.service.js`);

    // Prüfe ob bereits existiert
    try {
      await fs.access(controllerFile);
      console.info(`✓ ${feature.name}.controller.js bereits vorhanden`);
    } catch {
      // Erstelle Controller
      await fs.writeFile(controllerFile, controllerTemplate(feature.name, feature.model));
      console.info(`✓ ${feature.name}.controller.js erstellt`);
    }

    try {
      await fs.access(serviceFile);
      console.info(`✓ ${feature.name}.service.js bereits vorhanden`);
    } catch {
      // Erstelle Service
      await fs.writeFile(serviceFile, serviceTemplate(feature.name, feature.model));
      console.info(`✓ ${feature.name}.service.js erstellt`);
    }
  }

  console.info('\n✅ Alle Controller und Services generiert!');
}

// Führe Generation aus
generateAll().catch(console.error);
