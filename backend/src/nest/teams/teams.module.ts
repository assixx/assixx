/**
 * Teams Module
 *
 * NestJS module for team management.
 * Provides CRUD operations for teams with tenant isolation.
 */
import { Module } from '@nestjs/common';

import { ScopeModule } from '../hierarchy-permission/scope.module.js';
import { TeamsController } from './teams.controller.js';
import { TeamsService } from './teams.service.js';

@Module({
  imports: [ScopeModule],
  controllers: [TeamsController],
  providers: [TeamsService],
  exports: [TeamsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is standard pattern
export class TeamsModule {}
