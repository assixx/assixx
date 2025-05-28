const Kvp = require('../models/kvp');
const db = require('../database');

class KvpService {
  /**
   * Holt alle Kvp Einträge für einen Tenant
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {Object} filters - Optionale Filter
   * @returns {Promise<Array>} Liste der Einträge
   */
  async getAll(tenantDb, filters = {}) {
    try {
      return await Kvp.getAll(tenantDb, filters);
    } catch (error) {
      console.error('Error in KvpService.getAll:', error);
      throw error;
    }
  }

  /**
   * Holt einen Kvp Eintrag per ID
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @returns {Promise<Object>} Der Eintrag
   */
  async getById(tenantDb, id) {
    try {
      return await Kvp.getById(tenantDb, id);
    } catch (error) {
      console.error('Error in KvpService.getById:', error);
      throw error;
    }
  }

  /**
   * Erstellt einen neuen Kvp Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {Object} data - Die Daten
   * @returns {Promise<Object>} Der erstellte Eintrag
   */
  async create(tenantDb, data) {
    try {
      return await Kvp.create(tenantDb, data);
    } catch (error) {
      console.error('Error in KvpService.create:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert einen Kvp Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @param {Object} data - Die neuen Daten
   * @returns {Promise<Object>} Der aktualisierte Eintrag
   */
  async update(tenantDb, id, data) {
    try {
      return await Kvp.update(tenantDb, id, data);
    } catch (error) {
      console.error('Error in KvpService.update:', error);
      throw error;
    }
  }

  /**
   * Löscht einen Kvp Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @returns {Promise<boolean>} Erfolg
   */
  async delete(tenantDb, id) {
    try {
      return await Kvp.delete(tenantDb, id);
    } catch (error) {
      console.error('Error in KvpService.delete:', error);
      throw error;
    }
  }
}

module.exports = new KvpService();