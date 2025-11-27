/**
 * Chat Users Service v2
 * Business logic for chat user listing and access permissions
 */
import type { RowDataPacket } from 'mysql2/promise';

import { execute } from '../../../utils/db.js';
import { ServiceError } from '../users/users.service.js';
import type { ChatUser, ChatUserRow } from './chat.types.js';

/**
 * Query result interface for current user permissions
 */
interface CurrentUserPermissions extends RowDataPacket {
  role: string;
  department_id: number | null;
}

/**
 * Build chat users query based on user role and permissions
 * Admins/Root can see all users in tenant
 * Employees can see users in their department + all admins/root
 */
function buildChatUsersQuery(
  currentUser: CurrentUserPermissions,
  tenantId: number,
  currentUserId: number,
): { query: string; params: unknown[] } {
  const baseQuery = `
    SELECT
      u.id,
      u.username,
      u.email,
      u.first_name,
      u.last_name,
      u.profile_picture,
      u.department_id,
      d.name as department_name,
      u.role
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
  `;

  if (currentUser.role === 'admin' || currentUser.role === 'root') {
    return {
      query: `${baseQuery} WHERE u.tenant_id = ? AND u.id != ?`,
      params: [tenantId, currentUserId],
    };
  }

  return {
    query: `${baseQuery} WHERE u.tenant_id = ? AND u.id != ? AND (u.department_id = ? OR u.role IN ('admin', 'root'))`,
    params: [tenantId, currentUserId, currentUser.department_id],
  };
}

/**
 * Filter users by search term (username, email, or full name)
 */
function filterUsersBySearch(users: ChatUserRow[], search?: string): ChatUserRow[] {
  if (search === undefined || search === '') return users;

  const searchLower = search.toLowerCase();
  return users.filter((user: ChatUserRow) => {
    const fullName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.toLowerCase();
    return (
      user.username.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower) ||
      fullName.includes(searchLower)
    );
  });
}

/**
 * Transform database user row to ChatUser API format
 */
function transformToChatUser(user: ChatUserRow): ChatUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    first_name: user.first_name ?? '',
    last_name: user.last_name ?? '',
    profile_picture: user.profile_picture,
    department_id: user.department_id,
    department: user.department_name,
    role: user.role,
    status: 'offline', // noTODO: Implement online status tracking
    last_seen: null, // noTODO: Implement last seen tracking
  };
}

/**
 * Get list of users available for chat based on role permissions
 * @param tenantId - The tenant ID for multi-tenant isolation
 * @param currentUserId - The requesting user's ID
 * @param search - Optional search term for filtering users
 * @returns List of users the current user can chat with
 * @throws ServiceError if current user not found or database error
 */
export async function getChatUsers(
  tenantId: number,
  currentUserId: number,
  search?: string,
): Promise<ChatUser[]> {
  try {
    // Get current user's role and department for permission checking
    const [userRows] = await execute<CurrentUserPermissions[]>(
      'SELECT role, department_id FROM users WHERE id = ? AND tenant_id = ?',
      [currentUserId, tenantId],
    );

    if (userRows.length === 0) {
      throw new ServiceError('USER_NOT_FOUND', 'Current user not found', 404);
    }

    const currentUser = userRows[0];
    if (currentUser === undefined) {
      throw new ServiceError('USER_NOT_FOUND', 'Current user not found', 404);
    }

    // Build query based on user permissions
    const { query, params } = buildChatUsersQuery(currentUser, tenantId, currentUserId);
    const [users] = await execute<ChatUserRow[]>(query, params);

    // Apply search filter if provided
    const filteredUsers = filterUsersBySearch(users, search);

    // Transform to API format
    return filteredUsers.map((user: ChatUserRow) => transformToChatUser(user));
  } catch {
    throw new ServiceError('CHAT_USERS_ERROR', 'Failed to fetch chat users', 500);
  }
}
