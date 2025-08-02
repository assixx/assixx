/**
 * Chat API v2 Routes
 * Real-time messaging and conversations with improved standards
 */

import path from "path";

import express, { Router } from "express";
import { body, param, query } from "express-validator";
import multer from "multer";

import { authenticateV2 as authenticateToken } from "../../../middleware/v2/auth.middleware.js";
import { createValidation } from "../../../middleware/validation.js";
import {
  sanitizeFilename,
  getUploadDirectory,
} from "../../../utils/pathSecurity.js";
import { typed } from "../../../utils/routeHandlers.js";

import chatController from "./chat.controller.js";

const router: Router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Validation schemas
const getUsersValidation = createValidation([
  query("search")
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage("Search term must be at least 2 characters"),
]);

const getConversationsValidation = createValidation([
  query("page").optional().isInt({ min: 1 }).withMessage("Invalid page number"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("search").optional().trim(),
  query("isGroup").optional().isBoolean(),
  query("hasUnread").optional().isBoolean(),
]);

const createConversationValidation = createValidation([
  body("participantIds")
    .isArray({ min: 1 })
    .withMessage("At least one participant is required"),
  body("participantIds.*")
    .isInt({ min: 1 })
    .withMessage("Invalid participant ID"),
  body("name")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Conversation name must be between 1 and 100 characters"),
  body("isGroup").optional().isBoolean(),
]);

const getMessagesValidation = createValidation([
  param("id").isInt({ min: 1 }).withMessage("Invalid conversation ID"),
  query("page").optional().isInt({ min: 1 }).withMessage("Invalid page number"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("search").optional().trim(),
  query("startDate").optional().isISO8601(),
  query("endDate").optional().isISO8601(),
  query("hasAttachment").optional().isBoolean(),
]);

const sendMessageValidation = createValidation([
  param("id").isInt({ min: 1 }).withMessage("Invalid conversation ID"),
  body("message")
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage("Message cannot exceed 5000 characters"),
]);

const conversationIdValidation = createValidation([
  param("id").isInt({ min: 1 }).withMessage("Invalid conversation ID"),
]);

const attachmentValidation = createValidation([
  param("filename").notEmpty().withMessage("Filename is required"),
  query("download").optional().isBoolean(),
]);

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadPath = getUploadDirectory("chat");
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const sanitized = sanitizeFilename(file.originalname);
    const ext = path.extname(sanitized);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `chat-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("File type not allowed"));
    }
  },
});

/**
 * @swagger
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
  "/users",
  getUsersValidation,
  typed.auth(async (req, res, next) => {
    await chatController.getChatUsers(req, res, next);
  }),
);

/**
 * @swagger
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
  "/conversations",
  getConversationsValidation,
  typed.auth(async (req, res, next) => {
    await chatController.getConversations(req, res, next);
  }),
);

/**
 * @swagger
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
  "/conversations",
  createConversationValidation,
  typed.auth(async (req, res, next) => {
    await chatController.createConversation(req, res, next);
  }),
);

/**
 * @swagger
 * /api/v2/chat/conversations/{id}:
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
  "/conversations/:id",
  conversationIdValidation,
  typed.auth(async (req, res, next) => {
    await chatController.getConversation(req, res, next);
  }),
);

/**
 * @swagger
 * /api/v2/chat/conversations/{id}:
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
  "/conversations/:id",
  conversationIdValidation,
  typed.auth(async (req, res, next) => {
    await chatController.updateConversation(req, res, next);
  }),
);

/**
 * @swagger
 * /api/v2/chat/conversations/{id}:
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
  "/conversations/:id",
  conversationIdValidation,
  typed.auth(async (req, res, next) => {
    await chatController.deleteConversation(req, res, next);
  }),
);

/**
 * @swagger
 * /api/v2/chat/conversations/{id}/messages:
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
  "/conversations/:id/messages",
  getMessagesValidation,
  typed.auth(async (req, res, next) => {
    await chatController.getMessages(req, res, next);
  }),
);

/**
 * @swagger
 * /api/v2/chat/conversations/{id}/messages:
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
  "/conversations/:id/messages",
  upload.single("attachment"),
  sendMessageValidation,
  typed.auth(async (req, res, next) => {
    await chatController.sendMessage(req, res, next);
  }),
);

/**
 * @swagger
 * /api/v2/chat/messages/{id}:
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
  "/messages/:id",
  typed.auth(async (req, res, next) => {
    await chatController.editMessage(req, res, next);
  }),
);

/**
 * @swagger
 * /api/v2/chat/messages/{id}:
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
  "/messages/:id",
  typed.auth(async (req, res, next) => {
    await chatController.deleteMessage(req, res, next);
  }),
);

/**
 * @swagger
 * /api/v2/chat/conversations/{id}/read:
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
  "/conversations/:id/read",
  conversationIdValidation,
  typed.auth(async (req, res, next) => {
    await chatController.markAsRead(req, res, next);
  }),
);

/**
 * @swagger
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
  "/unread-count",
  typed.auth(async (req, res, next) => {
    await chatController.getUnreadCount(req, res, next);
  }),
);

/**
 * @swagger
 * /api/v2/chat/attachments/{filename}:
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
  "/attachments/:filename",
  attachmentValidation,
  typed.auth(async (req, res, next) => {
    await chatController.downloadAttachment(req, res, next);
  }),
);

/**
 * @swagger
 * /api/v2/chat/conversations/{id}/participants:
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
  "/conversations/:id/participants",
  conversationIdValidation,
  typed.auth(async (req, res, next) => {
    await chatController.addParticipants(req, res, next);
  }),
);

/**
 * @swagger
 * /api/v2/chat/conversations/{id}/participants/{userId}:
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
  "/conversations/:id/participants/:userId",
  typed.auth(async (req, res, next) => {
    await chatController.removeParticipant(req, res, next);
  }),
);

/**
 * @swagger
 * /api/v2/chat/conversations/{id}/leave:
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
  "/conversations/:id/leave",
  conversationIdValidation,
  typed.auth(async (req, res, next) => {
    await chatController.leaveConversation(req, res, next);
  }),
);

/**
 * @swagger
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
  "/search",
  typed.auth(async (req, res, next) => {
    await chatController.searchMessages(req, res, next);
  }),
);

export default router;
