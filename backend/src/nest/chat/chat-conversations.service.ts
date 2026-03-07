/**
 * Chat Conversations Service
 *
 * Handles conversation CRUD operations.
 * Sub-service of ChatService facade.
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
import { v7 as uuidv7 } from 'uuid';

import { DatabaseService } from '../database/database.service.js';
import {
  buildPaginationMeta,
  mapConversationToApiFormat,
} from './chat.helpers.js';
import type {
  Conversation,
  ConversationParticipant,
  ConversationRow,
  PaginationMeta,
  ParticipantRow,
} from './chat.types.js';
import { ERROR_FEATURE_NOT_IMPLEMENTED } from './chat.types.js';
import type {
  CreateConversationBody,
  GetConversationsQuery,
  UpdateConversationBody,
} from './dto/conversation.dto.js';
import { PresenceStore } from './presence.store.js';

@Injectable()
export class ChatConversationsService {
  private readonly logger = new Logger(ChatConversationsService.name);

  constructor(
    private readonly cls: ClsService,
    private readonly databaseService: DatabaseService,
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
  // Public Methods
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
        pagination: buildPaginationMeta(page, limit, totalItems),
      };
    }

    const conversationIds = conversations.map((c: ConversationRow) => c.id);
    const participants =
      await this.fetchParticipantsForConversations(conversationIds);
    const unreadCounts = await this.getUnreadCounts(conversationIds, userId);

    const onlineIds = this.presenceStore.getOnlineUserIds();
    const data = conversations.map((conv: ConversationRow) => {
      const mapped = mapConversationToApiFormat(
        conv,
        participants,
        unreadCounts,
      );
      mapped.participants = mapped.participants.map(
        (p: ConversationParticipant) => ({
          ...p,
          status: onlineIds.has(p.id) ? 'online' : 'offline',
        }),
      );
      return mapped;
    });

    return {
      data,
      pagination: buildPaginationMeta(page, limit, totalItems),
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
      `SELECT user_id FROM chat_conversation_participants
       WHERE conversation_id = $1 AND user_id = $2 AND tenant_id = $3`,
      [conversationId, userId, tenantId],
    );

    if (participant.length === 0) {
      throw new NotFoundException('Conversation not found');
    }

    const conversations = await this.databaseService.query<ConversationRow>(
      `SELECT id, uuid, name, is_group, created_at, updated_at
       FROM chat_conversations
       WHERE id = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [conversationId, tenantId],
    );

    const conv = conversations[0];
    if (conv === undefined) {
      throw new NotFoundException('Conversation not found');
    }

    const participants = await this.databaseService.query<ParticipantRow>(
      `SELECT cp.conversation_id, cp.user_id, cp.joined_at, cp.is_admin,
              u.username, u.first_name, u.last_name, u.profile_picture
       FROM chat_conversation_participants cp
       INNER JOIN users u ON cp.user_id = u.id
       WHERE cp.conversation_id = $1 AND cp.tenant_id = $2`,
      [conversationId, tenantId],
    );

    const onlineIds = this.presenceStore.getOnlineUserIds();
    const convParticipants = participants.map((p: ParticipantRow) => ({
      id: p.user_id,
      userId: p.user_id,
      username: p.username,
      firstName: p.first_name ?? '',
      lastName: p.last_name ?? '',
      profileImageUrl: p.profile_picture ?? undefined,
      joinedAt: new Date(p.joined_at),
      isActive: true,
      status:
        onlineIds.has(p.user_id) ? ('online' as const) : ('offline' as const),
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
    sendInitialMessage: (
      tenantId: number,
      conversationId: number,
      senderId: number,
      message: string,
    ) => Promise<void>,
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
      sendInitialMessage,
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

    if (dto.initialMessage !== undefined && dto.initialMessage !== '') {
      await sendInitialMessage(
        tenantId,
        conversationId,
        creatorId,
        dto.initialMessage,
      );
    }

    return await this.getConversation(conversationId);
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
   * WhatsApp-style "delete for me" behavior:
   * - Only hides the conversation for the user who deletes it
   * - Other participants still see the conversation
   */
  async deleteConversation(
    conversationId: number,
  ): Promise<{ message: string }> {
    const tenantId = this.getTenantId();
    const userId = this.getUserId();

    const participant = await this.databaseService.query<{
      id: number;
      deleted_at: Date | null;
    }>(
      `SELECT id, deleted_at FROM chat_conversation_participants
       WHERE conversation_id = $1 AND user_id = $2 AND tenant_id = $3`,
      [conversationId, userId, tenantId],
    );

    const participantRecord = participant[0];
    if (participantRecord === undefined) {
      throw new ForbiddenException(
        'You are not a participant of this conversation',
      );
    }

    // Idempotent: always update deleted_at to NOW() regardless of current state.
    // Handles: re-delete from stale UI, re-hide after new messages surfaced conversation.
    await this.databaseService.query(
      `UPDATE chat_conversation_participants SET deleted_at = NOW()
       WHERE conversation_id = $1 AND user_id = $2 AND tenant_id = $3`,
      [conversationId, userId, tenantId],
    );

    return { message: 'Conversation deleted successfully' };
  }

  /**
   * Verify user has access to conversation
   */
  async verifyConversationAccess(
    conversationId: number,
    userId: number,
    tenantId: number,
  ): Promise<void> {
    const participant = await this.databaseService.query<{ user_id: number }>(
      `SELECT user_id FROM chat_conversation_participants
       WHERE conversation_id = $1 AND user_id = $2 AND tenant_id = $3`,
      [conversationId, userId, tenantId],
    );

    if (participant.length === 0) {
      throw new ForbiddenException(
        'You are not a participant of this conversation',
      );
    }
  }

  /**
   * Get participant IDs for a conversation, excluding the sender
   */
  async getConversationRecipientIds(
    conversationId: number,
    excludeUserId: number,
  ): Promise<number[]> {
    const participants = await this.databaseService.query<{ user_id: number }>(
      `SELECT user_id FROM chat_conversation_participants WHERE conversation_id = $1`,
      [conversationId],
    );
    return participants
      .map((p: { user_id: number }) => p.user_id)
      .filter((id: number) => id !== excludeUserId);
  }

  /**
   * Update conversation's updated_at timestamp
   */
  async updateConversationTimestamp(
    conversationId: number,
    tenantId: number,
  ): Promise<void> {
    await this.databaseService.query(
      `UPDATE chat_conversations SET updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [conversationId, tenantId],
    );
  }

  // ============================================
  // Private Helpers
  // ============================================

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
       FROM chat_conversations c
       INNER JOIN chat_conversation_participants cp ON c.id = cp.conversation_id
       WHERE c.tenant_id = $1 AND cp.user_id = $2 AND c.is_active = ${IS_ACTIVE.ACTIVE}
         AND (
           cp.deleted_at IS NULL
           OR EXISTS (
             SELECT 1 FROM chat_messages m
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
   */
  private async fetchConversationsPage(
    tenantId: number,
    userId: number,
    limit: number,
    offset: number,
  ): Promise<ConversationRow[]> {
    return await this.databaseService.query<ConversationRow>(
      `SELECT DISTINCT c.id, c.uuid, c.name, c.is_group, c.created_at, c.updated_at,
        (SELECT m.content FROM chat_messages m
         WHERE m.conversation_id = c.id
           AND (cp.deleted_at IS NULL OR m.created_at > cp.deleted_at)
         ORDER BY m.created_at DESC LIMIT 1) as last_message_content,
        (SELECT m.created_at FROM chat_messages m
         WHERE m.conversation_id = c.id
           AND (cp.deleted_at IS NULL OR m.created_at > cp.deleted_at)
         ORDER BY m.created_at DESC LIMIT 1) as last_message_time,
        (SELECT m.is_e2e FROM chat_messages m
         WHERE m.conversation_id = c.id
           AND (cp.deleted_at IS NULL OR m.created_at > cp.deleted_at)
         ORDER BY m.created_at DESC LIMIT 1) as last_message_is_e2e
       FROM chat_conversations c
       INNER JOIN chat_conversation_participants cp ON c.id = cp.conversation_id
       WHERE c.tenant_id = $1 AND cp.user_id = $2 AND c.is_active = ${IS_ACTIVE.ACTIVE}
         AND (
           cp.deleted_at IS NULL
           OR EXISTS (
             SELECT 1 FROM chat_messages m
             WHERE m.conversation_id = c.id AND m.created_at > cp.deleted_at
           )
         )
       ORDER BY c.updated_at DESC
       LIMIT $3 OFFSET $4`,
      [tenantId, userId, limit, offset],
    );
  }

  /**
   * Fetch participants for given conversation IDs
   */
  private async fetchParticipantsForConversations(
    conversationIds: number[],
  ): Promise<ParticipantRow[]> {
    const placeholders = conversationIds
      .map((_: number, i: number) => `$${i + 1}`)
      .join(',');
    return await this.databaseService.query<ParticipantRow>(
      `SELECT cp.conversation_id, cp.user_id, cp.joined_at, cp.is_admin,
              u.username, u.first_name, u.last_name, u.profile_picture
       FROM chat_conversation_participants cp
       INNER JOIN users u ON cp.user_id = u.id
       WHERE cp.conversation_id IN (${placeholders})`,
      conversationIds,
    );
  }

  /**
   * Get unread counts for conversations
   * WhatsApp-style: Only count unread messages AFTER user's deleted_at timestamp
   */
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

    const rows = await this.databaseService.query<UnreadCountRow>(
      `SELECT
        m.conversation_id,
        COUNT(*) as unread_count
       FROM chat_messages m
       LEFT JOIN chat_conversation_participants cp
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

  /**
   * Check for existing 1:1 conversation and return it if found
   */
  private async tryGetExisting1to1Conversation(
    tenantId: number,
    creatorId: number,
    dto: CreateConversationBody,
    isGroup: boolean,
    sendInitialMessage: (
      tenantId: number,
      conversationId: number,
      senderId: number,
      message: string,
    ) => Promise<void>,
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

    // WhatsApp-style: reset soft-delete when creator re-engages with conversation
    await this.databaseService.query(
      `UPDATE chat_conversation_participants SET deleted_at = NULL
       WHERE conversation_id = $1 AND user_id = $2 AND tenant_id = $3
         AND deleted_at IS NOT NULL`,
      [existingId, creatorId, tenantId],
    );

    if (dto.initialMessage !== undefined && dto.initialMessage !== '') {
      await sendInitialMessage(
        tenantId,
        existingId,
        creatorId,
        dto.initialMessage,
      );
    }
    return await this.getConversation(existingId);
  }

  /**
   * Validate that all participant IDs exist in the same tenant
   */
  private async validateParticipantIds(
    participantIds: number[],
    tenantId: number,
  ): Promise<void> {
    if (participantIds.length === 0) {
      return;
    }

    const validationResult = await this.databaseService.query<{ id: number }>(
      `SELECT id FROM users WHERE id = ANY($1::int[]) AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
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

  /**
   * Insert a new conversation and return its ID
   */
  private async insertConversation(
    tenantId: number,
    name: string | undefined,
    isGroup: boolean,
  ): Promise<number> {
    const uuid = uuidv7();
    const insertResult = await this.databaseService.query<{ id: number }>(
      `INSERT INTO chat_conversations (tenant_id, name, is_group, uuid, uuid_created_at, created_at, updated_at)
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

  /**
   * Add creator and participants to a conversation
   */
  private async addConversationParticipants(
    tenantId: number,
    conversationId: number,
    creatorId: number,
    participantIds: number[],
  ): Promise<void> {
    // Add creator as admin
    await this.databaseService.query(
      `INSERT INTO chat_conversation_participants (tenant_id, conversation_id, user_id, is_admin, joined_at)
       VALUES ($1, $2, $3, true, NOW())`,
      [tenantId, conversationId, creatorId],
    );

    // Add other participants
    for (const participantId of participantIds) {
      await this.databaseService.query(
        `INSERT INTO chat_conversation_participants (tenant_id, conversation_id, user_id, is_admin, joined_at)
         VALUES ($1, $2, $3, false, NOW())`,
        [tenantId, conversationId, participantId],
      );
    }
  }

  /**
   * Find existing 1:1 conversation between two users
   */
  private async findExisting1to1(
    tenantId: number,
    user1Id: number,
    user2Id: number,
  ): Promise<number | null> {
    const existing = await this.databaseService.query<{ id: number }>(
      `SELECT c.id
       FROM chat_conversations c
       WHERE c.tenant_id = $1
       AND c.is_group = false
       AND c.is_active = ${IS_ACTIVE.ACTIVE}
       AND EXISTS (
         SELECT 1 FROM chat_conversation_participants cp1
         WHERE cp1.conversation_id = c.id AND cp1.user_id = $2
       )
       AND EXISTS (
         SELECT 1 FROM chat_conversation_participants cp2
         WHERE cp2.conversation_id = c.id AND cp2.user_id = $3
       )
       AND (
         SELECT COUNT(*) FROM chat_conversation_participants cp3
         WHERE cp3.conversation_id = c.id
       ) = 2`,
      [tenantId, user1Id, user2Id],
    );

    return existing.length > 0 && existing[0] !== undefined ?
        existing[0].id
      : null;
  }
}
