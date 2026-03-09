/**
 * Settings Permission Registrar
 *
 * Registers settings permission definitions with the global registry
 * during module initialization.
 */
import { Injectable, OnModuleInit } from '@nestjs/common';

import { PermissionRegistryService } from '../common/permission-registry/permission-registry.service.js';
import { SETTINGS_PERMISSIONS } from './settings.permissions.js';

@Injectable()
export class SettingsPermissionRegistrar implements OnModuleInit {
  constructor(private readonly registry: PermissionRegistryService) {}

  onModuleInit(): void {
    this.registry.register(SETTINGS_PERMISSIONS);
  }
}
