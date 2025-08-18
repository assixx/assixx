/**
 * Role Switch API Routes
 * Ermöglicht Admins als Employee zu agieren
 */

import jwt from "jsonwebtoken";
import express, { Router } from "express";
import { authenticateToken } from "../middleware/auth.js";
import { createRootLog } from "../models/rootLog.js";
import User from "../models/user.js";
import { getErrorMessage } from "../utils/errorHandler.js";
import { typed } from "../utils/routeHandlers";

const router: Router = express.Router();

/**
 * @route POST /api/role-switch/to-employee
 * @desc Switch admin view to employee mode
 * @access Private (Admin only)
 */
router.post(
  "/to-employee",
  authenticateToken,
  typed.auth(async (req, res) => {
    try {
      // Nur Admins und Root dürfen switchen
      if (req.user.role !== "admin" && req.user.role !== "root") {
        res
          .status(403)
          .json({ message: "Nur Admins und Root können die Rolle wechseln" });
        return;
      }

      // User-Daten holen
      const user = await User.findById(req.user.id, req.user.tenant_id);
      if (!user) {
        res.status(404).json({ message: "User nicht gefunden" });
        return;
      }

      // Prüfen ob Employee-Daten vollständig sind (nur position - department_id ist optional)
      const needsEmployeeData = user.position == null || user.position === "";

      if (needsEmployeeData) {
        // Update nur fehlende Employee-Daten (keine neue employee_id!)
        const updateData: Record<string, unknown> = {};

        // WICHTIG: department_id NICHT setzen wenn keine Departments existieren
        // department_id kann NULL bleiben bis Departments angelegt werden

        if (user.position == null || user.position === "") {
          updateData.position = "Mitarbeiter"; // Default position
        }

        // Update nur die fehlenden Daten (wenn überhaupt welche vorhanden sind)
        if (Object.keys(updateData).length > 0) {
          await User.update(req.user.id, updateData, req.user.tenant_id);
        }
      }

      // Neues JWT mit dual role info erstellen
      const dualRoleToken = jwt.sign(
        {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          activeRole: "employee", // Aktive Rolle
          tenant_id: user.tenant_id,
          isRoleSwitched: true,
        },
        process.env.JWT_SECRET ?? "your-secret-key",
        { expiresIn: "24h" },
      );

      // Log the action
      await createRootLog({
        tenant_id: req.user.tenant_id,
        user_id: req.user.id,
        action: "role_switch_to_employee",
        entity_type: "user",
        entity_id: req.user.id,
        new_values: {
          from_role: user.role, // Kann admin oder root sein
          to_role: "employee",
          timestamp: new Date(),
        },
        was_role_switched: true,
      });

      res.json({
        success: true,
        token: dualRoleToken,
        user: {
          ...user,
          activeRole: "employee",
          isRoleSwitched: true,
        },
        message: needsEmployeeData
          ? "Mitarbeiter-Profil erstellt und gewechselt"
          : "Erfolgreich zu Mitarbeiter-Ansicht gewechselt",
      });
    } catch (error: unknown) {
      console.error("Role switch error:", getErrorMessage(error));
      res.status(500).json({
        message: "Fehler beim Rollenwechsel",
        error: getErrorMessage(error),
      });
    }
  }),
);

/**
 * @route POST /api/role-switch/to-admin
 * @desc Switch back to admin mode
 * @access Private
 */
router.post(
  "/to-admin",
  authenticateToken,
  typed.auth(async (req, res) => {
    try {
      // User-Daten holen
      const user = await User.findById(req.user.id, req.user.tenant_id);
      if (!user) {
        res.status(404).json({ message: "User nicht gefunden" });
        return;
      }

      // Nur Admins und Root können zurück switchen
      if (user.role !== "admin" && user.role !== "root") {
        res
          .status(403)
          .json({ message: "Nur Admins und Root können die Rolle wechseln" });
        return;
      }

      // Neues JWT mit original role erstellen
      const adminToken = jwt.sign(
        {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          activeRole: user.role, // Zurück zur Original-Rolle (admin oder root)
          tenant_id: user.tenant_id,
          isRoleSwitched: false,
        },
        process.env.JWT_SECRET ?? "your-secret-key",
        { expiresIn: "24h" },
      );

      // Log the action
      await createRootLog({
        tenant_id: req.user.tenant_id,
        user_id: req.user.id,
        action: "role_switch_to_admin",
        entity_type: "user",
        entity_id: req.user.id,
        new_values: {
          from_role: "employee",
          to_role: "admin",
          timestamp: new Date(),
        },
        was_role_switched: true,
      });

      res.json({
        success: true,
        token: adminToken,
        user: {
          ...user,
          activeRole: user.role, // Original-Rolle (admin oder root)
          isRoleSwitched: false,
        },
        message: `Erfolgreich zu ${user.role === "root" ? "Root" : "Admin"}-Ansicht gewechselt`,
      });
    } catch (error: unknown) {
      console.error("Role switch back error:", getErrorMessage(error));
      res.status(500).json({
        message: "Fehler beim Rollenwechsel",
        error: getErrorMessage(error),
      });
    }
  }),
);

/**
 * @route POST /api/role-switch/to-root
 * @desc Switch back to root mode (root users only)
 * @access Private (Root only)
 */
router.post(
  "/to-root",
  authenticateToken,
  typed.auth(async (req, res) => {
    try {
      // User-Daten holen
      const user = await User.findById(req.user.id, req.user.tenant_id);
      if (!user) {
        res.status(404).json({ message: "User nicht gefunden" });
        return;
      }

      // Nur Root kann zu Root zurück switchen
      if (user.role !== "root") {
        res
          .status(403)
          .json({ message: "Nur Root-User können zu Root wechseln" });
        return;
      }

      // Neues JWT mit root role erstellen
      const rootToken = jwt.sign(
        {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          activeRole: "root",
          tenant_id: user.tenant_id,
          isRoleSwitched: false,
        },
        process.env.JWT_SECRET ?? "your-secret-key",
        { expiresIn: "24h" },
      );

      // Log the action
      await createRootLog({
        tenant_id: req.user.tenant_id,
        user_id: req.user.id,
        action: "role_switch_to_root",
        entity_type: "user",
        entity_id: req.user.id,
        new_values: {
          from_role: req.user.activeRole ?? req.user.role,
          to_role: "root",
          timestamp: new Date(),
        },
        was_role_switched: true,
      });

      res.json({
        success: true,
        token: rootToken,
        user: {
          ...user,
          activeRole: "root",
          isRoleSwitched: false,
        },
        message: "Erfolgreich zu Root-Ansicht gewechselt",
      });
    } catch (error: unknown) {
      console.error("Role switch to root error:", getErrorMessage(error));
      res.status(500).json({
        message: "Fehler beim Rollenwechsel",
        error: getErrorMessage(error),
      });
    }
  }),
);

/**
 * @route POST /api/role-switch/root-to-admin
 * @desc Switch root to admin view
 * @access Private (Root only)
 */
router.post(
  "/root-to-admin",
  authenticateToken,
  typed.auth(async (req, res) => {
    try {
      // Nur Root darf diesen Endpoint nutzen
      if (req.user.role !== "root") {
        res.status(403).json({ message: "Nur Root kann zu Admin wechseln" });
        return;
      }

      // User-Daten holen
      const user = await User.findById(req.user.id, req.user.tenant_id);
      if (!user) {
        res.status(404).json({ message: "User nicht gefunden" });
        return;
      }

      // Neues JWT mit admin activeRole erstellen
      const adminViewToken = jwt.sign(
        {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role, // Bleibt 'root'
          activeRole: "admin", // Aktive Rolle ist 'admin'
          tenant_id: user.tenant_id,
          isRoleSwitched: true,
        },
        process.env.JWT_SECRET ?? "your-secret-key",
        { expiresIn: "24h" },
      );

      // Log the action
      await createRootLog({
        tenant_id: req.user.tenant_id,
        user_id: req.user.id,
        action: "role_switch_root_to_admin",
        entity_type: "user",
        entity_id: req.user.id,
        new_values: {
          from_role: "root",
          to_role: "admin",
          timestamp: new Date(),
        },
        was_role_switched: true,
      });

      res.json({
        success: true,
        token: adminViewToken,
        user: {
          ...user,
          activeRole: "admin",
          isRoleSwitched: true,
        },
        message: "Erfolgreich zu Admin-Ansicht gewechselt",
      });
    } catch (error: unknown) {
      console.error("Role switch root to admin error:", getErrorMessage(error));
      res.status(500).json({
        message: "Fehler beim Rollenwechsel",
        error: getErrorMessage(error),
      });
    }
  }),
);

export default router;
