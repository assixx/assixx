/**
 * Users Module
 *
 * Handles user management for the application.
 * Provides CRUD operations, profile management, and availability tracking.
 *
 * NOTE: Availability logic split into UserAvailabilityService for separation of concerns
 */
import { Module } from '@nestjs/common';

import { UserAvailabilityService } from './user-availability.service.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [UsersController],
  providers: [UserAvailabilityService, UsersService],
  exports: [UsersService, UserAvailabilityService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design
export class UsersModule {}
