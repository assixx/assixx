/**
 * Chat Service
 *
 * Native NestJS implementation for real-time messaging.
 * No Express dependencies - uses DatabaseService directly.
 *
 * Architecture:
 * - Users: Get chat-available users based on role permissions
 * - Conversations: CRUD operations with participants
 * - Messages: Send, receive, read tracking
 * - Scheduled Messages: Future message delivery
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { v7 as uuidv7 } from 'uuid';

import { eventBus } from '../../utils/eventBus.js';
import { DatabaseService } from '../database/database.service.js';
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

// ============================================
// Constants
// ============================================

const ERROR_FEATURE_NOT_IMPLEMENTED = 'Feature not yet implemented';

// ============================================
// Types
// ============================================

/**
 * User permissions for chat access control
 */
interface UserPermissions {
  role: string;
  department_id: number | null;
}

/**
 * Input for message attachment
 */
interface MessageAttachmentInput {
  path: string;
  filename: string;
  mimeType: string;
  size: number;
}

/**
 * Sender info from database
 */
interface SenderInfo {
  username: string;
  first_name: string | null;
  last_name: string | null;
  profile_picture: string | null;
}

/**
 * Database row for chat user
 */
interface ChatUserRow {
  id: number;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  employee_number: string | null;
  profile_picture: string | null;
  department_id: number | null;
  department_name: string | null;
  area_id: number | null;
  area_name: string | null;
  role: string;
}

/**
 * API response for chat user
 */
interface ChatUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  employeeNumber: string | null;
  profilePicture: string | null;
  departmentId: number | null;
  departmentName: string | null;
  teamAreaId: number | null;
  teamAreaName: string | null;
  role: string;
  status: string;
  lastSeen: Date | null;
}

/**
 * Database row for conversation
 */
interface ConversationRow {
  id: number;
  uuid: string;
  name: string | null;
  is_group: boolean;
  created_at: Date;
  updated_at: Date;
  last_message_content: string | null;
  last_message_time: Date | null;
}

/**
 * Database row for participant
 */
interface ParticipantRow {
  conversation_id: number;
  user_id: number;
  joined_at: Date;
  is_admin: boolean;
  username: string;
  first_name: string | null;
  last_name: string | null;
  profile_picture: string | null;
}

/**
 * API response for participant
 */
interface ConversationParticipant {
  id: number;
  userId: number;
  username: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | undefined;
  joinedAt: Date;
  isActive: boolean;
}

/**
 * API response for conversation
 */
interface Conversation {
  id: number;
  uuid: string;
  name: string | null;
  isGroup: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastMessage: { content: string; createdAt: string } | null;
  unreadCount: number;
  participants: ConversationParticipant[];
}

/**
 * Database row for message
 */
interface MessageRow {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender_username: string;
  sender_first_name: string | null;
  sender_last_name: string | null;
  sender_profile_picture: string | null;
  content: string;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_size: number | null;
  created_at: Date;
  is_read: number;
  read_at: Date | null;
}

/**
 * API response for message attachment
 */
interface MessageAttachment {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

/**
 * API response for message
 */
interface Message {
  id: number;
  conversationId: number;
  senderId: number | null;
  senderName: string;
  senderUsername: string;
  senderProfilePicture: string | null;
  content: string;
  attachment: MessageAttachment | null;
  attachments: DocumentAttachment[];
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Document-based attachment
 */
interface DocumentAttachment {
  id: number;
  fileUuid: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  downloadUrl: string;
  createdAt?: string | undefined;
}

/**
 * Pagination meta
 */
interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Database row for scheduled message
 */
interface ScheduledMessageRow {
  id: string;
  tenant_id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_size: number | null;
  scheduled_for: Date;
  is_active: number;
  created_at: Date;
  sent_at: Date | null;
}

/**
 * API response for scheduled message
 */
interface ScheduledMessage {
  id: string;
  conversationId: number;
  senderId: number;
  content: string;
  scheduledFor: string;
  status: 'pending' | 'sent' | 'cancelled';
  createdAt: string;
  sentAt: string | null;
  attachment: { path: string; name: string; type: string; size: number } | null;
}

/**
 * Unread count summary
 */
interface UnreadCountSummary {
  totalUnread: number;
  conversations: {
    conversationId: number;
    conversationName: string | null;
    unreadCount: number;
    lastMessageTime: Date;
  }[];
}

// ============================================
// Constants
// ============================================

const SCHEDULED_STATUS = {
  CANCELLED: 0,
  PENDING: 1,
  SENT: 4,
} as const;

const MIN_SCHEDULE_MINUTES = 5;
const MAX_SCHEDULE_DAYS = 30;

// ============================================
// Service
// ============================================

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly cls: ClsService,
    private readonly databaseService: DatabaseService,
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
  // Users
  // ============================================

  /**
   * Get users available for chat based on role permissions
   */
  async getChatUsers(
    query: GetUsersQuery,
  ): Promise<{ users: ChatUser[]; total: number }> {
    const tenantId = this.getTenantId();
    const userId = this.getUserId();
    this.logger.debug(
      `Getting chat users for tenant ${tenantId}, user ${userId}`,
    );

    const currentUser = await this.getCurrentUserPermissions(tenantId, userId);
    const users = await this.fetchChatUsersByPermissions(
      tenantId,
      userId,
      currentUser,
    );
    const filteredUsers = this.filterUsersBySearch(users, query.search);
    const chatUsers = filteredUsers.map((user: ChatUserRow) =>
      this.mapRowToChatUser(user),
    );

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
    const isPrivileged =
      currentUser.role === 'admin' || currentUser.role === 'root';

    if (isPrivileged) {
      return await this.databaseService.query<ChatUserRow>(
        `${baseQuery} WHERE u.tenant_id = $1 AND u.id != $2 AND u.is_active = 1`,
        [tenantId, userId],
      );
    }
    return await this.databaseService.query<ChatUserRow>(
      `${baseQuery} WHERE u.tenant_id = $1 AND u.id != $2 AND u.is_active = 1 AND (ud.department_id = $3 OR u.role IN ('admin', 'root'))`,
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

  /** Filter users by search term (username, email, or full name) */
  private filterUsersBySearch(
    users: ChatUserRow[],
    search: string | undefined,
  ): ChatUserRow[] {
    if (search === undefined || search === '') {
      return users;
    }
    const searchLower = search.toLowerCase();
    return users.filter((user: ChatUserRow) => {
      const fullName =
        `${user.first_name ?? ''} ${user.last_name ?? ''}`.toLowerCase();
      return (
        user.username.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower) ||
        fullName.includes(searchLower)
      );
    });
  }

  /** Transform database row to API response format */
  private mapRowToChatUser(user: ChatUserRow): ChatUser {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name ?? '',
      lastName: user.last_name ?? '',
      employeeNumber: user.employee_number,
      profilePicture: user.profile_picture,
      departmentId: user.department_id,
      departmentName: user.department_name,
      teamAreaId: user.area_id,
      teamAreaName: user.area_name,
      role: user.role,
      status: 'offline',
      lastSeen: null,
    };
  }

  // ============================================
  // Conversations
  // ============================================

  /**
   * Get user's conversations with pagination and filters
   */
  async getConversations(
    query: GetConversationsQuery,
  ): Promise<{ data: Conversation[]; pagination: PaginationMeta }> {
    const tenantId = this.getTenantId();
    const userId = this.getUserId();
    this.logger.debug(
      `Getting conversations for tenant ${tenantId}, user ${userId}`,
    );

    const page = query.page ?? 1;
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const offset = (page - 1) * limit;

    const totalItems = await this.getConversationCount(tenantId, userId);
    const conversations = await this.fetchConversationsPage(
      tenantId,
      userId,
      limit,
      offset,
    );

    if (conversations.length === 0) {
      return {
        data: [],
        pagination: this.buildPaginationMeta(page, limit, totalItems),
      };
    }

    const conversationIds = conversations.map((c: ConversationRow) => c.id);
    const participants =
      await this.fetchParticipantsForConversations(conversationIds);
    const unreadCounts = await this.getUnreadCounts(conversationIds, userId);

    const data = conversations.map((conv: ConversationRow) =>
      this.mapConversationToApiFormat(conv, participants, unreadCounts),
    );

    return {
      data,
      pagination: this.buildPaginationMeta(page, limit, totalItems),
    };
  }

  /**
   * Get total count of conversations for a user
   * WhatsApp-style: Show conversation if not deleted OR if new messages exist after deletion
   */
  private async getConversationCount(
    tenantId: number,
    userId: number,
  ): Promise<number> {
    const countResult = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(DISTINCT c.id) as count
       FROM conversations c
       INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
       WHERE c.tenant_id = $1 AND cp.user_id = $2 AND c.is_active = 1
         AND (
           cp.deleted_at IS NULL
           OR EXISTS (
             SELECT 1 FROM messages m
             WHERE m.conversation_id = c.id AND m.created_at > cp.deleted_at
           )
         )`,
      [tenantId, userId],
    );
    return Number.parseInt(countResult[0]?.count ?? '0', 10);
  }

  /**
   * Fetch paginated conversations for a user
   * WhatsApp-style: Show conversation if not deleted OR if new messages exist after deletion
   * Also filters last_message to only show messages after deleted_at
   */
  private async fetchConversationsPage(
    tenantId: number,
    userId: number,
    limit: number,
    offset: number,
  ): Promise<ConversationRow[]> {
    return await this.databaseService.query<ConversationRow>(
      `SELECT DISTINCT c.id, c.uuid, c.name, c.is_group, c.created_at, c.updated_at,
        (SELECT m.content FROM messages m
         WHERE m.conversation_id = c.id
           AND (cp.deleted_at IS NULL OR m.created_at > cp.deleted_at)
         ORDER BY m.created_at DESC LIMIT 1) as last_message_content,
        (SELECT m.created_at FROM messages m
         WHERE m.conversation_id = c.id
           AND (cp.deleted_at IS NULL OR m.created_at > cp.deleted_at)
         ORDER BY m.created_at DESC LIMIT 1) as last_message_time
       FROM conversations c
       INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
       WHERE c.tenant_id = $1 AND cp.user_id = $2 AND c.is_active = 1
         AND (
           cp.deleted_at IS NULL
           OR EXISTS (
             SELECT 1 FROM messages m
             WHERE m.conversation_id = c.id AND m.created_at > cp.deleted_at
           )
         )
       ORDER BY c.updated_at DESC
       LIMIT $3 OFFSET $4`,
      [tenantId, userId, limit, offset],
    );
  }

  /** Fetch participants for given conversation IDs */
  private async fetchParticipantsForConversations(
    conversationIds: number[],
  ): Promise<ParticipantRow[]> {
    const placeholders = conversationIds
      .map((_: number, i: number) => `$${i + 1}`)
      .join(',');
    return await this.databaseService.query<ParticipantRow>(
      `SELECT cp.conversation_id, cp.user_id, cp.joined_at, cp.is_admin,
              u.username, u.first_name, u.last_name, u.profile_picture
       FROM conversation_participants cp
       INNER JOIN users u ON cp.user_id = u.id
       WHERE cp.conversation_id IN (${placeholders})`,
      conversationIds,
    );
  }

  /** Get participant IDs for a conversation, excluding the sender */
  private async getConversationRecipientIds(
    conversationId: number,
    excludeUserId: number,
  ): Promise<number[]> {
    const participants = await this.databaseService.query<{ user_id: number }>(
      `SELECT user_id FROM conversation_participants WHERE conversation_id = $1`,
      [conversationId],
    );
    return participants
      .map((p: { user_id: number }) => p.user_id)
      .filter((id: number) => id !== excludeUserId);
  }

  /** Transform conversation row to API format */
  private mapConversationToApiFormat(
    conv: ConversationRow,
    participants: ParticipantRow[],
    unreadCounts: Map<number, number>,
  ): Conversation {
    const convParticipants = participants
      .filter((p: ParticipantRow) => p.conversation_id === conv.id)
      .map((p: ParticipantRow) => ({
        id: p.user_id,
        userId: p.user_id,
        username: p.username,
        firstName: p.first_name ?? '',
        lastName: p.last_name ?? '',
        profileImageUrl: p.profile_picture ?? undefined,
        joinedAt: new Date(p.joined_at),
        isActive: true,
      }));

    let lastMessage: { content: string; createdAt: string } | null = null;
    if (conv.last_message_content !== null && conv.last_message_time !== null) {
      lastMessage = {
        content: conv.last_message_content,
        createdAt: new Date(conv.last_message_time).toISOString(),
      };
    }

    return {
      id: conv.id,
      uuid: conv.uuid.trim(),
      name: conv.name,
      isGroup: conv.is_group,
      createdAt: new Date(conv.created_at),
      updatedAt: new Date(conv.updated_at),
      lastMessage,
      unreadCount: unreadCounts.get(conv.id) ?? 0,
      participants: convParticipants,
    };
  }

  /**
   * Get single conversation by ID
   */
  async getConversation(
    conversationId: number,
  ): Promise<{ conversation: Conversation }> {
    const tenantId = this.getTenantId();
    const userId = this.getUserId();

    // Check if user is participant
    const participant = await this.databaseService.query<{ user_id: number }>(
      `SELECT user_id FROM conversation_participants
       WHERE conversation_id = $1 AND user_id = $2 AND tenant_id = $3`,
      [conversationId, userId, tenantId],
    );

    if (participant.length === 0) {
      throw new NotFoundException('Conversation not found');
    }

    const conversations = await this.databaseService.query<ConversationRow>(
      `SELECT id, uuid, name, is_group, created_at, updated_at
       FROM conversations
       WHERE id = $1 AND tenant_id = $2 AND is_active = 1`,
      [conversationId, tenantId],
    );

    if (conversations.length === 0) {
      throw new NotFoundException('Conversation not found');
    }

    const conv = conversations[0];
    if (conv === undefined) {
      throw new NotFoundException('Conversation not found');
    }

    const participants = await this.databaseService.query<ParticipantRow>(
      `SELECT cp.conversation_id, cp.user_id, cp.joined_at, cp.is_admin,
              u.username, u.first_name, u.last_name, u.profile_picture
       FROM conversation_participants cp
       INNER JOIN users u ON cp.user_id = u.id
       WHERE cp.conversation_id = $1 AND cp.tenant_id = $2`,
      [conversationId, tenantId],
    );

    const convParticipants = participants.map((p: ParticipantRow) => ({
      id: p.user_id,
      userId: p.user_id,
      username: p.username,
      firstName: p.first_name ?? '',
      lastName: p.last_name ?? '',
      profileImageUrl: p.profile_picture ?? undefined,
      joinedAt: new Date(p.joined_at),
      isActive: true,
    }));

    return {
      conversation: {
        id: conv.id,
        uuid: conv.uuid.trim(),
        name: conv.name,
        isGroup: conv.is_group,
        createdAt: new Date(conv.created_at),
        updatedAt: new Date(conv.updated_at),
        lastMessage: null,
        unreadCount: 0,
        participants: convParticipants,
      },
    };
  }

  /**
   * Create a new conversation
   */
  async createConversation(
    dto: CreateConversationBody,
  ): Promise<{ conversation: Conversation }> {
    const tenantId = this.getTenantId();
    const creatorId = this.getUserId();
    this.logger.log(
      `Creating conversation for tenant ${tenantId}, creator ${creatorId}`,
    );

    const isGroup = dto.isGroup ?? dto.participantIds.length > 1;

    // Return existing 1:1 conversation if found
    const existing = await this.tryGetExisting1to1Conversation(
      tenantId,
      creatorId,
      dto,
      isGroup,
    );
    if (existing !== null) {
      return existing;
    }

    await this.validateParticipantIds(dto.participantIds, tenantId);
    const conversationId = await this.insertConversation(
      tenantId,
      dto.name,
      isGroup,
    );
    await this.addConversationParticipants(
      tenantId,
      conversationId,
      creatorId,
      dto.participantIds,
    );
    await this.sendInitialMessageIfProvided(
      tenantId,
      conversationId,
      creatorId,
      dto.initialMessage,
    );

    return await this.getConversation(conversationId);
  }

  /** Check for existing 1:1 conversation and return it if found */
  private async tryGetExisting1to1Conversation(
    tenantId: number,
    creatorId: number,
    dto: CreateConversationBody,
    isGroup: boolean,
  ): Promise<{ conversation: Conversation } | null> {
    if (isGroup || dto.participantIds.length !== 1) {
      return null;
    }

    const participantId = dto.participantIds[0];
    if (participantId === undefined) {
      throw new BadRequestException('Participant ID is required');
    }

    const existingId = await this.findExisting1to1(
      tenantId,
      creatorId,
      participantId,
    );
    if (existingId === null) {
      return null;
    }

    await this.sendInitialMessageIfProvided(
      tenantId,
      existingId,
      creatorId,
      dto.initialMessage,
    );
    return await this.getConversation(existingId);
  }

  /** Validate that all participant IDs exist in the same tenant */
  private async validateParticipantIds(
    participantIds: number[],
    tenantId: number,
  ): Promise<void> {
    if (participantIds.length === 0) {
      return;
    }

    const validationResult = await this.databaseService.query<{ id: number }>(
      `SELECT id FROM users WHERE id = ANY($1::int[]) AND tenant_id = $2 AND is_active = 1`,
      [participantIds, tenantId],
    );

    const validIds = new Set(validationResult.map((r: { id: number }) => r.id));
    const invalidIds = participantIds.filter((id: number) => !validIds.has(id));

    if (invalidIds.length > 0) {
      throw new BadRequestException(
        `Invalid participant IDs: ${invalidIds.join(', ')}. Users must exist and belong to the same tenant.`,
      );
    }
  }

  /** Insert a new conversation and return its ID */
  private async insertConversation(
    tenantId: number,
    name: string | undefined,
    isGroup: boolean,
  ): Promise<number> {
    const uuid = uuidv7();
    const insertResult = await this.databaseService.query<{ id: number }>(
      `INSERT INTO conversations (tenant_id, name, is_group, uuid, uuid_created_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())
       RETURNING id`,
      [tenantId, name ?? null, isGroup ? 1 : 0, uuid],
    );

    const conversationId = insertResult[0]?.id;
    if (conversationId === undefined) {
      throw new BadRequestException('Failed to create conversation');
    }
    return conversationId;
  }

  /** Add creator and participants to a conversation */
  private async addConversationParticipants(
    tenantId: number,
    conversationId: number,
    creatorId: number,
    participantIds: number[],
  ): Promise<void> {
    // Add creator as admin
    await this.databaseService.query(
      `INSERT INTO conversation_participants (tenant_id, conversation_id, user_id, is_admin, joined_at)
       VALUES ($1, $2, $3, true, NOW())`,
      [tenantId, conversationId, creatorId],
    );

    // Add other participants
    for (const participantId of participantIds) {
      await this.databaseService.query(
        `INSERT INTO conversation_participants (tenant_id, conversation_id, user_id, is_admin, joined_at)
         VALUES ($1, $2, $3, false, NOW())`,
        [tenantId, conversationId, participantId],
      );
    }
  }

  /** Send initial message if provided and non-empty */
  private async sendInitialMessageIfProvided(
    tenantId: number,
    conversationId: number,
    senderId: number,
    initialMessage: string | undefined,
  ): Promise<void> {
    if (initialMessage !== undefined && initialMessage !== '') {
      await this.insertMessage(
        tenantId,
        conversationId,
        senderId,
        initialMessage,
      );
    }
  }

  /**
   * Update a conversation (stub)
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- Stub method
  async updateConversation(
    _conversationId: number,
    _dto: UpdateConversationBody,
  ): Promise<never> {
    throw new BadRequestException(ERROR_FEATURE_NOT_IMPLEMENTED);
  }

  /**
   * Delete conversation for current user only (per-user soft delete)
   *
   * This implements WhatsApp-style "delete for me" behavior:
   * - Only hides the conversation for the user who deletes it
   * - Other participants still see the conversation
   * - Any participant can delete for themselves (no admin required)
   */
  async deleteConversation(
    conversationId: number,
  ): Promise<{ message: string }> {
    const tenantId = this.getTenantId();
    const userId = this.getUserId();

    // Check if user is participant and not already deleted
    const participant = await this.databaseService.query<{
      id: number;
      deleted_at: Date | null;
    }>(
      `SELECT id, deleted_at FROM conversation_participants
       WHERE conversation_id = $1 AND user_id = $2 AND tenant_id = $3`,
      [conversationId, userId, tenantId],
    );

    const participantRecord = participant[0];
    if (participantRecord === undefined) {
      throw new ForbiddenException(
        'You are not a participant of this conversation',
      );
    }

    if (participantRecord.deleted_at !== null) {
      throw new BadRequestException('Conversation already deleted');
    }

    // Per-user soft delete: only mark THIS user's participant record as deleted
    // Other participants still see the conversation
    await this.databaseService.query(
      `UPDATE conversation_participants SET deleted_at = NOW()
       WHERE conversation_id = $1 AND user_id = $2 AND tenant_id = $3`,
      [conversationId, userId, tenantId],
    );

    return { message: 'Conversation deleted successfully' };
  }

  // ============================================
  // Messages
  // ============================================

  /**
   * Get messages from a conversation
   * WhatsApp-style: Only shows messages after user's deleted_at timestamp
   */
  async getMessages(
    conversationId: number,
    query: GetMessagesQuery,
  ): Promise<{ data: Message[]; pagination: PaginationMeta }> {
    const tenantId = this.getTenantId();
    const userId = this.getUserId();
    await this.verifyConversationAccess(conversationId, userId, tenantId);

    const page = query.page ?? 1;
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const offset = (page - 1) * limit;

    // Get user's deleted_at timestamp for this conversation
    const participantInfo = await this.databaseService.query<{
      deleted_at: Date | null;
    }>(
      `SELECT deleted_at FROM conversation_participants
       WHERE conversation_id = $1 AND user_id = $2 AND tenant_id = $3`,
      [conversationId, userId, tenantId],
    );
    const deletedAt = participantInfo[0]?.deleted_at ?? null;

    const { whereClause, params, paramIndex } = this.buildMessagesWhereClause(
      conversationId,
      tenantId,
      query,
      deletedAt,
    );

    const totalItems = await this.getMessagesCount(whereClause, params);
    const messages = await this.fetchMessages(
      whereClause,
      params,
      paramIndex,
      limit,
      offset,
      userId,
    );
    const data = messages.map((msg: MessageRow) => this.transformMessage(msg));
    await this.attachDocumentsToMessages(data, tenantId);

    return {
      data,
      pagination: this.buildPaginationMeta(page, limit, totalItems),
    };
  }

  /**
   * Build WHERE clause for messages query based on filters
   * WhatsApp-style: Filters messages to only show those after deletedAt timestamp
   */
  private buildMessagesWhereClause(
    conversationId: number,
    tenantId: number,
    query: GetMessagesQuery,
    deletedAt: Date | null,
  ): { whereClause: string; params: unknown[]; paramIndex: number } {
    let whereClause = 'WHERE m.conversation_id = $1 AND m.tenant_id = $2';
    const params: unknown[] = [conversationId, tenantId];
    let paramIndex = 3;

    // WhatsApp-style: Only show messages after user's deleted_at timestamp
    if (deletedAt !== null) {
      whereClause += ` AND m.created_at > $${paramIndex}`;
      params.push(deletedAt);
      paramIndex++;
    }

    if (query.search !== undefined && query.search !== '') {
      whereClause += ` AND m.content LIKE $${paramIndex}`;
      params.push(`%${query.search}%`);
      paramIndex++;
    }
    if (query.startDate !== undefined) {
      whereClause += ` AND m.created_at >= $${paramIndex}`;
      params.push(new Date(query.startDate));
      paramIndex++;
    }
    if (query.endDate !== undefined) {
      whereClause += ` AND m.created_at <= $${paramIndex}`;
      params.push(new Date(query.endDate));
      paramIndex++;
    }
    if (query.hasAttachment === true) {
      whereClause += ' AND m.attachment_path IS NOT NULL';
    }

    return { whereClause, params, paramIndex };
  }

  /** Get total count of messages matching the query */
  private async getMessagesCount(
    whereClause: string,
    params: unknown[],
  ): Promise<number> {
    const countResult = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM messages m ${whereClause}`,
      params,
    );
    return Number.parseInt(countResult[0]?.count ?? '0', 10);
  }

  /** Fetch messages with pagination */
  private async fetchMessages(
    whereClause: string,
    params: unknown[],
    paramIndex: number,
    limit: number,
    offset: number,
    userId: number,
  ): Promise<MessageRow[]> {
    const queryParams = [...params, limit, offset];
    return await this.databaseService.query<MessageRow>(
      `SELECT
        m.id, m.conversation_id, m.sender_id, m.content,
        m.attachment_path, m.attachment_name, m.attachment_type, m.attachment_size,
        m.created_at,
        u.username as sender_username, u.first_name as sender_first_name,
        u.last_name as sender_last_name, u.profile_picture as sender_profile_picture,
        CASE
          WHEN m.sender_id = ${userId} THEN
            CASE WHEN EXISTS (
              SELECT 1 FROM conversation_participants other_cp
              WHERE other_cp.conversation_id = m.conversation_id
              AND other_cp.user_id != ${userId}
              AND other_cp.last_read_message_id >= m.id
            ) THEN 1 ELSE 0 END
          WHEN m.id <= COALESCE(cp.last_read_message_id, 0) THEN 1
          ELSE 0
        END as is_read,
        CASE WHEN m.id <= COALESCE(cp.last_read_message_id, 0) THEN cp.last_read_at ELSE NULL END as read_at
       FROM messages m
       INNER JOIN users u ON m.sender_id = u.id
       LEFT JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = ${userId}
       ${whereClause}
       ORDER BY m.created_at ASC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      queryParams,
    );
  }

  /** Load and attach document attachments to messages */
  private async attachDocumentsToMessages(
    messages: Message[],
    tenantId: number,
  ): Promise<void> {
    const messageIds = messages.map((m: Message) => m.id);
    if (messageIds.length === 0) {
      return;
    }
    const attachmentMap = await this.loadDocumentAttachments(
      messageIds,
      tenantId,
    );
    for (const message of messages) {
      message.attachments = attachmentMap.get(message.id) ?? [];
    }
  }

  /**
   * Send a message to a conversation
   */
  async sendMessage(
    conversationId: number,
    dto: SendMessageBody,
    attachment?: MessageAttachmentInput,
  ): Promise<{ message: Message }> {
    const tenantId = this.getTenantId();
    const senderId = this.getUserId();
    await this.verifyConversationAccess(conversationId, senderId, tenantId);

    const content = this.resolveMessageContent(dto.message, attachment);
    const { id: messageId, uuid: messageUuid } = await this.insertMessageRecord(
      tenantId,
      conversationId,
      senderId,
      content,
      attachment,
    );
    await this.updateConversationTimestamp(conversationId, tenantId);
    const sender = await this.fetchSenderInfo(senderId, tenantId);

    // Emit event for SSE notifications (notify all participants except sender)
    const recipientIds = await this.getConversationRecipientIds(
      conversationId,
      senderId,
    );
    eventBus.emitNewMessage(tenantId, {
      id: messageId,
      uuid: messageUuid,
      conversationId,
      senderId,
      recipientIds,
      preview: content.substring(0, 50),
    });

    return {
      message: this.buildSentMessage(
        messageId,
        conversationId,
        senderId,
        content,
        sender,
        attachment,
      ),
    };
  }

  /** Resolve message content, using placeholder for attachment-only messages */
  private resolveMessageContent(
    message: string | undefined,
    attachment?: MessageAttachmentInput,
  ): string {
    let content = message ?? '';
    if (attachment !== undefined && content === '') {
      content = '📎 Attachment';
    }
    if (content === '' && attachment === undefined) {
      throw new BadRequestException(
        'Message content or attachment is required',
      );
    }
    return content;
  }

  /** Insert a message record and return its ID and UUID */
  private async insertMessageRecord(
    tenantId: number,
    conversationId: number,
    senderId: number,
    content: string,
    attachment?: MessageAttachmentInput,
  ): Promise<{ id: number; uuid: string }> {
    const messageUuid = uuidv7();
    const insertResult = await this.databaseService.query<{
      id: number;
      uuid: string;
    }>(
      `INSERT INTO messages (tenant_id, conversation_id, sender_id, content,
         attachment_path, attachment_name, attachment_type, attachment_size,
         uuid, uuid_created_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING id, uuid`,
      [
        tenantId,
        conversationId,
        senderId,
        content,
        attachment?.path ?? null,
        attachment?.filename ?? null,
        attachment?.mimeType ?? null,
        attachment?.size ?? null,
        messageUuid,
      ],
    );
    return {
      id: insertResult[0]?.id ?? 0,
      uuid: insertResult[0]?.uuid ?? messageUuid,
    };
  }

  /** Update conversation's updated_at timestamp */
  private async updateConversationTimestamp(
    conversationId: number,
    tenantId: number,
  ): Promise<void> {
    await this.databaseService.query(
      `UPDATE conversations SET updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [conversationId, tenantId],
    );
  }

  /**
   * Fetch sender information for message response
   * SECURITY: Only returns info for ACTIVE users (is_active = 1)
   */
  private async fetchSenderInfo(
    senderId: number,
    tenantId: number,
  ): Promise<SenderInfo> {
    const senderInfo = await this.databaseService.query<SenderInfo>(
      `SELECT username, first_name, last_name, profile_picture FROM users WHERE id = $1 AND tenant_id = $2 AND is_active = 1`,
      [senderId, tenantId],
    );
    const sender = senderInfo[0];
    if (sender === undefined) {
      throw new NotFoundException('Sender not found or inactive');
    }
    return sender;
  }

  /** Build Message response object */
  private buildSentMessage(
    messageId: number,
    conversationId: number,
    senderId: number,
    content: string,
    sender: SenderInfo,
    attachment?: MessageAttachmentInput,
  ): Message {
    const fullName =
      `${sender.first_name ?? ''} ${sender.last_name ?? ''}`.trim();
    return {
      id: messageId,
      conversationId,
      senderId,
      senderName: fullName !== '' ? fullName : 'Unknown',
      senderUsername: sender.username,
      senderProfilePicture: sender.profile_picture,
      content,
      attachment:
        attachment !== undefined ?
          {
            url: attachment.path,
            filename: attachment.filename,
            mimeType: attachment.mimeType,
            size: attachment.size,
          }
        : null,
      attachments: [],
      isRead: false,
      readAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Edit a message (stub)
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- Stub method
  async editMessage(_messageId: number, _dto: EditMessageBody): Promise<never> {
    throw new BadRequestException(ERROR_FEATURE_NOT_IMPLEMENTED);
  }

  /**
   * Delete a message (stub)
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- Stub method
  async deleteMessage(_messageId: number): Promise<never> {
    throw new BadRequestException(ERROR_FEATURE_NOT_IMPLEMENTED);
  }

  /**
   * Mark conversation as read
   */
  async markAsRead(conversationId: number): Promise<{ markedCount: number }> {
    const tenantId = this.getTenantId();
    const userId = this.getUserId();

    // Verify access
    await this.verifyConversationAccess(conversationId, userId, tenantId);

    // Get latest message ID
    const latestMessage = await this.databaseService.query<{
      max_id: number | null;
    }>(
      `SELECT MAX(id) as max_id FROM messages WHERE conversation_id = $1 AND tenant_id = $2`,
      [conversationId, tenantId],
    );

    const lastMessageId = latestMessage[0]?.max_id ?? 0;

    // Update last read
    await this.databaseService.query(
      `UPDATE conversation_participants
       SET last_read_message_id = $1, last_read_at = NOW()
       WHERE conversation_id = $2 AND user_id = $3 AND tenant_id = $4`,
      [lastMessageId, conversationId, userId, tenantId],
    );

    return { markedCount: lastMessageId };
  }

  /**
   * Get unread count summary
   */
  async getUnreadCount(): Promise<UnreadCountSummary> {
    const tenantId = this.getTenantId();
    const userId = this.getUserId();

    interface UnreadRow {
      conversationId: number;
      conversationName: string | null;
      unreadCount: string | number;
      lastMessageTime: Date;
    }

    const rows = await this.databaseService.query<UnreadRow>(
      `SELECT
        c.id as "conversationId",
        c.name as "conversationName",
        COUNT(CASE
          WHEN m.id > COALESCE(cp.last_read_message_id, 0)
          AND m.sender_id != $1
          THEN 1
        END) as "unreadCount",
        MAX(m.created_at) as "lastMessageTime"
       FROM conversations c
       INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
       LEFT JOIN messages m ON m.conversation_id = c.id
       WHERE c.tenant_id = $2
       AND c.is_active = 1
       AND cp.user_id = $1
       AND cp.tenant_id = $2
       GROUP BY c.id, c.name
       HAVING COUNT(CASE
         WHEN m.id > COALESCE(cp.last_read_message_id, 0)
         AND m.sender_id != $1
         THEN 1
       END) > 0
       ORDER BY MAX(m.created_at) DESC`,
      [userId, tenantId],
    );

    const conversations = rows.map((row: UnreadRow) => ({
      conversationId: row.conversationId,
      conversationName: row.conversationName,
      unreadCount: Number(row.unreadCount),
      lastMessageTime: new Date(row.lastMessageTime),
    }));

    const totalUnread = conversations.reduce(
      (sum: number, conv: { unreadCount: number }) => sum + conv.unreadCount,
      0,
    );

    return { totalUnread, conversations };
  }

  /**
   * Search messages (stub)
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- Stub method
  async searchMessages(_query: SearchMessagesQuery): Promise<never> {
    throw new BadRequestException(ERROR_FEATURE_NOT_IMPLEMENTED);
  }

  // ============================================
  // Participants
  // ============================================

  /**
   * Add participants (stub)
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- Stub method
  async addParticipants(
    _conversationId: number,
    _dto: AddParticipantsBody,
  ): Promise<never> {
    throw new BadRequestException(ERROR_FEATURE_NOT_IMPLEMENTED);
  }

  /**
   * Remove participant (stub)
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- Stub method
  async removeParticipant(
    _conversationId: number,
    _userId: number,
  ): Promise<never> {
    throw new BadRequestException(ERROR_FEATURE_NOT_IMPLEMENTED);
  }

  /**
   * Leave conversation (stub)
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- Stub method
  async leaveConversation(_conversationId: number): Promise<never> {
    throw new BadRequestException(ERROR_FEATURE_NOT_IMPLEMENTED);
  }

  // ============================================
  // Scheduled Messages
  // ============================================

  /**
   * Create a scheduled message
   */
  async createScheduledMessage(
    dto: CreateScheduledMessageBody,
  ): Promise<ScheduledMessage> {
    const tenantId = this.getTenantId();
    const userId = this.getUserId();

    // Verify access
    await this.verifyConversationAccess(dto.conversationId, userId, tenantId);

    // Parse and validate scheduled time
    const scheduledFor = new Date(dto.scheduledFor);
    if (Number.isNaN(scheduledFor.getTime())) {
      throw new BadRequestException('Invalid date format');
    }
    this.validateScheduledTime(scheduledFor);

    // Insert scheduled message
    const result = await this.databaseService.query<ScheduledMessageRow>(
      `INSERT INTO scheduled_messages (
        tenant_id, conversation_id, sender_id, content,
        attachment_path, attachment_name, attachment_type, attachment_size,
        scheduled_for
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        tenantId,
        dto.conversationId,
        userId,
        dto.content,
        dto.attachmentPath ?? null,
        dto.attachmentName ?? null,
        dto.attachmentType ?? null,
        dto.attachmentSize ?? null,
        scheduledFor.toISOString(),
      ],
    );

    const row = result[0];
    if (row === undefined) {
      throw new BadRequestException('Failed to create scheduled message');
    }

    return this.mapScheduledMessage(row);
  }

  /**
   * Get user's scheduled messages
   */
  async getScheduledMessages(): Promise<ScheduledMessage[]> {
    const tenantId = this.getTenantId();
    const userId = this.getUserId();

    const result = await this.databaseService.query<ScheduledMessageRow>(
      `SELECT * FROM scheduled_messages
       WHERE sender_id = $1 AND tenant_id = $2 AND is_active = $3
       ORDER BY scheduled_for ASC`,
      [userId, tenantId, SCHEDULED_STATUS.PENDING],
    );

    return result.map((row: ScheduledMessageRow) =>
      this.mapScheduledMessage(row),
    );
  }

  /**
   * Get a specific scheduled message
   */
  async getScheduledMessage(id: string): Promise<ScheduledMessage> {
    const tenantId = this.getTenantId();
    const userId = this.getUserId();

    const result = await this.databaseService.query<ScheduledMessageRow>(
      `SELECT * FROM scheduled_messages
       WHERE id = $1 AND sender_id = $2 AND tenant_id = $3`,
      [id, userId, tenantId],
    );

    const row = result[0];
    if (row === undefined) {
      throw new NotFoundException('Scheduled message not found');
    }

    return this.mapScheduledMessage(row);
  }

  /**
   * Cancel a scheduled message
   */
  async cancelScheduledMessage(id: string): Promise<{ message: string }> {
    const tenantId = this.getTenantId();
    const userId = this.getUserId();

    // Check if message exists
    const existing = await this.databaseService.query<ScheduledMessageRow>(
      `SELECT * FROM scheduled_messages
       WHERE id = $1 AND sender_id = $2 AND tenant_id = $3`,
      [id, userId, tenantId],
    );

    const message = existing[0];
    if (message === undefined) {
      throw new NotFoundException('Scheduled message not found');
    }

    if (message.is_active === SCHEDULED_STATUS.SENT) {
      throw new BadRequestException('This message has already been sent');
    }

    if (message.is_active === SCHEDULED_STATUS.CANCELLED) {
      throw new BadRequestException('This message has already been cancelled');
    }

    await this.databaseService.query(
      `UPDATE scheduled_messages SET is_active = $1 WHERE id = $2`,
      [SCHEDULED_STATUS.CANCELLED, id],
    );

    return { message: 'Scheduled message cancelled successfully' };
  }

  /**
   * Get scheduled messages for a conversation
   */
  async getConversationScheduledMessages(
    conversationId: number,
  ): Promise<ScheduledMessage[]> {
    const tenantId = this.getTenantId();
    const userId = this.getUserId();

    // Verify access
    await this.verifyConversationAccess(conversationId, userId, tenantId);

    const result = await this.databaseService.query<ScheduledMessageRow>(
      `SELECT * FROM scheduled_messages
       WHERE conversation_id = $1 AND sender_id = $2 AND tenant_id = $3 AND is_active = $4
       ORDER BY scheduled_for ASC`,
      [conversationId, userId, tenantId, SCHEDULED_STATUS.PENDING],
    );

    return result.map((row: ScheduledMessageRow) =>
      this.mapScheduledMessage(row),
    );
  }

  // ============================================
  // Private Helpers
  // ============================================

  private buildPaginationMeta(
    page: number,
    limit: number,
    totalItems: number,
  ): PaginationMeta {
    const totalPages = Math.ceil(totalItems / limit);
    return {
      currentPage: page,
      totalPages,
      pageSize: limit,
      totalItems,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  private async verifyConversationAccess(
    conversationId: number,
    userId: number,
    tenantId: number,
  ): Promise<void> {
    const participant = await this.databaseService.query<{ user_id: number }>(
      `SELECT user_id FROM conversation_participants
       WHERE conversation_id = $1 AND user_id = $2 AND tenant_id = $3`,
      [conversationId, userId, tenantId],
    );

    if (participant.length === 0) {
      throw new ForbiddenException(
        'You are not a participant of this conversation',
      );
    }
  }

  private async findExisting1to1(
    tenantId: number,
    user1Id: number,
    user2Id: number,
  ): Promise<number | null> {
    const existing = await this.databaseService.query<{ id: number }>(
      `SELECT c.id
       FROM conversations c
       WHERE c.tenant_id = $1
       AND c.is_group = false
       AND c.is_active = 1
       AND EXISTS (
         SELECT 1 FROM conversation_participants cp1
         WHERE cp1.conversation_id = c.id AND cp1.user_id = $2
       )
       AND EXISTS (
         SELECT 1 FROM conversation_participants cp2
         WHERE cp2.conversation_id = c.id AND cp2.user_id = $3
       )
       AND (
         SELECT COUNT(*) FROM conversation_participants cp3
         WHERE cp3.conversation_id = c.id
       ) = 2`,
      [tenantId, user1Id, user2Id],
    );

    return existing.length > 0 && existing[0] !== undefined ?
        existing[0].id
      : null;
  }

  private async insertMessage(
    tenantId: number,
    conversationId: number,
    senderId: number,
    content: string,
  ): Promise<void> {
    const messageUuid = uuidv7();
    await this.databaseService.query(
      `INSERT INTO messages (tenant_id, conversation_id, sender_id, content, uuid, uuid_created_at, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [tenantId, conversationId, senderId, content, messageUuid],
    );

    await this.databaseService.query(
      `UPDATE conversations SET updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [conversationId, tenantId],
    );
  }

  private async getUnreadCounts(
    conversationIds: number[],
    userId: number,
  ): Promise<Map<number, number>> {
    const unreadCounts = new Map<number, number>();

    if (conversationIds.length === 0) {
      return unreadCounts;
    }

    const convPlaceholders = conversationIds
      .map((_: number, i: number) => `$${i + 1}`)
      .join(',');
    const userIdIndex1 = conversationIds.length + 1;
    const userIdIndex2 = conversationIds.length + 2;

    interface UnreadCountRow {
      conversation_id: number;
      unread_count: string | number;
    }

    // WhatsApp-style: Only count unread messages AFTER user's deleted_at timestamp
    const rows = await this.databaseService.query<UnreadCountRow>(
      `SELECT
        m.conversation_id,
        COUNT(*) as unread_count
       FROM messages m
       LEFT JOIN conversation_participants cp
         ON cp.conversation_id = m.conversation_id
         AND cp.user_id = $${userIdIndex1}
       WHERE m.conversation_id IN (${convPlaceholders})
         AND m.sender_id != $${userIdIndex2}
         AND m.id > COALESCE(cp.last_read_message_id, 0)
         AND (cp.deleted_at IS NULL OR m.created_at > cp.deleted_at)
       GROUP BY m.conversation_id`,
      [...conversationIds, userId, userId],
    );

    for (const row of rows) {
      unreadCounts.set(row.conversation_id, Number(row.unread_count));
    }

    return unreadCounts;
  }

  private transformMessage(msg: MessageRow): Message {
    const fullName =
      `${msg.sender_first_name ?? ''} ${msg.sender_last_name ?? ''}`.trim();
    return {
      id: msg.id,
      conversationId: msg.conversation_id,
      senderId: msg.sender_id,
      senderName: fullName !== '' ? fullName : 'Unknown',
      senderUsername:
        msg.sender_username !== '' ? msg.sender_username : 'unknown',
      senderProfilePicture: msg.sender_profile_picture,
      content: msg.content,
      attachment:
        msg.attachment_path !== null ?
          {
            url: `/api/v2/chat/attachments/${msg.attachment_path}/download`,
            filename: msg.attachment_name ?? 'attachment',
            mimeType: msg.attachment_type ?? 'application/octet-stream',
            size:
              typeof msg.attachment_size === 'number' ? msg.attachment_size : 0,
          }
        : null,
      attachments: [],
      isRead: msg.is_read !== 0,
      readAt: msg.read_at !== null ? new Date(msg.read_at) : null,
      createdAt: new Date(msg.created_at),
      updatedAt: new Date(msg.created_at),
    };
  }

  private async loadDocumentAttachments(
    messageIds: number[],
    tenantId: number,
  ): Promise<Map<number, DocumentAttachment[]>> {
    const attachmentMap = new Map<number, DocumentAttachment[]>();

    if (messageIds.length === 0) {
      return attachmentMap;
    }

    for (const id of messageIds) {
      attachmentMap.set(id, []);
    }

    interface DocumentAttachmentRow {
      id: number;
      message_id: number;
      file_uuid: string;
      filename: string;
      original_name: string;
      file_size: number;
      mime_type: string;
      uploaded_at: Date | null;
    }

    const placeholders = messageIds
      .map((_: number, i: number) => `$${i + 2}`)
      .join(', ');
    const rows = await this.databaseService.query<DocumentAttachmentRow>(
      `SELECT id, message_id, file_uuid, filename, original_name, file_size, mime_type, uploaded_at
       FROM documents
       WHERE message_id IN (${placeholders})
       AND tenant_id = $1
       AND is_active = 1
       ORDER BY id ASC`,
      [tenantId, ...messageIds],
    );

    for (const row of rows) {
      const attachments = attachmentMap.get(row.message_id) ?? [];
      attachments.push({
        id: row.id,
        fileUuid: row.file_uuid,
        fileName: row.filename,
        originalName: row.original_name,
        fileSize: row.file_size,
        mimeType: row.mime_type,
        downloadUrl: `/api/v2/documents/${row.id}/download`,
        ...(row.uploaded_at !== null ?
          { createdAt: new Date(row.uploaded_at).toISOString() }
        : {}),
      });
      attachmentMap.set(row.message_id, attachments);
    }

    return attachmentMap;
  }

  private validateScheduledTime(scheduledFor: Date): void {
    const now = new Date();
    const minTime = new Date(now.getTime() + MIN_SCHEDULE_MINUTES * 60 * 1000);
    const maxTime = new Date(
      now.getTime() + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000,
    );

    if (scheduledFor <= minTime) {
      throw new BadRequestException(
        `Scheduled time must be at least ${MIN_SCHEDULE_MINUTES} minutes in the future`,
      );
    }

    if (scheduledFor > maxTime) {
      throw new BadRequestException(
        `Scheduled time cannot be more than ${MAX_SCHEDULE_DAYS} days in the future`,
      );
    }
  }

  private mapScheduledMessage(row: ScheduledMessageRow): ScheduledMessage {
    let status: 'pending' | 'sent' | 'cancelled';
    switch (row.is_active) {
      case SCHEDULED_STATUS.CANCELLED:
        status = 'cancelled';
        break;
      case SCHEDULED_STATUS.SENT:
        status = 'sent';
        break;
      default:
        status = 'pending';
    }

    let attachment: {
      path: string;
      name: string;
      type: string;
      size: number;
    } | null = null;
    if (
      row.attachment_path !== null &&
      row.attachment_name !== null &&
      row.attachment_type !== null &&
      row.attachment_size !== null
    ) {
      attachment = {
        path: row.attachment_path,
        name: row.attachment_name,
        type: row.attachment_type,
        size: row.attachment_size,
      };
    }

    return {
      id: row.id,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      content: row.content,
      scheduledFor: row.scheduled_for.toISOString(),
      status,
      createdAt: row.created_at.toISOString(),
      sentAt: row.sent_at?.toISOString() ?? null,
      attachment,
    };
  }
}
