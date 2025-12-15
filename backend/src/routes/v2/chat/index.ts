/**
 * Chat API v2 Routes
 * Real-time messaging and conversations with improved standards
 * Updated 2025-12-03: Added document-based attachment system
 */
import express, { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import path from 'path';

import { authenticateV2 as authenticateToken } from '../../../middleware/v2/auth.middleware.js';
import type { AuthenticatedRequest } from '../../../types/request.types.js';
import { getUploadDirectory, sanitizeFilename } from '../../../utils/pathSecurity.js';
import { typed } from '../../../utils/routeHandlers.js';
import chatController from './chat.controller.js';
import { chatValidation } from './chat.validation.zod.js';

const router: Router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (
    _req: Request,
    _file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void,
  ) => {
    cb(null, getUploadDirectory('chat'));
  },
  filename: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void,
  ) => {
    const sanitized = sanitizeFilename(file.originalname);
    const ext = path.extname(sanitized);
    const uniqueSuffix = `${String(Date.now())}-${String(Math.round(Math.random() * 1e9))}`;
    cb(null, `chat-${uniqueSuffix}${ext}`);
  },
});

// Allowed MIME types for chat attachments
const ALLOWED_ATTACHMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

// Legacy upload (disk storage) - for backward compatibility
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (ALLOWED_ATTACHMENT_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
});

// Document-based upload (memory storage) - for new attachment system
// Uses buffer to calculate checksum and store via document system
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (ALLOWED_ATTACHMENT_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
});

/**

 * /api/v2/chat/users:
 *   get:
 *     summary: Get available chat users
 *     tags: [Chat v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, username, or email
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 */
router.get(
  '/users',
  chatValidation.getUsers,
  typed.auth((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    void chatController.getChatUsers(req, res, next);
  }),
);

/**

 * /api/v2/chat/conversations:
 *   get:
 *     summary: Get user's conversations
 *     tags: [Chat v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/SearchParam'
 *       - in: query
 *         name: isGroup
 *         schema:
 *           type: boolean
 *         description: Filter by group conversations
 *       - in: query
 *         name: hasUnread
 *         schema:
 *           type: boolean
 *         description: Filter conversations with unread messages
 *     responses:
 *       200:
 *         description: Conversations retrieved successfully
 */
router.get(
  '/conversations',
  chatValidation.getConversations,
  typed.auth((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    void chatController.getConversations(req, res, next);
  }),
);

/**

 * /api/v2/chat/conversations:
 *   post:
 *     summary: Create a new conversation
 *     tags: [Chat v2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - participantIds
 *             properties:
 *               participantIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array of user IDs to include
 *               name:
 *                 type: string
 *                 description: Conversation name (for groups)
 *               isGroup:
 *                 type: boolean
 *                 description: Force group conversation
 *     responses:
 *       201:
 *         description: Conversation created successfully
 */
router.post(
  '/conversations',
  chatValidation.createConversation,
  typed.auth((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    void chatController.createConversation(req, res, next);
  }),
);

/**

 * /api/v2/chat/conversations/\{id\}:
 *   get:
 *     summary: Get conversation details
 *     tags: [Chat v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Conversation ID
 *     responses:
 *       200:
 *         description: Conversation retrieved successfully
 */
router.get(
  '/conversations/:id',
  chatValidation.getConversation,
  typed.auth((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    void chatController.getConversation(req, res, next);
  }),
);

/**

 * /api/v2/chat/conversations/\{id\}:
 *   put:
 *     summary: Update conversation
 *     tags: [Chat v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Conversation updated successfully
 */
router.put(
  '/conversations/:id',
  ...chatValidation.updateConversation,
  typed.auth((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    chatController.updateConversation(req, res, next);
  }),
);

/**

 * /api/v2/chat/conversations/\{id\}:
 *   delete:
 *     summary: Delete conversation
 *     tags: [Chat v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Conversation deleted successfully
 */
router.delete(
  '/conversations/:id',
  chatValidation.deleteConversation,
  typed.auth((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    void chatController.deleteConversation(req, res, next);
  }),
);

/**

 * /api/v2/chat/conversations/\{id\}/messages:
 *   get:
 *     summary: Get messages from conversation
 *     tags: [Chat v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/SearchParam'
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: hasAttachment
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 */
router.get(
  '/conversations/:id/messages',
  chatValidation.getMessages,
  typed.auth((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    void chatController.getMessages(req, res, next);
  }),
);

/**

 * /api/v2/chat/conversations/\{id\}/messages:
 *   post:
 *     summary: Send message to conversation
 *     tags: [Chat v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 description: Message content
 *               attachment:
 *                 type: string
 *                 format: binary
 *                 description: Optional file attachment
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *     responses:
 *       201:
 *         description: Message sent successfully
 */
router.post(
  '/conversations/:id/messages',
  upload.single('attachment'),
  chatValidation.sendMessage,
  typed.auth((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    void chatController.sendMessage(req, res, next);
  }),
);

/**

 * /api/v2/chat/messages/\{id\}:
 *   put:
 *     summary: Edit a message
 *     tags: [Chat v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Message updated successfully
 */
router.put(
  '/messages/:id',
  ...chatValidation.editMessage,
  typed.auth((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    chatController.editMessage(req, res, next);
  }),
);

/**

 * /api/v2/chat/messages/\{id\}:
 *   delete:
 *     summary: Delete a message
 *     tags: [Chat v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Message deleted successfully
 */
router.delete(
  '/messages/:id',
  chatValidation.deleteMessage,
  typed.auth((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    chatController.deleteMessage(req, res, next);
  }),
);

/**

 * /api/v2/chat/conversations/\{id\}/read:
 *   post:
 *     summary: Mark conversation as read
 *     tags: [Chat v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Conversation marked as read
 */
router.post(
  '/conversations/:id/read',
  chatValidation.markAsRead,
  typed.auth((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    void chatController.markAsRead(req, res, next);
  }),
);

/**
 * /api/v2/chat/conversations/\{id\}/scheduled-messages:
 *   get:
 *     summary: Get pending scheduled messages for a conversation
 *     tags: [Chat v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Scheduled messages retrieved successfully
 */
router.get(
  '/conversations/:id/scheduled-messages',
  chatValidation.getConversationScheduledMessages,
  typed.auth((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    void chatController.getConversationScheduledMessages(req, res, next);
  }),
);

/**

 * /api/v2/chat/unread-count:
 *   get:
 *     summary: Get unread message count
 *     tags: [Chat v2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count retrieved successfully
 */
router.get(
  '/unread-count',
  typed.auth((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    void chatController.getUnreadCount(req, res, next);
  }),
);

/**

 * /api/v2/chat/attachments/\{filename\}:
 *   get:
 *     summary: Download chat attachment
 *     tags: [Chat v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: download
 *         schema:
 *           type: boolean
 *         description: Force download instead of inline
 *     responses:
 *       200:
 *         description: File content
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get(
  '/attachments/:filename',
  chatValidation.downloadAttachment,
  typed.auth((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    void chatController.downloadAttachment(req, res, next);
  }),
);

/**

 * /api/v2/chat/conversations/\{id\}/participants:
 *   post:
 *     summary: Add participants to conversation
 *     tags: [Chat v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - participantIds
 *             properties:
 *               participantIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Participants added successfully
 */
router.post(
  '/conversations/:id/participants',
  ...chatValidation.addParticipants,
  typed.auth((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    chatController.addParticipants(req, res, next);
  }),
);

/**

 * /api/v2/chat/conversations/\{id\}/participants/\{userId\}:
 *   delete:
 *     summary: Remove participant from conversation
 *     tags: [Chat v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Participant removed successfully
 */
router.delete(
  '/conversations/:id/participants/:userId',
  chatValidation.removeParticipant,
  typed.auth((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    chatController.removeParticipant(req, res, next);
  }),
);

/**

 * /api/v2/chat/conversations/\{id\}/leave:
 *   post:
 *     summary: Leave conversation
 *     tags: [Chat v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Left conversation successfully
 */
router.post(
  '/conversations/:id/leave',
  chatValidation.leaveConversation,
  typed.auth((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    chatController.leaveConversation(req, res, next);
  }),
);

/**

 * /api/v2/chat/search:
 *   get:
 *     summary: Search messages across all conversations
 *     tags: [Chat v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
 */
router.get(
  '/search',
  chatValidation.searchMessages,
  typed.auth((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    chatController.searchMessages(req, res, next);
  }),
);

// =========================================
// SCHEDULED MESSAGES
// =========================================

/**
 * /api/v2/chat/scheduled-messages:
 *   post:
 *     summary: Create a scheduled message
 *     tags: [Chat v2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - conversationId
 *               - content
 *               - scheduledFor
 *             properties:
 *               conversationId:
 *                 type: integer
 *               content:
 *                 type: string
 *               scheduledFor:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Message scheduled successfully
 */
router.post(
  '/scheduled-messages',
  chatValidation.createScheduledMessage,
  typed.auth((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    void chatController.createScheduledMessage(req, res, next);
  }),
);

/**
 * /api/v2/chat/scheduled-messages:
 *   get:
 *     summary: Get all pending scheduled messages for current user
 *     tags: [Chat v2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Scheduled messages retrieved successfully
 */
router.get(
  '/scheduled-messages',
  typed.auth((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    void chatController.getScheduledMessages(req, res, next);
  }),
);

/**
 * /api/v2/chat/scheduled-messages/\{id\}:
 *   get:
 *     summary: Get a specific scheduled message
 *     tags: [Chat v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Scheduled message retrieved successfully
 */
router.get(
  '/scheduled-messages/:id',
  chatValidation.getScheduledMessage,
  typed.auth((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    void chatController.getScheduledMessage(req, res, next);
  }),
);

/**
 * /api/v2/chat/scheduled-messages/\{id\}:
 *   delete:
 *     summary: Cancel a scheduled message
 *     tags: [Chat v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Scheduled message cancelled successfully
 */
router.delete(
  '/scheduled-messages/:id',
  chatValidation.cancelScheduledMessage,
  typed.auth((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    void chatController.cancelScheduledMessage(req, res, next);
  }),
);

// =========================================
// DOCUMENT-BASED ATTACHMENTS (NEW 2025-12-03)
// =========================================

/**
 * /api/v2/chat/conversations/\{id\}/attachments:
 *   post:
 *     summary: Upload attachment to conversation
 *     tags: [Chat v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Conversation ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Attachment uploaded successfully
 */
router.post(
  '/conversations/:id/attachments',
  documentUpload.single('file'),
  chatValidation.uploadConversationAttachment,
  typed.auth((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    void chatController.uploadConversationAttachment(req, res, next);
  }),
);

/**
 * /api/v2/chat/conversations/\{id\}/attachments:
 *   get:
 *     summary: Get all attachments for a conversation
 *     tags: [Chat v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Conversation ID
 *     responses:
 *       200:
 *         description: Attachments retrieved successfully
 */
router.get(
  '/conversations/:id/attachments',
  chatValidation.getConversationAttachments,
  typed.auth((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    void chatController.getConversationAttachments(req, res, next);
  }),
);

/**
 * /api/v2/chat/attachments/\{fileUuid\}/download:
 *   get:
 *     summary: Download attachment by file UUID
 *     tags: [Chat v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileUuid
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: File UUID
 *       - in: query
 *         name: inline
 *         schema:
 *           type: boolean
 *         description: Display inline instead of download
 *     responses:
 *       200:
 *         description: File content
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get(
  '/attachments/:fileUuid/download',
  chatValidation.downloadAttachmentByUuid,
  typed.auth((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    void chatController.downloadAttachmentByUuid(req, res, next);
  }),
);

/**
 * /api/v2/chat/attachments/\{documentId\}:
 *   delete:
 *     summary: Delete attachment by document ID
 *     tags: [Chat v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Attachment deleted successfully
 */
router.delete(
  '/attachments/:documentId',
  chatValidation.deleteConversationAttachment,
  typed.auth((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    void chatController.deleteConversationAttachment(req, res, next);
  }),
);

export default router;
