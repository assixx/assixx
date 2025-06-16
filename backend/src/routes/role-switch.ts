/**
 * Role Switch API Routes
 * Ermöglicht Admins als Employee zu agieren
 */

import express, { Router, Request } from "express";
import { authenticateToken } from "../middleware/auth.js";
import User from "../models/user.js";
import AdminLog from "../models/adminLog.js";
import jwt from "jsonwebtoken";

const router: Router = express.Router();

// Extended Request interface
interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    username: string;
    email: string;
    role: string;
    tenant_id: number;
  };
}

/**
 * @route POST /api/role-switch/to-employee
 * @desc Switch admin view to employee mode
 * @access Private (Admin only)
 */
router.post(
  "/to-employee",
  authenticateToken,
  async (req, res): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;

      // Nur Admins dürfen switchen
      if (authReq.user.role !== "admin") {
        res
          .status(403)
          .json({ message: "Nur Admins können die Rolle wechseln" });
        return;
      }

      // User-Daten holen
      const user = await User.findById(authReq.user.id, authReq.user.tenant_id);
      if (!user) {
        res.status(404).json({ message: "User nicht gefunden" });
        return;
      }

      // Prüfen ob Employee-Daten vollständig sind (department_id und position)
      const needsEmployeeData = !user.department_id || !user.position;

      if (needsEmployeeData) {
        // Update nur fehlende Employee-Daten (keine neue employee_id!)
        const updateData: any = {};

        if (!user.department_id) {
          updateData.department_id = 1; // Default department
        }

        if (!user.position) {
          updateData.position = "Mitarbeiter"; // Default position
        }

        // Update nur die fehlenden Daten
        await User.update(authReq.user.id, updateData);
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
        process.env.JWT_SECRET || "your-secret-key",
        { expiresIn: "24h" },
      );

      // Log the action
      await AdminLog.create({
        tenant_id: authReq.user.tenant_id,
        user_id: authReq.user.id,
        action: "role_switch_to_employee",
        entity_type: "user",
        entity_id: authReq.user.id,
        new_values: JSON.stringify({
          from_role: "admin",
          to_role: "employee",
          timestamp: new Date(),
        }),
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
    } catch (error: any) {
      console.error("Role switch error:", error);
      res
        .status(500)
        .json({ message: "Fehler beim Rollenwechsel", error: error.message });
    }
  },
);

/**
 * @route POST /api/role-switch/to-admin
 * @desc Switch back to admin mode
 * @access Private
 */
router.post("/to-admin", authenticateToken, async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;

    // User-Daten holen
    const user = await User.findById(authReq.user.id, authReq.user.tenant_id);
    if (!user) {
      res.status(404).json({ message: "User nicht gefunden" });
      return;
    }

    // Nur Admins können zurück switchen
    if (user.role !== "admin") {
      res.status(403).json({ message: "Nur Admins können die Rolle wechseln" });
      return;
    }

    // Neues JWT mit admin role erstellen
    const adminToken = jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        activeRole: "admin", // Zurück zu Admin
        tenant_id: user.tenant_id,
        isRoleSwitched: false,
      },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "24h" },
    );

    // Log the action
    await AdminLog.create({
      tenant_id: authReq.user.tenant_id,
      user_id: authReq.user.id,
      action: "role_switch_to_admin",
      entity_type: "user",
      entity_id: authReq.user.id,
      new_values: JSON.stringify({
        from_role: "employee",
        to_role: "admin",
        timestamp: new Date(),
      }),
    });

    res.json({
      success: true,
      token: adminToken,
      user: {
        ...user,
        activeRole: "admin",
        isRoleSwitched: false,
      },
      message: "Erfolgreich zu Admin-Ansicht gewechselt",
    });
  } catch (error: any) {
    console.error("Role switch back error:", error);
    res
      .status(500)
      .json({ message: "Fehler beim Rollenwechsel", error: error.message });
  }
});

export default router;
