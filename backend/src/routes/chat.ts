/**
 * Chat API Routes
 * Handles all chat operations including messages, conversations, and file attachments
 */

import express, { Router } from 'express';
import multer from 'multer';
import path from 'path';
import chatController from '../controllers/chat.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = express.Router();

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads/chat');
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(
      null,
      `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`
    );
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Dateityp nicht erlaubt'));
    }
  },
});

// Routes with controller methods
router.get('/users', authenticateToken, chatController.getUsers as any);
router.get(
  '/conversations',
  authenticateToken,
  chatController.getConversations as any
);
router.post(
  '/conversations',
  authenticateToken,
  chatController.createConversation as any
);
router.get(
  '/conversations/:id/messages',
  authenticateToken,
  chatController.getMessages as any
);
router.post(
  '/conversations/:id/messages',
  authenticateToken,
  upload.single('attachment'),
  chatController.sendMessage as any
);
router.get(
  '/attachments/:filename',
  authenticateToken,
  chatController.getAttachment as any
);
router.put(
  '/messages/:id/read',
  authenticateToken,
  chatController.markAsRead as any
);
router.get(
  '/work-schedules',
  authenticateToken,
  chatController.getWorkSchedules as any
);
router.delete(
  '/messages/:id',
  authenticateToken,
  chatController.deleteMessage as any
);
router.get(
  '/unread-count',
  authenticateToken,
  chatController.getUnreadCount as any
);
router.put(
  '/messages/:id/archive',
  authenticateToken,
  chatController.archiveMessage as any
);
router.delete(
  '/conversations/:id',
  authenticateToken,
  chatController.deleteConversation as any
);

export default router;

// CommonJS compatibility
