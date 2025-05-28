const Team = require('../models/team');
const db = require('../database');

class TeamService {
  /**
   * Holt alle Team Einträge für einen Tenant
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {Object} filters - Optionale Filter
   * @returns {Promise<Array>} Liste der Einträge
   */
  async getAll(tenantDb, filters = {}) {
    try {
      return await Team.getAll(tenantDb, filters);
    } catch (error) {
      console.error('Error in TeamService.getAll:', error);
      throw error;
    }
  }

  /**
   * Holt einen Team Eintrag per ID
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @returns {Promise<Object>} Der Eintrag
   */
  async getById(tenantDb, id) {
    try {
      return await Team.getById(tenantDb, id);
    } catch (error) {
      console.error('Error in TeamService.getById:', error);
      throw error;
    }
  }

  /**
   * Erstellt einen neuen Team Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {Object} data - Die Daten
   * @returns {Promise<Object>} Der erstellte Eintrag
   */
  async create(tenantDb, data) {
    try {
      return await Team.create(tenantDb, data);
    } catch (error) {
      console.error('Error in TeamService.create:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert einen Team Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @param {Object} data - Die neuen Daten
   * @returns {Promise<Object>} Der aktualisierte Eintrag
   */
  async update(tenantDb, id, data) {
    try {
      return await Team.update(tenantDb, id, data);
    } catch (error) {
      console.error('Error in TeamService.update:', error);
      throw error;
    }
  }

  /**
   * Löscht einen Team Eintrag
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung
   * @param {number} id - Die ID
   * @returns {Promise<boolean>} Erfolg
   */
  async delete(tenantDb, id) {
    try {
      return await Team.delete(tenantDb, id);
    } catch (error) {
      console.error('Error in TeamService.delete:', error);
      throw error;
    }
  }
}

module.exports = new TeamService();
