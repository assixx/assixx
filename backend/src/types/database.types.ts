// Database-specific Type Definitions

import {
  Pool,
  ResultSetHeader,
  RowDataPacket,
  FieldPacket,
} from "mysql2/promise";

export interface DatabaseConfig {
  host: string;
  user: string;
  password: string;
  database: string;
  waitForConnections: boolean;
  connectionLimit: number;
  queueLimit: number;
  multipleStatements: boolean;
  charset: string;
  typeCast?: (
    field: {
      type: string;
      string: (encoding?: string) => string;
      buffer: () => Buffer;
    },
    next: () => unknown,
  ) => unknown;
}

export interface MockDatabase {
  query<T extends RowDataPacket[][] | RowDataPacket[] | ResultSetHeader>(
    sql: string,
    params?: unknown[],
  ): Promise<[T, FieldPacket[]]>;
  execute<T extends RowDataPacket[][] | RowDataPacket[] | ResultSetHeader>(
    sql: string,
    params?: unknown[],
  ): Promise<[T, FieldPacket[]]>;
  getConnection(): Promise<{
    query<T extends RowDataPacket[][] | RowDataPacket[] | ResultSetHeader>(
      sql: string,
      params?: unknown[],
    ): Promise<[T, FieldPacket[]]>;
    execute<T extends RowDataPacket[][] | RowDataPacket[] | ResultSetHeader>(
      sql: string,
      params?: unknown[],
    ): Promise<[T, FieldPacket[]]>;
    beginTransaction(): Promise<void>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
    release(): void;
  }>;
}

export type DatabasePool = Pool | MockDatabase;

// Helper type to extract result type from query
export type QueryResult<T = RowDataPacket> = T[];
export type QueryResultWithMeta<T = RowDataPacket> = [T[], RowDataPacket[]];
