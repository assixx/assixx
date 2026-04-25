/**
 * Security Settings Module
 *
 * Registers the SecuritySettings controller + service. The service is
 * exported so UserProfileService can inject it for the
 * `changePassword()` pre-flight policy check.
 */
import { Module } from '@nestjs/common';

import { SecuritySettingsController } from './security-settings.controller.js';
import { SecuritySettingsService } from './security-settings.service.js';

@Module({
  controllers: [SecuritySettingsController],
  providers: [SecuritySettingsService],
  exports: [SecuritySettingsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is standard pattern
export class SecuritySettingsModule {}
