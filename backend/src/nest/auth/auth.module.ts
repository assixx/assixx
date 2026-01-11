/**
 * Auth Module
 *
 * Handles authentication for the application.
 * Provides login, logout, token refresh, and user registration.
 *
 * Dependencies:
 * - DatabaseModule (for user queries)
 * - JwtModule (for token operations)
 */
import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design
export class AuthModule {}
