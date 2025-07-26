/**
 * Chat Controller v2
 * HTTP request handling for real-time messaging API
 */

import { promises as fs } from "fs";
import path from "path";

import { Response, NextFunction } from "express";

import { AuthenticatedRequest } from "../../../types/request.types.js";
import { successResponse, errorResponse } from "../../../utils/apiResponse.js";
import {
  validatePath,
  getUploadDirectory,
} from "../../../utils/pathSecurity.js";

import chatService from "./chat.service.js";
import type {
  ConversationFilters,
  MessageFilters,
  CreateConversationData,
  SendMessageData,
} from "./chat.service.js";

export class ChatController {
  /**
   * Get available chat users
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
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's conversations
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
        page: parseInt(req.query.page as string) ?? 1,
        limit: parseInt(req.query.limit as string) ?? 20,
      };

      const result = await chatService.getConversations(
        tenantId,
        userId,
        filters,
      );

      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new conversation
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

      res.status(201).json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get messages from a conversation
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
      const conversationId = parseInt(req.params.id);

      const filters: MessageFilters = {
        search: req.query.search as string,
        startDate: req.query.startDate
          ? new Date(req.query.startDate as string)
          : undefined,
        endDate: req.query.endDate
          ? new Date(req.query.endDate as string)
          : undefined,
        hasAttachment: req.query.hasAttachment === "true",
        page: parseInt(req.query.page as string) ?? 1,
        limit: parseInt(req.query.limit as string) ?? 50,
      };

      const result = await chatService.getMessages(
        tenantId,
        conversationId,
        userId,
        filters,
      );

      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Send a message to a conversation
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
      const conversationId = parseInt(req.params.id);

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

      res.status(201).json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get unread message count
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
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark all messages in a conversation as read
   */
  async markAsRead(
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
      const conversationId = parseInt(req.params.id);

      const result = await chatService.markConversationAsRead(
        conversationId,
        userId,
      );

      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a conversation
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
      const conversationId = parseInt(req.params.id);

      await chatService.deleteConversation(conversationId, userId, userRole);

      res.json(
        successResponse({
          message: "Conversation deleted successfully",
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Download chat attachment
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
          `attachment; filename="${path.basename(filename)}"`,
        );
      } else {
        res.setHeader(
          "Content-Disposition",
          `inline; filename="${path.basename(filename)}"`,
        );
      }

      res.sendFile(filePath);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get conversation details
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
      const conversationId = parseInt(req.params.id);

      // Use getConversations to get single conversation
      const result = await chatService.getConversations(tenantId, userId, {
        limit: 1,
      });

      const conversation = result.data.find((c) => c.id === conversationId);

      if (!conversation) {
        res
          .status(404)
          .json(errorResponse("NOT_FOUND", "Conversation not found"));
        return;
      }

      res.json(successResponse({ conversation }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update conversation (name, etc.)
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
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add participants to conversation
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
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove participant from conversation
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
    } catch (error) {
      next(error);
    }
  }

  /**
   * Leave conversation
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
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search messages across all conversations
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
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a message
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
    } catch (error) {
      next(error);
    }
  }

  /**
   * Edit a message
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
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export default new ChatController();
