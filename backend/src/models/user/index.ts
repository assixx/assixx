// Re-import for default export
import { autoResetExpiredAvailability, updateUserAvailability } from './user.availability';
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
} from './user.crud';
import { changeUserPassword, updateOwnProfile, updateUserProfilePicture } from './user.profile';
import {
  countActiveUsersByTenant,
  countUsers,
  countUsersWithFilters,
  getUserDepartmentAndTeam,
  getUserDocumentCount,
  userHasDocuments,
} from './user.stats';

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
} from './user.types';

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
} from './user.crud';

// Export profile operations
export { updateUserProfilePicture, changeUserPassword, updateOwnProfile } from './user.profile';

// Export availability operations
export { autoResetExpiredAvailability, updateUserAvailability } from './user.availability';

// Export statistics operations
export {
  countUsersWithFilters,
  countUsers,
  countActiveUsersByTenant,
  userHasDocuments,
  getUserDocumentCount,
  getUserDepartmentAndTeam,
} from './user.stats';

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
} from './user.utils';

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
