/**
 * Chat API Routes
 * Handles all chat operations including messages, conversations, and file attachments
 * @swagger
 * tags:
 *   name: Chat
 *   description: Real-time messaging and conversations
 */
import express, { Router } from 'express';
import { body, param, query } from 'express-validator';
import multer from 'multer';
import path from 'path';

import chatController from '../controllers/chat.controller';
import { security } from '../middleware/security';
import { createValidation } from '../middleware/validation';
import type {
  ChatUsersRequest,
  CreateConversationRequest,
  GetConversationsRequest,
  GetMessagesRequest,
  SendMessageRequest,
} from '../types/request.types';
import { getUploadDirectory, sanitizeFilename } from '../utils/pathSecurity';
import { typed } from '../utils/routeHandlers';

const router: Router = express.Router();

// Request body interfaces
interface CreateConversationBody {
  participant_ids: number[];
  is_group?: boolean;
  name?: string;
}

interface SendMessageBody {
  message: string;
}

// Validation schemas
const createConversationValidation = createValidation([
  body('participant_ids')
    .isArray({ min: 1 })
    .withMessage('Teilnehmer müssen als Array angegeben werden'),
  body('participant_ids.*').isInt({ min: 1 }).withMessage('Ungültige Teilnehmer-ID'),
  body('is_group').optional().isBoolean(),
  body('name').optional().trim().notEmpty(),
]);

const sendMessageValidation = createValidation([
  param('id').isInt({ min: 1 }).withMessage('Ungültige Konversations-ID'),
  body('message').notEmpty().trim().withMessage('Nachricht darf nicht leer sein'),
]);

const getMessagesValidation = createValidation([
  param('id').isInt({ min: 1 }).withMessage('Ungültige Konversations-ID'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
]);

const searchUsersValidation = createValidation([query('search').optional().trim()]);

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadPath = getUploadDirectory('chat');
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const sanitized = sanitizeFilename(file.originalname);
    const ext = path.extname(sanitized);
    const uniqueSuffix = `${String(Date.now())}-${String(Math.round(Math.random() * 1e9))}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
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

/**
 * @swagger
 * /chat/users:
 *   get:
 *     summary: Get available chat users
 *     description: Retrieve list of users available for chat within the tenant
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by username or name
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       username:
 *                         type: string
 *                       first_name:
 *                         type: string
 *                       last_name:
 *                         type: string
 *                       role:
 *                         type: string
 *                       is_online:
 *                         type: boolean
 *                       last_seen:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Routes with controller methods
router.get(
  '/users',
  ...security.user(searchUsersValidation),
  typed.auth(async (req, res) => {
    await chatController.getUsers(req as ChatUsersRequest, res);
  }),
);

/**
 * @swagger
 * /chat/conversations:
 *   get:
 *     summary: Get user conversations
 *     description: Retrieve all conversations for the authenticated user
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Conversations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 conversations:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Conversation'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/conversations',
  ...security.user(),
  typed.auth(async (req, res) => {
    await chatController.getConversations(req as GetConversationsRequest, res);
  }),
);

/**
 * @swagger
 * /chat/conversations:
 *   post:
 *     summary: Create new conversation
 *     description: Create a new chat conversation with one or more participants
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - participants
 *             properties:
 *               participants:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array of user IDs to include in conversation
 *                 example: [2, 3, 4]
 *               name:
 *                 type: string
 *                 description: Optional conversation name (for group chats)
 *                 example: Project Team Chat
 *     responses:
 *       201:
 *         description: Conversation created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Konversation erfolgreich erstellt
 *                 conversation:
 *                   $ref: '#/components/schemas/Conversation'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/conversations',
  ...security.user(createConversationValidation),
  typed.body<CreateConversationBody>(async (req, res) => {
    await chatController.createConversation(req as CreateConversationRequest, res);
  }),
);
/**
 * @swagger
 * /chat/conversations/{id}/messages:
 *   get:
 *     summary: Get messages from conversation
 *     description: Retrieve all messages from a specific conversation
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Conversation ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Messages per page
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ChatMessage'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationInfo'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Not a participant in this conversation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Sie sind kein Teilnehmer dieser Konversation
 *       404:
 *         description: Conversation not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Konversation nicht gefunden
 */
router.get(
  '/conversations/:id/messages',
  ...security.user(getMessagesValidation),
  typed.params<{ id: string }>(async (req, res) => {
    await chatController.getMessages(req as GetMessagesRequest, res);
  }),
);
/**
 * @swagger
 * /chat/conversations/{id}/messages:
 *   post:
 *     summary: Send message to conversation
 *     description: Send a new message to a conversation with optional file attachment
 *     tags: [Chat]
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
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: Message content
 *                 example: Hallo, wie geht es dir?
 *               attachment:
 *                 type: string
 *                 format: binary
 *                 description: Optional file attachment (max 10MB)
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: Message content
 *                 example: Hallo, wie geht es dir?
 *     responses:
 *       201:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Nachricht erfolgreich gesendet
 *                 data:
 *                   $ref: '#/components/schemas/ChatMessage'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Not a participant in this conversation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Sie sind kein Teilnehmer dieser Konversation
 *       404:
 *         description: Conversation not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Konversation nicht gefunden
 *       413:
 *         description: File too large
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Dateityp nicht erlaubt
 */
router.post(
  '/conversations/:id/messages',
  ...security.user(sendMessageValidation),
  upload.single('attachment'),
  typed.paramsBody<{ id: string }, SendMessageBody>(async (req, res) => {
    await chatController.sendMessage(req as SendMessageRequest, res);
  }),
);
/**
 * @swagger
 * /chat/attachments/{filename}:
 *   get:
 *     summary: Download chat attachment
 *     description: Download a file attachment from a chat message
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: Attachment filename
 *       - in: query
 *         name: download
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Force download instead of inline display
 *     responses:
 *       200:
 *         description: File content
 *         content:
 *           image/jpeg:
 *             schema:
 *               type: string
 *               format: binary
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *           image/gif:
 *             schema:
 *               type: string
 *               format: binary
 *           image/webp:
 *             schema:
 *               type: string
 *               format: binary
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *           text/plain:
 *             schema:
 *               type: string
 *               format: binary
 *           application/msword:
 *             schema:
 *               type: string
 *               format: binary
 *           application/vnd.openxmlformats-officedocument.wordprocessingml.document:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Disposition:
 *             schema:
 *               type: string
 *               example: attachment; filename="document.pdf"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - No access to this file
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Kein Zugriff auf diese Datei
 *       404:
 *         description: File not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Datei nicht gefunden
 */
router.get(
  '/attachments/:filename',
  ...security.user(
    createValidation([param('filename').notEmpty().withMessage('Dateiname erforderlich')]),
  ),
  typed.params<{ filename: string }>(async (req, res) => {
    await chatController.downloadFile(req, res);
  }),
);
// TODO: Implement these routes when controller methods are ready
// router.put('/messages/:id/read', ...security.user(), chatController.markAsRead);
// router.get('/work-schedules', ...security.user(), chatController.getWorkSchedules);
// router.delete('/messages/:id', ...security.user(), chatController.deleteMessage);
/**
 * @swagger
 * /chat/unread-count:
 *   get:
 *     summary: Get unread message count
 *     description: Get the total number of unread messages for the authenticated user
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 unreadCount:
 *                   type: integer
 *                   description: Total number of unread messages
 *                   example: 5
 *                 conversations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       conversationId:
 *                         type: integer
 *                       unreadCount:
 *                         type: integer
 *                       lastMessage:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/unread-count',
  ...security.user(),
  typed.auth(async (req, res) => {
    await chatController.getUnreadCount(req, res);
  }),
);
/**
 * @swagger
 * /chat/conversations/{id}/read:
 *   post:
 *     summary: Mark conversation as read
 *     description: Mark all messages in a conversation as read
 *     tags: [Chat]
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
 *         description: Conversation marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Konversation als gelesen markiert
 *                 markedCount:
 *                   type: integer
 *                   description: Number of messages marked as read
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Not a participant in this conversation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Sie sind kein Teilnehmer dieser Konversation
 *       404:
 *         description: Conversation not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Konversation nicht gefunden
 */
router.post(
  '/conversations/:id/read',
  ...security.user(
    createValidation([param('id').isInt({ min: 1 }).withMessage('Ungültige Konversations-ID')]),
  ),
  typed.params<{ id: string }>(async (req, res) => {
    await chatController.markConversationAsRead(req, res);
  }),
);
// TODO: Implement when controller method is ready
// router.put('/messages/:id/archive', ...security.user(), chatController.archiveMessage);
/**
 * @swagger
 * /chat/conversations/{id}:
 *   delete:
 *     summary: Delete conversation
 *     description: Delete a conversation (admin only or if you're the only participant)
 *     tags: [Chat]
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
 *         description: Conversation deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Konversation erfolgreich gelöscht
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Cannot delete this conversation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Sie können diese Konversation nicht löschen
 *       404:
 *         description: Conversation not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Konversation nicht gefunden
 */
router.delete(
  '/conversations/:id',
  ...security.user(
    createValidation([param('id').isInt({ min: 1 }).withMessage('Ungültige Konversations-ID')]),
  ),
  typed.params<{ id: string }>(async (req, res) => {
    await chatController.deleteConversation(req, res);
  }),
);

export default router;

// CommonJS compatibility
