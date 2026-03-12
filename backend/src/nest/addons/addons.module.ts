/**
 * Addons Module (ADR-033)
 *
 * Replaces FeaturesModule. Provides addon management endpoints
 * and exports AddonsService for use by other modules.
 */
import { Module } from '@nestjs/common';

import { AddonsController } from './addons.controller.js';
import { AddonsService } from './addons.service.js';

@Module({
  controllers: [AddonsController],
  providers: [AddonsService],
  exports: [AddonsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured
export class AddonsModule {}
