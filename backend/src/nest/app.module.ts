/* eslint-disable import-x/max-dependencies -- NestJS root module imports all feature modules by design */
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
import { ScheduleModule } from '@nestjs/schedule';
import { SentryModule } from '@sentry/nestjs/setup';
import type { FastifyRequest } from 'fastify';
import { ClsModule, ClsService } from 'nestjs-cls';
import { randomUUID } from 'node:crypto';

import { AddonCheckModule } from './addon-check/addon-check.module.js';
import { AddonVisitsModule } from './addon-visits/addon-visits.module.js';
import { AddonsModule } from './addons/addons.module.js';
import { AdminPermissionsModule } from './admin-permissions/admin-permissions.module.js';
import { AreasModule } from './areas/areas.module.js';
import { AssetsModule } from './assets/assets.module.js';
import { AuditTrailModule } from './audit-trail/audit-trail.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BlackboardModule } from './blackboard/blackboard.module.js';
import { CalendarModule } from './calendar/calendar.module.js';
import { ChatModule } from './chat/chat.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { PermissionGuard } from './common/guards/permission.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { TenantAddonGuard } from './common/guards/tenant-addon.guard.js';
// CustomThrottlerGuard is NOT global - applied selectively via @AuthThrottle(), @UploadThrottle()
// Reason: SSR makes many parallel requests from same IP, global rate limit breaks UI/UX
import { AuditTrailInterceptor } from './common/interceptors/audit-trail.interceptor.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';
import { LoggerModule } from './common/logger/logger.module.js';
import { PermissionRegistryModule } from './common/permission-registry/permission-registry.module.js';
import { CompanyModule } from './company/company.module.js';
import { AppConfigModule } from './config/config.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { DatabaseModule } from './database/database.module.js';
import { DepartmentsModule } from './departments/departments.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { DummyUsersModule } from './dummy-users/dummy-users.module.js';
import { E2eEscrowModule } from './e2e-escrow/e2e-escrow.module.js';
import { E2eKeysModule } from './e2e-keys/e2e-keys.module.js';
import { HallsModule } from './halls/halls.module.js';
import { KvpModule } from './kvp/kvp.module.js';
import { LogsModule } from './logs/logs.module.js';
import { MetricsModule } from './metrics/metrics.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { OrganigramModule } from './organigram/organigram.module.js';
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
import { TpmModule } from './tpm/tpm.module.js';
import { UserPermissionsModule } from './user-permissions/user-permissions.module.js';
import { UsersModule } from './users/users.module.js';
import { VacationModule } from './vacation/vacation.module.js';
import { WorkOrdersModule } from './work-orders/work-orders.module.js';

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

    // Pino Logger Module (replaces Winston)
    // Must be early so other modules can use logging
    LoggerModule,

    // Prometheus Metrics Module
    // Exposes /api/v2/metrics for Prometheus scraping
    MetricsModule,

    // Sentry Error Tracking Module
    // Initialized in instrument.ts (must be imported first in main.ts)
    // Only active when SENTRY_DSN is configured
    SentryModule.forRoot(),

    // Schedule Module for Cron Jobs
    // Used for: LogRetentionService
    // @see ADR-009 Central Audit Logging
    ScheduleModule.forRoot(),

    // JWT Module
    // SECURITY: JWT_SECRET must be set in environment (no fallback allowed)
    JwtModule.registerAsync({
      global: true,
      useFactory: (): JwtModuleOptions => {
        const secret = process.env['JWT_SECRET'];
        if (secret === undefined || secret === '' || secret.length < 32) {
          throw new Error(
            'SECURITY ERROR: JWT_SECRET must be set and at least 32 characters. ' +
              "Generate one with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"",
          );
        }
        return {
          secret,
          signOptions: {
            expiresIn: process.env['JWT_ACCESS_EXPIRY'] ?? '30m',
          },
        } as JwtModuleOptions;
      },
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

    // Permission Registry (Global Singleton, ADR-020)
    // Feature modules register their permissions via OnModuleInit
    PermissionRegistryModule,

    // Rate Limiting Module (Redis-backed)
    AppThrottlerModule,

    // Feature modules
    AdminPermissionsModule,
    AreasModule,
    AuditTrailModule,
    AuthModule,
    UsersModule,
    DashboardModule,
    DepartmentsModule,
    DummyUsersModule,
    TeamsModule,
    CalendarModule,
    DocumentsModule,
    E2eEscrowModule,
    E2eKeysModule,
    BlackboardModule,
    AddonCheckModule,
    AddonVisitsModule,
    AddonsModule,
    HallsModule,
    KvpModule,
    LogsModule,
    AssetsModule,
    SurveysModule,
    NotificationsModule,
    OrganigramModule,
    ReportsModule,
    RolesModule,
    RoleSwitchModule,
    RootModule,
    SettingsModule,
    ShiftsModule,
    SignupModule,
    VacationModule,
    WorkOrdersModule,
    TpmModule,
    ChatModule,
    CompanyModule,
    UserPermissionsModule,
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
    // Global Tenant Addon Guard (runs after Roles guard)
    // Checks @RequireAddon() decorator against addons/tenant_addons tables
    // No root/admin bypass — addon activation is a billing decision
    {
      provide: APP_GUARD,
      useClass: TenantAddonGuard,
    },
    // Global Permission Guard (runs after Tenant Addon guard, ADR-020)
    // Checks @RequirePermission() decorator against user_addon_permissions table
    // Root + admin-with-full-access bypass; all others: fail-closed DB check
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
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
    // Global Audit Trail Interceptor
    // Logs ALL authenticated requests to audit_trail table
    // @see ADR-009 Central Audit Logging
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditTrailInterceptor,
    },
  ],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design
export class AppModule {}
