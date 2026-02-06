/**
 * Database Module Barrel Export
 */

export { DatabaseModule, PG_POOL } from './database.module.js';
export { DatabaseService } from './database.service.js';

// Repositories
export {
  UserRepository,
  USER_STATUS,
  type UserStatus,
  type UserBase,
  type UserMinimal,
  type UserWithPassword,
  type FindManyOptions,
} from './repositories/index.js';
