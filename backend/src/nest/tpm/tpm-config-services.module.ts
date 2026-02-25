/**
 * TPM Config Services Sub-Module
 *
 * Pure configuration services with zero cross-TPM dependencies.
 * The TpmConfigController stays in the main TpmModule because it also
 * depends on TpmEscalationService (which has cross-TPM dependencies).
 */
import { Module } from '@nestjs/common';

import { TpmColorConfigService } from './tpm-color-config.service.js';
import { TpmTemplatesService } from './tpm-templates.service.js';
import { TpmTimeEstimatesService } from './tpm-time-estimates.service.js';

@Module({
  providers: [
    TpmColorConfigService,
    TpmTemplatesService,
    TpmTimeEstimatesService,
  ],
  exports: [
    TpmColorConfigService,
    TpmTemplatesService,
    TpmTimeEstimatesService,
  ],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is standard pattern
export class TpmConfigServicesModule {}
