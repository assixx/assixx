/**
 * Phone number validation utilities
 */

import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

/**
 * Validates international phone number format
 * @param phone Phone number to validate
 * @returns true if valid, false otherwise
 */
export function isValidPhoneNumber(phone: string | null | undefined): boolean {
  if (!phone) return true; // Allow empty/null for optional fields

  // Must start with + and contain 7-29 digits
  const phoneRegex = /^\+[0-9]{7,29}$/;
  return phoneRegex.test(phone);
}

/**
 * Formats a phone number by removing all spaces and special characters
 * @param phone Phone number to format
 * @returns Formatted phone number
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";

  // Remove all non-digit characters except the leading +
  const cleaned = phone.replace(/[^\d+]/g, "");

  // Ensure it starts with +
  if (!cleaned.startsWith("+")) {
    return "";
  }

  return cleaned;
}

/**
 * Common country codes for validation
 */
export const COUNTRY_CODES = {
  DE: "+49", // Germany
  US: "+1", // USA
  GB: "+44", // UK
  FR: "+33", // France
  IT: "+39", // Italy
  ES: "+34", // Spain
  AT: "+43", // Austria
  CH: "+41", // Switzerland
  TR: "+90", // Turkey
  PL: "+48", // Poland
};

/**
 * Checks if a phone number is unique in the database
 * @param phone Phone number to check
 * @param userId User ID to exclude from check (for updates)
 * @param connection Database connection
 * @returns true if unique, false if already exists
 */
export async function isPhoneUnique(
  phone: string,
  userId?: number,
  connection?: Pool | PoolConnection,
): Promise<boolean> {
  const { query } = await import("./db");

  const sql = userId
    ? "SELECT COUNT(*) as count FROM users WHERE phone = ? AND id != ?"
    : "SELECT COUNT(*) as count FROM users WHERE phone = ?";

  const params = userId ? [phone, userId] : [phone];

  interface CountResult extends RowDataPacket {
    count: number;
  }

  if (connection) {
    const [result] = await connection.query<CountResult[]>(sql, params);
    return result[0].count === 0;
  } else {
    const [result] = await query<CountResult[]>(sql, params);
    return result[0].count === 0;
  }
}
