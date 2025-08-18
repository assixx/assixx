/**
 * Chat Controller
 * Handles chat-related operations including messages, conversations, and file attachments
 */

import { promises as fs } from "fs";
import * as path from "path";
import { Pool } from "mysql2/promise";
import { Request, Response } from "express";
import chatService from "../services/chat.service";
import type { AuthenticatedRequest } from "../types/request.types";
import { validatePath } from "../utils/pathSecurity";

// Extended request with tenantDb
interface TenantAuthenticatedRequest extends AuthenticatedRequest {
  tenantDb?: Pool;
}

// Type guard to check if request is authenticated
/**
 *
 * @param req
 */
function isAuthenticated(req: Request): req is AuthenticatedRequest {
  return (
    "user" in req &&
    req.user != null &&
    typeof req.user === "object" &&
    "tenant_id" in req.user
  );
}

/**
 *
 */
class ChatController {
  // Get list of users available for chat
  /**
   *
   * @param req
   * @param res
   */
  async getUsers(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const users = await chatService.getUsers(
        req.user.tenant_id,
        req.user.userId,
      );
      res.json(users);
    } catch (error: unknown) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Create a new conversation
  /**
   *
   * @param req
   * @param res
   */
  async createConversation(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { participant_ids: participantIds, name } = req.body as {
        participant_ids?: number[];
        name?: string;
      };

      if (
        participantIds === undefined ||
        !Array.isArray(participantIds) ||
        participantIds.length === 0
      ) {
        res.status(400).json({ error: "Invalid participant IDs" });
        return;
      }

      const conversation = await chatService.createConversation(
        req.user.tenant_id,
        req.user.userId,
        participantIds,
        participantIds.length > 1,
        name,
      );

      res.status(201).json(conversation);
    } catch (error: unknown) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Get user's conversations
  /**
   *
   * @param req
   * @param res
   */
  async getConversations(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const conversations = await chatService.getConversations(
        req.user.tenant_id,
        req.user.userId,
      );

      res.json(conversations);
    } catch (error: unknown) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Get messages for a conversation
  /**
   *
   * @param req
   * @param res
   */
  async getMessages(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const conversationId = Number.parseInt(req.params.id);
      const limit = Number.parseInt(
        typeof req.query.limit === "string" ? req.query.limit : "50",
      );
      const offset = Number.parseInt(
        typeof req.query.offset === "string" ? req.query.offset : "0",
      );

      const result = await chatService.getMessages(
        req.user.tenant_id,
        conversationId,
        req.user.userId,
        limit,
        offset,
      );

      // Frontend expects just the messages array
      res.json(result.messages);
    } catch (error: unknown) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Send a message
  /**
   *
   * @param req
   * @param res
   */
  async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const conversationId = Number.parseInt(req.params.id);
      const body = req.body as { content?: string };
      let content = body.content ?? "";
      let attachmentUrl: string | undefined;

      // Handle file upload
      if (req.file !== undefined) {
        attachmentUrl = `/uploads/chat/${req.file.filename}`;
        if (content.length === 0) {
          content = "Sent an attachment";
        }
      }

      if (content.length === 0 && attachmentUrl === undefined) {
        res
          .status(400)
          .json({ error: "Message content or attachment is required" });
        return;
      }

      const message = await chatService.sendMessage(
        req.user.tenant_id,
        conversationId,
        req.user.userId,
        content,
        attachmentUrl !== undefined
          ? {
              path: attachmentUrl,
              name: req.file?.originalname ?? "",
              type: req.file?.mimetype ?? "",
            }
          : null,
      );

      res.status(201).json(message);
    } catch (error: unknown) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Get conversation participants
  /**
   *
   * @param req
   * @param res
   */
  async getConversationParticipants(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const conversationId = Number.parseInt(req.params.id);

      const participants = await chatService.getConversationParticipants(
        conversationId,
        req.user.tenant_id,
      );

      res.json(participants);
    } catch (error: unknown) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Add participant to conversation
  /**
   *
   * @param req
   * @param res
   */
  async addParticipant(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const conversationId = Number.parseInt(req.params.id);
      const { userId } = req.body as { userId?: number };

      if (userId == null) {
        res.status(400).json({ error: "User ID is required" });
        return;
      }

      await chatService.addParticipant(
        conversationId,
        userId,
        req.user.userId,
        req.user.tenant_id,
      );

      res.json({ message: "Participant added successfully" });
    } catch (error: unknown) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Remove participant from conversation
  /**
   *
   * @param req
   * @param res
   */
  async removeParticipant(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const conversationId = Number.parseInt(req.params.id);
      const userId = Number.parseInt(req.params.userId);

      await chatService.removeParticipant(
        conversationId,
        userId,
        req.user.userId,
        req.user.tenant_id,
      );

      res.json({ message: "Participant removed successfully" });
    } catch (error: unknown) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Update conversation name
  /**
   *
   * @param req
   * @param res
   */
  async updateConversationName(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const conversationId = Number.parseInt(req.params.id);
      const { name } = req.body as { name?: string };

      if (name == null || name.trim().length === 0) {
        res.status(400).json({ error: "Name is required" });
        return;
      }

      await chatService.updateConversationName(
        conversationId,
        name,
        req.user.userId,
        req.user.tenant_id,
      );

      res.json({ message: "Conversation name updated successfully" });
    } catch (error: unknown) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Handle file download
  /**
   *
   * @param req
   * @param res
   */
  async downloadFile(req: Request, res: Response): Promise<void> {
    try {
      const filename = req.params.filename;
      const uploadsDir = path.join(process.cwd(), "uploads", "chat");
      const validatedPath = validatePath(filename, uploadsDir);

      if (validatedPath == null) {
        res.status(400).json({ error: "Invalid file path" });
        return;
      }

      // Check if file exists
      try {
        await fs.access(validatedPath);
      } catch {
        res.status(404).json({ error: "File not found" });
        return;
      }

      res.download(validatedPath);
    } catch (error: unknown) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Get unread message count
  /**
   *
   * @param req
   * @param res
   */
  async getUnreadCount(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const tenantDb = (req as TenantAuthenticatedRequest).tenantDb;
      if (!tenantDb) {
        res.status(500).json({ error: "Tenant database not available" });
        return;
      }

      const unreadCount = await chatService.getUnreadCount(
        tenantDb,
        req.user.tenant_id,
        req.user.userId,
      );

      res.json({ unreadCount });
    } catch (error: unknown) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Mark all messages in a conversation as read
  /**
   *
   * @param req
   * @param res
   */
  async markConversationAsRead(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const conversationId = Number.parseInt(req.params.id);
      const userId = req.user.userId;

      await chatService.markConversationAsRead(conversationId, userId);

      res.json({ message: "Messages marked as read" });
    } catch (error: unknown) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Delete conversation
  /**
   *
   * @param req
   * @param res
   */
  async deleteConversation(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const conversationId = Number.parseInt(req.params.id);

      await chatService.deleteConversation(conversationId, req.user.userId);

      res.json({ message: "Conversation deleted successfully" });
    } catch (error: unknown) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}

export default new ChatController();
