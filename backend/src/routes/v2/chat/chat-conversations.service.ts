/**
 * Chat Conversations Service v2
 * Business logic for conversation management (CRUD operations)
 */
import { log, error as logError } from 'console';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import type { CountResult } from '../../../types/query-results.types.js';
import { execute } from '../../../utils/db.js';
import { ServiceError } from '../users/users.service.js';
import type {
  Conversation,
  ConversationFilters,
  ConversationParticipant,
  ConversationRow,
  CreateConversationData,
  PaginationMeta,
  ParticipantRow,
} from './chat.types.js';

// Query result interfaces
interface ParticipantAdminResult extends RowDataPacket {
  is_admin: number; // tinyint(1)
}

/**
 * Build WHERE clause for conversations query based on filters
 */
function buildConversationWhereClause(
  filters: ConversationFilters,
  tenantId: number,
  userId: number,
): { whereClause: string; params: unknown[] } {
  let whereClause = `
    WHERE c.tenant_id = ?
    AND cp.user_id = ?
  `;
  const params: unknown[] = [tenantId, userId];

  if (filters.search !== undefined && filters.search !== '') {
    whereClause += ` AND (c.name LIKE ? OR m.content LIKE ?)`;
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  if (filters.isGroup !== undefined) {
    whereClause += ` AND c.is_group = ?`;
    params.push(filters.isGroup ? 1 : 0);
  }

  return { whereClause, params };
}

/**
 * Get conversation participants with user details
 */
async function getConversationParticipants(conversationIds: number[]): Promise<ParticipantRow[]> {
  if (conversationIds.length === 0) {
    return [];
  }

  const query = `
    SELECT
      cp.conversation_id,
      cp.user_id,
      cp.joined_at,
      cp.is_admin,
      u.username,
      u.first_name,
      u.last_name,
      u.profile_picture
    FROM conversation_participants cp
    INNER JOIN users u ON cp.user_id = u.id
    WHERE cp.conversation_id IN (${conversationIds.map(() => '?').join(',')})
  `;

  const [rows] = await execute<ParticipantRow[]>(query, conversationIds);
  return rows;
}

/**
 * Get unread message counts for conversations
 */
async function getUnreadCounts(
  conversationIds: number[],
  userId: number,
): Promise<Map<number, number>> {
  const unreadCounts = new Map<number, number>();

  if (conversationIds.length === 0) {
    return unreadCounts;
  }

  const query = `
    SELECT
      m.conversation_id,
      COUNT(*) as unread_count
    FROM messages m
    LEFT JOIN conversation_participants cp
      ON cp.conversation_id = m.conversation_id
      AND cp.user_id = ${userId}
    WHERE m.conversation_id IN (${conversationIds.map(() => '?').join(',')})
      AND m.sender_id != ${userId}
      AND m.id > COALESCE(cp.last_read_message_id, 0)
    GROUP BY m.conversation_id
  `;

  interface UnreadCountRow extends RowDataPacket {
    conversation_id: number;
    unread_count: number;
  }

  const [rows] = await execute<UnreadCountRow[]>(query, conversationIds);

  for (const row of rows) {
    unreadCounts.set(row.conversation_id, row.unread_count);
  }

  return unreadCounts;
}

/**
 * Transform conversation data to API format
 */
function transformConversation(
  conv: ConversationRow,
  participants: ParticipantRow[],
  unreadCount: number,
): Conversation {
  const convParticipants: ConversationParticipant[] = participants
    .filter((p: ParticipantRow) => p.conversation_id === conv.id)
    .map((p: ParticipantRow) => ({
      id: p.user_id,
      userId: p.user_id,
      username: p.username,
      first_name: p.first_name ?? '',
      last_name: p.last_name ?? '',
      profile_picture_url: p.profile_picture,
      joinedAt: new Date(p.joined_at),
      isActive: true,
    }));

  let lastMessage: { content: string; created_at: Date } | null = null;
  if (conv.last_message_content !== null && conv.last_message_time !== null) {
    lastMessage = {
      content: conv.last_message_content,
      created_at: new Date(conv.last_message_time),
    };
  }

  return {
    id: conv.id,
    name: conv.name,
    isGroup: conv.is_group === 1,
    createdAt: new Date(conv.created_at),
    updatedAt: new Date(conv.updated_at),
    lastMessage,
    unreadCount,
    participants: convParticipants,
  };
}

/**
 * Check if 1:1 conversation already exists between two users
 */
async function findExisting1to1Conversation(
  tenantId: number,
  user1Id: number,
  user2Id: number,
): Promise<number | null> {
  interface ConversationIdRow extends RowDataPacket {
    id: number;
  }

  const [existing] = await execute<ConversationIdRow[]>(
    `SELECT c.id
     FROM conversations c
     WHERE c.tenant_id = ?
     AND c.is_group = 0
     AND EXISTS (
       SELECT 1 FROM conversation_participants cp1
       WHERE cp1.conversation_id = c.id AND cp1.user_id = ?
     )
     AND EXISTS (
       SELECT 1 FROM conversation_participants cp2
       WHERE cp2.conversation_id = c.id AND cp2.user_id = ?
     )
     AND (
       SELECT COUNT(*) FROM conversation_participants cp3
       WHERE cp3.conversation_id = c.id
     ) = 2`,
    [tenantId, user1Id, user2Id],
  );
  const firstRow = existing[0];
  return existing.length > 0 && firstRow !== undefined ? firstRow.id : null;
}

/**
 * Create conversation record in database
 */
async function insertConversation(
  tenantId: number,
  name: string | null,
  isGroup: boolean,
): Promise<number> {
  const [result] = await execute<ResultSetHeader>(
    `INSERT INTO conversations (tenant_id, name, is_group, created_at, updated_at)
     VALUES (?, ?, ?, NOW(), NOW())`,
    [tenantId, name, isGroup ? 1 : 0],
  );
  log('[Chat Service] Created conversation with ID:', result.insertId);
  return result.insertId;
}

/**
 * Add participants to conversation
 * Creator is added as admin, others as regular participants
 */
async function addParticipants(
  tenantId: number,
  conversationId: number,
  creatorId: number,
  participantIds: number[],
): Promise<void> {
  // Add creator as admin
  await execute(
    `INSERT INTO conversation_participants (tenant_id, conversation_id, user_id, is_admin, joined_at)
     VALUES (?, ?, ?, 1, NOW())`,
    [tenantId, conversationId, creatorId],
  );

  // Add other participants
  for (const participantId of participantIds) {
    await execute(
      `INSERT INTO conversation_participants (tenant_id, conversation_id, user_id, is_admin, joined_at)
       VALUES (?, ?, ?, 0, NOW())`,
      [tenantId, conversationId, participantId],
    );
  }
}

/**
 * Retrieve conversation by ID from the user's conversation list
 */
async function retrieveConversationById(
  tenantId: number,
  creatorId: number,
  conversationId: number,
): Promise<Conversation> {
  const conversations = await getConversations(tenantId, creatorId, { limit: 100 });
  const conversation = conversations.data.find((c: Conversation) => c.id === conversationId);

  if (!conversation) {
    throw new ServiceError('CONVERSATION_NOT_FOUND', 'Failed to retrieve conversation', 404);
  }
  return conversation;
}

/**
 * Calculate pagination values from filters
 */
function calculatePagination(filters: ConversationFilters): {
  page: number;
  limit: number;
  offset: number;
} {
  const page = Math.max(1, Number.isNaN(filters.page) ? 1 : (filters.page ?? 1));
  const limit = Math.min(
    100,
    Math.max(1, Number.isNaN(filters.limit) ? 20 : (filters.limit ?? 20)),
  );
  return { page, limit, offset: (page - 1) * limit };
}

/**
 * Get total conversation count
 */
async function getConversationCount(whereClause: string, params: unknown[]): Promise<number> {
  const countQuery = `
    SELECT COUNT(DISTINCT c.id) as count
    FROM conversations c
    INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
    LEFT JOIN messages m ON c.id = m.conversation_id
    ${whereClause}
  `;
  const [countResult] = await execute<CountResult[]>(countQuery, params);
  return countResult[0]?.count ?? 0;
}

/**
 * Build pagination meta object
 */
function buildPaginationMeta(page: number, limit: number, totalItems: number): PaginationMeta {
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

/**
 * Get user's conversations with pagination and filters
 */
export async function getConversations(
  tenantId: number,
  userId: number,
  filters: ConversationFilters = {},
): Promise<{ data: Conversation[]; pagination: PaginationMeta }> {
  try {
    log('[Chat Service] getConversations called with:', { tenantId, userId, filters });

    const { page, limit, offset } = calculatePagination(filters);
    const { whereClause, params } = buildConversationWhereClause(filters, tenantId, userId);
    const totalItems = await getConversationCount(whereClause, params);

    const query = `
      SELECT DISTINCT c.id, c.name, c.is_group, c.created_at, c.updated_at,
        (SELECT m.content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_content,
        (SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_time
      FROM conversations c
      INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
      WHERE c.tenant_id = ${tenantId} AND cp.user_id = ${userId}
      ORDER BY c.updated_at DESC LIMIT ${limit} OFFSET ${offset}
    `;

    const [conversations] = await execute<ConversationRow[]>(query);
    const conversationIds = conversations.map((c: ConversationRow) => c.id);

    const [participants, unreadCounts] = await Promise.all([
      getConversationParticipants(conversationIds),
      getUnreadCounts(conversationIds, userId),
    ]);

    const data = conversations.map((conv: ConversationRow) => {
      return transformConversation(conv, participants, unreadCounts.get(conv.id) ?? 0);
    });

    return { data, pagination: buildPaginationMeta(page, limit, totalItems) };
  } catch (error: unknown) {
    logError('[Chat Service] getConversations error:', error);
    throw new ServiceError('CONVERSATIONS_ERROR', 'Failed to fetch conversations', 500);
  }
}

/**
 * Create a new conversation (1:1 or group)
 * @param tenantId - The tenant ID for multi-tenant isolation
 * @param creatorId - The user creating the conversation
 * @param data - Conversation data (participant IDs, optional name and group flag)
 * @returns The created conversation with full details
 * @throws ServiceError if conversation creation fails or participants invalid
 */
export async function createConversation(
  tenantId: number,
  creatorId: number,
  data: CreateConversationData,
): Promise<{ conversation: Conversation }> {
  try {
    log('[Chat Service] createConversation called with:', { tenantId, creatorId, data });
    logError('[CRITICAL DEBUG] Creating conversation with tenantId:', tenantId);

    const isGroup = data.isGroup ?? data.participantIds.length > 1;

    // Check for existing 1:1 conversation
    if (!isGroup && data.participantIds.length === 1) {
      const firstParticipantId = data.participantIds[0];
      if (firstParticipantId === undefined) {
        throw new ServiceError('INVALID_PARTICIPANTS', 'Participant ID is required', 400);
      }

      const existingId = await findExisting1to1Conversation(
        tenantId,
        creatorId,
        firstParticipantId,
      );

      if (existingId !== null) {
        const conversation = await retrieveConversationById(tenantId, creatorId, existingId);
        return { conversation };
      }
    }

    // Create new conversation
    log('[Chat Service] Creating new conversation with isGroup:', isGroup);
    const conversationId = await insertConversation(tenantId, data.name ?? null, isGroup);

    // Add participants
    await addParticipants(tenantId, conversationId, creatorId, data.participantIds);

    // Retrieve and return the created conversation
    const conversation = await retrieveConversationById(tenantId, creatorId, conversationId);
    return { conversation };
  } catch (error: unknown) {
    logError('[Chat Service] createConversation error:', error);
    throw error instanceof ServiceError ? error : (
        new ServiceError('CREATE_CONVERSATION_ERROR', 'Failed to create conversation', 500)
      );
  }
}

interface ConvParticipantRow extends RowDataPacket {
  user_id: number;
  is_admin: number;
  joined_at: string | Date;
  username: string;
  first_name: string | null;
  last_name: string | null;
  profile_picture: string | null;
}

/**
 * Fetch participants for a single conversation
 */
async function fetchConversationParticipants(
  conversationId: number,
): Promise<ConversationParticipant[]> {
  const [participants] = await execute<ConvParticipantRow[]>(
    `SELECT cp.user_id, cp.is_admin, cp.joined_at, u.username, u.first_name, u.last_name, u.profile_picture
     FROM conversation_participants cp INNER JOIN users u ON cp.user_id = u.id
     WHERE cp.conversation_id = ${conversationId}`,
  );
  return participants.map((p: ConvParticipantRow) => ({
    id: p.user_id,
    userId: p.user_id,
    username: p.username,
    first_name: p.first_name ?? '',
    last_name: p.last_name ?? '',
    profile_picture_url: p.profile_picture,
    joinedAt: new Date(p.joined_at),
    isActive: true,
  }));
}

/**
 * Get single conversation details
 */
export async function getConversation(
  tenantId: number,
  conversationId: number,
  userId: number,
): Promise<Conversation | null> {
  try {
    const [participant] = await execute<RowDataPacket[]>(
      `SELECT 1 FROM conversation_participants WHERE conversation_id = ${conversationId} AND user_id = ${userId}`,
    );
    if (participant.length === 0) return null;

    const [conversations] = await execute<ConversationRow[]>(
      `SELECT c.id, c.name, c.is_group, c.created_at, c.updated_at
       FROM conversations c WHERE c.id = ${conversationId} AND c.tenant_id = ${tenantId}`,
    );
    if (conversations.length === 0) return null;

    const conv = conversations[0];
    if (conv === undefined) return null;

    const participants = await fetchConversationParticipants(conversationId);

    return {
      id: conv.id,
      name: conv.name,
      isGroup: conv.is_group === 1,
      createdAt: new Date(conv.created_at),
      updatedAt: new Date(conv.updated_at),
      lastMessage: null,
      unreadCount: 0,
      participants,
    };
  } catch (error: unknown) {
    logError('[Chat Service] getConversation error:', error);
    throw new ServiceError('CONVERSATION_ERROR', 'Failed to get conversation', 500);
  }
}

/**
 * Delete a conversation (admin, creator, or last participant only)
 * @param conversationId - The conversation ID to delete
 * @param userId - The user requesting deletion
 * @param userRole - The user's role (for permission checking)
 * @throws ServiceError if user lacks permission or conversation not found
 */
export async function deleteConversation(
  conversationId: number,
  userId: number,
  userRole: string,
): Promise<void> {
  try {
    // Check if user is participant
    const [participant] = await execute<ParticipantAdminResult[]>(
      `SELECT is_admin FROM conversation_participants
       WHERE conversation_id = ? AND user_id = ?`,
      [conversationId, userId],
    );

    if (participant.length === 0) {
      throw new ServiceError(
        'CONVERSATION_ACCESS_DENIED',
        'You are not a participant of this conversation',
        403,
      );
    }

    // Check permissions: must be admin or the only participant
    const [participantCount] = await execute<CountResult[]>(
      `SELECT COUNT(*) as count FROM conversation_participants
       WHERE conversation_id = ?`,
      [conversationId],
    );

    const firstParticipant = participant[0];
    const firstCount = participantCount[0];
    if (firstParticipant === undefined || firstCount === undefined) {
      throw new ServiceError('CONVERSATION_ERROR', 'Failed to retrieve conversation details', 500);
    }

    const canDelete =
      userRole === 'root' ||
      userRole === 'admin' ||
      firstParticipant.is_admin === 1 ||
      firstCount.count === 1;

    if (!canDelete) {
      throw new ServiceError(
        'DELETE_CONVERSATION_FORBIDDEN',
        "You don't have permission to delete this conversation",
        403,
      );
    }

    // Delete in correct order to avoid FK constraints
    await execute(`DELETE FROM messages WHERE conversation_id = ?`, [conversationId]);

    await execute(`DELETE FROM conversation_participants WHERE conversation_id = ?`, [
      conversationId,
    ]);

    await execute(`DELETE FROM conversations WHERE id = ?`, [conversationId]);
  } catch (error: unknown) {
    throw error instanceof ServiceError ? error : (
        new ServiceError('DELETE_CONVERSATION_ERROR', 'Failed to delete conversation', 500)
      );
  }
}
