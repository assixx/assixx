/**
 * Addon Check Module
 *
 * Provides AddonCheckService for checking tenant addon access.
 * DatabaseService is available via the global DatabaseModule.
 */
import { Module } from '@nestjs/common';

import { AddonCheckService } from './addon-check.service.js';

@Module({
  providers: [AddonCheckService],
  exports: [AddonCheckService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured
export class AddonCheckModule {}
