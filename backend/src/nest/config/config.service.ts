/**
 * Application Configuration Service
 *
 * Provides typed access to environment variables.
 * Validates configuration at startup using Zod.
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type ZodError, z } from 'zod';

/**
 * Environment configuration schema
 * Validates all required environment variables
 */
const EnvSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // Database
  DB_HOST: z.string().default('assixx-postgres'),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_NAME: z.string().default('assixx'),
  DB_USER: z.string().default('assixx_user'),
  DB_PASSWORD: z.string().min(1),
  DB_SYSTEM_USER: z.string().default('sys_user'),
  DB_SYSTEM_PASSWORD: z.string().min(1),

  // JWT
  // SECURITY: Both secrets are REQUIRED and must be at least 32 chars
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32), // Required for token isolation security
  JWT_ACCESS_EXPIRY: z.string().default('30m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // Redis (optional)
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().int().positive().optional(),
  REDIS_PASSWORD: z.string().optional(),

  // CORS
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:5173'),

  // Email (optional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  // 2FA (ADR-054 / FEAT_2FA_EMAIL_MASTERPLAN §2.9, DD-13).
  // Required at runtime so a missing secret crashes startup loud (R11) — the
  // 2FA code mail must always have a sender. Default keeps dev/test green
  // when Doppler hasn't been wired yet; production Doppler config supplies
  // the real address (FEAT_2FA_EMAIL_MASTERPLAN §0.5.2 SMTP domain auth).
  SMTP_FROM: z.string().min(1).default('noreply@assixx.de'),
});

type EnvConfig = z.infer<typeof EnvSchema>;

@Injectable()
export class AppConfigService {
  private readonly config: EnvConfig;

  constructor(private configService: ConfigService) {
    // Validate environment variables at startup
    const result = EnvSchema.safeParse({
      NODE_ENV: this.configService.get<string>('NODE_ENV'),
      PORT: this.configService.get<string>('PORT'),
      DB_HOST: this.configService.get<string>('DB_HOST'),
      DB_PORT: this.configService.get<string>('DB_PORT'),
      DB_NAME: this.configService.get<string>('DB_NAME'),
      DB_USER: this.configService.get<string>('DB_USER'),
      DB_PASSWORD: this.configService.get<string>('DB_PASSWORD'),
      DB_SYSTEM_USER: this.configService.get<string>('DB_SYSTEM_USER'),
      DB_SYSTEM_PASSWORD: this.configService.get<string>('DB_SYSTEM_PASSWORD'),
      JWT_SECRET: this.configService.get<string>('JWT_SECRET'),
      JWT_REFRESH_SECRET: this.configService.get<string>('JWT_REFRESH_SECRET'),
      JWT_ACCESS_EXPIRY: this.configService.get<string>('JWT_ACCESS_EXPIRY'),
      JWT_REFRESH_EXPIRY: this.configService.get<string>('JWT_REFRESH_EXPIRY'),
      REDIS_HOST: this.configService.get<string>('REDIS_HOST'),
      REDIS_PORT: this.configService.get<string>('REDIS_PORT'),
      REDIS_PASSWORD: this.configService.get<string>('REDIS_PASSWORD'),
      ALLOWED_ORIGINS: this.configService.get<string>('ALLOWED_ORIGINS'),
      SMTP_HOST: this.configService.get<string>('SMTP_HOST'),
      SMTP_PORT: this.configService.get<string>('SMTP_PORT'),
      SMTP_USER: this.configService.get<string>('SMTP_USER'),
      SMTP_PASS: this.configService.get<string>('SMTP_PASS'),
      SMTP_FROM: this.configService.get<string>('SMTP_FROM'),
    });

    if (!result.success) {
      const errors = result.error.issues
        .map((issue: ZodError['issues'][number]) => `${issue.path.join('.')}: ${issue.message}`)
        .join('\n');
      throw new Error(`Invalid environment configuration:\n${errors}`);
    }

    this.config = result.data;
  }

  // Server
  get nodeEnv(): string {
    return this.config.NODE_ENV;
  }

  get port(): number {
    return this.config.PORT;
  }

  get isProduction(): boolean {
    return this.config.NODE_ENV === 'production';
  }

  get isDevelopment(): boolean {
    return this.config.NODE_ENV === 'development';
  }

  // Database
  get dbHost(): string {
    return this.config.DB_HOST;
  }

  get dbPort(): number {
    return this.config.DB_PORT;
  }

  get dbName(): string {
    return this.config.DB_NAME;
  }

  get dbUser(): string {
    return this.config.DB_USER;
  }

  get dbPassword(): string {
    return this.config.DB_PASSWORD;
  }

  get databaseConfig(): {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  } {
    return {
      host: this.config.DB_HOST,
      port: this.config.DB_PORT,
      database: this.config.DB_NAME,
      user: this.config.DB_USER,
      password: this.config.DB_PASSWORD,
    };
  }

  /** System pool config (sys_user with BYPASSRLS — for cron, auth, root) */
  get systemDatabaseConfig(): {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  } {
    return {
      host: this.config.DB_HOST,
      port: this.config.DB_PORT,
      database: this.config.DB_NAME,
      user: this.config.DB_SYSTEM_USER,
      password: this.config.DB_SYSTEM_PASSWORD,
    };
  }

  // JWT
  get jwtSecret(): string {
    return this.config.JWT_SECRET;
  }

  get jwtAccessExpiry(): string {
    return this.config.JWT_ACCESS_EXPIRY;
  }

  get jwtRefreshExpiry(): string {
    return this.config.JWT_REFRESH_EXPIRY;
  }

  get jwtRefreshSecret(): string {
    return this.config.JWT_REFRESH_SECRET;
  }

  // Redis
  get redisHost(): string | undefined {
    return this.config.REDIS_HOST;
  }

  get redisPort(): number | undefined {
    return this.config.REDIS_PORT;
  }

  get redisPassword(): string | undefined {
    return this.config.REDIS_PASSWORD;
  }

  get hasRedis(): boolean {
    return this.config.REDIS_HOST !== undefined && this.config.REDIS_PORT !== undefined;
  }

  // CORS
  get allowedOrigins(): string {
    return this.config.ALLOWED_ORIGINS;
  }

  get allowedOriginsArray(): string[] {
    return this.config.ALLOWED_ORIGINS.split(',').map((origin: string) => origin.trim());
  }

  // Email
  get smtpHost(): string | undefined {
    return this.config.SMTP_HOST;
  }

  get smtpPort(): number | undefined {
    return this.config.SMTP_PORT;
  }

  get smtpUser(): string | undefined {
    return this.config.SMTP_USER;
  }

  get smtpPass(): string | undefined {
    return this.config.SMTP_PASS;
  }

  get hasSmtp(): boolean {
    return this.config.SMTP_HOST !== undefined && this.config.SMTP_PORT !== undefined;
  }

  /**
   * Sender address for transactional outbound mail (2FA codes, lockout
   * notifications). Always defined — Zod default fills in `noreply@assixx.de`
   * when the secret is missing. ADR-054 / FEAT_2FA_EMAIL_MASTERPLAN DD-13.
   */
  get smtpFrom(): string {
    return this.config.SMTP_FROM;
  }
}
