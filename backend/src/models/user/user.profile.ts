/**
 * User Profile & Account Management
 * Handles profile updates, password changes, and account-related operations
 */
import bcrypt from 'bcryptjs';

import { ResultSetHeader, query as executeQuery } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { findUserById } from './user.crud.js';
import { PasswordChangeResult, ProfileUpdateResult, UserCreateData } from './user.types.js';

/**
 * Update user profile picture
 */
export async function updateUserProfilePicture(
  userId: number,
  picturePath: string,
  tenantId: number, // SECURITY FIX: Made tenantId mandatory
): Promise<boolean> {
  try {
    // SECURITY: Always include tenant_id in WHERE clause
    const query = `UPDATE users SET profile_picture = ? WHERE id = ? AND tenant_id = ?`;
    const values = [picturePath, userId, tenantId];

    const [result] = await executeQuery<ResultSetHeader>(query, values);
    return result.affectedRows > 0;
  } catch (error: unknown) {
    logger.error(`Error updating profile picture for user ${userId}: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Change user password
 */
export async function changeUserPassword(
  userId: number,
  tenantId: number,
  currentPassword: string,
  newPassword: string,
): Promise<PasswordChangeResult> {
  try {
    // Aktuellen Benutzer abrufen
    const user = await findUserById(userId, tenantId);
    if (!user) {
      return { success: false, message: 'Benutzer nicht gefunden' };
    }

    // Aktuelles Passwort überprüfen
    const isValidPassword = await bcrypt.compare(currentPassword, user.password || '');
    if (!isValidPassword) {
      return { success: false, message: 'Aktuelles Passwort ist incorrect' };
    }

    // Neues Passwort hashen
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Passwort in der Datenbank aktualisieren
    const query = 'UPDATE users SET password = ? WHERE id = ?';
    const [result] = await executeQuery<ResultSetHeader>(query, [hashedNewPassword, userId]);

    if (result.affectedRows > 0) {
      logger.info(`Password changed successfully for user ${userId}`);
      return { success: true, message: 'Passwort erfolgreich geändert' };
    } else {
      return { success: false, message: 'Fehler beim Ändern des Passworts' };
    }
  } catch (error: unknown) {
    logger.error(`Error changing password for user ${userId}: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Update user's own profile (self-service)
 */
export async function updateOwnProfile(
  userId: number,
  tenantId: number,
  userData: Partial<UserCreateData>,
): Promise<ProfileUpdateResult> {
  try {
    const user = await findUserById(userId, tenantId);

    if (!user) {
      return { success: false, message: 'Benutzer nicht gefunden' };
    }

    // Erlaubte Felder für Profil-Updates (erweitert)
    const allowedFields = [
      'email',
      'first_name',
      'last_name',
      'age',
      'employee_id',
      'iban',
      'company',
      'notes',
      'phone',
      'address',
      'emergency_contact',
    ];

    // Nur erlaubte Felder übernehmen
    const updates = new Map<string, unknown>();
    allowedFields.forEach((field: string) => {
      const value = userData[field as keyof UserCreateData];
      if (value !== undefined) {
        updates.set(field, value);
      }
    });

    if (updates.size === 0) {
      return {
        success: false,
        message: 'Keine gültigen Felder zum Aktualisieren',
      };
    }

    // SQL-Query dynamisch erstellen
    const fields = [...updates.keys()];
    const values = [...updates.values()];
    // SECURITY FIX: Escape column names with backticks to prevent SQL injection
    const setClause = fields.map((field: string) => `\`${field}\` = ?`).join(', ');

    const query = `UPDATE users SET ${setClause} WHERE id = ?`;
    values.push(userId);

    const [result] = await executeQuery<ResultSetHeader>(query, values);

    if (result.affectedRows > 0) {
      logger.info(`Profile updated successfully for user ${userId}`);
      return { success: true, message: 'Profil erfolgreich aktualisiert' };
    } else {
      return {
        success: false,
        message: 'Fehler beim Aktualisieren des Profils',
      };
    }
  } catch (error: unknown) {
    logger.error(`Error updating profile for user ${userId}: ${(error as Error).message}`);
    throw error;
  }
}
