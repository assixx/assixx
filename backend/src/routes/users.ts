/**
 * Users API Routes
 * Handles user profile operations and profile picture uploads
 */

import express, { Router, Request } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { authenticateToken } from '../auth';
import { logger } from '../utils/logger';

// Import User model (keeping require pattern for compatibility)
import User from '../models/user';

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
  '/',
  authenticateToken as any,
  async (req: any, res: any): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;

      // Check if user is admin or root
      if (authReq.user.role !== 'admin' && authReq.user.role !== 'root') {
        res.status(403).json({ message: 'Access denied' });
        return;
      }

      const users = await User.findAllByTenant(authReq.user.tenant_id);

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
      }));

      res.json(sanitizedUsers);
    } catch (error: any) {
      logger.error('Error fetching users:', error);
      res.status(500).json({
        message: 'Error fetching users',
        error: error.message,
      });
    }
  }
);

// Get logged-in user's profile data
router.get(
  '/profile',
  authenticateToken as any,
  async (req: any, res: any): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = await User.findById(authReq.user.id);
      if (!user) {
        res.status(404).json({ message: 'Benutzer nicht gefunden' });
        return;
      }

      // Remove password from response
      const { password, ...userProfile } = user;

      logger.info(`User ${authReq.user.id} retrieved their profile`);
      res.json(userProfile);
    } catch (error: any) {
      logger.error(
        `Error retrieving profile for user ${(req as AuthenticatedRequest).user.id}: ${error.message}`
      );
      res.status(500).json({
        message: 'Fehler beim Abrufen des Profils',
        error: error.message,
      });
    }
  }
);

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
  destination(_req: any, _file: any, cb: any) {
    cb(null, 'uploads/profile_pictures/');
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
  cb: multer.FileFilterCallback
) => {
  // Accept only images
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Nur Bildformate sind erlaubt!'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter,
});

// Update user profile
router.put(
  '/profile',
  authenticateToken as any,
  async (req: any, res: any): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;
      const updateData = req.body;

      // Validate email if provided
      if (updateData.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(updateData.email)) {
          res.status(400).json({ message: 'Ungültige E-Mail-Adresse' });
          return;
        }
      }

      const success = await User.update(userId, updateData);

      if (success) {
        logger.info(`User ${userId} updated their profile`);
        res.json({ message: 'Profil erfolgreich aktualisiert' });
      } else {
        res
          .status(500)
          .json({ message: 'Fehler beim Aktualisieren des Profils' });
      }
    } catch (error: any) {
      logger.error(
        `Error updating profile for user ${(req as AuthenticatedRequest).user.id}: ${error.message}`
      );
      res.status(500).json({
        message: 'Fehler beim Aktualisieren des Profils',
        error: error.message,
      });
    }
  }
);

// Upload profile picture
router.post(
  '/profile/picture',
  authenticateToken as any,
  upload.single('profilePicture'),
  async (req: any, res: any): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      if (!req.file) {
        res.status(400).json({ message: 'Keine Datei hochgeladen' });
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
          message: 'Profilbild erfolgreich hochgeladen',
          profilePictureUrl: filePath,
        });
      } else {
        // Clean up uploaded file if database update failed
        await fs.unlink(req.file.path);
        res
          .status(500)
          .json({ message: 'Fehler beim Speichern des Profilbildes' });
      }
    } catch (error: any) {
      logger.error(
        `Error uploading profile picture for user ${(req as AuthenticatedRequest).user.id}: ${error.message}`
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
        message: 'Fehler beim Hochladen des Profilbildes',
        error: error.message,
      });
    }
  }
);

// Delete profile picture
router.delete(
  '/profile/picture',
  authenticateToken as any,
  async (req: any, res: any): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;

      // Get current user to find existing profile picture
      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({ message: 'Benutzer nicht gefunden' });
        return;
      }

      // Delete old profile picture file if it exists
      if (user.profile_picture_url) {
        const oldFilePath = path.join(
          __dirname,
          '..',
          '..',
          user.profile_picture_url
        );
        try {
          await fs.unlink(oldFilePath);
        } catch (unlinkError: any) {
          logger.warn(
            `Could not delete old profile picture file: ${unlinkError.message}`
          );
        }
      }

      // Remove profile picture URL from database
      const success = await User.update(userId, { profile_picture: undefined });

      if (success) {
        logger.info(`User ${userId} deleted their profile picture`);
        res.json({ message: 'Profilbild erfolgreich gelöscht' });
      } else {
        res
          .status(500)
          .json({ message: 'Fehler beim Löschen des Profilbildes' });
      }
    } catch (error: any) {
      logger.error(
        `Error deleting profile picture for user ${(req as AuthenticatedRequest).user.id}: ${error.message}`
      );
      res.status(500).json({
        message: 'Fehler beim Löschen des Profilbildes',
        error: error.message,
      });
    }
  }
);

// Change password
router.put(
  '/profile/password',
  authenticateToken as any,
  async (req: any, res: any): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        res
          .status(400)
          .json({ message: 'Aktuelles und neues Passwort sind erforderlich' });
        return;
      }

      if (newPassword.length < 6) {
        res.status(400).json({
          message: 'Neues Passwort muss mindestens 6 Zeichen lang sein',
        });
        return;
      }

      const userId = authReq.user.id;

      // Verify current password and update to new password
      const success = await User.changePassword(
        userId,
        currentPassword,
        newPassword
      );

      if (success) {
        logger.info(`User ${userId} changed their password`);
        res.json({ message: 'Passwort erfolgreich geändert' });
      } else {
        res.status(400).json({ message: 'Aktuelles Passwort ist ungültig' });
      }
    } catch (error: any) {
      logger.error(
        `Error changing password for user ${(req as AuthenticatedRequest).user.id}: ${error.message}`
      );
      res.status(500).json({
        message: 'Fehler beim Ändern des Passworts',
        error: error.message,
      });
    }
  }
);

export default router;

// CommonJS compatibility
