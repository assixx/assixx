/**
 * Users API Routes
 * Handles user profile operations and profile picture uploads
 */

import path from "path";

import bcrypt from "bcryptjs";
import express, { Router } from "express";
import { param } from "express-validator";
import multer from "multer";

const router: Router = express.Router();

import { security } from "../middleware/security";
import { apiLimiter, uploadLimiter } from "../middleware/security-enhanced";
import { createValidation, validationSchemas } from "../middleware/validation";
import User, { DbUser } from "../models/user";
import { AuthenticatedRequest } from "../types/request.types";
import { successResponse, errorResponse } from "../types/response.types";
import { getErrorMessage } from "../utils/errorHandler";
import { logger } from "../utils/logger";
import { safeDeleteFile } from "../utils/pathSecurity";
import { typed } from "../utils/routeHandlers";
/**
 * Users API Routes
 * Handles user profile operations and profile picture uploads
 */

// Import User model (keeping require pattern for compatibility)
// Import types
// Extended request for file uploads
interface FileUploadRequest extends AuthenticatedRequest {
  file?: Express.Multer.File;
}

// Validation schemas
const userIdValidation = createValidation([
  param("id").isInt({ min: 1 }).withMessage("Invalid user ID"),
]);

// Type definitions for request bodies
interface ProfileUpdateBody {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  department_id?: number;
  position?: string;
  password?: string;
  role?: string;
  tenant_id?: number;
}

interface PasswordChangeBody {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface AvailabilityUpdateBody {
  [key: string]: string | undefined;
  monday_start?: string;
  monday_end?: string;
  tuesday_start?: string;
  tuesday_end?: string;
  wednesday_start?: string;
  wednesday_end?: string;
  thursday_start?: string;
  thursday_end?: string;
  friday_start?: string;
  friday_end?: string;
  saturday_start?: string;
  saturday_end?: string;
  sunday_start?: string;
  sunday_end?: string;
}

// Get all users (admin only)
router.get(
  "/",
  apiLimiter,
  ...security.admin(),
  typed.auth(async (req, res) => {
    try {
      // Get query parameters
      const { role, limit } = req.query;

      let users: DbUser[] = [];

      // Different logic based on user role
      if (req.user.role === "admin" || req.user.role === "root") {
        // Admins see all users
        users = await User.findAllByTenant(req.user.tenant_id);
      } else if (req.user.role === "employee") {
        // Employees only see users from their department
        const currentUser = await User.findById(
          req.user.id,
          req.user.tenant_id,
        );
        if (currentUser?.department_id) {
          const allUsers = await User.findAllByTenant(req.user.tenant_id);
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
    } catch (error) {
      logger.error("Error fetching users:", error);
      res.status(500).json({
        message: "Error fetching users",
        error: getErrorMessage(error),
      });
    }
  }),
);

// Get current user data (alias for /profile) - for frontend compatibility
// IMPORTANT: This must come BEFORE the /:id route to avoid 'me' being treated as an ID
router.get(
  "/me",
  apiLimiter,
  ...security.user(),
  typed.auth(async (req, res) => {
    try {
      // Debug logging
      logger.info("GET /api/users/me - req.user:", req.user);

      if (!req.user?.id) {
        logger.error("No user object or user.id in request");
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const userId = parseInt(req.user.id.toString(), 10);
      const tenantId = req.user.tenant_id;

      logger.info(`Fetching user ${userId} from tenant ${tenantId}`);

      const user = await User.findById(userId, tenantId);
      if (!user) {
        res.status(404).json(errorResponse("Benutzer nicht gefunden", 404));
        return;
      }

      // Remove password from response
      const { password: _password, ...userProfile } = user;

      logger.info(`User ${userId} retrieved their profile via /me endpoint`);

      // Return in the format expected by the frontend
      res.json({ user: userProfile });
    } catch (error) {
      logger.error(
        `Error retrieving profile for user: ${getErrorMessage(error)}`,
      );
      res
        .status(500)
        .json(errorResponse("Fehler beim Abrufen des Profils", 500));
    }
  }),
);

// Get specific user by ID (admin only)
router.get(
  "/:id",
  apiLimiter,
  ...security.admin(),
  typed.params<{ id: string }>(async (req, res) => {
    try {
      // Security middleware already checked admin/root role

      const userId = parseInt(req.params.id);
      const user = await User.findById(userId, req.user.tenant_id);

      if (!user) {
        res.status(404).json(errorResponse("Benutzer nicht gefunden", 404));
        return;
      }

      // Remove password from response
      const { password: _password, ...userProfile } = user;
      res.json(userProfile);
    } catch (error) {
      logger.error(
        `Error fetching user ${req.params.id}: ${getErrorMessage(error)}`,
      );
      res.status(500).json({
        message: "Fehler beim Abrufen des Benutzers",
        error: getErrorMessage(error),
      });
    }
  }),
);

// Update user by ID (admin only)
router.put(
  "/:id",
  apiLimiter,
  ...security.admin(),
  typed.paramsBody<
    { id: string },
    {
      username?: string;
      email?: string;
      password?: string;
      role?: string;
      first_name?: string;
      last_name?: string;
      department_id?: number;
      position?: string;
      is_active?: boolean;
      is_archived?: boolean;
    }
  >(async (req, res) => {
    try {
      // Security middleware already checked admin/root role

      const userId = parseInt(req.params.id);
      // Create a copy and filter out protected fields
      const {
        id: _id,
        tenant_id: _tenant_id,
        created_at: _created_at,
        updated_at: _updated_at,
        ...updateData
      } = req.body as Record<string, unknown>;

      // Verify user belongs to tenant before updating
      const existingUser = await User.findById(userId, req.user.tenant_id);
      if (!existingUser) {
        res.status(404).json(errorResponse("Benutzer nicht gefunden", 404));
        return;
      }

      // Hash password if provided
      const password = updateData.password;
      if (typeof password === "string" && password.trim() !== "") {
        const saltRounds = 10;
        updateData.password = await bcrypt.hash(password, saltRounds);
        logger.info(
          `Password updated for user ${userId} by admin ${req.user.id}`,
        );
      } else {
        // Remove empty password field
        delete updateData.password;
      }

      // Update user
      const success = await User.update(userId, updateData, req.user.tenant_id);

      if (!success) {
        res.status(500).json({ message: "Aktualisierung fehlgeschlagen" });
        return;
      }

      logger.info(`User ${userId} updated by ${req.user.id}`);
      res.json({ message: "Benutzer erfolgreich aktualisiert" });
    } catch (error) {
      logger.error(
        `Error updating user ${req.params.id}: ${getErrorMessage(error)}`,
      );
      res
        .status(500)
        .json(errorResponse("Fehler beim Aktualisieren des Benutzers", 500));
    }
  }),
);

// Delete user by ID (admin only)
router.delete(
  "/:id",
  apiLimiter,
  ...security.admin(userIdValidation),
  typed.params<{ id: string }>(async (req, res) => {
    try {
      // Security middleware already checked admin/root role

      const userId = parseInt(req.params.id);

      // Prevent self-deletion
      if (userId === req.user.id) {
        res
          .status(400)
          .json(errorResponse("Sie können sich nicht selbst löschen", 400));
        return;
      }

      // Verify user belongs to tenant before deleting
      const existingUser = await User.findById(userId, req.user.tenant_id);
      if (!existingUser) {
        res.status(404).json(errorResponse("Benutzer nicht gefunden", 404));
        return;
      }

      const success = await User.delete(userId);

      if (!success) {
        res.status(500).json(errorResponse("Löschen fehlgeschlagen", 500));
        return;
      }

      logger.info(`User ${userId} deleted by ${req.user.id}`);
      res.json(successResponse(null, "Benutzer erfolgreich gelöscht"));
    } catch (error) {
      logger.error(
        `Error deleting user ${req.params.id}: ${getErrorMessage(error)}`,
      );
      res
        .status(500)
        .json(errorResponse("Fehler beim Löschen des Benutzers", 500));
    }
  }),
);

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
// Get logged-in user's profile data
router.get(
  "/profile",
  apiLimiter,
  ...security.user(),
  typed.auth(async (req, res) => {
    try {
      // Debug logging
      console.log("[DEBUG] /api/users/profile - req.user:", req.user);
      console.log("[DEBUG] /api/users/profile - req.user.id:", req.user?.id);
      console.log(
        "[DEBUG] /api/users/profile - typeof req.user.id:",
        typeof req.user?.id,
      );

      // Use the same logic as /me route which works
      if (!req.user?.id) {
        logger.error("No user object or user.id in request");
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const userId = parseInt(req.user.id.toString(), 10);
      const tenantId = req.user.tenant_id;

      console.log("[DEBUG] Parsed userId:", userId, "tenantId:", tenantId);

      const user = await User.findById(userId, tenantId);
      if (!user) {
        res.status(404).json(errorResponse("Benutzer nicht gefunden", 404));
        return;
      }

      // Remove password from response
      const { password: _password, ...userProfile } = user;

      logger.info(`User ${userId} retrieved their profile`);
      res.json(successResponse(userProfile));
    } catch (error) {
      logger.error(
        `Error retrieving profile for user: ${getErrorMessage(error)}`,
      );
      res
        .status(500)
        .json(errorResponse("Fehler beim Abrufen des Profils", 500));
    }
  }),
);

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, "uploads/profile_pictures/");
  },
  filename(_req, file, cb) {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const extension = path.extname(file.originalname);
    cb(null, `profile-${uniqueSuffix}${extension}`);
  },
});

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
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
  apiLimiter,
  ...security.user(validationSchemas.profileUpdate),
  typed.body<ProfileUpdateBody>(async (req, res) => {
    try {
      const userId = req.user.id;
      const updateData = req.body;

      // Prevent password updates through profile endpoint
      // Password changes should go through /profile/password
      delete updateData.password;
      delete updateData.role;
      delete updateData.tenant_id;

      // Validate email if provided
      if (updateData.email) {
        // Use a simpler, non-backtracking regex to prevent ReDoS
        // First check length to prevent processing extremely long inputs
        if (updateData.email.length > 254) {
          res.status(400).json(errorResponse("E-Mail-Adresse zu lang", 400));
          return;
        }

        // Simple email validation without nested quantifiers
        const emailParts = updateData.email.split("@");
        if (
          emailParts.length !== 2 ||
          emailParts[0].length === 0 ||
          emailParts[1].length === 0 ||
          !emailParts[1].includes(".") ||
          emailParts[0].includes(" ") ||
          emailParts[1].includes(" ")
        ) {
          res.status(400).json(errorResponse("Ungültige E-Mail-Adresse", 400));
          return;
        }
      }

      const success = await User.update(userId, updateData, req.user.tenant_id);

      if (success) {
        logger.info(`User ${userId} updated their profile`);
        res.json(successResponse(null, "Profil erfolgreich aktualisiert"));
      } else {
        res
          .status(500)
          .json(errorResponse("Fehler beim Aktualisieren des Profils", 500));
      }
    } catch (error) {
      logger.error(
        `Error updating profile for user ${req.user.id}: ${getErrorMessage(error)}`,
      );
      res
        .status(500)
        .json(errorResponse("Fehler beim Aktualisieren des Profils", 500));
    }
  }),
);

// Upload profile picture
router.post(
  "/profile/picture",
  uploadLimiter,
  ...security.user(),
  upload.single("profilePicture"),
  typed.auth(async (req, res) => {
    try {
      const fileReq = req as FileUploadRequest;
      if (!fileReq.file) {
        res.status(400).json({ message: "Keine Datei hochgeladen" });
        return;
      }

      const userId = req.user.id;
      const fileName = fileReq.file.filename;
      const filePath = `/uploads/profile_pictures/${fileName}`;

      // Update user's profile picture URL in database
      const success = await User.update(
        userId,
        {
          profile_picture: filePath,
        },
        req.user.tenant_id,
      );

      if (success) {
        logger.info(`User ${userId} uploaded new profile picture: ${fileName}`);
        res.json({
          message: "Profilbild erfolgreich hochgeladen",
          profilePictureUrl: filePath,
        });
      } else {
        // Clean up uploaded file if database update failed
        if (req.file) {
          await safeDeleteFile(req.file.path);
        }
        res
          .status(500)
          .json({ message: "Fehler beim Speichern des Profilbildes" });
      }
    } catch (error) {
      logger.error(
        `Error uploading profile picture for user ${(req as AuthenticatedRequest).user.id}: ${getErrorMessage(error)}`,
      );

      // Clean up uploaded file
      if (req.file?.path) {
        try {
          await safeDeleteFile(req.file.path);
        } catch (unlinkError) {
          logger.error(
            `Error deleting temporary file: ${getErrorMessage(unlinkError)}`,
          );
        }
      }

      res.status(500).json({
        message: "Fehler beim Hochladen des Profilbildes",
        error: getErrorMessage(error),
      });
    }
  }),
);

// Delete profile picture
router.delete(
  "/profile/picture",
  apiLimiter,
  ...security.user(),
  typed.auth(async (req, res) => {
    try {
      const userId = req.user.id;

      // Get current user to find existing profile picture
      const user = await User.findById(userId, req.user.tenant_id);
      if (!user) {
        res.status(404).json(errorResponse("Benutzer nicht gefunden", 404));
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
          await safeDeleteFile(oldFilePath);
        } catch (unlinkError) {
          logger.warn(
            `Could not delete old profile picture file: ${getErrorMessage(unlinkError)}`,
          );
        }
      }

      // Remove profile picture URL from database
      const success = await User.update(
        userId,
        { profile_picture: undefined },
        req.user.tenant_id,
      );

      if (success) {
        logger.info(`User ${userId} deleted their profile picture`);
        res.json({ message: "Profilbild erfolgreich gelöscht" });
      } else {
        res
          .status(500)
          .json({ message: "Fehler beim Löschen des Profilbildes" });
      }
    } catch (error) {
      logger.error(
        `Error deleting profile picture for user ${req.user.id}: ${getErrorMessage(error)}`,
      );
      res
        .status(500)
        .json(errorResponse("Fehler beim Löschen des Profilbildes", 500));
    }
  }),
);

// Change password
router.put(
  "/profile/password",
  apiLimiter,
  ...security.user(validationSchemas.passwordChange),
  typed.body<PasswordChangeBody>(async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      // Validation is now handled by middleware

      const userId = req.user.id;

      // Verify current password and update to new password
      const result = await User.changePassword(
        userId,
        req.user.tenant_id,
        currentPassword,
        newPassword,
      );

      if (result.success) {
        logger.info(`User ${userId} changed their password`);
        res.json(successResponse(null, result.message));
      } else {
        res.status(400).json(errorResponse(result.message, 400));
      }
    } catch (error) {
      logger.error(
        `Error changing password for user ${req.user.id}: ${getErrorMessage(error)}`,
      );
      res
        .status(500)
        .json(errorResponse("Fehler beim Ändern des Passworts", 500));
    }
  }),
);

// Update employee availability
router.put(
  "/:id/availability",
  apiLimiter,
  ...security.admin(validationSchemas.availabilityUpdate),
  typed.paramsBody<{ id: string }, AvailabilityUpdateBody>(async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const {
        availability_status,
        availability_start,
        availability_end,
        availability_notes,
      } = req.body;

      // Validation is now handled by middleware
      if (!availability_status) {
        res
          .status(400)
          .json(errorResponse("Availability status is required", 400));
        return;
      }

      // Update user availability
      const success = await User.updateAvailability(
        employeeId,
        req.user.tenant_id,
        {
          availability_status,
          availability_start,
          availability_end,
          availability_notes,
        },
      );

      if (success) {
        logger.info(
          `Admin ${req.user.id} updated availability for employee ${employeeId}`,
        );
        res.json(
          successResponse(null, "Verfügbarkeit erfolgreich aktualisiert"),
        );
      } else {
        res.status(404).json(errorResponse("Mitarbeiter nicht gefunden", 404));
      }
    } catch (error) {
      logger.error(
        `Error updating availability for employee ${req.params.id}: ${getErrorMessage(error)}`,
      );
      res
        .status(500)
        .json(
          errorResponse("Fehler beim Aktualisieren der Verfügbarkeit", 500),
        );
    }
  }),
);

/**
 * @route PATCH /api/users/me
 * @desc Update current user's employee number (for root users on first login)
 * @access Private
 */
router.patch(
  "/me",
  ...security.user(),
  typed.body<{ employee_number: string }>(async (req, res) => {
    try {
      const userId = req.user.id;
      const tenantId = req.user.tenant_id;
      
      // Extract and validate employee number
      const { employee_number } = req.body;
      
      if (!employee_number) {
        res.status(400).json(errorResponse("Personalnummer ist erforderlich", 400));
        return;
      }

      // Validate employee number format: max 8 chars, alphanumeric + one hyphen allowed
      // Allow leading zeros like "01", "0002", "0002-22x"
      const employeeNumberRegex = /^[a-zA-Z0-9]+(-[a-zA-Z0-9]+)?$/;
      if (!employeeNumberRegex.test(employee_number) || employee_number.length > 8) {
        res.status(400).json(
          errorResponse(
            "Ungültiges Format. Max. 8 Zeichen, nur Buchstaben, Zahlen und ein Bindestrich erlaubt",
            400
          )
        );
        return;
      }

      // Update user's employee number
      const success = await User.update(
        userId,
        { employee_number },
        tenantId
      );

      if (success) {
        logger.info(`User ${userId} updated their employee number`);
        res.json(
          successResponse(
            { employee_number },
            "Personalnummer erfolgreich aktualisiert"
          )
        );
      } else {
        res.status(500).json(
          errorResponse("Fehler beim Aktualisieren der Personalnummer", 500)
        );
      }

    } catch (error) {
      logger.error(`Error updating employee number: ${getErrorMessage(error)}`);
      res.status(500).json(
        errorResponse("Serverfehler beim Aktualisieren der Personalnummer", 500)
      );
    }
  })
);

export default router;

// CommonJS compatibility
