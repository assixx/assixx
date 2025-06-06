import pool from "../database";
import * as bcrypt from "bcrypt";
import { logger } from "../utils/logger";
import { RowDataPacket, ResultSetHeader } from "mysql2/promise";

console.log("[DEBUG] UserModel loading, pool type:", typeof pool);

// Helper function to handle both real pool and mock database
async function executeQuery<T extends RowDataPacket[] | ResultSetHeader>(
  sql: string,
  params?: any[],
): Promise<[T, any]> {
  console.log("[DEBUG] executeQuery called, pool exists:", !!pool);
  // Use any to bypass TypeScript union type issues
  const result = await (pool as any).query(sql, params);
  // MySQL2 returns [rows, fields] or result could be T directly from mock
  if (Array.isArray(result) && result.length === 2) {
    return result as [T, any];
  }
  // Mock database returns the data directly
  return [result as T, null];
}

// Database User interface with snake_case to match DB schema
interface DbUser extends RowDataPacket {
  id: number;
  username: string;
  email: string;
  password: string;
  role: string;
  company?: string;
  notes?: string;
  first_name: string;
  last_name: string;
  age?: number;
  employee_id?: string;
  iban?: string;
  department_id?: number;
  department_name?: string;
  position?: string;
  phone?: string;
  address?: string;
  birthday?: Date;
  hire_date?: Date;
  emergency_contact?: string;
  profile_picture?: string;
  status: string;
  is_archived: boolean;
  is_active?: boolean;
  tenant_id?: number;
  last_login?: Date;
  created_at?: Date;
  updated_at?: Date;
  // Additional fields from joins
  company_name?: string;
  subdomain?: string;
}

interface UserCreateData {
  username: string;
  email: string;
  password: string;
  role: string;
  company?: string;
  notes?: string;
  first_name: string;
  last_name: string;
  age?: number;
  employee_id?: string;
  iban?: string;
  department_id?: number;
  position?: string;
  phone?: string;
  address?: string;
  birthday?: Date;
  hire_date?: Date;
  emergency_contact?: string;
  profile_picture?: string;
  status?: string;
  is_archived?: boolean;
  is_active?: boolean;
  tenant_id?: number;
}

interface UserFilter {
  tenant_id: number; // PFLICHT!
  role?: string;
  is_archived?: boolean;
  department_id?: number;
  status?: string;
  search?: string;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
  limit?: number;
  page?: number;
}

interface CountResult extends RowDataPacket {
  count: number;
  total: number;
}

interface DocumentCountResult extends RowDataPacket {
  document_count: number;
}

interface UserDepartmentTeam extends RowDataPacket {
  role: string | null;
  department_id: number | null;
  team_id: number | null;
  department_name: string | null;
  team_name: string | null;
}

export class User {
  // Removed duplicate methods - see implementations below

  static async create(userData: UserCreateData): Promise<number> {
    const {
      username,
      email,
      password,
      role,
      company,
      notes,
      first_name,
      last_name,
      age,
      employee_id,
      department_id,
      position,
      phone,
      address,
      birthday,
      hire_date,
      emergency_contact,
      profile_picture,
      status = "active",
      is_archived = false,
      is_active = true,
    } = userData;

    // Default-IBAN, damit der Server nicht abstürzt, wenn keine IBAN übergeben wird
    const iban = userData.iban || "";

    const hashedPassword = await bcrypt.hash(password, 10);

    const query = `
      INSERT INTO users (
        username, email, password, role, company, notes, 
        first_name, last_name, age, employee_id, iban,
        department_id, position, phone, address, birthday,
        hire_date, emergency_contact, profile_picture,
        status, is_archived, is_active, tenant_id
      ) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      const [result] = await executeQuery<ResultSetHeader>(query, [
        username,
        email,
        hashedPassword,
        role,
        company,
        notes,
        first_name,
        last_name,
        age,
        employee_id,
        iban,
        department_id,
        position,
        phone,
        address,
        birthday,
        hire_date,
        emergency_contact,
        profile_picture,
        status,
        is_archived,
        is_active,
        userData.tenant_id,
      ]);

      logger.info(`User created successfully with ID: ${result.insertId}`);
      return result.insertId;
    } catch (error) {
      logger.error(`Error creating user: ${(error as Error).message}`);
      throw error;
    }
  }

  static async findByUsername(username: string): Promise<DbUser | undefined> {
    console.log("[DEBUG] findByUsername called for:", username);
    try {
      console.log("[DEBUG] About to execute query with pool:", typeof pool);
      const [rows] = await executeQuery<DbUser[]>(
        "SELECT * FROM users WHERE username = ?",
        [username],
      );
      console.log("[DEBUG] Query completed, rows found:", rows.length);
      return rows[0];
    } catch (error) {
      console.error("[DEBUG] findByUsername error:", error);
      logger.error(
        `Error finding user by username: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  static async findById(
    id: number,
    tenant_id: number,
  ): Promise<DbUser | undefined> {
    try {
      const [rows] = await executeQuery<DbUser[]>(
        `
        SELECT u.*, d.name as department_name, t.company_name, t.subdomain
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN tenants t ON u.tenant_id = t.id
        WHERE u.id = ? AND u.tenant_id = ?
      `,
        [id, tenant_id],
      );

      if (rows[0]) {
        // Normalize boolean fields from MySQL 0/1 to JavaScript true/false
        rows[0].is_active =
          (rows[0].is_active as any) === 1 ||
          (rows[0].is_active as any) === "1" ||
          rows[0].is_active === true;
        rows[0].is_archived =
          (rows[0].is_archived as any) === 1 ||
          (rows[0].is_archived as any) === "1" ||
          rows[0].is_archived === true;
      }

      return rows[0];
    } catch (error) {
      logger.error(`Error finding user by ID: ${(error as Error).message}`);
      throw error;
    }
  }

  static async findByRole(
    role: string,
    includeArchived = false,
    tenant_id: number, // PFLICHT - nicht mehr optional!
  ): Promise<DbUser[]> {
    try {
      let query = `
        SELECT u.id, u.username, u.email, u.role, u.company, 
        u.first_name, u.last_name, u.created_at, u.department_id, 
        u.position, u.phone, u.profile_picture, u.status, u.is_archived,
        u.is_active, u.last_login,
        d.name as department_name 
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.role = ? AND u.tenant_id = ?
      `;

      const params: any[] = [role, tenant_id];

      if (!includeArchived) {
        query += ` AND u.is_archived = false`;
      }

      const [rows] = await executeQuery<DbUser[]>(query, params);

      // Normalize boolean fields from MySQL 0/1 to JavaScript true/false
      const normalizedRows = rows.map((row) => ({
        ...row,
        is_active:
          (row.is_active as any) === 1 ||
          (row.is_active as any) === "1" ||
          row.is_active === true,
        is_archived:
          (row.is_archived as any) === 1 ||
          (row.is_archived as any) === "1" ||
          row.is_archived === true,
      }));

      return normalizedRows;
    } catch (error) {
      logger.error(`Error finding users by role: ${(error as Error).message}`);
      throw error;
    }
  }

  static async findByEmail(email: string): Promise<DbUser | undefined> {
    try {
      const [rows] = await executeQuery<DbUser[]>(
        "SELECT * FROM users WHERE email = ? AND is_archived = false",
        [email],
      );
      return rows[0];
    } catch (error) {
      logger.error(`Error finding user by email: ${(error as Error).message}`);
      throw error;
    }
  }

  static async delete(id: number): Promise<boolean> {
    try {
      const [result] = await executeQuery<ResultSetHeader>(
        "DELETE FROM users WHERE id = ?",
        [id],
      );
      return result.affectedRows > 0;
    } catch (error) {
      logger.error(
        `Error deleting user with ID ${id}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  static async update(
    id: number,
    userData: Partial<UserCreateData>,
  ): Promise<boolean> {
    try {
      // Dynamisch Query aufbauen basierend auf den zu aktualisierenden Feldern
      const fields: string[] = [];
      const values: any[] = [];

      // Für jedes übergebene Feld Query vorbereiten
      Object.entries(userData).forEach(([key, value]) => {
        if (value !== undefined) {
          // Special handling for boolean fields
          if (key === "is_active") {
            logger.info(
              `Special handling for is_active field - received value: ${value}, type: ${typeof value}`,
            );
            fields.push(`${key} = ?`);
            // Ensure boolean is converted properly for MySQL
            values.push(value === true ? 1 : 0);
            logger.info(`is_active will be set to: ${value === true ? 1 : 0}`);
          } else {
            fields.push(`${key} = ?`);
            values.push(value);
            logger.info(`Updating field ${key} to value: ${value}`);
          }
        }
      });

      // Wenn keine Felder zum Aktualisieren vorhanden sind, abbrechen
      if (fields.length === 0) {
        return false;
      }

      // ID für die WHERE-Klausel anhängen
      values.push(id);

      const query = `UPDATE users SET ${fields.join(", ")} WHERE id = ?`;

      logger.info(`Executing update query: ${query}`);
      logger.info(`With values: ${JSON.stringify(values)}`);

      const [result] = await executeQuery<ResultSetHeader>(query, values);
      return result.affectedRows > 0;
    } catch (error) {
      logger.error(
        `Error updating user with ID ${id}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  // Neue Methode: Benutzer suchen mit Filtern
  static async search(filters: UserFilter): Promise<DbUser[]> {
    try {
      let query = `
        SELECT u.id, u.username, u.email, u.role, u.company, 
        u.first_name, u.last_name, u.employee_id, u.created_at,
        u.department_id, u.position, u.phone, u.status, u.is_archived,
        u.is_active, u.last_login,
        d.name as department_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.tenant_id = ?
      `;

      const values: any[] = [filters.tenant_id];

      // Filter für archivierte Benutzer
      if (filters.is_archived !== undefined) {
        query += ` AND u.is_archived = ?`;
        values.push(filters.is_archived);
      } else {
        // Standardmäßig nur nicht-archivierte Benutzer anzeigen
        query += ` AND u.is_archived = false`;
      }

      // Weitere Filter hinzufügen
      if (filters.role) {
        query += ` AND u.role = ?`;
        values.push(filters.role);
      }

      if (filters.department_id) {
        query += ` AND u.department_id = ?`;
        values.push(filters.department_id);
      }

      if (filters.status) {
        query += ` AND u.status = ?`;
        values.push(filters.status);
      }

      if (filters.search) {
        query += ` AND (
          u.username LIKE ? OR 
          u.email LIKE ? OR 
          u.first_name LIKE ? OR 
          u.last_name LIKE ? OR
          u.employee_id LIKE ?
        )`;
        const searchTerm = `%${filters.search}%`;
        values.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
      }

      // Sortierung hinzufügen
      if (filters.sort_by) {
        const validColumns = [
          "username",
          "email",
          "first_name",
          "last_name",
          "created_at",
          "employee_id",
          "position",
          "status",
        ];

        if (validColumns.includes(filters.sort_by)) {
          const direction = filters.sort_dir === "desc" ? "DESC" : "ASC";
          query += ` ORDER BY u.${filters.sort_by} ${direction}`;
        } else {
          query += ` ORDER BY u.username ASC`;
        }
      } else {
        query += ` ORDER BY u.username ASC`;
      }

      // Pagination hinzufügen
      if (filters.limit) {
        const limit = parseInt(filters.limit.toString()) || 20;
        const page = parseInt((filters.page || 1).toString()) || 1;
        const offset = (page - 1) * limit;

        query += ` LIMIT ? OFFSET ?`;
        values.push(limit, offset);
      }

      const [rows] = await executeQuery<DbUser[]>(query, values);

      // Normalize boolean fields from MySQL 0/1 to JavaScript true/false
      const normalizedRows = rows.map((row) => ({
        ...row,
        is_active:
          (row.is_active as any) === 1 ||
          (row.is_active as any) === "1" ||
          row.is_active === true,
        is_archived:
          (row.is_archived as any) === 1 ||
          (row.is_archived as any) === "1" ||
          row.is_archived === true,
      }));

      return normalizedRows;
    } catch (error) {
      logger.error(`Error searching users: ${(error as Error).message}`);
      throw error;
    }
  }

  // Neue Methode: Profilbild aktualisieren
  static async updateProfilePicture(
    userId: number,
    picturePath: string,
  ): Promise<boolean> {
    try {
      const query = `UPDATE users SET profile_picture = ? WHERE id = ?`;
      const [result] = await executeQuery<ResultSetHeader>(query, [
        picturePath,
        userId,
      ]);
      return result.affectedRows > 0;
    } catch (error) {
      logger.error(
        `Error updating profile picture for user ${userId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  // Neue Methode: Anzahl der Benutzer zählen (für Pagination)
  static async countWithFilters(filters: UserFilter): Promise<number> {
    try {
      let query = `SELECT COUNT(*) as total FROM users u WHERE u.tenant_id = ?`;
      const values: any[] = [filters.tenant_id];

      // Filter für archivierte Benutzer
      if (filters.is_archived !== undefined) {
        query += ` AND u.is_archived = ?`;
        values.push(filters.is_archived);
      } else {
        // Standardmäßig nur nicht-archivierte Benutzer anzeigen
        query += ` AND u.is_archived = false`;
      }

      if (filters.role) {
        query += ` AND u.role = ?`;
        values.push(filters.role);
      }

      if (filters.department_id) {
        query += ` AND u.department_id = ?`;
        values.push(filters.department_id);
      }

      if (filters.status) {
        query += ` AND u.status = ?`;
        values.push(filters.status);
      }

      if (filters.search) {
        query += ` AND (
          u.username LIKE ? OR 
          u.email LIKE ? OR 
          u.first_name LIKE ? OR 
          u.last_name LIKE ? OR
          u.employee_id LIKE ?
        )`;
        const searchTerm = `%${filters.search}%`;
        values.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
      }

      const [rows] = await executeQuery<CountResult[]>(query, values);
      return rows[0].total;
    } catch (error) {
      logger.error(`Error counting users: ${(error as Error).message}`);
      throw error;
    }
  }

  // Neue Methode: Benutzer archivieren
  static async archiveUser(userId: number): Promise<boolean> {
    logger.info(`Archiving user ${userId}`);
    return this.update(userId, { is_archived: true });
  }

  // Neue Methode: Benutzer aus dem Archiv wiederherstellen
  static async unarchiveUser(userId: number): Promise<boolean> {
    logger.info(`Unarchiving user ${userId}`);
    return this.update(userId, { is_archived: false });
  }

  // Neue Methode: Alle archivierten Benutzer auflisten
  static async findArchivedUsers(
    role: string | null = null,
  ): Promise<DbUser[]> {
    try {
      let query = `
        SELECT u.id, u.username, u.email, u.role, u.company, 
        u.first_name, u.last_name, u.created_at, u.department_id, 
        u.position, u.phone, u.profile_picture, u.status,
        d.name as department_name 
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.is_archived = true
      `;

      const params: any[] = [];

      if (role) {
        query += ` AND u.role = ?`;
        params.push(role);
      }

      query += ` ORDER BY u.last_name, u.first_name`;

      const [rows] = await executeQuery<DbUser[]>(query, params);

      return rows;
    } catch (error) {
      logger.error(`Error finding archived users: ${(error as Error).message}`);
      throw error;
    }
  }

  // Neue Methode: Überprüfen, ob ein Benutzer Dokumente hat
  static async hasDocuments(userId: number): Promise<boolean> {
    try {
      const query = `
        SELECT COUNT(*) as document_count 
        FROM documents 
        WHERE user_id = ?
      `;

      const [rows] = await executeQuery<DocumentCountResult[]>(query, [userId]);

      return rows[0].document_count > 0;
    } catch (error) {
      logger.error(
        `Error checking if user ${userId} has documents: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  // Neue Methode: Dokumente eines Benutzers zählen
  static async getDocumentCount(userId: number): Promise<number> {
    try {
      const query = `
        SELECT COUNT(*) as document_count 
        FROM documents 
        WHERE user_id = ?
      `;

      const [rows] = await executeQuery<DocumentCountResult[]>(query, [userId]);

      return rows[0].document_count;
    } catch (error) {
      logger.error(
        `Error counting documents for user ${userId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Get user's department and team information
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Object with role, departmentId, and teamId
   */
  static async getUserDepartmentAndTeam(userId: number): Promise<{
    role: string | null;
    departmentId: number | null;
    teamId: number | null;
    departmentName: string | null;
    teamName: string | null;
  }> {
    try {
      const query = `
        SELECT 
          u.role,
          u.department_id,
          ut.team_id,
          d.name as department_name,
          t.name as team_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN user_teams ut ON u.id = ut.user_id
        LEFT JOIN teams t ON ut.team_id = t.id
        WHERE u.id = ?
      `;

      const [rows] = await executeQuery<UserDepartmentTeam[]>(query, [userId]);

      if (rows.length === 0) {
        return {
          role: null,
          departmentId: null,
          teamId: null,
          departmentName: null,
          teamName: null,
        };
      }

      const user = rows[0];
      return {
        role: user.role,
        departmentId: user.department_id,
        teamId: user.team_id,
        departmentName: user.department_name,
        teamName: user.team_name,
      };
    } catch (error) {
      logger.error(
        `Error getting user department and team: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  // Passwort ändern
  static async changePassword(
    userId: number,
    tenantId: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      // Aktuellen Benutzer abrufen
      const user = await this.findById(userId, tenantId);
      if (!user) {
        return { success: false, message: "Benutzer nicht gefunden" };
      }

      // Aktuelles Passwort überprüfen
      const isValidPassword = await bcrypt.compare(
        currentPassword,
        user.password,
      );
      if (!isValidPassword) {
        return { success: false, message: "Aktuelles Passwort ist incorrect" };
      }

      // Neues Passwort hashen
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      // Passwort in der Datenbank aktualisieren
      const query = "UPDATE users SET password = ? WHERE id = ?";
      const [result] = await executeQuery<ResultSetHeader>(query, [
        hashedNewPassword,
        userId,
      ]);

      if (result.affectedRows > 0) {
        logger.info(`Password changed successfully for user ${userId}`);
        return { success: true, message: "Passwort erfolgreich geändert" };
      } else {
        return { success: false, message: "Fehler beim Ändern des Passworts" };
      }
    } catch (error) {
      logger.error(
        `Error changing password for user ${userId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  // Profil-Update erweitern für allgemeine Felder
  static async updateOwnProfile(
    userId: number,
    tenantId: number,
    userData: Partial<UserCreateData>,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const user = await this.findById(userId, tenantId);

      if (!user) {
        return { success: false, message: "Benutzer nicht gefunden" };
      }

      // Erlaubte Felder für Profil-Updates (erweitert)
      const allowedFields = [
        "email",
        "first_name",
        "last_name",
        "age",
        "employee_id",
        "iban",
        "company",
        "notes",
        "phone",
        "address",
        "emergency_contact",
      ];

      // Nur erlaubte Felder übernehmen
      const updates: any = {};
      Object.keys(userData).forEach((key) => {
        if (
          allowedFields.includes(key) &&
          userData[key as keyof UserCreateData] !== undefined
        ) {
          updates[key] = userData[key as keyof UserCreateData];
        }
      });

      if (Object.keys(updates).length === 0) {
        return {
          success: false,
          message: "Keine gültigen Felder zum Aktualisieren",
        };
      }

      // SQL-Query dynamisch erstellen
      const fields = Object.keys(updates);
      const values = Object.values(updates);
      const setClause = fields.map((field) => `${field} = ?`).join(", ");

      const query = `UPDATE users SET ${setClause} WHERE id = ?`;
      values.push(userId);

      const [result] = await executeQuery<ResultSetHeader>(query, values);

      if (result.affectedRows > 0) {
        logger.info(`Profile updated successfully for user ${userId}`);
        return { success: true, message: "Profil erfolgreich aktualisiert" };
      } else {
        return {
          success: false,
          message: "Fehler beim Aktualisieren des Profils",
        };
      }
    } catch (error) {
      logger.error(
        `Error updating profile for user ${userId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  // Find all users with optional filters
  static async findAll(filters: UserFilter): Promise<DbUser[]> {
    try {
      let query = "SELECT * FROM users WHERE tenant_id = ?";
      const params: any[] = [filters.tenant_id];

      if (filters.role) {
        query += " AND role = ?";
        params.push(filters.role);
      }

      const [rows] = await executeQuery<DbUser[]>(query, params);
      return rows;
    } catch (error) {
      logger.error(`Error finding all users: ${(error as Error).message}`);
      throw error;
    }
  }

  // Find all users by tenant
  static async findAllByTenant(tenantId: number): Promise<DbUser[]> {
    try {
      const [rows] = await executeQuery<DbUser[]>(
        "SELECT * FROM users WHERE tenant_id = ?",
        [tenantId],
      );
      return rows;
    } catch (error) {
      logger.error(
        `Error finding users by tenant: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  // Count users with optional filters
  static async count(filters: UserFilter): Promise<number> {
    try {
      let query = "SELECT COUNT(*) as count FROM users WHERE tenant_id = ?";
      const params: any[] = [filters.tenant_id];

      if (filters.role) {
        query += " AND role = ?";
        params.push(filters.role);
      }

      const [rows] = await executeQuery<any[]>(query, params);
      return rows[0]?.count || 0;
    } catch (error) {
      logger.error(`Error counting users: ${(error as Error).message}`);
      return 0;
    }
  }

  // Count active users by tenant
  static async countActiveByTenant(tenantId: number): Promise<number> {
    try {
      const [rows] = await executeQuery<any[]>(
        "SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND is_active = 1",
        [tenantId],
      );
      return rows[0]?.count || 0;
    } catch (error) {
      logger.error(`Error counting active users: ${(error as Error).message}`);
      return 0;
    }
  }
}

// Export types
export type { DbUser, UserCreateData, UserFilter };

// Default export for CommonJS compatibility
export default User;

// CommonJS compatibility
