// Database-specific Type Definitions

import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

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
  typeCast?: (field: any, next: () => any) => any;
}

export interface MockDatabase {
  query<T extends RowDataPacket[][] | RowDataPacket[] | ResultSetHeader>(
    sql: string,
    params?: any[]
  ): Promise<T>;
}

export type DatabasePool = Pool | MockDatabase;

// Helper type to extract result type from query
export type QueryResult<T = RowDataPacket> = T[];
export type QueryResultWithMeta<T = RowDataPacket> = [T[], any];
