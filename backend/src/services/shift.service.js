const Shift = require('../models/shift');
const db = require('../database');

class ShiftService {
  /**
   * Holt alle Shift Einträge für einen Tenant
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {Object} filters - Optionale Filter
   * @returns {Promise<Array>} Liste der Einträge
   */
  async getAll(tenantDb, filters = {}) {
    try {
      return await Shift.getAll(tenantDb, filters);
    } catch (error) {
      console.error('Error in ShiftService.getAll:', error);
      throw error;
    }
  }

  /**
   * Holt einen Shift Eintrag per ID
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @returns {Promise<Object>} Der Eintrag
   */
  async getById(tenantDb, id) {
    try {
      return await Shift.getById(tenantDb, id);
    } catch (error) {
      console.error('Error in ShiftService.getById:', error);
      throw error;
    }
  }

  /**
   * Erstellt einen neuen Shift Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {Object} data - Die Daten
   * @returns {Promise<Object>} Der erstellte Eintrag
   */
  async create(tenantDb, data) {
    try {
      return await Shift.create(tenantDb, data);
    } catch (error) {
      console.error('Error in ShiftService.create:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert einen Shift Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @param {Object} data - Die neuen Daten
   * @returns {Promise<Object>} Der aktualisierte Eintrag
   */
  async update(tenantDb, id, data) {
    try {
      return await Shift.update(tenantDb, id, data);
    } catch (error) {
      console.error('Error in ShiftService.update:', error);
      throw error;
    }
  }

  /**
   * Löscht einen Shift Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @returns {Promise<boolean>} Erfolg
   */
  async delete(tenantDb, id) {
    try {
      return await Shift.delete(tenantDb, id);
    } catch (error) {
      console.error('Error in ShiftService.delete:', error);
      throw error;
    }
  }
}

module.exports = new ShiftService();
