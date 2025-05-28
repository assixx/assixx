const Feature = require('../models/feature');
const db = require('../database');

class FeatureService {
  /**
   * Holt alle Feature Einträge für einen Tenant
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {Object} filters - Optionale Filter
   * @returns {Promise<Array>} Liste der Einträge
   */
  async getAll(tenantDb, filters = {}) {
    try {
      return await Feature.getAll(tenantDb, filters);
    } catch (error) {
      console.error('Error in FeatureService.getAll:', error);
      throw error;
    }
  }

  /**
   * Holt einen Feature Eintrag per ID
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @returns {Promise<Object>} Der Eintrag
   */
  async getById(tenantDb, id) {
    try {
      return await Feature.getById(tenantDb, id);
    } catch (error) {
      console.error('Error in FeatureService.getById:', error);
      throw error;
    }
  }

  /**
   * Erstellt einen neuen Feature Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {Object} data - Die Daten
   * @returns {Promise<Object>} Der erstellte Eintrag
   */
  async create(tenantDb, data) {
    try {
      return await Feature.create(tenantDb, data);
    } catch (error) {
      console.error('Error in FeatureService.create:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert einen Feature Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @param {Object} data - Die neuen Daten
   * @returns {Promise<Object>} Der aktualisierte Eintrag
   */
  async update(tenantDb, id, data) {
    try {
      return await Feature.update(tenantDb, id, data);
    } catch (error) {
      console.error('Error in FeatureService.update:', error);
      throw error;
    }
  }

  /**
   * Löscht einen Feature Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @returns {Promise<boolean>} Erfolg
   */
  async delete(tenantDb, id) {
    try {
      return await Feature.delete(tenantDb, id);
    } catch (error) {
      console.error('Error in FeatureService.delete:', error);
      throw error;
    }
  }
}

module.exports = new FeatureService();
