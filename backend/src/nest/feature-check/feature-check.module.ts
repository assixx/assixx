/**
 * Feature Check Module
 *
 * Provides FeatureCheckService for checking tenant feature access.
 * DatabaseService is available via the global DatabaseModule.
 */
import { Module } from '@nestjs/common';

import { FeatureCheckService } from './feature-check.service.js';

@Module({
  providers: [FeatureCheckService],
  exports: [FeatureCheckService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured
export class FeatureCheckModule {}
