/**
 * Chat Service Facade
 *
 * Thin orchestration layer for real-time messaging.
 * Delegates to sub-services for specific domains.
 *
 * Architecture:
 * - Users: Direct handling (small domain, stays in facade)
 * - Conversations: Delegates to ChatConversationsService
 * - Messages: Delegates to ChatMessagesService
 * - Scheduled Messages: Delegates to ChatScheduledService
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

import { DatabaseService } from '../database/database.service.js';
import { ChatConversationsService } from './chat-conversations.service.js';
import { ChatMessagesService } from './chat-messages.service.js';
import { ChatScheduledService } from './chat-scheduled.service.js';
import { filterUsersBySearch, mapRowToChatUser } from './chat.helpers.js';
import type {
  ChatUser,
  ChatUserRow,
  Conversation,
  Message,
  MessageAttachmentInput,
  PaginationMeta,
  ScheduledMessage,
  UnreadCountSummary,
  UserPermissions,
} from './chat.types.js';
import { ERROR_FEATURE_NOT_IMPLEMENTED } from './chat.types.js';
import type {
  AddParticipantsBody,
  CreateConversationBody,
  GetConversationsQuery,
  UpdateConversationBody,
} from './dto/conversation.dto.js';
import type {
  EditMessageBody,
  GetMessagesQuery,
  SearchMessagesQuery,
  SendMessageBody,
} from './dto/message.dto.js';
import type { CreateScheduledMessageBody } from './dto/scheduled-message.dto.js';
import type { GetUsersQuery } from './dto/user.dto.js';
import { PresenceStore } from './presence.store.js';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly cls: ClsService,
    private readonly databaseService: DatabaseService,
    private readonly conversationsService: ChatConversationsService,
    private readonly messagesService: ChatMessagesService,
    private readonly scheduledService: ChatScheduledService,
    private readonly presenceStore: PresenceStore,
  ) {}

  // ============================================
  // Context Helpers
  // ============================================

  private getTenantId(): number {
    const tenantId = this.cls.get<number | undefined>('tenantId');
    if (tenantId === undefined) {
      throw new ForbiddenException('Tenant context not available');
    }
    return tenantId;
  }

  private getUserId(): number {
    const userId = this.cls.get<number | undefined>('userId');
    if (userId === undefined) {
      throw new ForbiddenException('User context not available');
    }
    return userId;
  }

  // ============================================
  // Users (Direct handling - small domain)
  // ============================================

  /**
   * Get users available for chat based on role permissions
   */
  async getChatUsers(query: GetUsersQuery): Promise<{ users: ChatUser[]; total: number }> {
    const tenantId = this.getTenantId();
    const userId = this.getUserId();
    this.logger.debug(`Getting chat users for tenant ${tenantId}, user ${userId}`);

    const currentUser = await this.getCurrentUserPermissions(tenantId, userId);
    const users = await this.fetchChatUsersByPermissions(tenantId, userId, currentUser);
    const filteredUsers = filterUsersBySearch(users, query.search);
    const onlineIds = this.presenceStore.getOnlineUserIds();
    const chatUsers = filteredUsers.map((user: ChatUserRow) => {
      const mapped = mapRowToChatUser(user);
      if (onlineIds.has(user.id)) mapped.status = 'online';
      return mapped;
    });

    return { users: chatUsers, total: chatUsers.length };
  }

  /** Get current user's role and department for permission checks */
  private async getCurrentUserPermissions(
    tenantId: number,
    userId: number,
  ): Promise<UserPermissions> {
    const userPerms = await this.databaseService.query<UserPermissions>(
      `SELECT u.role, ud.department_id
       FROM users u
       LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
       WHERE u.id = $1 AND u.tenant_id = $2`,
      [userId, tenantId],
    );

    const currentUser = userPerms[0];
    if (currentUser === undefined) {
      throw new NotFoundException('Current user not found');
    }
    return currentUser;
  }

  /** Fetch chat users based on current user's role permissions */
  private async fetchChatUsersByPermissions(
    tenantId: number,
    userId: number,
    currentUser: UserPermissions,
  ): Promise<ChatUserRow[]> {
    const baseQuery = this.getChatUsersBaseQuery();
    const isPrivileged = currentUser.role === 'admin' || currentUser.role === 'root';

    if (isPrivileged) {
      return await this.databaseService.query<ChatUserRow>(
        `${baseQuery} WHERE u.tenant_id = $1 AND u.id != $2 AND u.is_active = ${IS_ACTIVE.ACTIVE} AND u.role != 'dummy'`,
        [tenantId, userId],
      );
    }
    return await this.databaseService.query<ChatUserRow>(
      `${baseQuery} WHERE u.tenant_id = $1 AND u.id != $2 AND u.is_active = ${IS_ACTIVE.ACTIVE} AND u.role != 'dummy' AND (ud.department_id = $3 OR u.role IN ('admin', 'root'))`,
      [tenantId, userId, currentUser.department_id],
    );
  }

  /** Base SQL query for fetching chat users with department/area info */
  private getChatUsersBaseQuery(): string {
    return `
      SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.employee_number, u.profile_picture,
        COALESCE(adp.department_id, dept_lead.id, ud.department_id) as department_id,
        COALESCE(dep_admin.name, dept_lead.name, d.name) as department_name,
        COALESCE(aap.area_id, area_lead.id, dep_admin.area_id, dept_lead.area_id, d.area_id) as area_id,
        COALESCE(area_admin.name, area_lead.name, area_via_dep.name, area_via_dept_lead.name, a.name) as area_name,
        u.role
      FROM users u
      LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
      LEFT JOIN departments d ON ud.department_id = d.id
      LEFT JOIN areas a ON d.area_id = a.id
      LEFT JOIN admin_area_permissions aap ON u.id = aap.admin_user_id AND aap.tenant_id = u.tenant_id
      LEFT JOIN areas area_admin ON aap.area_id = area_admin.id
      LEFT JOIN admin_department_permissions adp ON u.id = adp.admin_user_id AND adp.tenant_id = u.tenant_id
      LEFT JOIN departments dep_admin ON adp.department_id = dep_admin.id
      LEFT JOIN areas area_via_dep ON dep_admin.area_id = area_via_dep.id
      LEFT JOIN areas area_lead ON u.id = area_lead.area_lead_id AND area_lead.tenant_id = u.tenant_id
      LEFT JOIN departments dept_lead ON u.id = dept_lead.department_lead_id AND dept_lead.tenant_id = u.tenant_id
      LEFT JOIN areas area_via_dept_lead ON dept_lead.area_id = area_via_dept_lead.id`;
  }

  // ============================================
  // Conversations (Delegated)
  // ============================================

  /**
   * Get user's conversations with pagination and filters
   */
  async getConversations(
    query: GetConversationsQuery,
  ): Promise<{ data: Conversation[]; pagination: PaginationMeta }> {
    return await this.conversationsService.getConversations(query);
  }

  /**
   * Get single conversation by ID
   */
  async getConversation(conversationId: number): Promise<{ conversation: Conversation }> {
    return await this.conversationsService.getConversation(conversationId);
  }

  /**
   * Create a new conversation
   */
  async createConversation(dto: CreateConversationBody): Promise<{ conversation: Conversation }> {
    return await this.conversationsService.createConversation(
      dto,
      this.messagesService.insertMessage.bind(this.messagesService),
    );
  }

  /**
   * Update a conversation
   */
  async updateConversation(conversationId: number, dto: UpdateConversationBody): Promise<never> {
    return await this.conversationsService.updateConversation(conversationId, dto);
  }

  /**
   * Delete conversation for current user
   */
  async deleteConversation(conversationId: number): Promise<{ message: string }> {
    return await this.conversationsService.deleteConversation(conversationId);
  }

  // ============================================
  // Messages (Delegated)
  // ============================================

  /**
   * Get messages from a conversation
   */
  async getMessages(
    conversationId: number,
    query: GetMessagesQuery,
  ): Promise<{ data: Message[]; pagination: PaginationMeta }> {
    return await this.messagesService.getMessages(
      conversationId,
      query,
      this.conversationsService.verifyConversationAccess.bind(this.conversationsService),
    );
  }

  /**
   * Send a message to a conversation
   */
  async sendMessage(
    conversationId: number,
    dto: SendMessageBody,
    attachment?: MessageAttachmentInput,
  ): Promise<{ message: Message }> {
    return await this.messagesService.sendMessage(
      conversationId,
      dto,
      this.conversationsService.verifyConversationAccess.bind(this.conversationsService),
      this.conversationsService.getConversationRecipientIds.bind(this.conversationsService),
      this.conversationsService.updateConversationTimestamp.bind(this.conversationsService),
      attachment,
    );
  }

  /**
   * Edit a message
   */
  async editMessage(messageId: number, dto: EditMessageBody): Promise<never> {
    return await this.messagesService.editMessage(messageId, dto);
  }

  /**
   * Delete a message
   */
  async deleteMessage(messageId: number): Promise<never> {
    return await this.messagesService.deleteMessage(messageId);
  }

  /**
   * Mark conversation as read
   */
  async markAsRead(conversationId: number): Promise<{ markedCount: number }> {
    return await this.messagesService.markAsRead(
      conversationId,
      this.conversationsService.verifyConversationAccess.bind(this.conversationsService),
    );
  }

  /**
   * Get unread count summary
   */
  async getUnreadCount(): Promise<UnreadCountSummary> {
    return await this.messagesService.getUnreadCount();
  }

  /**
   * Search messages
   */
  async searchMessages(query: SearchMessagesQuery): Promise<never> {
    return await this.messagesService.searchMessages(query);
  }

  // ============================================
  // Participants (Stubs - delegated pattern ready)
  // ============================================

  /**
   * Add participants to conversation
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- Stub method
  async addParticipants(_conversationId: number, _dto: AddParticipantsBody): Promise<never> {
    throw new BadRequestException(ERROR_FEATURE_NOT_IMPLEMENTED);
  }

  /**
   * Remove participant from conversation
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- Stub method
  async removeParticipant(_conversationId: number, _userId: number): Promise<never> {
    throw new BadRequestException(ERROR_FEATURE_NOT_IMPLEMENTED);
  }

  /**
   * Leave conversation
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- Stub method
  async leaveConversation(_conversationId: number): Promise<never> {
    throw new BadRequestException(ERROR_FEATURE_NOT_IMPLEMENTED);
  }

  // ============================================
  // Scheduled Messages (Delegated)
  // ============================================

  /**
   * Create a scheduled message
   */
  async createScheduledMessage(dto: CreateScheduledMessageBody): Promise<ScheduledMessage> {
    return await this.scheduledService.createScheduledMessage(
      dto,
      this.conversationsService.verifyConversationAccess.bind(this.conversationsService),
    );
  }

  /**
   * Get user's scheduled messages
   */
  async getScheduledMessages(): Promise<ScheduledMessage[]> {
    return await this.scheduledService.getScheduledMessages();
  }

  /**
   * Get a specific scheduled message
   */
  async getScheduledMessage(id: string): Promise<ScheduledMessage> {
    return await this.scheduledService.getScheduledMessage(id);
  }

  /**
   * Cancel a scheduled message
   */
  async cancelScheduledMessage(id: string): Promise<{ message: string }> {
    return await this.scheduledService.cancelScheduledMessage(id);
  }

  /**
   * Get scheduled messages for a conversation
   */
  async getConversationScheduledMessages(conversationId: number): Promise<ScheduledMessage[]> {
    return await this.scheduledService.getConversationScheduledMessages(
      conversationId,
      this.conversationsService.verifyConversationAccess.bind(this.conversationsService),
    );
  }
}
