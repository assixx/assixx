import * as mysql from 'mysql2/promise';
import { PoolOptions, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import * as dotenv from 'dotenv';
import { DatabasePool, MockDatabase } from './types/database.types';

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

if (USE_MOCK_DB) {
  // Mock-Implementierung
  const mockDb: MockDatabase = {
    async query<
      T extends RowDataPacket[][] | RowDataPacket[] | ResultSetHeader,
    >(sql: string, params?: any[]): Promise<T> {
      // Einfache Mock-Daten für Entwicklung
      if (sql.includes('SELECT * FROM users WHERE role = "employee"')) {
        return [
          [
            {
              id: 1,
              username: 'mitarbeiter1',
              first_name: 'Max',
              last_name: 'Mustermann',
              email: 'max@example.com',
              role: 'employee',
              status: 'active',
              department_id: 1,
              position: 'Entwickler',
            },
            {
              id: 2,
              username: 'mitarbeiter2',
              first_name: 'Anna',
              last_name: 'Schmidt',
              email: 'anna@example.com',
              role: 'employee',
              status: 'active',
              department_id: 1,
              position: 'Designerin',
            },
            {
              id: 3,
              username: 'mitarbeiter3',
              first_name: 'Thomas',
              last_name: 'Müller',
              email: 'thomas@example.com',
              role: 'employee',
              status: 'inactive',
              department_id: 2,
              position: 'Manager',
            },
          ] as MockUser[],
        ] as unknown as T;
      } else if (sql.includes('SELECT * FROM departments')) {
        return [
          [
            {
              id: 1,
              name: 'Entwicklung',
              description: 'Software-Entwicklung',
              status: 'active',
            },
            {
              id: 2,
              name: 'Marketing',
              description: 'Marketing und Verkauf',
              status: 'active',
            },
          ] as MockDepartment[],
        ] as unknown as T;
      } else if (sql.includes('SELECT * FROM documents')) {
        return [
          [
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
          ] as MockDocument[],
        ] as unknown as T;
      } else if (sql.includes('COUNT(*) as count FROM users')) {
        return [[{ count: 3 }] as RowDataPacket[]] as T;
      } else if (sql.includes('COUNT(*) as count FROM departments')) {
        return [[{ count: 2 }] as RowDataPacket[]] as T;
      } else if (sql.includes('COUNT(*) as count FROM documents')) {
        return [[{ count: 2 }] as RowDataPacket[]] as T;
      } else if (sql.includes('SELECT * FROM users WHERE username = ?')) {
        if (params && params[0] === 'admin') {
          return [
            [
              {
                id: 999,
                username: 'admin',
                password:
                  '$2b$10$0h85p.WVUvyRJ1taW9vEvehv7Lz.GcMRkRdSOWLG.GaOSydbE8u3a',
                first_name: 'Admin',
                last_name: 'User',
                email: 'admin@example.com',
                role: 'admin',
              },
            ] as MockUser[],
          ] as unknown as T;
        }
        return [[]] as unknown as T;
      } else if (
        sql.includes(
          'SELECT u.*, d.name as department_name FROM users u LEFT JOIN departments d ON u.department_id = d.id WHERE u.id = ?'
        )
      ) {
        // Mock für findById
        const userId = params ? params[0] : null;
        if (userId == 999) {
          return [
            [
              {
                id: 999,
                username: 'admin',
                first_name: 'Admin',
                last_name: 'User',
                email: 'admin@example.com',
                role: 'admin',
                department_id: null,
                department_name: null,
              },
            ] as MockUser[],
          ] as unknown as T;
        } else if (userId == 1) {
          return [
            [
              {
                id: 1,
                username: 'mitarbeiter1',
                first_name: 'Max',
                last_name: 'Mustermann',
                email: 'max@example.com',
                role: 'employee',
                status: 'active',
                department_id: 1,
                department_name: 'Entwicklung',
                position: 'Entwickler',
              },
            ] as MockUser[],
          ] as unknown as T;
        } else if (userId == 2) {
          return [
            [
              {
                id: 2,
                username: 'mitarbeiter2',
                first_name: 'Anna',
                last_name: 'Schmidt',
                email: 'anna@example.com',
                role: 'employee',
                status: 'active',
                department_id: 1,
                department_name: 'Entwicklung',
                position: 'Designerin',
              },
            ] as MockUser[],
          ] as unknown as T;
        } else if (userId == 3) {
          return [
            [
              {
                id: 3,
                username: 'mitarbeiter3',
                first_name: 'Thomas',
                last_name: 'Müller',
                email: 'thomas@example.com',
                role: 'employee',
                status: 'inactive',
                department_id: 2,
                department_name: 'Marketing',
                position: 'Manager',
              },
            ] as MockUser[],
          ] as unknown as T;
        }
        return [[]] as unknown as T;
      } else if (
        sql.includes('UPDATE users SET') &&
        sql.includes('WHERE id = ?')
      ) {
        // Mock für update
        return [{ affectedRows: 1 } as ResultSetHeader] as unknown as T;
      } else if (sql.includes('INSERT INTO users')) {
        // Mock für create
        return [{ insertId: 4 } as ResultSetHeader] as unknown as T;
      } else if (sql.includes('DELETE FROM users WHERE id = ?')) {
        // Mock für delete
        return [{ affectedRows: 1 } as ResultSetHeader] as unknown as T;
      }

      // Standardantwort für nicht implementierte Abfragen
      return [[]] as unknown as T;
    },
    // Execute method (alias for query in mock)
    async execute<
      T extends RowDataPacket[][] | RowDataPacket[] | ResultSetHeader,
    >(sql: string, params?: any[]): Promise<T> {
      return this.query<T>(sql, params);
    },
    async getConnection() {
      // Mock connection object
      const mockConnection = {
        async query<
          T extends RowDataPacket[][] | RowDataPacket[] | ResultSetHeader,
        >(sql: string, params?: any[]): Promise<T> {
          // Use the same mock query function
          return mockDb.query<T>(sql, params);
        },
        async execute<
          T extends RowDataPacket[][] | RowDataPacket[] | ResultSetHeader,
        >(sql: string, params?: any[]): Promise<T> {
          // Use the same mock query function
          return mockDb.execute<T>(sql, params);
        },
        async beginTransaction() {
          // Mock transaction - do nothing
        },
        async commit() {
          // Mock commit - do nothing
        },
        async rollback() {
          // Mock rollback - do nothing
        },
        release() {
          // Mock release - do nothing
        },
      };
      return mockConnection;
    },
  };

  pool = mockDb;
} else {
  // Echte Datenbankverbindung
  console.log('[DEBUG] Database config:', {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
  });

  // Initialize pool immediately with config
  const config: PoolOptions = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'assixx',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: false, // Sicherheitsverbesserung
    charset: 'utf8mb4',
    connectTimeout: 60000, // 60 seconds
    typeCast(field: any, next: () => any) {
      // Spezielle Behandlung für BLOB/BINARY Felder, um sie als Buffer zurückzugeben
      if (field.type === 'BLOB' || field.type === 'BINARY') {
        return field.buffer();
      }
      // Ensure TEXT fields are returned as strings
      if (
        field.type === 'VAR_STRING' ||
        field.type === 'STRING' ||
        field.type === 'LONG_STRING' ||
        field.type === 'TINY' ||
        field.type === 'SHORT' ||
        field.type === 'LONG' ||
        field.type === 'LONGLONG'
      ) {
        return field.string();
      }
      return next();
    },
  };

  try {
    pool = mysql.createPool(config);
    console.log('[DEBUG] Database pool created successfully');

    // Test the connection immediately
    pool
      .getConnection()
      .then((conn) => {
        console.log('[DEBUG] Database connection test successful');
        conn.release();
      })
      .catch((err) => {
        console.error('[DEBUG] Database connection test failed:', err.message);
      });
  } catch (error) {
    console.error('Fehler beim Verbinden mit der Datenbank:', error);
    // Create a dummy pool that throws errors
    pool = {
      async query(): Promise<any> {
        throw new Error('Database connection failed');
      },
      async execute(): Promise<any> {
        throw new Error('Database connection failed');
      },
      async getConnection(): Promise<any> {
        throw new Error('Database connection failed');
      },
    } as MockDatabase;
  }
}

// Export the pool
export default pool;

// CommonJS compatibility
