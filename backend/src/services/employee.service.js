const User = require('../models/employee');
const db = require('../database');

class UserService {
  /**
   * Holt alle User Einträge für einen Tenant
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {Object} filters - Optionale Filter
   * @returns {Promise<Array>} Liste der Einträge
   */
  async getAll(tenantDb, filters = {}) {
    try {
      return await User.getAll(tenantDb, filters);
    } catch (error) {
      console.error('Error in UserService.getAll:', error);
      throw error;
    }
  }

  /**
   * Holt einen User Eintrag per ID
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @returns {Promise<Object>} Der Eintrag
   */
  async getById(tenantDb, id) {
    try {
      return await User.getById(tenantDb, id);
    } catch (error) {
      console.error('Error in UserService.getById:', error);
      throw error;
    }
  }

  /**
   * Erstellt einen neuen User Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {Object} data - Die Daten
   * @returns {Promise<Object>} Der erstellte Eintrag
   */
  async create(tenantDb, data) {
    try {
      return await User.create(tenantDb, data);
    } catch (error) {
      console.error('Error in UserService.create:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert einen User Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @param {Object} data - Die neuen Daten
   * @returns {Promise<Object>} Der aktualisierte Eintrag
   */
  async update(tenantDb, id, data) {
    try {
      return await User.update(tenantDb, id, data);
    } catch (error) {
      console.error('Error in UserService.update:', error);
      throw error;
    }
  }

  /**
   * Löscht einen User Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @returns {Promise<boolean>} Erfolg
   */
  async delete(tenantDb, id) {
    try {
      return await User.delete(tenantDb, id);
    } catch (error) {
      console.error('Error in UserService.delete:', error);
      throw error;
    }
  }
}

module.exports = new UserService();