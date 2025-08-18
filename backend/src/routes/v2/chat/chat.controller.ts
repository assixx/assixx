/**
 * Chat Controller v2
 * HTTP request handling for real-time messaging API
 */

import { error as logError } from "console";
import { promises as fs } from "fs";
import path from "path";
import { Response, NextFunction } from "express";
import chatService from "./chat.service.js";
import type {
  ConversationFilters,
  MessageFilters,
  CreateConversationData,
  SendMessageData,
} from "./chat.service.js";
import RootLog from "../../../models/rootLog";
import type { AuthenticatedRequest } from "../../../types/request.types.js";
import { successResponse, errorResponse } from "../../../utils/apiResponse.js";
import {
  validatePath,
  getUploadDirectory,
} from "../../../utils/pathSecurity.js";

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
 *
 */
export class ChatController {
  /**
   * Get available chat users
   * @param req
   * @param res
   * @param next
   */
  async getChatUsers(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { user } = req;
      if (!user) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "Authentication required"));
        return;
      }
      const tenantId = user.tenant_id;
      const userId = user.id;
      const search = req.query.search as string | undefined;

      const users = await chatService.getChatUsers(tenantId, userId, search);

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
   * @param req
   * @param res
   * @param next
   */
  async getConversations(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { user } = req;
      if (!user) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "Authentication required"));
        return;
      }
      const tenantId = user.tenant_id;
      const userId = user.id;

      const filters: ConversationFilters = {
        search: req.query.search as string,
        isGroup:
          req.query.isGroup === "true"
            ? true
            : req.query.isGroup === "false"
              ? false
              : undefined,
        hasUnread: req.query.hasUnread === "true",
        page: Number.parseInt(req.query.page as string) ?? 1,
        limit: Number.parseInt(req.query.limit as string) ?? 20,
      };

      const result = await chatService.getConversations(
        tenantId,
        userId,
        filters,
      );

      res.json(successResponse(result));
    } catch (error: unknown) {
      next(error);
    }
  }

  /**
   * Create a new conversation
   * @param req
   * @param res
   * @param next
   */
  async createConversation(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { user } = req;
      if (!user) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "Authentication required"));
        return;
      }
      const tenantId = user.tenant_id;
      const userId = user.id;

      // Critical debug logging
      logError("[CRITICAL DEBUG] Controller: user object:", user);
      logError("[CRITICAL DEBUG] Controller: tenantId from user:", tenantId);
      logError("[CRITICAL DEBUG] Controller: userId from user:", userId);

      const body = req.body as {
        participantIds?: number[];
        name?: string;
        isGroup?: boolean;
      };
      const data: CreateConversationData = {
        participantIds: body.participantIds ?? [],
        name: body.name,
        isGroup: body.isGroup,
      };

      const result = await chatService.createConversation(
        tenantId,
        userId,
        data,
      );

      // Log conversation creation
      await RootLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: "create",
        entity_type: "chat_conversation",
        entity_id:
          (result as unknown as ChatConversationResult).conversationId ??
          (result as unknown as ChatConversationResult).id,
        details: `Erstellt: ${data.name ?? "Chat-Unterhaltung"}`,
        new_values: {
          name: data.name,
          is_group: data.isGroup,
          participant_ids: data.participantIds,
          participant_count: data.participantIds.length + 1,
          created_by: user.email,
        },
        ip_address: req.ip ?? req.socket.remoteAddress,
        user_agent: req.get("user-agent"),
        was_role_switched: false,
      });

      res.status(201).json(successResponse(result));
    } catch (error: unknown) {
      logError("[Chat Controller] createConversation error:", error);
      next(error);
    }
  }

  /**
   * Get messages from a conversation
   * @param req
   * @param res
   * @param next
   */
  async getMessages(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { user } = req;
      if (!user) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "Authentication required"));
        return;
      }
      const tenantId = user.tenant_id;
      const userId = user.id;
      const conversationId = Number.parseInt(req.params.id);

      const filters: MessageFilters = {
        search: req.query.search as string,
        startDate: req.query.startDate
          ? new Date(req.query.startDate as string)
          : undefined,
        endDate: req.query.endDate
          ? new Date(req.query.endDate as string)
          : undefined,
        hasAttachment: req.query.hasAttachment === "true",
        page: Number.parseInt(req.query.page as string) ?? 1,
        limit: Number.parseInt(req.query.limit as string) ?? 50,
      };

      const result = await chatService.getMessages(
        tenantId,
        conversationId,
        userId,
        filters,
      );

      res.json(successResponse(result));
    } catch (error: unknown) {
      next(error);
    }
  }

  /**
   * Send a message to a conversation
   * @param req
   * @param res
   * @param next
   */
  async sendMessage(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { user } = req;
      if (!user) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "Authentication required"));
        return;
      }
      const tenantId = user.tenant_id;
      const userId = user.id;
      const conversationId = Number.parseInt(req.params.id);

      const body = req.body as { message?: string; content?: string };
      const data: SendMessageData = {
        content: body.message ?? body.content ?? "",
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
        if (!data.content) {
          data.content = "📎 Attachment";
        }
      }

      if (!data.content && !data.attachment) {
        res
          .status(400)
          .json(
            errorResponse(
              "VALIDATION_ERROR",
              "Message content or attachment is required",
            ),
          );
        return;
      }

      const result = await chatService.sendMessage(
        tenantId,
        conversationId,
        userId,
        data,
      );

      // Log message sending
      await RootLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: "send_message",
        entity_type: "chat_message",
        entity_id:
          (result as unknown as ChatMessageResult).messageId ??
          (result as unknown as ChatMessageResult).id,
        details: `Nachricht gesendet${data.attachment ? " mit Anhang" : ""}`,
        new_values: {
          conversation_id: conversationId,
          content_length: data.content.length,
          has_attachment: !!data.attachment,
          attachment_name: data.attachment?.filename,
          attachment_size: data.attachment?.size,
          sent_by: user.email,
        },
        ip_address: req.ip ?? req.socket.remoteAddress,
        user_agent: req.get("user-agent"),
        was_role_switched: false,
      });

      res.status(201).json(successResponse(result));
    } catch (error: unknown) {
      next(error);
    }
  }

  /**
   * Get unread message count
   * @param req
   * @param res
   * @param next
   */
  async getUnreadCount(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { user } = req;
      if (!user) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "Authentication required"));
        return;
      }
      const tenantId = user.tenant_id;
      const userId = user.id;

      const unreadSummary = await chatService.getUnreadCount(tenantId, userId);

      res.json(successResponse(unreadSummary));
    } catch (error: unknown) {
      next(error);
    }
  }

  /**
   * Mark all messages in a conversation as read
   * @param req
   * @param res
   * @param next
   */
  async markAsRead(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      logError("[Chat Controller] markAsRead called");
      const { user } = req;
      if (!user) {
        logError("[Chat Controller] No user found!");
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "Authentication required"));
        return;
      }
      const userId = user.id;
      const conversationId = Number.parseInt(req.params.id);
      logError(
        "[Chat Controller] markAsRead - conversationId:",
        conversationId,
        "userId:",
        userId,
      );

      const result = await chatService.markConversationAsRead(
        conversationId,
        userId,
      );

      res.json(successResponse(result));
    } catch (error: unknown) {
      logError("[Chat Controller] markAsRead error:", error);
      next(error);
    }
  }

  /**
   * Delete a conversation
   * @param req
   * @param res
   * @param next
   */
  async deleteConversation(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { user } = req;
      if (!user) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "Authentication required"));
        return;
      }
      const userId = user.id;
      const userRole = user.role;
      const conversationId = Number.parseInt(req.params.id);

      await chatService.deleteConversation(conversationId, userId, userRole);

      // Log conversation deletion
      await RootLog.create({
        tenant_id: user.tenant_id,
        user_id: userId,
        action: "delete",
        entity_type: "chat_conversation",
        entity_id: conversationId,
        details: `Gelöscht: Chat-Unterhaltung`,
        old_values: {
          conversation_id: conversationId,
          deleted_by: user.email,
          deleted_by_role: userRole,
        },
        ip_address: req.ip ?? req.socket.remoteAddress,
        user_agent: req.get("user-agent"),
        was_role_switched: false,
      });

      res.json(
        successResponse({
          message: "Conversation deleted successfully",
        }),
      );
    } catch (error: unknown) {
      next(error);
    }
  }

  /**
   * Download chat attachment
   * @param req
   * @param res
   * @param next
   */
  async downloadAttachment(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const filename = req.params.filename;
      const forceDownload = req.query.download === "true";

      // Validate filename
      const uploadsDir = getUploadDirectory("chat");
      const filePath = validatePath(filename, uploadsDir);

      if (!filePath) {
        res
          .status(400)
          .json(errorResponse("INVALID_PATH", "Invalid file path"));
        return;
      }

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        res.status(404).json(errorResponse("NOT_FOUND", "File not found"));
        return;
      }

      // TODO: Verify user has access to this file through conversation participation
      // This requires tracking which files belong to which conversations

      // Set appropriate headers
      if (forceDownload) {
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${String(path.basename(filename))}"`,
        );
      } else {
        res.setHeader(
          "Content-Disposition",
          `inline; filename="${String(path.basename(filename))}"`,
        );
      }

      res.sendFile(filePath);
    } catch (error: unknown) {
      next(error);
    }
  }

  /**
   * Get conversation details
   * @param req
   * @param res
   * @param next
   */
  async getConversation(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { user } = req;
      if (!user) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "Authentication required"));
        return;
      }
      const tenantId = user.tenant_id;
      const userId = user.id;
      const conversationId = Number.parseInt(req.params.id);

      // Get single conversation
      const conversation = await chatService.getConversation(
        tenantId,
        conversationId,
        userId,
      );

      if (!conversation) {
        res
          .status(404)
          .json(errorResponse("NOT_FOUND", "Conversation not found"));
        return;
      }

      res.json(successResponse({ conversation }));
    } catch (error: unknown) {
      next(error);
    }
  }

  /**
   * Update conversation (name, etc.)
   * @param _req
   * @param res
   * @param next
   */
  async updateConversation(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // TODO: Implement conversation update (name change, etc.)
      res
        .status(501)
        .json(errorResponse("NOT_IMPLEMENTED", "Feature not yet implemented"));
    } catch (error: unknown) {
      next(error);
    }
  }

  /**
   * Add participants to conversation
   * @param _req
   * @param res
   * @param next
   */
  async addParticipants(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // TODO: Implement adding participants to group conversations
      res
        .status(501)
        .json(errorResponse("NOT_IMPLEMENTED", "Feature not yet implemented"));
    } catch (error: unknown) {
      next(error);
    }
  }

  /**
   * Remove participant from conversation
   * @param _req
   * @param res
   * @param next
   */
  async removeParticipant(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // TODO: Implement removing participants from group conversations
      res
        .status(501)
        .json(errorResponse("NOT_IMPLEMENTED", "Feature not yet implemented"));
    } catch (error: unknown) {
      next(error);
    }
  }

  /**
   * Leave conversation
   * @param _req
   * @param res
   * @param next
   */
  async leaveConversation(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // TODO: Implement leaving a group conversation
      res
        .status(501)
        .json(errorResponse("NOT_IMPLEMENTED", "Feature not yet implemented"));
    } catch (error: unknown) {
      next(error);
    }
  }

  /**
   * Search messages across all conversations
   * @param _req
   * @param res
   * @param next
   */
  async searchMessages(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // TODO: Implement global message search
      res
        .status(501)
        .json(errorResponse("NOT_IMPLEMENTED", "Feature not yet implemented"));
    } catch (error: unknown) {
      next(error);
    }
  }

  /**
   * Delete a message
   * @param _req
   * @param res
   * @param next
   */
  async deleteMessage(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // TODO: Implement message deletion (soft delete)
      res
        .status(501)
        .json(errorResponse("NOT_IMPLEMENTED", "Feature not yet implemented"));
    } catch (error: unknown) {
      next(error);
    }
  }

  /**
   * Edit a message
   * @param _req
   * @param res
   * @param next
   */
  async editMessage(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // TODO: Implement message editing
      res
        .status(501)
        .json(errorResponse("NOT_IMPLEMENTED", "Feature not yet implemented"));
    } catch (error: unknown) {
      next(error);
    }
  }
}

// Export singleton instance
export default new ChatController();
