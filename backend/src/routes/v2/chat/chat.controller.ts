/**
 * Chat Controller v2
 * HTTP request handling for real-time messaging API
 * Updated 2025-12-03: Added document-based attachment system
 */
import { error as logError } from 'console';
import crypto from 'crypto';
import { NextFunction, Response } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { v7 as uuidv7 } from 'uuid';

import type { AuthenticatedRequest } from '../../../types/request.types.js';
import { errorResponse, successResponse } from '../../../utils/apiResponse.js';
import { logger } from '../../../utils/logger.js';
import { getUploadDirectory, validatePath } from '../../../utils/pathSecurity.js';
import { getConversationUuid, isConversationParticipant } from '../documents/document.model.js';
import { documentsService } from '../documents/documents.service.js';
import rootLog from '../logs/logs.service.js';
import {
  createConversation,
  deleteConversation,
  getChatUsers,
  getConversation,
  getConversations,
  getMessages,
  getUnreadCount,
  markConversationAsRead,
  sendMessage,
} from './chat.service.js';
import type {
  ConversationFilters,
  CreateConversationData,
  MessageFilters,
  SendMessageData,
} from './chat.service.js';
import type { CreateScheduledMessageBody } from './chat.validation.zod.js';
import {
  cancelScheduledMessage,
  createScheduledMessage,
  getConversationScheduledMessages,
  getScheduledMessage,
  getUserScheduledMessages,
} from './scheduled-messages.service.js';

// Constants
const NOT_IMPLEMENTED = 'NOT_IMPLEMENTED';
const NOT_IMPLEMENTED_MESSAGE = 'Feature not yet implemented';
const VALIDATION_ERROR = 'VALIDATION_ERROR';
const CONVERSATION_ID_REQUIRED = 'Conversation ID is required';
const USER_AGENT_HEADER = 'user-agent';

interface ChatConversationResult {
  id: number;
  conversationId: number;
  [key: string]: unknown;
}

interface ChatMessageResult {
  id: number;
  messageId: number;
  [key: string]: unknown;
}

/**
 * Helper to parse optional query string as integer with default
 */
function parseIntQuery(value: string | undefined, defaultVal: number): number {
  return value !== undefined && value !== '' ? Number.parseInt(value) : defaultVal;
}

/**
 * Helper to set optional filter property if value exists
 */
function setOptionalFilter(
  filters: Record<string, unknown>,
  key: string,
  value: string | undefined,
  transform?: (v: string) => unknown,
): void {
  if (value !== undefined && value !== '') {
    Object.defineProperty(filters, key, {
      value: transform !== undefined ? transform(value) : value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
}

/**
 *
 */
class ChatController {
  /**
   * Helper function for unimplemented features
   */
  private notImplemented(res: Response, next: NextFunction): void {
    try {
      res.status(501).json(errorResponse(NOT_IMPLEMENTED, NOT_IMPLEMENTED_MESSAGE));
    } catch (error: unknown) {
      next(error);
    }
  }
  /**
   * Get available chat users
   * @param req - The request object
   * @param res - The response object
   * @param next - The next middleware function
   */
  async getChatUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user } = req;
      const tenantId = user.tenant_id;
      const userId = user.id;
      const search = req.query['search'] as string | undefined;

      const users = await getChatUsers(tenantId, userId, search);

      res.json(
        successResponse({
          users,
          total: users.length,
        }),
      );
    } catch (error: unknown) {
      next(error);
    }
  }

  /**
   * Get user's conversations
   * @param req - The request object
   * @param res - The response object
   * @param next - The next middleware function
   */
  async getConversations(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { user } = req;
      const tenantId = user.tenant_id;
      const userId = user.id;

      const pageQuery = req.query['page'] as string | undefined;
      const limitQuery = req.query['limit'] as string | undefined;
      const searchQuery = req.query['search'] as string | undefined;

      const filters: ConversationFilters = {
        hasUnread: req.query['hasUnread'] === 'true',
        page: pageQuery !== undefined && pageQuery !== '' ? Number.parseInt(pageQuery) : 1,
        limit: limitQuery !== undefined && limitQuery !== '' ? Number.parseInt(limitQuery) : 20,
      };

      // Conditionally add optional properties to avoid exactOptionalPropertyTypes error
      if (searchQuery !== undefined && searchQuery !== '') {
        (filters as Record<string, unknown>)['search'] = searchQuery;
      }
      if (req.query['isGroup'] === 'true') {
        (filters as Record<string, unknown>)['isGroup'] = true;
      } else if (req.query['isGroup'] === 'false') {
        (filters as Record<string, unknown>)['isGroup'] = false;
      }

      const result = await getConversations(tenantId, userId, filters);

      res.json(successResponse(result));
    } catch (error: unknown) {
      next(error);
    }
  }

  /**
   * Create a new conversation
   * @param req - The request object
   * @param res - The response object
   * @param next - The next middleware function
   */
  async createConversation(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { user } = req;
      const tenantId = user.tenant_id;
      const userId = user.id;

      // Critical debug logging
      logError('[CRITICAL DEBUG] Controller: user object:', user);
      logError('[CRITICAL DEBUG] Controller: tenantId from user:', tenantId);
      logError('[CRITICAL DEBUG] Controller: userId from user:', userId);

      const body = req.body as {
        participantIds?: number[];
        name?: string;
        isGroup?: boolean;
        initialMessage?: string;
      };
      const data: CreateConversationData = {
        participantIds: body.participantIds ?? [],
      };

      // Conditionally add optional properties to avoid exactOptionalPropertyTypes error
      if (body.name !== undefined) {
        (data as unknown as Record<string, unknown>)['name'] = body.name;
      }
      if (body.isGroup !== undefined) {
        (data as unknown as Record<string, unknown>)['isGroup'] = body.isGroup;
      }
      if (body.initialMessage !== undefined) {
        (data as unknown as Record<string, unknown>)['initialMessage'] = body.initialMessage;
      }

      const result = await createConversation(tenantId, userId, data);

      // Log conversation creation
      const resultTyped = result as unknown as ChatConversationResult;
      const entityId =
        resultTyped.conversationId !== 0 ? resultTyped.conversationId : resultTyped.id;
      await rootLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: 'create',
        entity_type: 'chat_conversation',
        entity_id: entityId,
        details: `Erstellt: ${data.name ?? 'Chat-Unterhaltung'}`,
        new_values: {
          name: data.name,
          is_group: data.isGroup,
          participant_ids: data.participantIds,
          participant_count: data.participantIds.length + 1,
          created_by: user.email,
        },
        ip_address: req.ip ?? req.socket.remoteAddress,
        user_agent: req.get(USER_AGENT_HEADER),
        was_role_switched: false,
      });

      res.status(201).json(successResponse(result));
    } catch (error: unknown) {
      logError('[Chat Controller] createConversation error:', error);
      next(error);
    }
  }

  /**
   * Get messages from a conversation
   * @param req - The request object
   * @param res - The response object
   * @param next - The next middleware function
   */
  async getMessages(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user } = req;
      const tenantId = user.tenant_id;
      const userId = user.id;
      const conversationIdParam = req.params['id'];
      if (conversationIdParam === undefined) {
        res.status(400).json(errorResponse(VALIDATION_ERROR, CONVERSATION_ID_REQUIRED));
        return;
      }
      const conversationId = Number.parseInt(conversationIdParam);

      const filters: MessageFilters = {
        hasAttachment: req.query['hasAttachment'] === 'true',
        page: parseIntQuery(req.query['page'] as string | undefined, 1),
        limit: parseIntQuery(req.query['limit'] as string | undefined, 50),
      };

      // Conditionally add optional properties to avoid exactOptionalPropertyTypes error
      const filtersRecord = filters as Record<string, unknown>;
      setOptionalFilter(filtersRecord, 'search', req.query['search'] as string | undefined);
      setOptionalFilter(
        filtersRecord,
        'startDate',
        req.query['startDate'] as string | undefined,
        (v: string) => new Date(v),
      );
      setOptionalFilter(
        filtersRecord,
        'endDate',
        req.query['endDate'] as string | undefined,
        (v: string) => new Date(v),
      );

      const result = await getMessages(tenantId, conversationId, userId, filters);

      res.json(successResponse(result));
    } catch (error: unknown) {
      next(error);
    }
  }

  /**
   * Send a message to a conversation
   * @param req - The request object
   * @param res - The response object
   * @param next - The next middleware function
   */
  async sendMessage(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user } = req;
      const tenantId = user.tenant_id;
      const userId = user.id;
      const conversationIdParam = req.params['id'];
      if (conversationIdParam === undefined) {
        res.status(400).json(errorResponse(VALIDATION_ERROR, CONVERSATION_ID_REQUIRED));
        return;
      }
      const conversationId = Number.parseInt(conversationIdParam);

      const body = req.body as { message?: string; content?: string };
      const data: SendMessageData = {
        content: body.message ?? body.content ?? '',
      };

      // Handle file upload
      if (req.file) {
        data.attachment = {
          path: `/api/v2/chat/attachments/${req.file.filename}`,
          filename: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
        };

        // If no content provided with attachment, use a default message
        if (data.content === '') {
          data.content = '📎 Attachment';
        }
      }

      if (data.content === '' && data.attachment === undefined) {
        res
          .status(400)
          .json(errorResponse(VALIDATION_ERROR, 'Message content or attachment is required'));
        return;
      }

      const result = await sendMessage(tenantId, conversationId, userId, data);

      // Log message sending
      const msgResultTyped = result as unknown as ChatMessageResult;
      const msgEntityId =
        msgResultTyped.messageId !== 0 ? msgResultTyped.messageId : msgResultTyped.id;
      await rootLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: 'send_message',
        entity_type: 'chat_message',
        entity_id: msgEntityId,
        details: `Nachricht gesendet${data.attachment ? ' mit Anhang' : ''}`,
        new_values: {
          conversation_id: conversationId,
          content_length: data.content.length,
          has_attachment: !!data.attachment,
          attachment_name: data.attachment?.filename,
          attachment_size: data.attachment?.size,
          sent_by: user.email,
        },
        ip_address: req.ip ?? req.socket.remoteAddress,
        user_agent: req.get(USER_AGENT_HEADER),
        was_role_switched: false,
      });

      res.status(201).json(successResponse(result));
    } catch (error: unknown) {
      next(error);
    }
  }

  /**
   * Get unread message count
   * @param req - The request object
   * @param res - The response object
   * @param next - The next middleware function
   */
  async getUnreadCount(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { user } = req;
      const tenantId = user.tenant_id;
      const userId = user.id;

      const unreadSummary = await getUnreadCount(tenantId, userId);

      res.json(successResponse(unreadSummary));
    } catch (error: unknown) {
      next(error);
    }
  }

  /**
   * Mark all messages in a conversation as read
   * @param req - The request object
   * @param res - The response object
   * @param next - The next middleware function
   */
  async markAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      logError('[Chat Controller] markAsRead called');
      const { user } = req;
      const userId = user.id;
      const tenantId = user.tenant_id;
      const conversationIdParam = req.params['id'];
      if (conversationIdParam === undefined) {
        res.status(400).json(errorResponse(VALIDATION_ERROR, CONVERSATION_ID_REQUIRED));
        return;
      }
      const conversationId = Number.parseInt(conversationIdParam);
      logError(
        '[Chat Controller] markAsRead - tenantId:',
        tenantId,
        'conversationId:',
        conversationId,
        'userId:',
        userId,
      );

      const result = await markConversationAsRead(tenantId, conversationId, userId);

      res.json(successResponse(result));
    } catch (error: unknown) {
      logError('[Chat Controller] markAsRead error:', error);
      next(error);
    }
  }

  /**
   * Delete a conversation
   * @param req - The request object
   * @param res - The response object
   * @param next - The next middleware function
   */
  async deleteConversation(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { user } = req;
      const userId = user.id;
      const tenantId = user.tenant_id;
      const userRole = user.role;
      const conversationIdParam = req.params['id'];
      if (conversationIdParam === undefined) {
        res.status(400).json(errorResponse(VALIDATION_ERROR, CONVERSATION_ID_REQUIRED));
        return;
      }
      const conversationId = Number.parseInt(conversationIdParam);

      await deleteConversation(tenantId, conversationId, userId, userRole);

      // Log conversation deletion
      await rootLog.create({
        tenant_id: user.tenant_id,
        user_id: userId,
        action: 'delete',
        entity_type: 'chat_conversation',
        entity_id: conversationId,
        details: `Gelöscht: Chat-Unterhaltung`,
        old_values: {
          conversation_id: conversationId,
          deleted_by: user.email,
          deleted_by_role: userRole,
        },
        ip_address: req.ip ?? req.socket.remoteAddress,
        user_agent: req.get(USER_AGENT_HEADER),
        was_role_switched: false,
      });

      res.json(
        successResponse({
          message: 'Conversation deleted successfully',
        }),
      );
    } catch (error: unknown) {
      next(error);
    }
  }

  /**
   * Download chat attachment
   * @param req - The request object
   * @param res - The response object
   * @param next - The next middleware function
   */
  async downloadAttachment(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const filename = req.params['filename'];
      if (filename === undefined) {
        res.status(400).json(errorResponse(VALIDATION_ERROR, 'Filename is required'));
        return;
      }
      const forceDownload = req.query['download'] === 'true';

      // Validate filename
      const uploadsDir = getUploadDirectory('chat');
      const filePath = validatePath(filename, uploadsDir);

      if (filePath === null || filePath === '') {
        res.status(400).json(errorResponse('INVALID_PATH', 'Invalid file path'));
        return;
      }

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        res.status(404).json(errorResponse('NOT_FOUND', 'File not found'));
        return;
      }

      // TODO: Verify user has access to this file through conversation participation
      // This requires tracking which files belong to which conversations

      // Set appropriate headers
      if (forceDownload) {
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filename)}"`);
      } else {
        res.setHeader('Content-Disposition', `inline; filename="${path.basename(filename)}"`);
      }

      res.sendFile(filePath);
    } catch (error: unknown) {
      next(error);
    }
  }

  /**
   * Get conversation details
   * @param req - The request object
   * @param res - The response object
   * @param next - The next middleware function
   */
  async getConversation(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { user } = req;
      const tenantId = user.tenant_id;
      const userId = user.id;
      const conversationIdParam = req.params['id'];
      if (conversationIdParam === undefined) {
        res.status(400).json(errorResponse(VALIDATION_ERROR, CONVERSATION_ID_REQUIRED));
        return;
      }
      const conversationId = Number.parseInt(conversationIdParam);

      // Get single conversation
      const conversation = await getConversation(tenantId, conversationId, userId);

      if (!conversation) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Conversation not found'));
        return;
      }

      res.json(successResponse({ conversation }));
    } catch (error: unknown) {
      next(error);
    }
  }

  /**
   * Update conversation (name, etc.)
   * @param _req - The _req parameter
   * @param res - The response object
   * @param next - The next middleware function
   */
  updateConversation(_req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    // TODO: Implement conversation update (name change, etc.)
    this.notImplemented(res, next);
  }

  /**
   * Add participants to conversation
   * @param _req - The _req parameter
   * @param res - The response object
   * @param next - The next middleware function
   */
  addParticipants(_req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    // TODO: Implement adding participants to group conversations
    this.notImplemented(res, next);
  }

  /**
   * Remove participant from conversation
   * @param _req - The _req parameter
   * @param res - The response object
   * @param next - The next middleware function
   */
  removeParticipant(_req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    // TODO: Implement removing participants from group conversations
    this.notImplemented(res, next);
  }

  /**
   * Leave conversation
   * @param _req - The _req parameter
   * @param res - The response object
   * @param next - The next middleware function
   */
  leaveConversation(_req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    // TODO: Implement leaving a group conversation
    this.notImplemented(res, next);
  }

  /**
   * Search messages across all conversations
   * @param _req - The _req parameter
   * @param res - The response object
   * @param next - The next middleware function
   */
  searchMessages(_req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    // TODO: Implement global message search
    this.notImplemented(res, next);
  }

  /**
   * Delete a message
   * @param _req - The _req parameter
   * @param res - The response object
   * @param next - The next middleware function
   */
  deleteMessage(_req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    // TODO: Implement message deletion (soft delete)
    this.notImplemented(res, next);
  }

  /**
   * Edit a message
   * @param _req - The _req parameter
   * @param res - The response object
   * @param next - The next middleware function
   */
  editMessage(_req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    // TODO: Implement message editing
    this.notImplemented(res, next);
  }

  // =========================================
  // SCHEDULED MESSAGES
  // =========================================

  /**
   * Create a scheduled message
   * POST /api/v2/chat/scheduled-messages
   */
  async createScheduledMessage(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { user } = req;
      const tenantId = user.tenant_id;
      const userId = user.id;

      // Request body is already validated by middleware
      const data = req.body as CreateScheduledMessageBody;

      // Build input object, only including optional properties if they have values
      const input: {
        conversationId: number;
        content: string;
        scheduledFor: string;
        attachmentPath?: string;
        attachmentName?: string;
        attachmentType?: string;
        attachmentSize?: number;
      } = {
        conversationId: data.conversationId,
        content: data.content,
        scheduledFor: data.scheduledFor,
      };

      // Only add attachment properties if they exist (not undefined)
      if (data.attachmentPath !== undefined) input.attachmentPath = data.attachmentPath;
      if (data.attachmentName !== undefined) input.attachmentName = data.attachmentName;
      if (data.attachmentType !== undefined) input.attachmentType = data.attachmentType;
      if (data.attachmentSize !== undefined) input.attachmentSize = data.attachmentSize;

      const result = await createScheduledMessage(input, userId, tenantId);

      // Log scheduled message creation
      await rootLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: 'schedule_message',
        entity_type: 'scheduled_message',
        entity_id: 0, // UUID stored in details
        details: `Nachricht geplant für ${new Date(result.scheduledFor).toLocaleString('de-DE')} (ID: ${result.id})`,
        new_values: {
          scheduled_message_id: result.id,
          conversation_id: data.conversationId,
          scheduled_for: result.scheduledFor,
          content_length: data.content.length,
          scheduled_by: user.email,
        },
        ip_address: req.ip ?? req.socket.remoteAddress,
        user_agent: req.get(USER_AGENT_HEADER),
        was_role_switched: false,
      });

      res.status(201).json(successResponse(result));
    } catch (error: unknown) {
      next(error);
    }
  }

  /**
   * Get all pending scheduled messages for the current user
   * GET /api/v2/chat/scheduled-messages
   */
  async getScheduledMessages(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { user } = req;
      const tenantId = user.tenant_id;
      const userId = user.id;

      const messages = await getUserScheduledMessages(userId, tenantId);

      res.json(
        successResponse({
          messages,
          total: messages.length,
        }),
      );
    } catch (error: unknown) {
      next(error);
    }
  }

  /**
   * Get a specific scheduled message
   * GET /api/v2/chat/scheduled-messages/:id
   */
  async getScheduledMessage(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { user } = req;
      const tenantId = user.tenant_id;
      const userId = user.id;

      // ID parameter is already validated by middleware
      const messageId = req.params['id'] as string;

      const message = await getScheduledMessage(messageId, userId, tenantId);

      res.json(successResponse({ message }));
    } catch (error: unknown) {
      next(error);
    }
  }

  /**
   * Cancel a scheduled message
   * DELETE /api/v2/chat/scheduled-messages/:id
   */
  async cancelScheduledMessage(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { user } = req;
      const tenantId = user.tenant_id;
      const userId = user.id;

      // ID parameter is already validated by middleware
      const messageId = req.params['id'] as string;

      const result = await cancelScheduledMessage(messageId, userId, tenantId);

      // Log cancellation
      await rootLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: 'cancel_scheduled_message',
        entity_type: 'scheduled_message',
        entity_id: 0, // UUID stored in details
        details: `Geplante Nachricht storniert (ID: ${result.id})`,
        old_values: {
          scheduled_message_id: result.id,
          scheduled_for: result.scheduledFor,
          cancelled_by: user.email,
        },
        ip_address: req.ip ?? req.socket.remoteAddress,
        user_agent: req.get(USER_AGENT_HEADER),
        was_role_switched: false,
      });

      res.json(
        successResponse({
          message: 'Geplante Nachricht wurde storniert',
          scheduledMessage: result,
        }),
      );
    } catch (error: unknown) {
      next(error);
    }
  }

  /**
   * Get scheduled messages for a specific conversation
   * GET /api/v2/chat/conversations/:id/scheduled-messages
   */
  async getConversationScheduledMessages(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { user } = req;
      const tenantId = user.tenant_id;
      const userId = user.id;
      const conversationIdParam = req.params['id'];

      if (conversationIdParam === undefined) {
        res.status(400).json(errorResponse(VALIDATION_ERROR, CONVERSATION_ID_REQUIRED));
        return;
      }
      const conversationId = Number.parseInt(conversationIdParam);

      const messages = await getConversationScheduledMessages(conversationId, userId, tenantId);

      res.json(
        successResponse({
          scheduledMessages: messages,
          total: messages.length,
        }),
      );
    } catch (error: unknown) {
      next(error);
    }
  }

  // ============================================================================
  // DOCUMENT-BASED ATTACHMENT SYSTEM (NEW 2025-12-03)
  // ============================================================================

  /**
   * Build hierarchical storage path for chat attachment
   */
  private buildChatStoragePath(
    tenantId: number,
    conversationUuid: string,
    fileUuid: string,
    extension: string,
  ): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return path.join(
      'uploads',
      'documents',
      tenantId.toString(),
      'chat',
      conversationUuid.trim(),
      year.toString(),
      month,
      `${fileUuid}${extension}`,
    );
  }

  /** POST /api/v2/chat/conversations/:id/attachments - Upload attachment */
  async uploadConversationAttachment(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { tenant_id: tenantId, id: userId } = req.user;
      const conversationIdParam = req.params['id'];
      if (conversationIdParam === undefined) {
        res.status(400).json(errorResponse(VALIDATION_ERROR, CONVERSATION_ID_REQUIRED));
        return;
      }
      const conversationId = Number.parseInt(conversationIdParam);
      if (!req.file) {
        res.status(400).json(errorResponse('BAD_REQUEST', 'No file uploaded'));
        return;
      }
      if (!(await isConversationParticipant(userId, conversationId, tenantId))) {
        res.status(403).json(errorResponse('FORBIDDEN', 'Not a conversation participant'));
        return;
      }
      const conversationUuid = await getConversationUuid(conversationId, tenantId);
      if (conversationUuid === null) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Conversation not found'));
        return;
      }
      const fileUuid = uuidv7();
      const ext = path.extname(req.file.originalname).toLowerCase();
      const checksum = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
      const document = await documentsService.createDocument(
        {
          filename: `${fileUuid}${ext}`,
          originalName: req.file.originalname,
          fileSize: req.file.size,
          fileContent: req.file.buffer,
          mimeType: req.file.mimetype,
          category: 'chat',
          accessScope: 'chat' as const,
          conversationId,
          fileUuid,
          fileChecksum: checksum,
          filePath: this.buildChatStoragePath(tenantId, conversationUuid, fileUuid, ext),
          storageType: 'filesystem' as const,
        },
        userId,
        tenantId,
      );
      logger.info(`Chat attachment uploaded: ${String(document['id'])} for conv ${conversationId}`);
      res.status(201).json(successResponse(document));
    } catch (error: unknown) {
      logger.error('Error uploading chat attachment:', error);
      next(error);
    }
  }

  /**
   * Get all attachments for a conversation
   * GET /api/v2/chat/conversations/:id/attachments
   */
  async getConversationAttachments(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { user } = req;
      const tenantId = user.tenant_id;
      const userId = user.id;

      const conversationIdParam = req.params['id'];
      if (conversationIdParam === undefined) {
        res.status(400).json(errorResponse(VALIDATION_ERROR, CONVERSATION_ID_REQUIRED));
        return;
      }
      const conversationId = Number.parseInt(conversationIdParam);

      // Permission check happens in service
      const attachments = await documentsService.getDocumentsByConversation(
        conversationId,
        tenantId,
        userId,
      );

      res.json(
        successResponse({
          attachments,
          total: attachments.length,
        }),
      );
    } catch (error: unknown) {
      logger.error('Error getting conversation attachments:', error);
      next(error);
    }
  }

  /**
   * Download attachment by file UUID (secure URL)
   * GET /api/v2/chat/attachments/:fileUuid/download
   */
  async downloadAttachmentByUuid(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { user } = req;
      const tenantId = user.tenant_id;
      const userId = user.id;

      const fileUuid = req.params['fileUuid'];
      if (fileUuid === undefined || fileUuid === '') {
        res.status(400).json(errorResponse('BAD_REQUEST', 'File UUID is required'));
        return;
      }

      // Get document content (access check happens in service)
      const documentContent = await documentsService.getDocumentContentByFileUuid(
        fileUuid,
        userId,
        tenantId,
      );

      // Set headers for download
      const disposition = req.query['inline'] === 'true' ? 'inline' : 'attachment';
      res.setHeader('Content-Type', documentContent.mimeType);
      res.setHeader(
        'Content-Disposition',
        `${disposition}; filename="${documentContent.originalName}"`,
      );
      res.setHeader('Content-Length', documentContent.fileSize.toString());
      res.setHeader('Cache-Control', 'private, max-age=3600');

      // Send binary content
      res.end(documentContent.content);
    } catch (error: unknown) {
      logger.error('Error downloading chat attachment:', error);
      next(error);
    }
  }

  /**
   * Delete attachment by document ID
   * DELETE /api/v2/chat/attachments/:documentId
   */
  async deleteConversationAttachment(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { user } = req;
      const tenantId = user.tenant_id;
      const userId = user.id;

      const documentIdParam = req.params['documentId'];
      if (documentIdParam === undefined) {
        res.status(400).json(errorResponse('BAD_REQUEST', 'Document ID is required'));
        return;
      }
      const documentId = Number.parseInt(documentIdParam);

      // Delete via documents service (access check happens there)
      await documentsService.deleteDocument(documentId, userId, tenantId);

      res.json(successResponse({ message: 'Attachment deleted successfully' }));
    } catch (error: unknown) {
      logger.error('Error deleting chat attachment:', error);
      next(error);
    }
  }
}

// Export singleton instance
export default new ChatController();
