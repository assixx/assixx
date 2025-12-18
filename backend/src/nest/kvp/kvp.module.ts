/**
 * KVP Module
 *
 * NestJS module for Continuous Improvement Process (KVP) management.
 * Provides CRUD operations for improvement suggestions with tenant isolation.
 */
import { Module } from '@nestjs/common';

import { KvpController } from './kvp.controller.js';
import { KvpService } from './kvp.service.js';

@Module({
  controllers: [KvpController],
  providers: [KvpService],
  exports: [KvpService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is standard pattern
export class KvpModule {}
