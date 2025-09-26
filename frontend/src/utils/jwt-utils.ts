/**
 * JWT Utility functions - extracted to avoid circular dependencies
 */

import type { JWTPayload } from '../types/api.types';

/**
 * Parse JWT token and extract payload
 * @param token - JWT token string
 * @returns Parsed JWT payload or null if invalid
 */
export function parseJwt(token: string): JWTPayload | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const decodedBase64 = atob(base64);
    let percentEncoded = '';
    for (let i = 0; i < decodedBase64.length; i++) {
      const charCode = decodedBase64.charCodeAt(i);
      percentEncoded += `%${('00' + charCode.toString(16)).slice(-2)}`;
    }
    const jsonPayload = decodeURIComponent(percentEncoded);
    return JSON.parse(jsonPayload) as JWTPayload;
  } catch (error) {
    console.error('Error parsing JWT:', error);
    return null;
  }
}
