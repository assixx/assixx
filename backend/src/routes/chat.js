const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const chatController = require('../controllers/chat.controller');
const { authenticateToken } = require('../middleware/auth');

// Multer-Konfiguration für Datei-Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads/chat');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
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
  fileFilter: (req, file, cb) => {
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
      cb(new Error('Dateityp nicht erlaubt'), false);
    }
  },
});

// Routen mit Controller-Methoden
router.get('/users', authenticateToken, chatController.getUsers);
router.get(
  '/conversations',
  authenticateToken,
  chatController.getConversations
);
router.post(
  '/conversations',
  authenticateToken,
  chatController.createConversation
);
router.get(
  '/conversations/:id/messages',
  authenticateToken,
  chatController.getMessages
);
router.post(
  '/conversations/:id/messages',
  authenticateToken,
  upload.single('attachment'),
  chatController.sendMessage
);
router.get(
  '/attachments/:filename',
  authenticateToken,
  chatController.getAttachment
);
router.put('/messages/:id/read', authenticateToken, chatController.markAsRead);
router.get(
  '/work-schedules',
  authenticateToken,
  chatController.getWorkSchedules
);
router.delete('/messages/:id', authenticateToken, chatController.deleteMessage);
router.get('/unread-count', authenticateToken, chatController.getUnreadCount);
router.put(
  '/messages/:id/archive',
  authenticateToken,
  chatController.archiveMessage
);
router.delete(
  '/conversations/:id',
  authenticateToken,
  chatController.deleteConversation
);

module.exports = router;
