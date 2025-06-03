/**
 * User Profile API Routes
 */

import express, { Router, Request } from "express";
import path from "path";
import fs from "fs";
import { authenticateToken } from "../middleware/auth";
import multer from "multer";

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
  file?: Express.Multer.File;
}

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'profile-pictures');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
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
  // Accept only specific image formats
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Nur JPEG, PNG, GIF und WebP Formate sind erlaubt!'));
  }
};

const upload = multer({
  storage,
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1 // Only one file at a time
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
    const user = await User.findById(authReq.user.id, authReq.user.tenant_id);

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
    const authReq = req as AuthenticatedRequest;
    const { id } = authReq.user;
    const updates = { ...req.body };

    // Don't allow updating critical fields
    if ("id" in updates) delete updates.id;
    if ("username" in updates) delete updates.username;
    if ("role" in updates) delete updates.role;
    if ("password" in updates) delete updates.password;
    if ("created_at" in updates) delete updates.created_at;

    const result = await User.update(id, updates);

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
      const user = await User.findById(authReq.user.id, authReq.user.tenant_id);

      if (!user || !user.profile_picture) {
        res.status(404).json({ message: "Profile picture not found" });
        return;
      }

      // Send the profile picture file
      const filePath = path.join(
        process.cwd(),
        user.profile_picture.startsWith('/') ? user.profile_picture.substring(1) : user.profile_picture,
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
      if (user && user.profile_picture_url) {
        const oldFilePath = path.join(
          process.cwd(),
          user.profile_picture_url.startsWith('/') ? user.profile_picture_url.substring(1) : user.profile_picture_url,
        );
        try {
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
          }
        } catch (unlinkError: any) {
          console.warn("Could not delete old profile picture:", unlinkError.message);
        }
      }

      // Update user's profile picture URL in database
      const success = await User.update(userId, {
        profile_picture: profilePictureUrl,
      });

      if (success) {
        res.json({
          message: "Profilbild erfolgreich hochgeladen",
          profilePicture: profilePictureUrl,
        });
      } else {
        // Clean up uploaded file if database update failed
        fs.unlinkSync(authReq.file.path);
        res.status(500).json({ message: "Fehler beim Speichern des Profilbildes" });
      }
    } catch (error: any) {
      console.error("Error uploading profile picture:", error);
      
      // Clean up uploaded file on error
      if ((req as AuthenticatedRequest).file) {
        try {
          fs.unlinkSync((req as AuthenticatedRequest).file!.path);
        } catch (unlinkError: any) {
          console.error("Error deleting temporary file:", unlinkError.message);
        }
      }
      
      res.status(500).json({
        message: error.message || "Fehler beim Hochladen des Profilbildes",
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
      if (user.profile_picture_url) {
        const filePath = path.join(
          process.cwd(),
          user.profile_picture_url.startsWith('/') ? user.profile_picture_url.substring(1) : user.profile_picture_url,
        );
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (unlinkError: any) {
          console.warn("Could not delete profile picture file:", unlinkError.message);
        }
      }

      // Remove profile picture URL from database
      const success = await User.update(userId, { 
        profile_picture: undefined 
      });

      if (success) {
        res.json({ message: "Profilbild erfolgreich gelöscht" });
      } else {
        res.status(500).json({ message: "Fehler beim Löschen des Profilbildes" });
      }
    } catch (error: any) {
      console.error("Error deleting profile picture:", error);
      res.status(500).json({
        message: "Fehler beim Löschen des Profilbildes",
      });
    }
  },
);

export default router;

// CommonJS compatibility
