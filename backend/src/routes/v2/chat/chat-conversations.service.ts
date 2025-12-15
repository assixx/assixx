/**
 * Chat Conversations Service v2
 * Business logic for conversation management (CRUD operations)
 */
import { log, error as logError } from 'console';
import { v7 as uuidv7 } from 'uuid';

import type { CountResult } from '../../../types/query-results.types.js';
import type { PoolConnection, RowDataPacket } from '../../../utils/db.js';
import { execute, transaction } from '../../../utils/db.js';
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

/**
 * Helper: Check if string is UUIDv7 format
 * UUIDv7 format: 8-4-4-4-12 hex characters (lowercase or uppercase)
 * Example: 018c5f8e-7a1b-7c3d-9e4f-0a1b2c3d4e5f
 */
function isUuid(value: string | number): boolean {
  if (typeof value === 'number') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

// Query result interfaces
interface ParticipantAdminResult extends RowDataPacket {
  is_admin: boolean; // tinyint(1)
}

/**
 * PostgreSQL RETURNING id result
 */
interface InsertIdResult extends RowDataPacket {
  id: number;
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
    WHERE c.tenant_id = $1
    AND cp.user_id = $2
    AND c.is_active = 1
  `;
  const params: unknown[] = [tenantId, userId];
  let paramIndex = 3;

  if (filters.search !== undefined && filters.search !== '') {
    whereClause += ` AND (c.name LIKE $${paramIndex} OR m.content LIKE $${paramIndex + 1})`;
    params.push(`%${filters.search}%`, `%${filters.search}%`);
    paramIndex += 2;
  }

  if (filters.isGroup !== undefined) {
    whereClause += ` AND c.is_group = $${paramIndex}`;
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

  // PostgreSQL: Generate sequential $1, $2, $3... for each conversation ID
  const placeholders = conversationIds.map((_: number, idx: number) => `$${idx + 1}`).join(',');
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
    WHERE cp.conversation_id IN (${placeholders})
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

  // PostgreSQL: Generate sequential $1, $2, $3... for conversation IDs, then userId params
  const convPlaceholders = conversationIds.map((_: number, idx: number) => `$${idx + 1}`).join(',');
  const userIdParamIndex1 = conversationIds.length + 1;
  const userIdParamIndex2 = conversationIds.length + 2;

  const query = `
    SELECT
      m.conversation_id,
      COUNT(*) as unread_count
    FROM messages m
    LEFT JOIN conversation_participants cp
      ON cp.conversation_id = m.conversation_id
      AND cp.user_id = $${userIdParamIndex1}
    WHERE m.conversation_id IN (${convPlaceholders})
      AND m.sender_id != $${userIdParamIndex2}
      AND m.id > COALESCE(cp.last_read_message_id, 0)
    GROUP BY m.conversation_id
  `;

  interface UnreadCountRow extends RowDataPacket {
    conversation_id: number;
    unread_count: number;
  }

  const [rows] = await execute<UnreadCountRow[]>(query, [...conversationIds, userId, userId]);

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
      firstName: p.first_name ?? '',
      lastName: p.last_name ?? '',
      profilePictureUrl: p.profile_picture,
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
    uuid: conv.uuid.trim(), // UUIDv7 for URL routing (trim to remove CHAR(36) padding)
    name: conv.name,
    isGroup: conv.is_group,
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
  const firstRow = existing[0];
  return existing.length > 0 && firstRow !== undefined ? firstRow.id : null;
}

/**
 * Create conversation record in database
 * PostgreSQL: Uses RETURNING id to get the inserted ID as row data
 * Generates UUIDv7 for secure URL routing
 */
async function insertConversation(
  tenantId: number,
  name: string | null,
  isGroup: boolean,
): Promise<number> {
  // Generate UUIDv7 for external identifier (secure, time-sortable)
  const uuid = uuidv7();

  // PostgreSQL RETURNING returns rows, not ResultSetHeader
  const [rows] = await execute<InsertIdResult[]>(
    `INSERT INTO conversations (tenant_id, name, is_group, uuid, uuid_created_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())
     RETURNING id`,
    [tenantId, name, isGroup ? 1 : 0, uuid],
  );

  const insertedRow = rows[0];
  if (insertedRow === undefined) {
    throw new ServiceError('INSERT_FAILED', 'Failed to get inserted conversation ID', 500);
  }

  return insertedRow.id;
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
     VALUES ($1, $2, $3, true, NOW())`,
    [tenantId, conversationId, creatorId],
  );

  // Add other participants
  for (const participantId of participantIds) {
    await execute(
      `INSERT INTO conversation_participants (tenant_id, conversation_id, user_id, is_admin, joined_at)
       VALUES ($1, $2, $3, false, NOW())`,
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
      SELECT DISTINCT c.id, c.uuid, c.name, c.is_group, c.created_at, c.updated_at,
        (SELECT m.content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_content,
        (SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_time
      FROM conversations c
      INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
      WHERE c.tenant_id = ${tenantId} AND cp.user_id = ${userId} AND c.is_active = 1
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
 * Handle reusing existing 1:1 conversation if found
 * @returns conversation if existing found, null otherwise
 */
async function handleExisting1to1(
  tenantId: number,
  creatorId: number,
  participantId: number,
  initialMessage: string | undefined,
): Promise<{ conversation: Conversation } | null> {
  const existingId = await findExisting1to1Conversation(tenantId, creatorId, participantId);

  if (existingId === null) {
    return null;
  }

  // Existing conversation found - if initialMessage provided, add it
  if (initialMessage !== undefined && initialMessage !== '') {
    await insertInitialMessage(tenantId, existingId, creatorId, initialMessage);
  }
  const conversation = await retrieveConversationById(tenantId, creatorId, existingId);
  return { conversation };
}

/**
 * Create a new conversation record with participants and optional initial message
 */
async function createNewConversation(
  tenantId: number,
  creatorId: number,
  data: CreateConversationData,
  isGroup: boolean,
): Promise<{ conversation: Conversation }> {
  log('[Chat Service] Creating new conversation with isGroup:', isGroup);
  const conversationId = await insertConversation(tenantId, data.name ?? null, isGroup);

  await addParticipants(tenantId, conversationId, creatorId, data.participantIds);

  // LAZY CREATION: If initialMessage provided, insert the first message
  if (data.initialMessage !== undefined && data.initialMessage !== '') {
    await insertInitialMessage(tenantId, conversationId, creatorId, data.initialMessage);
  }

  const conversation = await retrieveConversationById(tenantId, creatorId, conversationId);
  return { conversation };
}

/**
 * Create a new conversation (1:1 or group)
 * Supports lazy creation: if initialMessage is provided, message is created with conversation
 * @param tenantId - The tenant ID for multi-tenant isolation
 * @param creatorId - The user creating the conversation
 * @param data - Conversation data (participant IDs, optional name, group flag, and initialMessage)
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

    const isGroup = data.isGroup ?? data.participantIds.length > 1;

    // Check for existing 1:1 conversation
    if (!isGroup && data.participantIds.length === 1) {
      const firstParticipantId = data.participantIds[0];
      if (firstParticipantId === undefined) {
        throw new ServiceError('INVALID_PARTICIPANTS', 'Participant ID is required', 400);
      }

      const existing = await handleExisting1to1(
        tenantId,
        creatorId,
        firstParticipantId,
        data.initialMessage,
      );
      if (existing !== null) {
        return existing;
      }
    }

    return await createNewConversation(tenantId, creatorId, data, isGroup);
  } catch (error: unknown) {
    logError('[Chat Service] createConversation error:', error);
    throw error instanceof ServiceError ? error : (
        new ServiceError('CREATE_CONVERSATION_ERROR', 'Failed to create conversation', 500)
      );
  }
}

/**
 * Insert initial message when creating conversation with lazy creation
 * @internal
 */
async function insertInitialMessage(
  tenantId: number,
  conversationId: number,
  senderId: number,
  content: string,
): Promise<void> {
  const insertQuery = `
    INSERT INTO messages (tenant_id, conversation_id, sender_id, content, created_at)
    VALUES ($1, $2, $3, $4, NOW())
  `;
  await execute(insertQuery, [tenantId, conversationId, senderId, content]);

  const updateQuery = `
    UPDATE conversations SET updated_at = NOW() WHERE id = $1 AND tenant_id = $2
  `;
  await execute(updateQuery, [conversationId, tenantId]);
}

interface ConvParticipantRow extends RowDataPacket {
  user_id: number;
  is_admin: boolean;
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
  tenantId: number,
): Promise<ConversationParticipant[]> {
  const [participants] = await execute<ConvParticipantRow[]>(
    `SELECT cp.user_id, cp.is_admin, cp.joined_at, u.username, u.first_name, u.last_name, u.profile_picture
     FROM conversation_participants cp INNER JOIN users u ON cp.user_id = u.id
     WHERE cp.conversation_id = $1 AND cp.tenant_id = $2`,
    [conversationId, tenantId],
  );
  return participants.map((p: ConvParticipantRow) => ({
    id: p.user_id,
    userId: p.user_id,
    username: p.username,
    firstName: p.first_name ?? '',
    lastName: p.last_name ?? '',
    profilePictureUrl: p.profile_picture,
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
      `SELECT 1 FROM conversation_participants
       WHERE conversation_id = $1 AND user_id = $2 AND tenant_id = $3`,
      [conversationId, userId, tenantId],
    );
    if (participant.length === 0) return null;

    const [conversations] = await execute<ConversationRow[]>(
      `SELECT c.id, c.uuid, c.name, c.is_group, c.created_at, c.updated_at
       FROM conversations c WHERE c.id = $1 AND c.tenant_id = $2 AND c.is_active = 1`,
      [conversationId, tenantId],
    );
    if (conversations.length === 0) return null;

    const conv = conversations[0];
    if (conv === undefined) return null;

    const participants = await fetchConversationParticipants(conversationId, tenantId);

    return {
      id: conv.id,
      uuid: conv.uuid.trim(), // UUIDv7 for URL routing (trim to remove CHAR(36) padding)
      name: conv.name,
      isGroup: conv.is_group,
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
 * Delete a conversation (soft delete: sets is_active = 4)
 * Preserves messages, attachments, and foreign key references
 * @param tenantId - The tenant ID for multi-tenant isolation
 * @param conversationId - The conversation ID to delete
 * @param userId - The user requesting deletion
 * @param userRole - The user's role (for permission checking)
 * @throws ServiceError if user lacks permission or conversation not found
 */
export async function deleteConversation(
  tenantId: number,
  conversationId: number,
  userId: number,
  userRole: string,
): Promise<void> {
  try {
    await transaction(async (conn: PoolConnection) => {
      // Check if user is participant
      const [participant] = await conn.execute<ParticipantAdminResult[]>(
        `SELECT is_admin FROM conversation_participants
         WHERE conversation_id = $1 AND user_id = $2 AND tenant_id = $3`,
        [conversationId, userId, tenantId],
      );

      if (participant.length === 0) {
        throw new ServiceError(
          'CONVERSATION_ACCESS_DENIED',
          'You are not a participant of this conversation',
          403,
        );
      }

      // Only root and admin can delete conversations
      if (userRole !== 'root' && userRole !== 'admin') {
        throw new ServiceError(
          'DELETE_CONVERSATION_FORBIDDEN',
          'Only administrators can delete conversations',
          403,
        );
      }

      // Soft delete: Set is_active = 4 (deleted)
      await conn.execute(
        `UPDATE conversations SET is_active = 4, updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2`,
        [conversationId, tenantId],
      );
    }, tenantId);
  } catch (error: unknown) {
    throw error instanceof ServiceError ? error : (
        new ServiceError('DELETE_CONVERSATION_ERROR', 'Failed to delete conversation', 500)
      );
  }
}

/**
 * Get conversation by UUID
 * Used for URL-based routing (/chat/:uuid)
 * @param tenantId - The tenant ID for multi-tenant isolation
 * @param uuid - The conversation UUID (UUIDv7)
 * @param userId - The user requesting the conversation
 * @returns The conversation if found and user is participant, null otherwise
 */
export async function getConversationByUuid(
  tenantId: number,
  uuid: string,
  userId: number,
): Promise<Conversation | null> {
  try {
    // First get the conversation ID from UUID
    interface ConversationIdRow extends RowDataPacket {
      id: number;
    }

    const [convRows] = await execute<ConversationIdRow[]>(
      `SELECT id FROM conversations WHERE uuid = $1 AND tenant_id = $2 AND is_active = 1`,
      [uuid, tenantId],
    );

    if (convRows.length === 0) return null;
    const convRow = convRows[0];
    if (convRow === undefined) return null;

    // Use existing getConversation with the ID
    return await getConversation(tenantId, convRow.id, userId);
  } catch (error: unknown) {
    logError('[Chat Service] getConversationByUuid error:', error);
    throw new ServiceError('CONVERSATION_ERROR', 'Failed to get conversation by UUID', 500);
  }
}

// Export isUuid helper for use in controller
export { isUuid };
