/**
 * Database Module
 *
 * Provides PostgreSQL connection pool and database service.
 * Uses raw pg library (NOT TypeORM) for full SQL control.
 * Supports RLS (Row-Level Security) for multi-tenant isolation.
 */
import { Global, Logger, Module, type OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { AppConfigService } from '../config/config.service.js';
import { PG_POOL } from './database.constants.js';
import { DatabaseService } from './database.service.js';
import { UserRepository } from './repositories/user.repository.js';

export { PG_POOL } from './database.constants.js';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: async (configService: AppConfigService): Promise<Pool> => {
        const logger = new Logger('DatabaseModule');
        const config = configService.databaseConfig;

        const pool = new Pool({
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.user,
          password: config.password,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        });

        // Test connection
        try {
          const client = await pool.connect();
          const result = await client.query<{ now: Date }>('SELECT NOW()');
          client.release();
          const timestamp = result.rows[0]?.now ?? 'unknown';
          logger.log(
            `PostgreSQL connected: ${config.host}:${config.port}/${config.database} at ${String(timestamp)}`,
          );
        } catch (error: unknown) {
          logger.error('PostgreSQL connection failed', error);
          throw error;
        }

        // Log pool errors
        pool.on('error', (err: Error) => {
          logger.error('Unexpected PostgreSQL pool error', err);
        });

        return pool;
      },
      inject: [AppConfigService],
    },
    DatabaseService,
    ActivityLoggerService,
    UserRepository,
  ],
  exports: [PG_POOL, DatabaseService, ActivityLoggerService, UserRepository],
})
export class DatabaseModule implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Closing PostgreSQL connection pool...');
    await this.databaseService.closePool();
    this.logger.log('PostgreSQL connection pool closed');
  }
}
