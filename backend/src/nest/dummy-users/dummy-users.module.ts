/**
 * Dummy Users Module
 *
 * Anonymous display accounts for factory TVs and screens.
 * Admin-only CRUD. No feature gate.
 */
import { Module } from '@nestjs/common';

import { DummyUsersController } from './dummy-users.controller.js';
import { DummyUsersService } from './dummy-users.service.js';

@Module({
  controllers: [DummyUsersController],
  providers: [DummyUsersService],
  exports: [DummyUsersService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is standard pattern
export class DummyUsersModule {}
