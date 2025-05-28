const Blackboard = require('../models/blackboard');
const db = require('../database');

class BlackboardService {
  /**
   * Holt alle Blackboard Einträge für einen Tenant
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {Object} filters - Optionale Filter
   * @returns {Promise<Array>} Liste der Einträge
   */
  async getAll(tenantDb, filters = {}) {
    try {
      return await Blackboard.getAll(tenantDb, filters);
    } catch (error) {
      console.error('Error in BlackboardService.getAll:', error);
      throw error;
    }
  }

  /**
   * Holt einen Blackboard Eintrag per ID
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @returns {Promise<Object>} Der Eintrag
   */
  async getById(tenantDb, id) {
    try {
      return await Blackboard.getById(tenantDb, id);
    } catch (error) {
      console.error('Error in BlackboardService.getById:', error);
      throw error;
    }
  }

  /**
   * Erstellt einen neuen Blackboard Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {Object} data - Die Daten
   * @returns {Promise<Object>} Der erstellte Eintrag
   */
  async create(tenantDb, data) {
    try {
      return await Blackboard.create(tenantDb, data);
    } catch (error) {
      console.error('Error in BlackboardService.create:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert einen Blackboard Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @param {Object} data - Die neuen Daten
   * @returns {Promise<Object>} Der aktualisierte Eintrag
   */
  async update(tenantDb, id, data) {
    try {
      return await Blackboard.update(tenantDb, id, data);
    } catch (error) {
      console.error('Error in BlackboardService.update:', error);
      throw error;
    }
  }

  /**
   * Löscht einen Blackboard Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @returns {Promise<boolean>} Erfolg
   */
  async delete(tenantDb, id) {
    try {
      return await Blackboard.delete(tenantDb, id);
    } catch (error) {
      console.error('Error in BlackboardService.delete:', error);
      throw error;
    }
  }
}

module.exports = new BlackboardService();
