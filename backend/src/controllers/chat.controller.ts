/**
 * Chat Controller
 * Handles chat-related operations including messages, conversations, and file attachments
 */

import { Request, Response } from 'express';
import chatService from '../services/chat.service';
import * as path from 'path';
import { promises as fs } from 'fs';
import { AuthenticatedRequest } from '../types/request.types';
import { Pool } from 'mysql2/promise';
import { validatePath } from '../utils/pathSecurity';

// Extended request with tenantDb
interface TenantAuthenticatedRequest extends AuthenticatedRequest {
  tenantDb?: Pool;
}

// Type guard to check if request is authenticated
function isAuthenticated(req: Request): req is AuthenticatedRequest {
  return (
    'user' in req &&
    req.user != null &&
    typeof req.user === 'object' &&
    'tenant_id' in req.user
  );
}

class ChatController {
  // Get list of users available for chat
  async getUsers(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const users = await chatService.getUsers(
        req.user.tenant_id,
        req.user.userId || req.user.id
      );
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Create a new conversation
  async createConversation(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { participant_ids: participantIds, name } = req.body as {
        participant_ids?: number[];
        name?: string;
      };

      if (
        !participantIds ||
        !Array.isArray(participantIds) ||
        participantIds.length === 0
      ) {
        res.status(400).json({ error: 'Invalid participant IDs' });
        return;
      }

      const conversation = await chatService.createConversation(
        req.user.tenant_id,
        req.user.userId || req.user.id,
        participantIds,
        participantIds.length > 1,
        name
      );

      res.status(201).json(conversation);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Get user's conversations
  async getConversations(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const conversations = await chatService.getConversations(
        req.user.tenant_id,
        req.user.userId || req.user.id
      );

      res.json(conversations);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Get messages for a conversation
  async getMessages(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const conversationId = parseInt(req.params.id);
      const limit = parseInt(String(req.query.limit || '50'));
      const offset = parseInt(String(req.query.offset || '0'));

      const result = await chatService.getMessages(
        req.user.tenant_id,
        conversationId,
        req.user.userId,
        limit,
        offset
      );

      // Frontend expects just the messages array
      res.json(result.messages);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Send a message
  async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const conversationId = parseInt(req.params.id);
      const body = req.body as { content?: string };
      let content = body.content || '';
      let attachmentUrl: string | undefined;

      // Handle file upload
      if (req.file) {
        attachmentUrl = `/uploads/chat/${req.file.filename}`;
        if (!content) {
          content = 'Sent an attachment';
        }
      }

      if (!content && !attachmentUrl) {
        res
          .status(400)
          .json({ error: 'Message content or attachment is required' });
        return;
      }

      const message = await chatService.sendMessage(
        req.user.tenant_id,
        conversationId,
        req.user.userId,
        content,
        attachmentUrl
          ? {
              path: attachmentUrl,
              name: req.file?.originalname || '',
              type: req.file?.mimetype || '',
            }
          : null
      );

      res.status(201).json(message);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Get conversation participants
  async getConversationParticipants(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const conversationId = parseInt(req.params.id);

      const participants = await chatService.getConversationParticipants(
        conversationId,
        req.user.tenant_id
      );

      res.json(participants);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Add participant to conversation
  async addParticipant(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const conversationId = parseInt(req.params.id);
      const { userId } = req.body as { userId?: number };

      if (!userId) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      await chatService.addParticipant(
        conversationId,
        userId,
        req.user.userId || req.user.id,
        req.user.tenant_id
      );

      res.json({ message: 'Participant added successfully' });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Remove participant from conversation
  async removeParticipant(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const conversationId = parseInt(req.params.id);
      const userId = parseInt(req.params.userId);

      await chatService.removeParticipant(
        conversationId,
        userId,
        req.user.userId || req.user.id,
        req.user.tenant_id
      );

      res.json({ message: 'Participant removed successfully' });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Update conversation name
  async updateConversationName(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const conversationId = parseInt(req.params.id);
      const { name } = req.body as { name?: string };

      if (!name || name.trim().length === 0) {
        res.status(400).json({ error: 'Name is required' });
        return;
      }

      await chatService.updateConversationName(
        conversationId,
        name,
        req.user.userId || req.user.id,
        req.user.tenant_id
      );

      res.json({ message: 'Conversation name updated successfully' });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Handle file download
  async downloadFile(req: Request, res: Response): Promise<void> {
    try {
      const filename = req.params.filename;
      const uploadsDir = path.join(process.cwd(), 'uploads', 'chat');
      const validatedPath = validatePath(filename, uploadsDir);

      if (!validatedPath) {
        res.status(400).json({ error: 'Invalid file path' });
        return;
      }

      // Check if file exists
      try {
        await fs.access(validatedPath);
      } catch {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      res.download(validatedPath);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Get unread message count
  async getUnreadCount(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const unreadCount = await chatService.getUnreadCount(
        (req as TenantAuthenticatedRequest).tenantDb as Pool, // tenantDb parameter is not used but required
        req.user.tenant_id,
        req.user.userId || req.user.id
      );

      res.json({ unreadCount });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Mark all messages in a conversation as read
  async markConversationAsRead(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const conversationId = parseInt(req.params.id);
      const userId = req.user.userId || req.user.id;

      await chatService.markConversationAsRead(conversationId, userId);

      res.json({ message: 'Messages marked as read' });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Delete conversation
  async deleteConversation(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const conversationId = parseInt(req.params.id);

      await chatService.deleteConversation(
        conversationId,
        req.user.userId || req.user.id
      );

      res.json({ message: 'Conversation deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}

export default new ChatController();
