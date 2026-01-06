/* eslint-disable import-x/max-dependencies */
/**
 * Root Application Module
 *
 * Main module that imports and configures all feature modules.
 * Sets up global providers like guards, interceptors, and filters.
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import type { FastifyRequest } from 'fastify';
import { ClsModule, ClsService } from 'nestjs-cls';
import { randomUUID } from 'node:crypto';

import { AdminPermissionsModule } from './admin-permissions/admin-permissions.module.js';
import { AreasModule } from './areas/areas.module.js';
import { AuditTrailModule } from './audit-trail/audit-trail.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BlackboardModule } from './blackboard/blackboard.module.js';
import { CalendarModule } from './calendar/calendar.module.js';
import { ChatModule } from './chat/chat.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
// CustomThrottlerGuard is NOT global - applied selectively via @AuthThrottle(), @UploadThrottle()
// Reason: SSR makes many parallel requests from same IP, global rate limit breaks UI/UX
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';
import { TenantContextInterceptor } from './common/interceptors/tenant-context.interceptor.js';
import { AppConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { DepartmentsModule } from './departments/departments.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { FeaturesModule } from './features/features.module.js';
import { KvpModule } from './kvp/kvp.module.js';
import { LogsModule } from './logs/logs.module.js';
import { MachinesModule } from './machines/machines.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PlansModule } from './plans/plans.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { RoleSwitchModule } from './role-switch/role-switch.module.js';
import { RolesModule } from './roles/roles.module.js';
import { RootModule } from './root/root.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { ShiftsModule } from './shifts/shifts.module.js';
import { SignupModule } from './signup/signup.module.js';
import { SurveysModule } from './surveys/surveys.module.js';
import { TeamsModule } from './teams/teams.module.js';
import { AppThrottlerModule } from './throttler/throttler.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    // Configuration - loads .env and validates
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env', '../../docker/.env'],
      cache: true,
    }),

    // Custom config module with typed access
    AppConfigModule,

    // JWT Module
    JwtModule.registerAsync({
      global: true,
      useFactory: (): JwtModuleOptions =>
        ({
          secret: process.env['JWT_SECRET'] ?? 'your-secret-key-change-in-production',
          signOptions: {
            expiresIn: process.env['JWT_ACCESS_EXPIRY'] ?? '30m',
          },
        }) as JwtModuleOptions,
    }),

    // CLS Module for request-scoped context (tenant isolation)
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        idGenerator: (): string => randomUUID(),
        setup: (cls: ClsService, req: FastifyRequest): void => {
          // Initial setup - auth guard will populate user data
          // getId() returns the generated ID from idGenerator
          cls.set('requestId', cls.getId());
          cls.set('requestPath', req.url);
          cls.set('requestMethod', req.method);
        },
      },
    }),

    // Database module (raw PostgreSQL with pg)
    DatabaseModule,

    // Rate Limiting Module (Redis-backed)
    AppThrottlerModule,

    // Feature modules
    AdminPermissionsModule,
    AreasModule,
    AuditTrailModule,
    AuthModule,
    UsersModule,
    DepartmentsModule,
    TeamsModule,
    CalendarModule,
    DocumentsModule,
    BlackboardModule,
    FeaturesModule,
    KvpModule,
    LogsModule,
    MachinesModule,
    SurveysModule,
    NotificationsModule,
    PlansModule,
    ReportsModule,
    RolesModule,
    RoleSwitchModule,
    RootModule,
    SettingsModule,
    ShiftsModule,
    SignupModule,
    ChatModule,
  ],
  providers: [
    // NOTE: Throttler Guard is NOT global - applied selectively via decorators
    // @AuthThrottle() on login/signup, @UploadThrottle() on file uploads
    // See: docs/RATE-LIMITING-NESTJS-PLAN.md for details

    // Global JWT Auth Guard
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global Roles Guard (runs after JWT guard)
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    // Global Exception Filter
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    // Global Response Interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    // Global Tenant Context Interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
  ],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design
export class AppModule {}
