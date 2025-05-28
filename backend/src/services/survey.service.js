const Survey = require('../models/survey');
const db = require('../database');

class SurveyService {
  /**
   * Holt alle Survey Einträge für einen Tenant
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {Object} filters - Optionale Filter
   * @returns {Promise<Array>} Liste der Einträge
   */
  async getAll(tenantDb, filters = {}) {
    try {
      return await Survey.getAll(tenantDb, filters);
    } catch (error) {
      console.error('Error in SurveyService.getAll:', error);
      throw error;
    }
  }

  /**
   * Holt einen Survey Eintrag per ID
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @returns {Promise<Object>} Der Eintrag
   */
  async getById(tenantDb, id) {
    try {
      return await Survey.getById(tenantDb, id);
    } catch (error) {
      console.error('Error in SurveyService.getById:', error);
      throw error;
    }
  }

  /**
   * Erstellt einen neuen Survey Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {Object} data - Die Daten
   * @returns {Promise<Object>} Der erstellte Eintrag
   */
  async create(tenantDb, data) {
    try {
      return await Survey.create(tenantDb, data);
    } catch (error) {
      console.error('Error in SurveyService.create:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert einen Survey Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @param {Object} data - Die neuen Daten
   * @returns {Promise<Object>} Der aktualisierte Eintrag
   */
  async update(tenantDb, id, data) {
    try {
      return await Survey.update(tenantDb, id, data);
    } catch (error) {
      console.error('Error in SurveyService.update:', error);
      throw error;
    }
  }

  /**
   * Löscht einen Survey Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @returns {Promise<boolean>} Erfolg
   */
  async delete(tenantDb, id) {
    try {
      return await Survey.delete(tenantDb, id);
    } catch (error) {
      console.error('Error in SurveyService.delete:', error);
      throw error;
    }
  }
}

module.exports = new SurveyService();
