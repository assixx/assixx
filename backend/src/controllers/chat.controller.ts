/**
 * Chat Controller
 * Handles chat-related operations including messages, conversations, and file attachments
 */

import { Response } from 'express';
import { Pool } from 'mysql2/promise';
import chatService from '../services/chat.service';
import path from 'path';
import fs from 'fs/promises';
import {
  AuthenticatedRequest as BaseAuthRequest,
  ChatUsersRequest as BaseChatUsersRequest,
  GetConversationsRequest as BaseGetConversationsRequest,
  CreateConversationRequest as BaseCreateConversationRequest,
  GetMessagesRequest as BaseGetMessagesRequest,
  SendMessageRequest as BaseSendMessageRequest,
} from '../types/request.types';

// Extended Request interfaces for chat operations with DB pool
interface AuthenticatedRequest extends BaseAuthRequest {
  tenantDb?: Pool;
}

interface ChatUsersRequest extends BaseChatUsersRequest {
  tenantDb?: Pool;
}

interface CreateConversationRequest extends BaseCreateConversationRequest {
  tenantDb?: Pool;
}

interface GetConversationsRequest extends BaseGetConversationsRequest {
  tenantDb?: Pool;
}

interface GetMessagesRequest extends BaseGetMessagesRequest {
  tenantDb?: Pool;
}

interface SendMessageRequest extends BaseSendMessageRequest {
  tenantDb?: Pool;
  file?: any; // Multer file - will be typed properly later
}

interface GetConversationParticipantsRequest extends AuthenticatedRequest {
  user: {
    userId: number;
    tenantId: number;
    id: number;
    username: string;
    email: string;
    role: string;
  };
  params: {
    id: string;
  };
}

interface AddParticipantRequest extends AuthenticatedRequest {
  user: {
    userId: number;
    tenantId: number;
    id: number;
    username: string;
    email: string;
    role: string;
  };
  params: {
    id: string;
  };
  body: {
    userId: number;
  };
}

interface RemoveParticipantRequest extends AuthenticatedRequest {
  user: {
    userId: number;
    tenantId: number;
    id: number;
    username: string;
    email: string;
    role: string;
  };
  params: {
    id: string;
    userId: string;
  };
}

interface UpdateConversationNameRequest extends AuthenticatedRequest {
  user: {
    userId: number;
    tenantId: number;
    id: number;
    username: string;
    email: string;
    role: string;
  };
  params: {
    id: string;
  };
  body: {
    name: string;
  };
}

class ChatController {
  // Get list of users available for chat
  async getUsers(req: ChatUsersRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const users = await chatService.getUsers(
        req.user.tenantId,
        req.user.userId || req.user.id
      );
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Create a new conversation
  async createConversation(
    req: CreateConversationRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { participant_ids: participantIds, name } = req.body;

      if (
        !participantIds ||
        !Array.isArray(participantIds) ||
        participantIds.length === 0
      ) {
        res.status(400).json({ error: 'Invalid participant IDs' });
        return;
      }

      const conversation = await chatService.createConversation(
        req.user.tenantId,
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
  async getConversations(
    req: GetConversationsRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const conversations = await chatService.getConversations(
        req.user.tenantId,
        req.user.userId || req.user.id
      );

      res.json(conversations);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Get messages for a conversation
  async getMessages(req: GetMessagesRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const conversationId = parseInt(req.params.id);
      const limit = parseInt(req.query.limit || '50');
      const offset = parseInt(req.query.offset || '0');

      const result = await chatService.getMessages(
        req.user.tenantId,
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
  async sendMessage(req: SendMessageRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const conversationId = parseInt(req.params.id);
      let content = req.body.content || '';
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
        req.user.tenantId,
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
    req: GetConversationParticipantsRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const conversationId = parseInt(req.params.id);

      const participants = await chatService.getConversationParticipants(
        conversationId,
        req.user.tenantId
      );

      res.json(participants);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Add participant to conversation
  async addParticipant(
    req: AddParticipantRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const conversationId = parseInt(req.params.id);
      const { userId } = req.body;

      await chatService.addParticipant(
        conversationId,
        userId,
        req.user.userId || req.user.id,
        req.user.tenantId
      );

      res.json({ message: 'Participant added successfully' });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Remove participant from conversation
  async removeParticipant(
    req: RemoveParticipantRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const conversationId = parseInt(req.params.id);
      const userId = parseInt(req.params.userId);

      await chatService.removeParticipant(
        conversationId,
        userId,
        req.user.userId || req.user.id,
        req.user.tenantId
      );

      res.json({ message: 'Participant removed successfully' });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Update conversation name
  async updateConversationName(
    req: UpdateConversationNameRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const conversationId = parseInt(req.params.id);
      const { name } = req.body;

      if (!name || name.trim().length === 0) {
        res.status(400).json({ error: 'Name is required' });
        return;
      }

      await chatService.updateConversationName(
        conversationId,
        name,
        req.user.userId || req.user.id,
        req.user.tenantId
      );

      res.json({ message: 'Conversation name updated successfully' });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Handle file download
  async downloadFile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const filename = req.params.filename;
      const filePath = path.join(process.cwd(), 'uploads', 'chat', filename);

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      res.download(filePath);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Get unread message count
  async getUnreadCount(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const unreadCount = await chatService.getUnreadCount(
        null as any, // tenantDb parameter is not used
        req.user.tenantId,
        req.user.userId || req.user.id
      );

      res.json({ unreadCount });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Mark all messages in a conversation as read
  async markConversationAsRead(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
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
  async deleteConversation(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
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
