/**
 * Auth Module
 *
 * Handles authentication for the application.
 * Provides login, logout, token refresh, user registration, and connection tickets.
 *
 * Dependencies:
 * - DatabaseModule (for user queries)
 * - JwtModule (for token operations)
 * - ConfigModule (for Redis configuration)
 */
import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { ConnectionTicketService } from './connection-ticket.service.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, ConnectionTicketService],
  exports: [AuthService, ConnectionTicketService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design
export class AuthModule {}
