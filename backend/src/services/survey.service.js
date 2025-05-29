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

  /**
   * Holt alle Surveys für einen Tenant
   * @param {number} tenantId - Die Tenant ID
   * @param {Object} filters - Filter Optionen
   * @returns {Promise<Array>} Liste der Surveys
   */
  async getAllByTenant(tenantId, filters = {}) {
    try {
      return await Survey.getAllByTenant(tenantId, filters);
    } catch (error) {
      console.error('Error in SurveyService.getAllByTenant:', error);
      throw error;
    }
  }

  /**
   * Holt Survey Templates
   * @param {number} tenantId - Die Tenant ID
   * @returns {Promise<Array>} Liste der Templates
   */
  async getTemplates(tenantId) {
    try {
      return await Survey.getTemplates(tenantId);
    } catch (error) {
      console.error('Error in SurveyService.getTemplates:', error);
      throw error;
    }
  }

  /**
   * Erstellt Survey aus Template
   * @param {number} templateId - Die Template ID
   * @param {number} tenantId - Die Tenant ID
   * @param {number} createdBy - User ID des Erstellers
   * @returns {Promise<number>} ID der erstellten Survey
   */
  async createFromTemplate(templateId, tenantId, createdBy) {
    try {
      return await Survey.createFromTemplate(templateId, tenantId, createdBy);
    } catch (error) {
      console.error('Error in SurveyService.createFromTemplate:', error);
      throw error;
    }
  }

  /**
   * Holt Survey Statistiken
   * @param {number} surveyId - Die Survey ID
   * @param {number} tenantId - Die Tenant ID
   * @returns {Promise<Object>} Statistiken
   */
  async getStatistics(surveyId, tenantId) {
    try {
      return await Survey.getStatistics(surveyId, tenantId);
    } catch (error) {
      console.error('Error in SurveyService.getStatistics:', error);
      throw error;
    }
  }
}

module.exports = new SurveyService();
