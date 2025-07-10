/**
 * Database wrapper utilities for proper TypeScript types
 */

import { RowDataPacket, ResultSetHeader } from "mysql2/promise";

export interface DbConnection {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<[RowDataPacket[] | ResultSetHeader, unknown]>;
  execute(
    sql: string,
    params?: unknown[],
  ): Promise<[RowDataPacket[] | ResultSetHeader, unknown]>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): void;
}

export class ConnectionWrapper {
  constructor(private conn: DbConnection) {}

  async query<T extends RowDataPacket[] = RowDataPacket[]>(
    sql: string,
    params?: unknown[],
  ): Promise<T> {
    const [result] = await this.conn.query(sql, params);
    return result as T;
  }

  async execute(sql: string, params?: unknown[]): Promise<ResultSetHeader> {
    const [result] = await this.conn.execute(sql, params);
    return result as ResultSetHeader;
  }

  async beginTransaction(): Promise<void> {
    return this.conn.beginTransaction();
  }

  async commit(): Promise<void> {
    return this.conn.commit();
  }

  async rollback(): Promise<void> {
    return this.conn.rollback();
  }

  release(): void {
    return this.conn.release();
  }
}

export function wrapConnection(conn: DbConnection): ConnectionWrapper {
  return new ConnectionWrapper(conn);
}
