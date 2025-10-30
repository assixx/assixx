// Re-import for default export
import { autoResetExpiredAvailability, updateUserAvailability } from './user.availability.js';
import {
  archiveUser,
  createUser,
  deleteUser,
  findAllUsers,
  findAllUsersByTenant,
  findArchivedUsers,
  findUserByEmail,
  findUserById,
  findUserByUsername,
  findUsersByRole,
  searchUsers,
  unarchiveUser,
  updateUser,
} from './user.crud.js';
import { changeUserPassword, updateOwnProfile, updateUserProfilePicture } from './user.profile.js';
import {
  countActiveUsersByTenant,
  countUsers,
  countUsersWithFilters,
  getUserDepartmentAndTeam,
  getUserDocumentCount,
  userHasDocuments,
} from './user.stats.js';

/**
 * User Module - Barrel Export
 * Provides backward compatibility and clean API for user operations
 */

// Export all types
export type {
  DbUser,
  UserCreateData,
  UserFilter,
  CountResult,
  DocumentCountResult,
  UserDepartmentTeam,
  SubdomainResult,
  AvailabilityData,
  PasswordChangeResult,
  ProfileUpdateResult,
} from './user.types.js';

// Export CRUD operations
export {
  createUser,
  findUserByUsername,
  findUserById,
  findUsersByRole,
  findUserByEmail,
  deleteUser,
  updateUser,
  searchUsers,
  archiveUser,
  unarchiveUser,
  findArchivedUsers,
  findAllUsers,
  findAllUsersByTenant,
} from './user.crud.js';

// Export profile operations
export { updateUserProfilePicture, changeUserPassword, updateOwnProfile } from './user.profile.js';

// Export availability operations
export { autoResetExpiredAvailability, updateUserAvailability } from './user.availability.js';

// Export statistics operations
export {
  countUsersWithFilters,
  countUsers,
  countActiveUsersByTenant,
  userHasDocuments,
  getUserDocumentCount,
  getUserDepartmentAndTeam,
} from './user.stats.js';

// Export utility functions (if needed externally)
export {
  generateInitialEmployeeId,
  updateTemporaryEmployeeId,
  buildUserQueryParams,
  processUpdateField,
  buildFilterConditions,
  buildOrderByClause,
  buildPaginationClause,
  buildCountQuery,
} from './user.utils.js';

/**
 * Default export for backward compatibility
 * Allows: import user from './models/user'
 * This ensures all existing code continues to work without changes
 */
const User = {
  create: createUser,
  findByUsername: findUserByUsername,
  findById: findUserById,
  findByRole: findUsersByRole,
  findByEmail: findUserByEmail,
  delete: deleteUser,
  update: updateUser,
  search: searchUsers,
  updateProfilePicture: updateUserProfilePicture,
  countWithFilters: countUsersWithFilters,
  archiveUser,
  unarchiveUser,
  findArchivedUsers,
  autoResetExpiredAvailability,
  hasDocuments: userHasDocuments,
  getDocumentCount: getUserDocumentCount,
  getUserDepartmentAndTeam,
  changePassword: changeUserPassword,
  updateOwnProfile,
  findAll: findAllUsers,
  findAllByTenant: findAllUsersByTenant,
  count: countUsers,
  countActiveByTenant: countActiveUsersByTenant,
  updateAvailability: updateUserAvailability,
};

export default User;
