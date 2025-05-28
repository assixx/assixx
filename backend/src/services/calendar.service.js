const Calendar = require('../models/calendar');
const db = require('../database');

class CalendarService {
  /**
   * Holt alle Calendar Einträge für einen Tenant
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {Object} filters - Optionale Filter
   * @returns {Promise<Array>} Liste der Einträge
   */
  async getAll(tenantDb, filters = {}) {
    try {
      return await Calendar.getAll(tenantDb, filters);
    } catch (error) {
      console.error('Error in CalendarService.getAll:', error);
      throw error;
    }
  }

  /**
   * Holt einen Calendar Eintrag per ID
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @returns {Promise<Object>} Der Eintrag
   */
  async getById(tenantDb, id) {
    try {
      return await Calendar.getById(tenantDb, id);
    } catch (error) {
      console.error('Error in CalendarService.getById:', error);
      throw error;
    }
  }

  /**
   * Erstellt einen neuen Calendar Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {Object} data - Die Daten
   * @returns {Promise<Object>} Der erstellte Eintrag
   */
  async create(tenantDb, data) {
    try {
      return await Calendar.create(tenantDb, data);
    } catch (error) {
      console.error('Error in CalendarService.create:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert einen Calendar Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @param {Object} data - Die neuen Daten
   * @returns {Promise<Object>} Der aktualisierte Eintrag
   */
  async update(tenantDb, id, data) {
    try {
      return await Calendar.update(tenantDb, id, data);
    } catch (error) {
      console.error('Error in CalendarService.update:', error);
      throw error;
    }
  }

  /**
   * Löscht einen Calendar Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @returns {Promise<boolean>} Erfolg
   */
  async delete(tenantDb, id) {
    try {
      return await Calendar.delete(tenantDb, id);
    } catch (error) {
      console.error('Error in CalendarService.delete:', error);
      throw error;
    }
  }
}

module.exports = new CalendarService();
