/**
 * Assets Module
 *
 * NestJS module for asset management.
 * Provides CRUD operations for assets with tenant isolation.
 *
 * Sub-services:
 * - AssetMaintenanceService — maintenance history, statistics, categories
 * - AssetTeamService — asset-team associations
 */
import { Module } from '@nestjs/common';

import { AssetAvailabilityService } from './asset-availability.service.js';
import { AssetMaintenanceService } from './asset-maintenance.service.js';
import { AssetTeamService } from './asset-team.service.js';
import { AssetsController } from './assets.controller.js';
import { AssetsService } from './assets.service.js';

@Module({
  controllers: [AssetsController],
  providers: [
    AssetsService,
    AssetAvailabilityService,
    AssetMaintenanceService,
    AssetTeamService,
  ],
  exports: [AssetsService, AssetAvailabilityService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured
export class AssetsModule {}
