/**
 * Machines Module
 *
 * NestJS module for machine management.
 * Provides CRUD operations for machines with tenant isolation.
 *
 * Sub-services:
 * - MachineMaintenanceService — maintenance history, statistics, categories
 * - MachineTeamService — machine-team associations
 */
import { Module } from '@nestjs/common';

import { MachineAvailabilityService } from './machine-availability.service.js';
import { MachineMaintenanceService } from './machine-maintenance.service.js';
import { MachineTeamService } from './machine-team.service.js';
import { MachinesController } from './machines.controller.js';
import { MachinesService } from './machines.service.js';

@Module({
  controllers: [MachinesController],
  providers: [
    MachinesService,
    MachineAvailabilityService,
    MachineMaintenanceService,
    MachineTeamService,
  ],
  exports: [MachinesService, MachineAvailabilityService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured
export class MachinesModule {}
