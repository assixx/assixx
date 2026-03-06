/**
 * TPM Locations Sub-Module
 *
 * Self-contained module for structured location descriptions per maintenance plan.
 * Fully independent — no cross-TPM service dependencies.
 */
import { Module } from '@nestjs/common';

import { FeatureCheckModule } from '../feature-check/feature-check.module.js';
import { TpmLocationsController } from './tpm-locations.controller.js';
import { TpmLocationsService } from './tpm-locations.service.js';

@Module({
  imports: [FeatureCheckModule],
  controllers: [TpmLocationsController],
  providers: [TpmLocationsService],
  exports: [TpmLocationsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is standard pattern
export class TpmLocationsModule {}
