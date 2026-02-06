/**
 * Minimal NestJS module for the deletion worker.
 * Bootstraps only what's needed: config, database, and tenant deletion.
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClsModule } from 'nestjs-cls';

import { AppConfigModule } from '../nest/config/config.module.js';
import { DatabaseModule } from '../nest/database/database.module.js';
import { TenantDeletionModule } from '../nest/tenant-deletion/tenant-deletion.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env', '../../docker/.env'],
      cache: true,
    }),
    AppConfigModule,
    ClsModule.forRoot({ global: true }),
    DatabaseModule,
    TenantDeletionModule,
  ],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS module pattern
export class DeletionWorkerModule {}
