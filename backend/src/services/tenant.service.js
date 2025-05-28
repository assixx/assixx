const Tenant = require('../models/tenant');
const db = require('../database');

class TenantService {
  /**
   * Holt alle Tenant Einträge für einen Tenant
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {Object} filters - Optionale Filter
   * @returns {Promise<Array>} Liste der Einträge
   */
  async getAll(tenantDb, filters = {}) {
    try {
      return await Tenant.getAll(tenantDb, filters);
    } catch (error) {
      console.error('Error in TenantService.getAll:', error);
      throw error;
    }
  }

  /**
   * Holt einen Tenant Eintrag per ID
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @returns {Promise<Object>} Der Eintrag
   */
  async getById(tenantDb, id) {
    try {
      return await Tenant.getById(tenantDb, id);
    } catch (error) {
      console.error('Error in TenantService.getById:', error);
      throw error;
    }
  }

  /**
   * Erstellt einen neuen Tenant Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {Object} data - Die Daten
   * @returns {Promise<Object>} Der erstellte Eintrag
   */
  async create(tenantDb, data) {
    try {
      return await Tenant.create(tenantDb, data);
    } catch (error) {
      console.error('Error in TenantService.create:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert einen Tenant Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @param {Object} data - Die neuen Daten
   * @returns {Promise<Object>} Der aktualisierte Eintrag
   */
  async update(tenantDb, id, data) {
    try {
      return await Tenant.update(tenantDb, id, data);
    } catch (error) {
      console.error('Error in TenantService.update:', error);
      throw error;
    }
  }

  /**
   * Löscht einen Tenant Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @returns {Promise<boolean>} Erfolg
   */
  async delete(tenantDb, id) {
    try {
      return await Tenant.delete(tenantDb, id);
    } catch (error) {
      console.error('Error in TenantService.delete:', error);
      throw error;
    }
  }
}

module.exports = new TenantService();
