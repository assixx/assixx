/**
 * Users API Routes
 * Handles user profile operations and profile picture uploads
 */

import express, { Router, Request } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import bcrypt from "bcryptjs";
import { authenticateToken } from "../auth";
import { logger } from "../utils/logger";

// Import User model (keeping require pattern for compatibility)
import User from "../models/user";

const router: Router = express.Router();

// Extended Request interfaces
interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    tenant_id: number;
    username: string;
    email: string;
    role: string;
  };

  file?: Express.Multer.File;
}

// Removed unused ProfileUpdateRequest interface

// Get all users (admin only)
router.get(
  "/",
  authenticateToken as any,
  async (req: any, res: any): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;

      // Get query parameters
      const { role, limit } = req.query;

      let users: any[] = [];

      // Different logic based on user role
      if (authReq.user.role === "admin" || authReq.user.role === "root") {
        // Admins see all users
        users = await User.findAllByTenant(authReq.user.tenant_id);
      } else if (authReq.user.role === "employee") {
        // Employees only see users from their department
        const currentUser = await User.findById(
          authReq.user.id,
          authReq.user.tenant_id,
        );
        if (currentUser && currentUser.department_id) {
          const allUsers = await User.findAllByTenant(authReq.user.tenant_id);
          users = allUsers.filter(
            (u) => u.department_id === currentUser.department_id,
          );
        }
      } else {
        res.status(403).json({ message: "Access denied" });
        return;
      }

      // Filter by role if specified
      if (role && typeof role === "string") {
        users = users.filter((user) => user.role === role);
      }

      // Apply limit if specified
      if (limit && typeof limit === "string") {
        const limitNum = parseInt(limit, 10);
        if (!isNaN(limitNum) && limitNum > 0) {
          users = users.slice(0, limitNum);
        }
      }

      // Remove sensitive data
      const sanitizedUsers = users.map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        department_id: user.department_id,
        team_id: user.team_id,
        phone: user.phone,
        created_at: user.created_at,
        is_active: user.is_active,
        position: user.position,
        department: user.department,
        availability_status: user.availability_status,
        availability_start: user.availability_start,
        availability_end: user.availability_end,
        availability_notes: user.availability_notes,
      }));

      res.json(sanitizedUsers);
    } catch (error: any) {
      logger.error("Error fetching users:", error);
      res.status(500).json({
        message: "Error fetching users",
        error: error.message,
      });
    }
  },
);

// Get specific user by ID (admin only)
router.get(
  "/:id",
  authenticateToken as any,
  async (req: any, res: any): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;

      // Check if user is admin or root
      if (authReq.user.role !== "admin" && authReq.user.role !== "root") {
        res.status(403).json({ message: "Access denied" });
        return;
      }

      const userId = parseInt(req.params.id);
      const user = await User.findById(userId, authReq.user.tenant_id);

      if (!user) {
        res.status(404).json({ message: "Benutzer nicht gefunden" });
        return;
      }

      // Remove password from response
      const { password: _password, ...userProfile } = user;
      res.json(userProfile);
    } catch (error: any) {
      logger.error(`Error fetching user ${req.params.id}: ${error.message}`);
      res.status(500).json({
        message: "Fehler beim Abrufen des Benutzers",
        error: error.message,
      });
    }
  },
);

// Update user by ID (admin only)
router.put(
  "/:id",
  authenticateToken as any,
  async (req: any, res: any): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;

      // Check if user is admin or root
      if (authReq.user.role !== "admin" && authReq.user.role !== "root") {
        res.status(403).json({ message: "Access denied" });
        return;
      }

      const userId = parseInt(req.params.id);
      const updateData = req.body;

      // Remove fields that shouldn't be updated directly
      delete updateData.id;
      delete updateData.tenant_id;
      delete updateData.created_at;
      delete updateData.updated_at;

      // Verify user belongs to tenant before updating
      const existingUser = await User.findById(userId, authReq.user.tenant_id);
      if (!existingUser) {
        res.status(404).json({ message: "Benutzer nicht gefunden" });
        return;
      }

      // Hash password if provided
      if (updateData.password && updateData.password.trim() !== "") {
        const saltRounds = 10;
        updateData.password = await bcrypt.hash(
          updateData.password,
          saltRounds,
        );
        logger.info(
          `Password updated for user ${userId} by admin ${authReq.user.id}`,
        );
      } else {
        // Remove empty password field
        delete updateData.password;
      }

      // Update user
      const success = await User.update(userId, updateData);

      if (!success) {
        res.status(500).json({ message: "Aktualisierung fehlgeschlagen" });
        return;
      }

      logger.info(`User ${userId} updated by ${authReq.user.id}`);
      res.json({ message: "Benutzer erfolgreich aktualisiert" });
    } catch (error: any) {
      logger.error(`Error updating user ${req.params.id}: ${error.message}`);
      res.status(500).json({
        message: "Fehler beim Aktualisieren des Benutzers",
        error: error.message,
      });
    }
  },
);

// Delete user by ID (admin only)
router.delete(
  "/:id",
  authenticateToken as any,
  async (req: any, res: any): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;

      // Check if user is admin or root
      if (authReq.user.role !== "admin" && authReq.user.role !== "root") {
        res.status(403).json({ message: "Access denied" });
        return;
      }

      const userId = parseInt(req.params.id);

      // Prevent self-deletion
      if (userId === authReq.user.id) {
        res
          .status(400)
          .json({ message: "Sie können sich nicht selbst löschen" });
        return;
      }

      // Verify user belongs to tenant before deleting
      const existingUser = await User.findById(userId, authReq.user.tenant_id);
      if (!existingUser) {
        res.status(404).json({ message: "Benutzer nicht gefunden" });
        return;
      }

      const success = await User.delete(userId);

      if (!success) {
        res.status(500).json({ message: "Löschen fehlgeschlagen" });
        return;
      }

      logger.info(`User ${userId} deleted by ${authReq.user.id}`);
      res.json({ message: "Benutzer erfolgreich gelöscht" });
    } catch (error: any) {
      logger.error(`Error deleting user ${req.params.id}: ${error.message}`);
      res.status(500).json({
        message: "Fehler beim Löschen des Benutzers",
        error: error.message,
      });
    }
  },
);

// Get logged-in user's profile data
router.get(
  "/profile",
  authenticateToken as any,
  async (req: any, res: any): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = await User.findById(authReq.user.id, authReq.user.tenant_id);
      if (!user) {
        res.status(404).json({ message: "Benutzer nicht gefunden" });
        return;
      }

      // Remove password from response
      const { password: _password, ...userProfile } = user;

      logger.info(`User ${authReq.user.id} retrieved their profile`);
      res.json(userProfile);
    } catch (error: any) {
      logger.error(
        `Error retrieving profile for user ${(req as AuthenticatedRequest).user.id}: ${error.message}`,
      );
      res.status(500).json({
        message: "Fehler beim Abrufen des Profils",
        error: error.message,
      });
    }
  },
);

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
  destination(_req: any, _file: any, cb: any) {
    cb(null, "uploads/profile_pictures/");
  },
  filename(_req: any, file: any, cb: any) {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const extension = path.extname(file.originalname);
    cb(null, `profile-${uniqueSuffix}${extension}`);
  },
});

const fileFilter = (
  _req: any,

  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  // Accept only images
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Nur Bildformate sind erlaubt!"));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter,
});

// Update user profile
router.put(
  "/profile",
  authenticateToken as any,
  async (req: any, res: any): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;
      const updateData = req.body;

      // Prevent password updates through profile endpoint
      // Password changes should go through /profile/password
      delete updateData.password;
      delete updateData.role;
      delete updateData.tenant_id;

      // Validate email if provided
      if (updateData.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(updateData.email)) {
          res.status(400).json({ message: "Ungültige E-Mail-Adresse" });
          return;
        }
      }

      const success = await User.update(userId, updateData);

      if (success) {
        logger.info(`User ${userId} updated their profile`);
        res.json({ message: "Profil erfolgreich aktualisiert" });
      } else {
        res
          .status(500)
          .json({ message: "Fehler beim Aktualisieren des Profils" });
      }
    } catch (error: any) {
      logger.error(
        `Error updating profile for user ${(req as AuthenticatedRequest).user.id}: ${error.message}`,
      );
      res.status(500).json({
        message: "Fehler beim Aktualisieren des Profils",
        error: error.message,
      });
    }
  },
);

// Upload profile picture
router.post(
  "/profile/picture",
  authenticateToken as any,
  upload.single("profilePicture"),
  async (req: any, res: any): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      if (!req.file) {
        res.status(400).json({ message: "Keine Datei hochgeladen" });
        return;
      }

      const userId = authReq.user.id;
      const fileName = req.file.filename;
      const filePath = `/uploads/profile_pictures/${fileName}`;

      // Update user's profile picture URL in database
      const success = await User.update(userId, {
        profile_picture: filePath,
      });

      if (success) {
        logger.info(`User ${userId} uploaded new profile picture: ${fileName}`);
        res.json({
          message: "Profilbild erfolgreich hochgeladen",
          profilePictureUrl: filePath,
        });
      } else {
        // Clean up uploaded file if database update failed
        await fs.unlink(req.file.path);
        res
          .status(500)
          .json({ message: "Fehler beim Speichern des Profilbildes" });
      }
    } catch (error: any) {
      logger.error(
        `Error uploading profile picture for user ${(req as AuthenticatedRequest).user.id}: ${error.message}`,
      );

      // Clean up uploaded file
      if (req.file?.path) {
        try {
          await fs.unlink(req.file.path);
        } catch (unlinkError: any) {
          logger.error(`Error deleting temporary file: ${unlinkError.message}`);
        }
      }

      res.status(500).json({
        message: "Fehler beim Hochladen des Profilbildes",
        error: error.message,
      });
    }
  },
);

// Delete profile picture
router.delete(
  "/profile/picture",
  authenticateToken as any,
  async (req: any, res: any): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;

      // Get current user to find existing profile picture
      const user = await User.findById(userId, authReq.user.tenant_id);
      if (!user) {
        res.status(404).json({ message: "Benutzer nicht gefunden" });
        return;
      }

      // Delete old profile picture file if it exists
      if (user.profile_picture_url) {
        const oldFilePath = path.join(
          __dirname,
          "..",
          "..",
          user.profile_picture_url,
        );
        try {
          await fs.unlink(oldFilePath);
        } catch (unlinkError: any) {
          logger.warn(
            `Could not delete old profile picture file: ${unlinkError.message}`,
          );
        }
      }

      // Remove profile picture URL from database
      const success = await User.update(userId, { profile_picture: undefined });

      if (success) {
        logger.info(`User ${userId} deleted their profile picture`);
        res.json({ message: "Profilbild erfolgreich gelöscht" });
      } else {
        res
          .status(500)
          .json({ message: "Fehler beim Löschen des Profilbildes" });
      }
    } catch (error: any) {
      logger.error(
        `Error deleting profile picture for user ${(req as AuthenticatedRequest).user.id}: ${error.message}`,
      );
      res.status(500).json({
        message: "Fehler beim Löschen des Profilbildes",
        error: error.message,
      });
    }
  },
);

// Change password
router.put(
  "/profile/password",
  authenticateToken as any,
  async (req: any, res: any): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        res
          .status(400)
          .json({ message: "Aktuelles und neues Passwort sind erforderlich" });
        return;
      }

      if (newPassword.length < 6) {
        res.status(400).json({
          message: "Neues Passwort muss mindestens 6 Zeichen lang sein",
        });
        return;
      }

      const userId = authReq.user.id;

      // Verify current password and update to new password
      const success = await User.changePassword(
        userId,
        authReq.user.tenant_id,
        currentPassword,
        newPassword,
      );

      if (success) {
        logger.info(`User ${userId} changed their password`);
        res.json({ message: "Passwort erfolgreich geändert" });
      } else {
        res.status(400).json({ message: "Aktuelles Passwort ist ungültig" });
      }
    } catch (error: any) {
      logger.error(
        `Error changing password for user ${(req as AuthenticatedRequest).user.id}: ${error.message}`,
      );
      res.status(500).json({
        message: "Fehler beim Ändern des Passworts",
        error: error.message,
      });
    }
  },
);

// Update employee availability
router.put(
  "/:id/availability",
  authenticateToken as any,
  async (req: any, res: any): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const employeeId = parseInt(req.params.id);
      const {
        availability_status,
        availability_start,
        availability_end,
        availability_notes,
      } = req.body;

      // Check if user is admin or root
      if (authReq.user.role !== "admin" && authReq.user.role !== "root") {
        res.status(403).json({
          message: "Nur Administratoren können die Verfügbarkeit ändern",
        });
        return;
      }

      // Validate availability status
      const validStatuses = ["available", "unavailable", "vacation", "sick"];
      if (!validStatuses.includes(availability_status)) {
        res.status(400).json({ message: "Ungültiger Verfügbarkeitsstatus" });
        return;
      }

      // Update user availability
      const success = await User.updateAvailability(
        employeeId,
        authReq.user.tenant_id,
        {
          availability_status,
          availability_start,
          availability_end,
          availability_notes,
        },
      );

      if (success) {
        logger.info(
          `Admin ${authReq.user.id} updated availability for employee ${employeeId}`,
        );
        res.json({ message: "Verfügbarkeit erfolgreich aktualisiert" });
      } else {
        res.status(404).json({ message: "Mitarbeiter nicht gefunden" });
      }
    } catch (error: any) {
      logger.error(
        `Error updating availability for employee ${req.params.id}: ${error.message}`,
      );
      res.status(500).json({
        message: "Fehler beim Aktualisieren der Verfügbarkeit",
        error: error.message,
      });
    }
  },
);

export default router;

// CommonJS compatibility
