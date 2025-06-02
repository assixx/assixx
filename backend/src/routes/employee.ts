/**
 * Employee Self-Service Routes
 * API endpoints for employee access to their information and documents
 */

import express, { Router } from "express";
import { authenticateToken, authorizeRole } from "../auth";
// import { checkDocumentAccess } from '../middleware/documentAccess';
import { logger } from "../utils/logger";

// Import models (now ES modules)
import User from "../models/user";
import Document from "../models/document";

const router: Router = express.Router();

// Get employee information
router.get(
  "/info",
  [authenticateToken, authorizeRole("employee")] as any[],
  async (req: any, res: any) => {
    try {
      const authReq = req as any;
      const employeeId = authReq.user.id;
      logger.info(`Employee ${employeeId} requesting their information`);
      const employee = await User.findById(employeeId);
      if (!employee) {
        logger.warn(`Employee with ID ${employeeId} not found`);
        res.status(404).json({ message: "Mitarbeiter nicht gefunden" });
        return;
      }
      logger.info(`Information retrieved for Employee ${employeeId}`);
      res.json(employee);
    } catch (error: any) {
      logger.error(
        `Error retrieving information for Employee: ${error.message}`,
      );
      res.status(500).json({
        message: "Fehler beim Abrufen der Mitarbeiterinformationen",
        error: error.message,
      });
    }
  },
);

// Get employee documents
router.get(
  "/documents",
  [authenticateToken, authorizeRole("employee")] as any[],
  async (req: any, res: any) => {
    try {
      const authReq = req as any;
      const employeeId = authReq.user.id;
      logger.info(`Employee ${employeeId} requesting their documents`);
      const documents = await Document.findByUserId(employeeId);
      logger.info(
        `Retrieved ${documents.length} documents for Employee ${employeeId}`,
      );
      res.json(documents);
    } catch (error: any) {
      const authReq2 = req as any;
      const employeeId2 = authReq2.user?.id || "unknown";
      logger.error(
        `Error retrieving documents for Employee ${employeeId2}: ${error.message}`,
      );
      res.status(500).json({
        message: "Fehler beim Abrufen der Dokumente",
        error: error.message,
      });
    }
  },
);

// Search employee documents
router.get(
  "/search-documents",
  [authenticateToken, authorizeRole("employee")] as any[],
  async (req: any, res: any) => {
    try {
      const authReq = req as any;
      const employeeId = authReq.user.id;
      const { query } = req.query;
      logger.info(
        `Employee ${employeeId} searching documents with query: ${query}`,
      );
      if (!query) {
        logger.warn(`Employee ${employeeId} attempted search without query`);
        res.status(400).json({ message: "Suchbegriff erforderlich" });
        return;
      }
      const documents = await Document.search(employeeId, String(query));
      logger.info(
        `Found ${documents.length} documents for Employee ${employeeId} with query: ${query}`,
      );
      res.json(documents);
    } catch (error: any) {
      const authReq3 = req as any;
      const employeeId3 = authReq3.user?.id || "unknown";
      logger.error(
        `Error searching documents for Employee ${employeeId3}: ${error.message}`,
      );
      res.status(500).json({
        message: "Fehler bei der Dokumentensuche",
        error: error.message,
      });
    }
  },
);

// Get employee salary documents
router.get(
  "/salary-documents",
  [authenticateToken, authorizeRole("employee")] as any[],
  async (req: any, res: any) => {
    try {
      const authReq = req as any;
      const employeeId = authReq.user.id;
      const archived = req.query.archived === "true";

      logger.info(
        `Employee ${employeeId} requesting their salary documents (archived: ${archived})`,
      );

      const documents = await Document.findByUserIdAndCategory(
        employeeId,
        "salary",
        archived,
      );
      logger.info(
        `Retrieved ${documents.length} salary documents for Employee ${employeeId}`,
      );
      res.json(documents);
    } catch (error: any) {
      const authReq4 = req as any;
      const employeeId4 = authReq4.user?.id || "unknown";
      logger.error(
        `Error retrieving salary documents for Employee ${employeeId4}: ${error.message}`,
      );
      res.status(500).json({
        message: "Fehler beim Abrufen der Gehaltsabrechnungen",
        error: error.message,
      });
    }
  },
);

// Download individual document
router.get(
  "/documents/:documentId",
  [authenticateToken, authorizeRole("employee")] as any[],
  async (req: any, res: any) => {
    try {
      const authReq = req as any;
      const employeeId = authReq.user.id;
      const { documentId } = req.params;
      const { inline } = req.query; // Option zum Anzeigen im Browser statt herunterzuladen

      logger.info(
        `Employee ${employeeId} attempting to download document ${documentId}`,
      );

      // Dokument suchen
      const document = await Document.findById(documentId);

      // Prüfen, ob das Dokument existiert und dem Mitarbeiter gehört
      if (!document) {
        logger.warn(`Document ${documentId} not found`);
        res.status(404).json({ message: "Dokument nicht gefunden" });
        return;
      }

      if (document.user_id != employeeId) {
        logger.warn(
          `Access denied: Employee ${employeeId} attempted to access document ${documentId} owned by user ${document.user_id}`,
        );
        res.status(403).json({ message: "Zugriff verweigert" });
        return;
      }

      // Download-Zähler erhöhen
      await Document.incrementDownloadCount(documentId);

      // Content-Type Header setzen
      res.setHeader("Content-Type", "application/pdf");

      // Content-Disposition Header basierend auf inline-Parameter setzen
      const disposition = inline === "true" ? "inline" : "attachment";
      res.setHeader(
        "Content-Disposition",
        `${disposition}; filename=${encodeURIComponent(document.file_name)}`,
      );

      // Optional: Cache-Control Header für häufig abgerufene Dokumente
      res.setHeader("Cache-Control", "max-age=300"); // 5 Minuten cachen

      // Content-Length setzen, um dem Browser mitzuteilen, wie groß die Datei ist
      if (document.file_content) {
        res.setHeader("Content-Length", document.file_content.length);
      }

      logger.info(
        `Employee ${employeeId} successfully downloading document ${documentId}`,
      );

      // Für alle Dateien einfach den gesamten Inhalt auf einmal senden
      res.end(document.file_content);
    } catch (error: any) {
      const authReq5 = req as any;
      const employeeId5 = authReq5.user?.id || "unknown";
      const documentId2 = req.params?.documentId || "unknown";
      logger.error(
        `Error downloading document ${documentId2} for Employee ${employeeId5}: ${error.message}`,
      );
      res.status(500).json({
        message: "Fehler beim Herunterladen des Dokuments",
        error: error.message,
      });
    }
  },
);

export default router;

// CommonJS compatibility
