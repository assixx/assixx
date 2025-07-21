/**
 * Department Groups Routes
 * Handles hierarchical department group management
 */

import express, { Router } from "express";
import { body, param, validationResult } from "express-validator";

import { authenticateToken, authorizeRole } from "../auth.js";
import departmentGroupService from "../services/departmentGroup.service.js";
import { getErrorMessage } from "../utils/errorHandler.js";
import { logger } from "../utils/logger.js";
import { typed } from "../utils/routeHandlers";

const router: Router = express.Router();

// Validation middleware
const validateCreateGroup = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Gruppenname ist erforderlich")
    .isLength({ max: 100 })
    .withMessage("Gruppenname darf maximal 100 Zeichen lang sein"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Beschreibung darf maximal 500 Zeichen lang sein"),
  body("parentGroupId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Ungültige übergeordnete Gruppen-ID"),
  body("departmentIds")
    .optional()
    .isArray()
    .withMessage("departmentIds muss ein Array sein"),
  body("departmentIds.*")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Ungültige Abteilungs-ID"),
];

// Get all groups
router.get(
  "/",
  authenticateToken,
  authorizeRole("admin"),
  typed.auth(async (req, res) => {
    try {
      const groups = await departmentGroupService.getGroupHierarchy(
        req.user.tenant_id,
      );

      res.json({
        success: true,
        data: groups,
      });
    } catch (error) {
      logger.error(
        `Error getting department groups: ${getErrorMessage(error)}`,
      );
      res.status(500).json({
        success: false,
        error: "Fehler beim Abrufen der Abteilungsgruppen",
      });
    }
  }),
);

// Get hierarchical structure
router.get(
  "/hierarchy",
  authenticateToken,
  authorizeRole("admin"),
  typed.auth(async (req, res) => {
    try {
      const hierarchy = await departmentGroupService.getGroupHierarchy(
        req.user.tenant_id,
      );

      res.json({
        success: true,
        data: hierarchy,
      });
    } catch (error) {
      logger.error(`Error getting group hierarchy: ${getErrorMessage(error)}`);
      res.status(500).json({
        success: false,
        error: "Fehler beim Abrufen der Gruppenhierarchie",
      });
    }
  }),
);

// Create a new group
router.post(
  "/",
  authenticateToken,
  authorizeRole("root"),
  validateCreateGroup,
  typed.body<{
    name: string;
    description?: string;
    parentGroupId?: number;
    departmentIds?: number[];
  }>(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { name, description, parentGroupId, departmentIds = [] } = req.body;

    try {
      const groupId = await departmentGroupService.createGroup(
        name,
        description ?? null,
        parentGroupId ?? null,
        req.user.tenant_id,
        req.user.id,
      );

      if (!groupId) {
        res.status(500).json({
          success: false,
          error: "Fehler beim Erstellen der Gruppe",
        });
        return;
      }

      // Add departments if provided
      if (departmentIds.length > 0) {
        await departmentGroupService.addDepartmentsToGroup(
          groupId,
          departmentIds,
          req.user.tenant_id,
          req.user.id,
        );
      }

      logger.info(
        `Root user ${req.user.id} created department group ${groupId}`,
      );

      res.status(201).json({
        success: true,
        data: { id: groupId },
        message: "Abteilungsgruppe erfolgreich erstellt",
      });
    } catch (error) {
      if (getErrorMessage(error) === "Group name already exists") {
        res.status(409).json({
          success: false,
          error: "Eine Gruppe mit diesem Namen existiert bereits",
        });
      } else if (getErrorMessage(error) === "Circular dependency detected") {
        res.status(400).json({
          success: false,
          error: "Zirkuläre Abhängigkeit erkannt",
        });
      } else {
        logger.error(
          `Error creating department group: ${getErrorMessage(error)}`,
        );
        res.status(500).json({
          success: false,
          error: "Fehler beim Erstellen der Gruppe",
        });
      }
    }
  }),
);

// Update a group
router.put(
  "/:id",
  authenticateToken,
  authorizeRole("root"),
  param("id").isInt({ min: 1 }).withMessage("Ungültige Gruppen-ID"),
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Gruppenname ist erforderlich")
    .isLength({ max: 100 })
    .withMessage("Gruppenname darf maximal 100 Zeichen lang sein"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Beschreibung darf maximal 500 Zeichen lang sein"),
  typed.paramsBody<{ id: string }, { name: string; description?: string }>(
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const groupId = parseInt(req.params.id);
      const { name, description } = req.body;

      try {
        const success = await departmentGroupService.updateGroup(
          groupId,
          name,
          description ?? null,
          req.user.tenant_id,
        );

        if (success) {
          res.json({
            success: true,
            message: "Gruppe erfolgreich aktualisiert",
          });
        } else {
          res.status(404).json({
            success: false,
            error: "Gruppe nicht gefunden",
          });
        }
      } catch (error) {
        if (getErrorMessage(error) === "Group name already exists") {
          res.status(409).json({
            success: false,
            error: "Eine Gruppe mit diesem Namen existiert bereits",
          });
        } else {
          logger.error(
            `Error updating department group: ${getErrorMessage(error)}`,
          );
          res.status(500).json({
            success: false,
            error: "Fehler beim Aktualisieren der Gruppe",
          });
        }
      }
    },
  ),
);

// Delete a group
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole("root"),
  param("id").isInt({ min: 1 }).withMessage("Ungültige Gruppen-ID"),
  typed.params<{ id: string }>(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const groupId = parseInt(req.params.id);

    try {
      const success = await departmentGroupService.deleteGroup(
        groupId,
        req.user.tenant_id,
      );

      if (success) {
        logger.info(
          `Root user ${req.user.id} deleted department group ${groupId}`,
        );
        res.json({
          success: true,
          message: "Gruppe erfolgreich gelöscht",
        });
      } else {
        res.status(404).json({
          success: false,
          error: "Gruppe nicht gefunden",
        });
      }
    } catch (error) {
      if (
        getErrorMessage(error) ===
        "Cannot delete group with active admin permissions"
      ) {
        res.status(409).json({
          success: false,
          error:
            "Gruppe kann nicht gelöscht werden, da noch Admin-Berechtigungen existieren",
        });
      } else if (
        getErrorMessage(error) === "Cannot delete group with subgroups"
      ) {
        res.status(409).json({
          success: false,
          error:
            "Gruppe kann nicht gelöscht werden, da noch Untergruppen existieren",
        });
      } else {
        logger.error(
          `Error deleting department group: ${getErrorMessage(error)}`,
        );
        res.status(500).json({
          success: false,
          error: "Fehler beim Löschen der Gruppe",
        });
      }
    }
  }),
);

// Add departments to a group
router.post(
  "/:id/departments",
  authenticateToken,
  authorizeRole("root"),
  param("id").isInt({ min: 1 }).withMessage("Ungültige Gruppen-ID"),
  body("departmentIds")
    .isArray({ min: 1 })
    .withMessage("departmentIds muss ein nicht-leeres Array sein"),
  body("departmentIds.*")
    .isInt({ min: 1 })
    .withMessage("Ungültige Abteilungs-ID"),
  typed.paramsBody<{ id: string }, { departmentIds: number[] }>(
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const groupId = parseInt(req.params.id);
      const { departmentIds } = req.body;

      try {
        const success = await departmentGroupService.addDepartmentsToGroup(
          groupId,
          departmentIds,
          req.user.tenant_id,
          req.user.id,
        );

        if (success) {
          res.json({
            success: true,
            message: "Abteilungen erfolgreich zur Gruppe hinzugefügt",
          });
        } else {
          res.status(500).json({
            success: false,
            error: "Fehler beim Hinzufügen der Abteilungen",
          });
        }
      } catch (error) {
        logger.error(
          `Error adding departments to group: ${getErrorMessage(error)}`,
        );
        res.status(500).json({
          success: false,
          error: "Fehler beim Hinzufügen der Abteilungen",
        });
      }
    },
  ),
);

// Remove department from a group
router.delete(
  "/:id/departments/:deptId",
  authenticateToken,
  authorizeRole("root"),
  param("id").isInt({ min: 1 }).withMessage("Ungültige Gruppen-ID"),
  param("deptId").isInt({ min: 1 }).withMessage("Ungültige Abteilungs-ID"),
  typed.params<{ id: string; deptId: string }>(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const groupId = parseInt(req.params.id);
    const departmentId = parseInt(req.params.deptId);

    try {
      const success = await departmentGroupService.removeDepartmentsFromGroup(
        groupId,
        [departmentId],
        req.user.tenant_id,
      );

      if (success) {
        res.json({
          success: true,
          message: "Abteilung erfolgreich aus der Gruppe entfernt",
        });
      } else {
        res.status(404).json({
          success: false,
          error: "Abteilung oder Gruppe nicht gefunden",
        });
      }
    } catch (error) {
      logger.error(
        `Error removing department from group: ${getErrorMessage(error)}`,
      );
      res.status(500).json({
        success: false,
        error: "Fehler beim Entfernen der Abteilung",
      });
    }
  }),
);

// Get departments in a group
router.get(
  "/:id/departments",
  authenticateToken,
  authorizeRole("admin"),
  param("id").isInt({ min: 1 }).withMessage("Ungültige Gruppen-ID"),
  typed.params<{ id: string }>(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const groupId = parseInt(req.params.id);
    const includeSubgroups = req.query.includeSubgroups !== "false";

    try {
      const departments = await departmentGroupService.getGroupDepartments(
        groupId,
        req.user.tenant_id,
        includeSubgroups,
      );

      res.json({
        success: true,
        data: departments,
      });
    } catch (error) {
      logger.error(
        `Error getting group departments: ${getErrorMessage(error)}`,
      );
      res.status(500).json({
        success: false,
        error: "Fehler beim Abrufen der Abteilungen",
      });
    }
  }),
);

export default router;
