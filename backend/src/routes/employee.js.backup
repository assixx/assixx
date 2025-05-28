const express = require('express');
const { authenticateToken, authorizeRole } = require('../auth');
const { checkDocumentAccess } = require('../middleware/documentAccess');
const User = require('../models/user');
const Document = require('../models/document');
const { logger } = require('../utils/logger');

const router = express.Router();

router.get(
  '/info',
  authenticateToken,
  authorizeRole('employee'),
  async (req, res) => {
    const employeeId = req.user.id;
    logger.info(`Employee ${employeeId} requesting their information`);
    try {
      const employee = await User.findById(employeeId);
      if (!employee) {
        logger.warn(`Employee with ID ${employeeId} not found`);
        return res.status(404).json({ message: 'Mitarbeiter nicht gefunden' });
      }
      logger.info(`Information retrieved for Employee ${employeeId}`);
      res.json(employee);
    } catch (error) {
      logger.error(
        `Error retrieving information for Employee ${employeeId}: ${error.message}`
      );
      res.status(500).json({
        message: 'Fehler beim Abrufen der Mitarbeiterinformationen',
        error: error.message,
      });
    }
  }
);

router.get(
  '/documents',
  authenticateToken,
  authorizeRole('employee'),
  async (req, res) => {
    const employeeId = req.user.id;
    logger.info(`Employee ${employeeId} requesting their documents`);
    try {
      const documents = await Document.findByUserId(employeeId);
      logger.info(
        `Retrieved ${documents.length} documents for Employee ${employeeId}`
      );
      res.json(documents);
    } catch (error) {
      logger.error(
        `Error retrieving documents for Employee ${employeeId}: ${error.message}`
      );
      res.status(500).json({
        message: 'Fehler beim Abrufen der Dokumente',
        error: error.message,
      });
    }
  }
);

// Diese Route wurde entfernt, da sie unten nochmal definiert ist und
// dort erweiterte Funktionalität bietet

router.get(
  '/search-documents',
  authenticateToken,
  authorizeRole('employee'),
  async (req, res) => {
    const employeeId = req.user.id;
    const { query } = req.query;
    logger.info(
      `Employee ${employeeId} searching documents with query: ${query}`
    );
    try {
      if (!query) {
        logger.warn(`Employee ${employeeId} attempted search without query`);
        return res.status(400).json({ message: 'Suchbegriff erforderlich' });
      }
      const documents = await Document.search(employeeId, query);
      logger.info(
        `Found ${documents.length} documents for Employee ${employeeId} with query: ${query}`
      );
      res.json(documents);
    } catch (error) {
      logger.error(
        `Error searching documents for Employee ${employeeId}: ${error.message}`
      );
      res.status(500).json({
        message: 'Fehler bei der Dokumentensuche',
        error: error.message,
      });
    }
  }
);

// Gehaltsabrechnungen des Mitarbeiters abrufen
router.get(
  '/salary-documents',
  authenticateToken,
  authorizeRole('employee'),
  async (req, res) => {
    const employeeId = req.user.id;
    const archived = req.query.archived === 'true';

    logger.info(
      `Employee ${employeeId} requesting their salary documents (archived: ${archived})`
    );

    try {
      const documents = await Document.findByUserIdAndCategory(
        employeeId,
        'salary',
        archived
      );
      logger.info(
        `Retrieved ${documents.length} salary documents for Employee ${employeeId}`
      );
      res.json(documents);
    } catch (error) {
      logger.error(
        `Error retrieving salary documents for Employee ${employeeId}: ${error.message}`
      );
      res.status(500).json({
        message: 'Fehler beim Abrufen der Gehaltsabrechnungen',
        error: error.message,
      });
    }
  }
);

// Einzelnes Dokument herunterladen
router.get(
  '/documents/:documentId',
  authenticateToken,
  authorizeRole('employee'),
  async (req, res) => {
    const employeeId = req.user.id;
    const { documentId } = req.params;
    const { inline } = req.query; // Option zum Anzeigen im Browser statt herunterzuladen

    logger.info(
      `Employee ${employeeId} attempting to download document ${documentId}`
    );

    try {
      // Dokument suchen
      const document = await Document.findById(documentId);

      // Prüfen, ob das Dokument existiert und dem Mitarbeiter gehört
      if (!document) {
        logger.warn(`Document ${documentId} not found`);
        return res.status(404).json({ message: 'Dokument nicht gefunden' });
      }

      if (document.user_id != employeeId) {
        logger.warn(
          `Access denied: Employee ${employeeId} attempted to access document ${documentId} owned by user ${document.user_id}`
        );
        return res.status(403).json({ message: 'Zugriff verweigert' });
      }

      // Download-Zähler erhöhen
      await Document.incrementDownloadCount(documentId);

      // Content-Type Header setzen
      res.setHeader('Content-Type', 'application/pdf');

      // Content-Disposition Header basierend auf inline-Parameter setzen
      const disposition = inline === 'true' ? 'inline' : 'attachment';
      res.setHeader(
        'Content-Disposition',
        `${disposition}; filename=${encodeURIComponent(document.file_name)}`
      );

      // Optional: Cache-Control Header für häufig abgerufene Dokumente
      res.setHeader('Cache-Control', 'max-age=300'); // 5 Minuten cachen

      // Content-Length setzen, um dem Browser mitzuteilen, wie groß die Datei ist
      if (document.file_content) {
        res.setHeader('Content-Length', document.file_content.length);
      }

      logger.info(
        `Employee ${employeeId} successfully downloading document ${documentId}`
      );

      // Für alle Dateien einfach den gesamten Inhalt auf einmal senden
      return res.end(document.file_content);
    } catch (error) {
      logger.error(
        `Error downloading document ${documentId} for Employee ${employeeId}: ${error.message}`
      );
      res.status(500).json({
        message: 'Fehler beim Herunterladen des Dokuments',
        error: error.message,
      });
    }
  }
);

module.exports = router;
