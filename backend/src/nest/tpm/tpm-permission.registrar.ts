/**
 * TPM Permission Registrar (ADR-020)
 *
 * Registers TPM permission modules with the central PermissionRegistryService
 * on application startup via OnModuleInit lifecycle hook.
 */
import { Injectable, type OnModuleInit } from '@nestjs/common';

import { PermissionRegistryService } from '../common/permission-registry/permission-registry.service.js';
import { TPM_PERMISSIONS } from './tpm.permissions.js';

@Injectable()
export class TpmPermissionRegistrar implements OnModuleInit {
  constructor(private readonly registry: PermissionRegistryService) {}

  onModuleInit(): void {
    this.registry.register(TPM_PERMISSIONS);
  }
}
