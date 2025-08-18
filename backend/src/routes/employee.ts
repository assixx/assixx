/**
 * Employee Self-Service Routes
 * API endpoints for employee access to their information and documents
 * @swagger
 * tags:
 *   name: Employee
 *   description: Employee self-service operations
 */

import { RowDataPacket } from "mysql2/promise";
import express, { Router } from "express";
import { executeQuery } from "../database.js";
import { security } from "../middleware/security";
import Document from "../models/document";
import User from "../models/user";
import { successResponse, errorResponse } from "../types/response.types";
import { getErrorMessage } from "../utils/errorHandler";
import { logger } from "../utils/logger";
import { typed } from "../utils/routeHandlers";

// Import models (now ES modules)

const router: Router = express.Router();

/**
 * @swagger
 * /employee/info:
 *   get:
 *     summary: Get employee information
 *     description: Retrieve the current employee's personal information
 *     tags: [Employee]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Employee information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User is not an employee
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Employee not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Mitarbeiter nicht gefunden
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get employee information
router.get(
  "/info",
  ...security.user(),
  typed.auth(async (req, res) => {
    try {
      const employeeId = req.user.id;
      logger.info(`Employee ${employeeId} requesting their information`);
      const employee = await User.findById(employeeId, req.user.tenant_id);
      if (!employee) {
        logger.warn(`Employee with ID ${employeeId} not found`);
        res.status(404).json(errorResponse("Mitarbeiter nicht gefunden", 404));
        return;
      }

      // Remove sensitive data before sending to client
      const { password: _password, ...employeeData } = employee;

      logger.info(`Information retrieved for Employee ${employeeId}`);
      res.json(successResponse(employeeData));
    } catch (error: unknown) {
      logger.error(
        `Error retrieving information for Employee: ${getErrorMessage(error)}`,
      );
      res
        .status(500)
        .json(
          errorResponse(
            "Fehler beim Abrufen der Mitarbeiterinformationen",
            500,
          ),
        );
    }
  }),
);

/**
 * @swagger
 * /employee/documents:
 *   get:
 *     summary: Get employee documents
 *     description: Retrieve all documents accessible to the employee (personal, team, department, and company documents)
 *     tags: [Employee]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Documents retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Document'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User is not an employee
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get employee documents (including team, department, and company documents)
router.get(
  "/documents",
  ...security.user(),
  typed.auth(async (req, res) => {
    try {
      const employeeId = req.user.id;
      const tenantId = req.user.tenant_id;
      logger.info(
        `Employee ${employeeId} requesting their accessible documents`,
      );

      // Use the new method that includes team, department, and company documents
      const result = await Document.findByEmployeeWithAccess(
        employeeId,
        tenantId,
      );

      logger.info(
        `Retrieved ${result.documents.length} accessible documents for Employee ${employeeId}`,
      );
      res.json(successResponse(result.documents));
    } catch (error: unknown) {
      const employeeId2 = req.user.id;
      logger.error(
        `Error retrieving documents for Employee ${employeeId2}: ${getErrorMessage(error)}`,
      );
      res
        .status(500)
        .json(errorResponse("Fehler beim Abrufen der Dokumente", 500));
    }
  }),
);

// Mark all documents as read for employee
router.post(
  "/documents/mark-all-read",
  ...security.user(),
  typed.auth(async (req, res) => {
    try {
      const employeeId = req.user.id;
      const tenantId = req.user.tenant_id;
      logger.info(
        `Employee ${employeeId} marking all accessible documents as read`,
      );

      // Get all accessible documents
      const result = await Document.findByEmployeeWithAccess(
        employeeId,
        tenantId,
      );

      // Mark each document as read
      for (const doc of result.documents) {
        await Document.markAsRead(doc.id, employeeId, tenantId);
      }

      logger.info(
        `Marked ${result.documents.length} documents as read for Employee ${employeeId}`,
      );
      res.json(
        successResponse({
          success: true,
          markedCount: result.documents.length,
        }),
      );
    } catch (error: unknown) {
      logger.error(
        `Error marking documents as read: ${getErrorMessage(error)}`,
      );
      res
        .status(500)
        .json(
          errorResponse("Fehler beim Markieren der Dokumente als gelesen", 500),
        );
    }
  }),
);

// Get unread documents count for employee
router.get(
  "/documents/unread-count",
  ...security.user(),
  typed.auth(async (req, res) => {
    try {
      const employeeId = req.user.id;
      const tenantId = req.user.tenant_id;

      // Get real unread count from database
      const unreadCount = await Document.getUnreadCountForUser(
        employeeId,
        tenantId,
      );

      res.json(successResponse({ unreadCount }));
    } catch (error: unknown) {
      logger.error(
        `Error getting unread document count: ${getErrorMessage(error)}`,
      );
      res.json(successResponse({ unreadCount: 0 }));
    }
  }),
);

// Search employee documents (including team, department, and company documents)
router.get(
  "/search-documents",
  ...security.user(),
  typed.auth(async (req, res) => {
    try {
      const employeeId = req.user.id;
      const tenantId = req.user.tenant_id;
      const { query } = req.query;
      const queryString = typeof query === "string" ? query : "";
      logger.info(
        `Employee ${employeeId} searching accessible documents with query: ${queryString}`,
      );
      if (queryString === "") {
        logger.warn(`Employee ${employeeId} attempted search without query`);
        res.status(400).json(errorResponse("Suchbegriff erforderlich", 400));
        return;
      }

      // Use the new search method that includes team, department, and company documents
      const documents = await Document.searchWithEmployeeAccess(
        employeeId,
        tenantId,
        queryString,
      );

      logger.info(
        `Found ${documents.length} accessible documents for Employee ${employeeId} with query: ${queryString}`,
      );
      res.json(successResponse(documents));
    } catch (error: unknown) {
      const employeeId3 = req.user.id;
      logger.error(
        `Error searching documents for Employee ${employeeId3}: ${getErrorMessage(error)}`,
      );
      res
        .status(500)
        .json(errorResponse("Fehler bei der Dokumentensuche", 500));
    }
  }),
);

// Get employee salary documents
router.get(
  "/salary-documents",
  ...security.user(),
  typed.auth(async (req, res) => {
    try {
      const employeeId = req.user.id;
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
      res.json(successResponse(documents));
    } catch (error: unknown) {
      const employeeId4 = req.user.id;
      logger.error(
        `Error retrieving salary documents for Employee ${employeeId4}: ${getErrorMessage(error)}`,
      );
      res
        .status(500)
        .json(
          errorResponse("Fehler beim Abrufen der Gehaltsabrechnungen", 500),
        );
    }
  }),
);

// Download individual document
router.get(
  "/documents/:documentId",
  ...security.user(),
  typed.auth(async (req, res) => {
    try {
      const employeeId = req.user.id;
      const { documentId } = req.params;
      const { inline } = req.query; // Option zum Anzeigen im Browser statt herunterzuladen

      logger.info(
        `Employee ${employeeId} attempting to download document ${documentId}`,
      );

      // Dokument suchen
      const document = await Document.findById(Number.parseInt(documentId, 10));

      // Prüfen, ob das Dokument existiert
      if (!document) {
        logger.warn(`Document ${documentId} not found`);
        res.status(404).json(errorResponse("Dokument nicht gefunden", 404));
        return;
      }

      // Prüfen, ob der Mitarbeiter Zugriff auf das Dokument hat
      let hasAccess = false;
      const tenantId = req.user.tenant_id;

      switch (document.recipient_type ?? "user") {
        case "user":
          // Persönliche Dokumente
          hasAccess = document.user_id == employeeId;
          break;

        case "team":
          // Team-Dokumente - prüfen ob Mitarbeiter im Team ist
          try {
            const [teamMembership] = await executeQuery<RowDataPacket[]>(
              "SELECT 1 FROM user_teams WHERE user_id = ? AND team_id = ? AND tenant_id = ?",
              [employeeId, document.team_id, tenantId],
            );
            hasAccess = teamMembership.length > 0;
          } catch (error: unknown) {
            logger.error(
              `Error checking team membership: ${getErrorMessage(error)}`,
            );
          }
          break;

        case "department":
          // Abteilungs-Dokumente - prüfen ob Mitarbeiter in der Abteilung ist
          try {
            const [userDept] = await executeQuery<RowDataPacket[]>(
              "SELECT department_id FROM users WHERE id = ? AND tenant_id = ?",
              [employeeId, tenantId],
            );
            hasAccess = userDept[0]?.department_id == document.department_id;
          } catch (error: unknown) {
            logger.error(
              `Error checking department membership: ${getErrorMessage(error)}`,
            );
          }
          break;

        case "company":
          // Firmen-Dokumente - alle Mitarbeiter des Tenants haben Zugriff
          hasAccess = document.tenant_id == tenantId;
          break;
      }

      if (!hasAccess) {
        logger.warn(
          `Access denied: Employee ${employeeId} attempted to access document ${documentId} (type: ${String(document.recipient_type)})`,
        );
        res.status(403).json(errorResponse("Zugriff verweigert", 403));
        return;
      }

      // Download-Zähler erhöhen
      await Document.incrementDownloadCount(Number.parseInt(documentId, 10));

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
    } catch (error: unknown) {
      const employeeId5 = req.user.id;
      const documentId2 = req.params.documentId;
      logger.error(
        `Error downloading document ${documentId2} for Employee ${employeeId5}: ${getErrorMessage(error)}`,
      );
      res
        .status(500)
        .json(errorResponse("Fehler beim Herunterladen des Dokuments", 500));
    }
  }),
);

export default router;

// CommonJS compatibility
