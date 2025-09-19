import * as dotenv from 'dotenv';
import * as mysql from 'mysql2/promise';
import { PoolOptions, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { DatabasePool, MockDatabase } from '../types/database.types.js';

dotenv.config();

// Prüfe, ob wir den Mock-Modus verwenden sollen
const USE_MOCK_DB = process.env.USE_MOCK_DB === 'true';

let pool: DatabasePool;

// Type definitions for mock data
interface MockUser extends RowDataPacket {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  status?: string;
  department_id?: number | null;
  department_name?: string | null;
  position?: string;
  password?: string;
}

interface MockDepartment extends RowDataPacket {
  id: number;
  name: string;
  description: string;
  status: string;
}

interface MockDocument extends RowDataPacket {
  id: number;
  user_id: number;
  file_name: string;
  category: string;
  upload_date: Date;
}

// Helper functions for mock queries
function getMockEmployees<T>(): Promise<[T, mysql.FieldPacket[]]> {
  return Promise.resolve([[[] as MockUser[]], []] as unknown as [T, mysql.FieldPacket[]]);
}

function getMockDepartments<T>(): Promise<[T, mysql.FieldPacket[]]> {
  const departments = [
    { id: 1, name: 'Entwicklung', description: 'Software-Entwicklung', status: 'active' },
    { id: 2, name: 'Marketing', description: 'Marketing und Verkauf', status: 'active' },
  ] as MockDepartment[];
  return Promise.resolve([[[...departments]], []] as unknown as [T, mysql.FieldPacket[]]);
}

function getMockDocuments<T>(): Promise<[T, mysql.FieldPacket[]]> {
  const documents = [
    {
      id: 1,
      user_id: 1,
      file_name: 'Arbeitsvertrag.pdf',
      category: 'Vertrag',
      upload_date: new Date(),
    },
    {
      id: 2,
      user_id: 2,
      file_name: 'Gehaltsabrechnung.pdf',
      category: 'Gehaltsabrechnung',
      upload_date: new Date(),
    },
  ] as MockDocument[];
  return Promise.resolve([[[...documents]], []] as unknown as [T, mysql.FieldPacket[]]);
}

function getMockCount<T>(count: number): Promise<[T, mysql.FieldPacket[]]> {
  return Promise.resolve([[[{ count }] as RowDataPacket[]], []] as unknown as [
    T,
    mysql.FieldPacket[],
  ]);
}

function getMockUserByUsername<T>(params?: unknown[]): Promise<[T, mysql.FieldPacket[]]> {
  if (params !== undefined && params[0] === 'admin') {
    const adminUser = {
      id: 999,
      username: 'admin',
      password: '$2b$10$0h85p.WVUvyRJ1taW9vEvehv7Lz.GcMRkRdSOWLG.GaOSydbE8u3a',
      first_name: 'Admin',
      last_name: 'User',
      email: 'admin@example.com',
      role: 'admin',
    } as MockUser;
    return Promise.resolve([[[[adminUser]]], []] as unknown as [T, mysql.FieldPacket[]]);
  }
  return Promise.resolve([[[]], []] as unknown as [T, mysql.FieldPacket[]]);
}

function getMockUserById<T>(params?: unknown[]): Promise<[T, mysql.FieldPacket[]]> {
  const userId = params !== undefined ? params[0] : null;
  if (userId === 999) {
    const adminUser = {
      id: 999,
      username: 'admin',
      first_name: 'Admin',
      last_name: 'User',
      email: 'admin@example.com',
      role: 'admin',
      department_id: null,
      department_name: null,
    } as MockUser;
    return Promise.resolve([[[[adminUser]]], []] as unknown as [T, mysql.FieldPacket[]]);
  }
  return Promise.resolve([[[]], []] as unknown as [T, mysql.FieldPacket[]]);
}

function getMockMutationResult<T>(): Promise<[T, mysql.FieldPacket[]]> {
  return Promise.resolve([[{ affectedRows: 1 } as ResultSetHeader], []] as unknown as [
    T,
    mysql.FieldPacket[],
  ]);
}

function getMockInsertResult<T>(): Promise<[T, mysql.FieldPacket[]]> {
  return Promise.resolve([[{ insertId: 4 } as ResultSetHeader], []] as unknown as [
    T,
    mysql.FieldPacket[],
  ]);
}

function getEmptyResult<T>(): Promise<[T, mysql.FieldPacket[]]> {
  return Promise.resolve([[[]], []] as unknown as [T, mysql.FieldPacket[]]);
}

if (USE_MOCK_DB) {
  // Mock-Implementierung
  const mockDb: MockDatabase = {
    async query<T extends RowDataPacket[][] | RowDataPacket[] | ResultSetHeader>(
      sql: string,
      params?: unknown[],
    ): Promise<[T, mysql.FieldPacket[]]> {
      // Employee queries
      if (sql.includes('SELECT * FROM users WHERE role = "employee"')) {
        return await getMockEmployees<T>();
      }

      // Department queries
      if (sql.includes('SELECT * FROM departments')) {
        return await getMockDepartments<T>();
      }

      // Document queries
      if (sql.includes('SELECT * FROM documents')) {
        return await getMockDocuments<T>();
      }

      // Count queries
      if (sql.includes('COUNT(*) as count FROM users')) {
        return await getMockCount<T>(0);
      }
      if (
        sql.includes('COUNT(*) as count FROM departments') ||
        sql.includes('COUNT(*) as count FROM documents')
      ) {
        return await getMockCount<T>(2);
      }

      // User queries
      if (sql.includes('SELECT * FROM users WHERE username = ?')) {
        return await getMockUserByUsername<T>(params);
      }
      if (
        sql.includes('SELECT u.*, d.name as department_name FROM users u LEFT JOIN departments d')
      ) {
        return await getMockUserById<T>(params);
      }

      // Mutation queries
      if (
        (sql.includes('UPDATE users SET') && sql.includes('WHERE id = ?')) ||
        sql.includes('DELETE FROM users WHERE id = ?')
      ) {
        return await getMockMutationResult<T>();
      }
      if (sql.includes('INSERT INTO users')) {
        return await getMockInsertResult<T>();
      }

      // Default for unimplemented queries
      return await getEmptyResult<T>();
    },
    // Execute method (alias for query in mock)
    async execute<T extends RowDataPacket[][] | RowDataPacket[] | ResultSetHeader>(
      sql: string,
      params?: unknown[],
    ): Promise<[T, mysql.FieldPacket[]]> {
      return await mockDb.query<T>(sql, params);
    },
    async getConnection() {
      // Mock connection object
      const mockConnection = {
        async query<T extends RowDataPacket[][] | RowDataPacket[] | ResultSetHeader>(
          sql: string,
          params?: unknown[],
        ): Promise<[T, mysql.FieldPacket[]]> {
          // Use the same mock query function
          return await mockDb.query<T>(sql, params);
        },
        async execute<T extends RowDataPacket[][] | RowDataPacket[] | ResultSetHeader>(
          sql: string,
          params?: unknown[],
        ): Promise<[T, mysql.FieldPacket[]]> {
          // Use the same mock query function
          return await mockDb.execute<T>(sql, params);
        },
        async beginTransaction() {
          // Mock transaction - do nothing
          await Promise.resolve();
        },
        async commit() {
          // Mock commit - do nothing
          await Promise.resolve();
        },
        async rollback() {
          // Mock rollback - do nothing
          await Promise.resolve();
        },
        release() {
          // Mock release - do nothing
        },
      };
      return await Promise.resolve(mockConnection);
    },
  };

  pool = mockDb;
} else {
  // Echte Datenbankverbindung
  console.info('[DEBUG] Database config:', {
    host: process.env.DB_HOST ?? 'localhost',
    user: process.env.DB_USER ?? 'assixx_user',
    database: process.env.DB_NAME ?? 'main',
    port: process.env.DB_PORT ?? (process.env.CI !== undefined ? '3306' : '3307'),
    NODE_ENV: process.env.NODE_ENV,
    CI: process.env.CI,
  });

  // Initialize pool immediately with config
  // Use port 3306 for CI, 3307 for local development
  const defaultPort = process.env.CI !== undefined && process.env.CI !== '' ? '3306' : '3307';
  const defaultDatabase = 'main';
  const config: PoolOptions = {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number.parseInt(
      process.env.DB_PORT !== undefined && process.env.DB_PORT !== '' ?
        process.env.DB_PORT
      : defaultPort,
    ),
    user: process.env.DB_USER ?? 'assixx_user',
    password: process.env.DB_PASSWORD ?? 'AssixxP@ss2025!',
    database: process.env.DB_NAME ?? defaultDatabase,
    waitForConnections: true,
    connectionLimit: process.env.NODE_ENV === 'test' ? 1 : 10,
    queueLimit: 0,
    multipleStatements: false, // Sicherheitsverbesserung
    charset: 'utf8mb4',
    connectTimeout: process.env.NODE_ENV === 'test' ? 5000 : 60000, // 5s for tests
    stringifyObjects: false,
    supportBigNumbers: true,
    bigNumberStrings: false,
    dateStrings: false,
    debug: false,
    typeCast: function (field, next) {
      if (field.type === 'VAR_STRING' || field.type === 'STRING' || field.type === 'BLOB') {
        const value = field.string('utf8');
        return value ?? null;
      }
      return next();
    },
  };

  try {
    pool = mysql.createPool(config);
    console.info('[DEBUG] Database pool created successfully');

    // Skip connection test in test environment
    if (process.env.NODE_ENV !== 'test') {
      // Test the connection immediately
      void (async () => {
        try {
          const conn = await pool.getConnection();
          console.info('[DEBUG] Database connection test successful');
          conn.release();
        } catch (error: unknown) {
          console.error(
            '[DEBUG] Database connection test failed:',
            error instanceof Error ? error.message : 'Unknown error',
          );
        }
      })();
    }
  } catch (error: unknown) {
    console.error('Fehler beim Verbinden mit der Datenbank:', error);
    // Create a dummy pool that throws errors
    pool = {
      async query<T extends RowDataPacket[][] | RowDataPacket[] | ResultSetHeader>(): Promise<
        [T, mysql.FieldPacket[]]
      > {
        return await Promise.reject(new Error('Database connection failed'));
      },
      async execute<T extends RowDataPacket[][] | RowDataPacket[] | ResultSetHeader>(): Promise<
        [T, mysql.FieldPacket[]]
      > {
        return await Promise.reject(new Error('Database connection failed'));
      },
      async getConnection(): Promise<{
        query<T extends RowDataPacket[][] | RowDataPacket[] | ResultSetHeader>(
          sql: string,
          params?: unknown[],
        ): Promise<[T, mysql.FieldPacket[]]>;
        execute<T extends RowDataPacket[][] | RowDataPacket[] | ResultSetHeader>(
          sql: string,
          params?: unknown[],
        ): Promise<[T, mysql.FieldPacket[]]>;
        beginTransaction(): Promise<void>;
        commit(): Promise<void>;
        rollback(): Promise<void>;
        release(): void;
      }> {
        return await Promise.reject(new Error('Database connection failed'));
      },
    } as MockDatabase;
  }
}

// Export the pool
export default pool;
export { pool };

// Function to close the pool (for tests)
/**
 *
 */
export async function closePool(): Promise<void> {
  if ('end' in pool && typeof pool.end === 'function') {
    try {
      // Give connections time to finish
      await new Promise((resolve) => setTimeout(resolve, 100));
      await pool.end();
      console.info('[DEBUG] Database pool closed');
    } catch (error: unknown) {
      console.error('[DEBUG] Error closing pool:', error);
    }
  }
}

// CommonJS compatibility
