const AdminLog = require('../models/admin');
const db = require('../database');

class AdminLogService {
  /**
   * Holt alle AdminLog Einträge für einen Tenant
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {Object} filters - Optionale Filter
   * @returns {Promise<Array>} Liste der Einträge
   */
  async getAll(tenantDb, filters = {}) {
    try {
      return await AdminLog.getAll(tenantDb, filters);
    } catch (error) {
      console.error('Error in AdminLogService.getAll:', error);
      throw error;
    }
  }

  /**
   * Holt einen AdminLog Eintrag per ID
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @returns {Promise<Object>} Der Eintrag
   */
  async getById(tenantDb, id) {
    try {
      return await AdminLog.getById(tenantDb, id);
    } catch (error) {
      console.error('Error in AdminLogService.getById:', error);
      throw error;
    }
  }

  /**
   * Erstellt einen neuen AdminLog Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {Object} data - Die Daten
   * @returns {Promise<Object>} Der erstellte Eintrag
   */
  async create(tenantDb, data) {
    try {
      return await AdminLog.create(tenantDb, data);
    } catch (error) {
      console.error('Error in AdminLogService.create:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert einen AdminLog Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @param {Object} data - Die neuen Daten
   * @returns {Promise<Object>} Der aktualisierte Eintrag
   */
  async update(tenantDb, id, data) {
    try {
      return await AdminLog.update(tenantDb, id, data);
    } catch (error) {
      console.error('Error in AdminLogService.update:', error);
      throw error;
    }
  }

  /**
   * Löscht einen AdminLog Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @returns {Promise<boolean>} Erfolg
   */
  async delete(tenantDb, id) {
    try {
      return await AdminLog.delete(tenantDb, id);
    } catch (error) {
      console.error('Error in AdminLogService.delete:', error);
      throw error;
    }
  }
}

module.exports = new AdminLogService();