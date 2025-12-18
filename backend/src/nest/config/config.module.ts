/**
 * Application Configuration Module
 *
 * Provides typed access to environment configuration.
 * Uses Zod for validation to ensure type safety.
 */
import { Global, Module } from '@nestjs/common';

import { AppConfigService } from './config.service.js';

@Global()
@Module({
  providers: [AppConfigService],
  exports: [AppConfigService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design
export class AppConfigModule {}
