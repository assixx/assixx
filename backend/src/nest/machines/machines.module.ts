/**
 * Machines Module
 */
import { Module } from '@nestjs/common';

import { MachinesController } from './machines.controller.js';
import { MachinesService } from './machines.service.js';

@Module({
  controllers: [MachinesController],
  providers: [MachinesService],
  exports: [MachinesService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured
export class MachinesModule {}
