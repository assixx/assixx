const Department = require('../models/department');
const db = require('../database');

class DepartmentService {
  /**
   * Holt alle Department Einträge für einen Tenant
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {Object} filters - Optionale Filter
   * @returns {Promise<Array>} Liste der Einträge
   */
  async getAll(tenantDb, filters = {}) {
    try {
      return await Department.getAll(tenantDb, filters);
    } catch (error) {
      console.error('Error in DepartmentService.getAll:', error);
      throw error;
    }
  }

  /**
   * Holt einen Department Eintrag per ID
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @returns {Promise<Object>} Der Eintrag
   */
  async getById(tenantDb, id) {
    try {
      return await Department.getById(tenantDb, id);
    } catch (error) {
      console.error('Error in DepartmentService.getById:', error);
      throw error;
    }
  }

  /**
   * Erstellt einen neuen Department Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {Object} data - Die Daten
   * @returns {Promise<Object>} Der erstellte Eintrag
   */
  async create(tenantDb, data) {
    try {
      return await Department.create(tenantDb, data);
    } catch (error) {
      console.error('Error in DepartmentService.create:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert einen Department Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @param {Object} data - Die neuen Daten
   * @returns {Promise<Object>} Der aktualisierte Eintrag
   */
  async update(tenantDb, id, data) {
    try {
      return await Department.update(tenantDb, id, data);
    } catch (error) {
      console.error('Error in DepartmentService.update:', error);
      throw error;
    }
  }

  /**
   * Löscht einen Department Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @returns {Promise<boolean>} Erfolg
   */
  async delete(tenantDb, id) {
    try {
      return await Department.delete(tenantDb, id);
    } catch (error) {
      console.error('Error in DepartmentService.delete:', error);
      throw error;
    }
  }
}

module.exports = new DepartmentService();
