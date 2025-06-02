/**
 * User Profile API Routes
 */

import express, { Router, Request } from "express";
import path from "path";
import fs from "fs";
import { authenticateToken } from "../middleware/auth";

// Import models and database (now ES modules)
import User from "../models/user";
import db from "../database";

const router: Router = express.Router();

// Extended Request interfaces
interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    username: string;
    email: string;
    role: string;
    tenant_id: number;
  };
}

// Removed unused interfaces - UserProfileRequest, UserProfileUpdateRequest, UserProfilePictureRequest

/**
 * @route GET /api/user/profile
 * @desc Get user profile
 * @access Private
 */
router.get("/profile", authenticateToken, async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = await User.findById(authReq.user.id);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Get department information if available
    let departmentInfo = null;
    if (user.department_id) {
      // Verwende db statt req.tenantDb
      const [departments] = await (db as any).execute(
        "SELECT * FROM departments WHERE id = ?",
        [user.department_id],
      );

      if (departments && departments.length > 0) {
        departmentInfo = departments[0];
      }
    }

    // Get team information if available
    let teamInfo = null;
    if (user.team_id) {
      // Verwende db statt req.tenantDb
      const [teams] = await (db as any).execute(
        "SELECT * FROM teams WHERE id = ?",
        [user.team_id],
      );

      if (teams && teams.length > 0) {
        teamInfo = teams[0];
      }
    }

    // Get tenant information
    let tenantInfo = null;
    if (user.tenant_id) {
      const [tenants] = await (db as any).execute(
        "SELECT * FROM tenants WHERE id = ?",
        [user.tenant_id],
      );

      if (tenants && tenants.length > 0) {
        tenantInfo = tenants[0];
      }
    }

    // Remove sensitive information
    const { password: _password, ...userWithoutPassword } = user;

    res.json({
      ...userWithoutPassword,
      department: departmentInfo ? departmentInfo.name : null,
      departmentId: user.department_id,
      team: teamInfo ? teamInfo.name : null,
      teamId: user.team_id,
      company_name: tenantInfo ? tenantInfo.company_name : null,
      subdomain: tenantInfo ? tenantInfo.subdomain : null,
    });
  } catch (error: any) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route PUT /api/user/profile
 * @desc Update user profile
 * @access Private
 */
router.put("/profile", authenticateToken, async (req, res): Promise<void> => {
  try {
    // const authReq = req as AuthenticatedRequest;
    const { id } = req.user;
    const updates = { ...req.body };

    // Don't allow updating critical fields
    if ("id" in updates) delete updates.id;
    if ("username" in updates) delete updates.username;
    if ("role" in updates) delete updates.role;
    if ("password" in updates) delete updates.password;
    if ("created_at" in updates) delete updates.created_at;

    const result = await User.update(id, updates);

    if (result) {
      const updatedUser = await User.findById(id);
      if (!updatedUser) {
        res.status(404).json({ message: "User not found after update" });
        return;
      }
      const { password: _password, ...userWithoutPassword } = updatedUser;

      res.json({
        message: "Profile updated successfully",
        user: userWithoutPassword,
      });
    } else {
      res.status(400).json({ message: "Failed to update profile" });
    }
  } catch (error: any) {
    console.error("Error updating user profile:", error);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route GET /api/user/profile-picture
 * @desc Get user profile picture
 * @access Private
 */
router.get(
  "/profile-picture",
  authenticateToken,
  async (req, res): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = await User.findById(authReq.user.id);

      if (!user || !user.profile_picture) {
        res.status(404).json({ message: "Profile picture not found" });
        return;
      }

      // Send the profile picture file
      const filePath = path.join(
        __dirname,
        "..",
        "uploads",
        "profile_pictures",
        user.profile_picture,
      );

      if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
      } else {
        res.status(404).json({ message: "Profile picture file not found" });
      }
    } catch (error: any) {
      console.error("Error fetching profile picture:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

export default router;

// CommonJS compatibility
