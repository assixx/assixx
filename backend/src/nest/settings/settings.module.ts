/**
 * Settings Module
 *
 * NestJS module for settings management.
 * Provides system, tenant, and user settings with appropriate access controls.
 */
import { Module } from '@nestjs/common';

import { SettingsPermissionRegistrar } from './settings-permission.registrar.js';
import { SettingsController } from './settings.controller.js';
import { SettingsService } from './settings.service.js';

@Module({
  controllers: [SettingsController],
  providers: [SettingsService, SettingsPermissionRegistrar],
  exports: [SettingsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is standard pattern
export class SettingsModule {}
