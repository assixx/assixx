/**
 * User Profile API Routes
 */

import fs from "fs";
import path from "path";

import express, { Router } from "express";
import multer from "multer";
import { RowDataPacket } from "mysql2";

const router: Router = express.Router();

import { authenticateToken } from "../middleware/auth-refactored";
import { rateLimiter } from "../middleware/rateLimiter";
import User from "../models/user";
import type { AuthenticatedRequest } from "../types/request.types";
import { query as executeQuery } from "../utils/db";
import { getErrorMessage } from "../utils/errorHandler";
import {
  validatePath,
  sanitizeFilename,
  getUploadDirectory,
  safeDeleteFile,
} from "../utils/pathSecurity";
/**
 * User Profile API Routes
 */

// Import models and database
// Allowed fields for user profile update
interface UserUpdateFields {
  email?: string;
  company?: string;
  notes?: string;
  first_name?: string;
  last_name?: string;
  age?: number;
  iban?: string;
  department_id?: number;
  position?: string;
  phone?: string;
  landline?: string;
  employee_number?: string;
  address?: string;
  birthday?: Date;
  hire_date?: Date;
  emergency_contact?: string;
  profile_picture?: string;
  availability_status?: "available" | "unavailable" | "vacation" | "sick";
}

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = getUploadDirectory("profile_pictures");
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const sanitized = sanitizeFilename(file.originalname);
    const extension = path.extname(sanitized);
    const uniqueSuffix = `${String(Date.now())}-${String(Math.round(Math.random() * 1e9))}`;
    cb(null, `profile-${uniqueSuffix}${extension}`);
  },
});

const fileFilter = (
  _req: unknown,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  // Accept only specific image formats
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Nur JPEG, PNG, GIF und WebP Formate sind erlaubt!"));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1, // Only one file at a time
  },
  fileFilter,
});

// Removed unused interfaces - UserProfileRequest, UserProfileUpdateRequest, UserProfilePictureRequest

/**
 * @route GET /api/user/profile
 * @desc Get user profile
 * @access Private
 */
router.get("/profile", authenticateToken, async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;

    // Validate user ID exists
    if (!authReq.user?.id || !authReq.user.tenant_id) {
      res.status(401).json({ message: "Nicht autorisiert" });
      return;
    }

    const userId = parseInt(authReq.user.id.toString());
    const tenantId = parseInt(authReq.user.tenant_id.toString());

    // Check for valid IDs
    if (isNaN(userId) || isNaN(tenantId)) {
      res.status(400).json({ message: "Ungültige Benutzer-ID" });
      return;
    }

    const user = await User.findById(userId, tenantId);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Get department information if available
    let departmentInfo = null;
    if (user.department_id != null && user.department_id !== 0) {
      // Verwende db statt req.tenantDb
      const [departments] = await executeQuery<RowDataPacket[]>(
        "SELECT * FROM departments WHERE id = ?",
        [user.department_id],
      );

      if (departments.length > 0) {
        departmentInfo = departments[0];
      }
    }

    // Get team information if available
    let teamInfo = null;
    if (user.team_id != null && user.team_id !== 0) {
      // Verwende db statt req.tenantDb
      const [teams] = await executeQuery<RowDataPacket[]>(
        "SELECT * FROM teams WHERE id = ?",
        [user.team_id],
      );

      if (teams.length > 0) {
        teamInfo = teams[0];
      }
    }

    // Get tenant information
    let tenantInfo = null;
    if (user.tenant_id != null && user.tenant_id !== 0) {
      const [tenants] = await executeQuery<RowDataPacket[]>(
        "SELECT * FROM tenants WHERE id = ?",
        [user.tenant_id],
      );

      if (tenants.length > 0) {
        tenantInfo = tenants[0];
      }
    }

    // Remove sensitive information
    const { password: _password, ...userWithoutPassword } = user;

    res.json({
      ...userWithoutPassword,
      department: departmentInfo ? (departmentInfo.name as string) : null,
      departmentId: user.department_id,
      team: teamInfo ? (teamInfo.name as string) : null,
      teamId: user.team_id as number | null,
      company_name: tenantInfo ? (tenantInfo.company_name as string) : null,
      subdomain: tenantInfo ? (tenantInfo.subdomain as string) : null,
    });
  } catch (error: unknown) {
    console.error("Error fetching user profile:", getErrorMessage(error));
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
    const authReq = req as AuthenticatedRequest;
    const { id } = authReq.user;
    const updates = { ...(req.body as UserUpdateFields) };

    // Don't allow updating critical fields
    if ("id" in updates) delete updates.id;
    if ("username" in updates) delete updates.username;
    if ("role" in updates) delete updates.role;
    if ("password" in updates) delete updates.password;
    if ("created_at" in updates) delete updates.created_at;

    const result = await User.update(id, updates, authReq.user.tenant_id);

    if (result) {
      const updatedUser = await User.findById(id, authReq.user.tenant_id);
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
  } catch (error: unknown) {
    console.error("Error updating user profile:", getErrorMessage(error));
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
  rateLimiter.download,
  async (req, res): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = await User.findById(authReq.user.id, authReq.user.tenant_id);

      if (user?.profile_picture == null || user.profile_picture === "") {
        res.status(404).json({ message: "Profile picture not found" });
        return;
      }

      // Validate and send the profile picture file
      const baseDir = path.join(process.cwd(), "uploads");
      const profilePicPath = user.profile_picture.startsWith("/")
        ? user.profile_picture.substring(1)
        : user.profile_picture;

      // Remove 'uploads/' prefix if present
      const relativePath = profilePicPath.startsWith("uploads/")
        ? profilePicPath.substring(8)
        : profilePicPath;

      const validatedPath = validatePath(relativePath, baseDir);

      if (validatedPath == null || validatedPath === "") {
        res.status(400).json({ message: "Invalid file path" });
        return;
      }

      if (fs.existsSync(validatedPath)) {
        res.sendFile(validatedPath);
      } else {
        res.status(404).json({ message: "Profile picture file not found" });
      }
    } catch (error: unknown) {
      console.error("Error fetching profile picture:", getErrorMessage(error));
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

/**
 * @route POST /api/user/profile-picture
 * @desc Upload user profile picture
 * @access Private
 */
router.post(
  "/profile-picture",
  authenticateToken,
  upload.single("profilePicture"),
  async (req, res): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;

      if (!authReq.file) {
        res.status(400).json({ message: "Keine Datei hochgeladen" });
        return;
      }

      const userId = authReq.user.id;
      const fileName = authReq.file.filename;
      const profilePictureUrl = `/uploads/profile-pictures/${fileName}`;

      // Get current user to delete old profile picture
      const user = await User.findById(userId, authReq.user.tenant_id);

      // Delete old profile picture if it exists
      if (
        user?.profile_picture_url != null &&
        user.profile_picture_url !== ""
      ) {
        const oldFilePath = path.join(
          process.cwd(),
          typeof user.profile_picture_url === "string" &&
            user.profile_picture_url.startsWith("/")
            ? user.profile_picture_url.substring(1)
            : String(user.profile_picture_url),
        );
        try {
          await safeDeleteFile(oldFilePath);
        } catch (unlinkError: unknown) {
          console.warn(
            "Could not delete old profile picture:",
            getErrorMessage(unlinkError),
          );
        }
      }

      // Update user's profile picture URL in database
      const success = await User.update(
        userId,
        {
          profile_picture: profilePictureUrl,
        },
        authReq.user.tenant_id,
      );

      if (success) {
        res.json({
          message: "Profilbild erfolgreich hochgeladen",
          profilePicture: profilePictureUrl,
        });
      } else {
        // Clean up uploaded file if database update failed
        await safeDeleteFile(authReq.file.path);
        res
          .status(500)
          .json({ message: "Fehler beim Speichern des Profilbildes" });
      }
    } catch (error: unknown) {
      console.error("Error uploading profile picture:", getErrorMessage(error));

      // Clean up uploaded file on error
      const authenticatedReq = req as AuthenticatedRequest;
      if (
        authenticatedReq.file?.path != null &&
        authenticatedReq.file.path !== ""
      ) {
        try {
          await safeDeleteFile(authenticatedReq.file.path);
        } catch (unlinkError: unknown) {
          console.error(
            "Error deleting temporary file:",
            getErrorMessage(unlinkError),
          );
        }
      }

      res.status(500).json({
        message:
          getErrorMessage(error) ?? "Fehler beim Hochladen des Profilbildes",
      });
    }
  },
);

/**
 * @route DELETE /api/user/profile-picture
 * @desc Delete user profile picture
 * @access Private
 */
router.delete(
  "/profile-picture",
  authenticateToken,
  async (req, res): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;

      // Get current user to find existing profile picture
      const user = await User.findById(userId, authReq.user.tenant_id);
      if (!user) {
        res.status(404).json({ message: "Benutzer nicht gefunden" });
        return;
      }

      // Delete profile picture file if it exists
      if (user.profile_picture_url != null && user.profile_picture_url !== "") {
        const filePath = path.join(
          process.cwd(),
          typeof user.profile_picture_url === "string" &&
            user.profile_picture_url.startsWith("/")
            ? user.profile_picture_url.substring(1)
            : String(user.profile_picture_url),
        );
        try {
          await safeDeleteFile(filePath);
        } catch (unlinkError: unknown) {
          console.warn(
            "Could not delete profile picture file:",
            getErrorMessage(unlinkError),
          );
        }
      }

      // Remove profile picture URL from database
      const success = await User.update(
        userId,
        {
          profile_picture: undefined,
        },
        authReq.user.tenant_id,
      );

      if (success) {
        res.json({ message: "Profilbild erfolgreich gelöscht" });
      } else {
        res
          .status(500)
          .json({ message: "Fehler beim Löschen des Profilbildes" });
      }
    } catch (error: unknown) {
      console.error("Error deleting profile picture:", getErrorMessage(error));
      res.status(500).json({
        message: "Fehler beim Löschen des Profilbildes",
      });
    }
  },
);

export default router;

// CommonJS compatibility
