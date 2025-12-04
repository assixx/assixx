/**
 * Chat Users Service v2
 * Business logic for chat user listing and access permissions
 */
import type { RowDataPacket } from '../../../utils/db.js';
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
 *
 * ASSIGNMENT LOGIC (Priority Order):
 * 1. admin_area_permissions → areas (explicit admin permission)
 * 2. areas.area_lead_id = user.id (user is area leader)
 * 3. admin_department_permissions → departments → areas
 * 4. departments.department_lead_id = user.id (user is dept leader)
 * 5. user_departments → departments → areas (employee path)
 */
function buildChatUsersQuery(
  currentUser: CurrentUserPermissions,
  tenantId: number,
  currentUserId: number,
): { query: string; params: unknown[] } {
  // Complex query with ALL assignment paths including lead_id
  const baseQuery = `
    SELECT
      u.id,
      u.username,
      u.email,
      u.first_name,
      u.last_name,
      u.employee_number,
      u.profile_picture,
      COALESCE(adp.department_id, dept_lead.id, ud.department_id) as department_id,
      COALESCE(dep_admin.name, dept_lead.name, d.name) as department_name,
      COALESCE(aap.area_id, area_lead.id, dep_admin.area_id, dept_lead.area_id, d.area_id) as area_id,
      COALESCE(area_admin.name, area_lead.name, area_via_dep.name, area_via_dept_lead.name, a.name) as area_name,
      u.role
    FROM users u
    -- Employee path: user_departments → departments → areas
    LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
    LEFT JOIN departments d ON ud.department_id = d.id
    LEFT JOIN areas a ON d.area_id = a.id
    -- Admin path 1: admin_area_permissions → areas (explicit permission)
    LEFT JOIN admin_area_permissions aap ON u.id = aap.admin_user_id AND aap.tenant_id = u.tenant_id
    LEFT JOIN areas area_admin ON aap.area_id = area_admin.id
    -- Admin path 2: admin_department_permissions → departments → areas
    LEFT JOIN admin_department_permissions adp ON u.id = adp.admin_user_id AND adp.tenant_id = u.tenant_id
    LEFT JOIN departments dep_admin ON adp.department_id = dep_admin.id
    LEFT JOIN areas area_via_dep ON dep_admin.area_id = area_via_dep.id
    -- Lead path 1: areas.area_lead_id (user is area leader)
    LEFT JOIN areas area_lead ON u.id = area_lead.area_lead_id AND area_lead.tenant_id = u.tenant_id
    -- Lead path 2: departments.department_lead_id (user is dept leader)
    LEFT JOIN departments dept_lead ON u.id = dept_lead.department_lead_id AND dept_lead.tenant_id = u.tenant_id
    LEFT JOIN areas area_via_dept_lead ON dept_lead.area_id = area_via_dept_lead.id
  `;

  if (currentUser.role === 'admin' || currentUser.role === 'root') {
    return {
      query: `${baseQuery} WHERE u.tenant_id = $1 AND u.id != $2`,
      params: [tenantId, currentUserId],
    };
  }

  return {
    query: `${baseQuery} WHERE u.tenant_id = $1 AND u.id != $2 AND (ud.department_id = $3 OR u.role IN ('admin', 'root'))`,
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
 * NOTE: Outputs camelCase for frontend compatibility
 * INHERITANCE: area_id/area_name → teamAreaId/teamAreaName
 */
function transformToChatUser(user: ChatUserRow): ChatUser {
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
    status: 'offline', // noTODO: Implement online status tracking
    lastSeen: null, // noTODO: Implement last seen tracking
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
    // Note: department_id is now in user_departments table (many-to-many)
    const [userRows] = await execute<CurrentUserPermissions[]>(
      `SELECT u.role, ud.department_id
       FROM users u
       LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
       WHERE u.id = $1 AND u.tenant_id = $2`,
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
