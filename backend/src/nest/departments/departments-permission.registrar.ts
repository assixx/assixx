/**
 * Departments Permission Registrar
 *
 * Registers department + area permission definitions with the global registry
 * during module initialization.
 */
import { Injectable, OnModuleInit } from '@nestjs/common';

import { PermissionRegistryService } from '../common/permission-registry/permission-registry.service.js';
import { DEPARTMENTS_PERMISSIONS } from './departments.permissions.js';

@Injectable()
export class DepartmentsPermissionRegistrar implements OnModuleInit {
  constructor(private readonly registry: PermissionRegistryService) {}

  onModuleInit(): void {
    this.registry.register(DEPARTMENTS_PERMISSIONS);
  }
}
