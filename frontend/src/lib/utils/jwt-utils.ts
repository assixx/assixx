/**
 * JWT Utility functions - extracted to avoid circular dependencies
 * 1:1 Copy from frontend/src/utils/jwt-utils.ts
 */

import { createLogger } from './logger';

const log = createLogger('JWTUtils');

/** JWT Payload structure */
export interface JWTPayload {
  id: number;
  email: string;
  role: 'root' | 'admin' | 'employee';
  tenantId: number;
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
}

/** Parse JWT token and extract payload */
export function parseJwt(token: string): JWTPayload | null {
  try {
    const base64Url = token.split('.').at(1);
    if (base64Url === undefined) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const decodedBase64 = atob(base64);
    let percentEncoded = '';
    for (let i = 0; i < decodedBase64.length; i++) {
      const charCode = decodedBase64.charCodeAt(i);
      percentEncoded += `%${('00' + charCode.toString(16)).slice(-2)}`;
    }
    const jsonPayload = decodeURIComponent(percentEncoded);
    return JSON.parse(jsonPayload) as JWTPayload;
  } catch (error: unknown) {
    log.error({ err: error }, 'Error parsing JWT');
    return null;
  }
}

/** Check if token is expired */
export function isTokenExpired(token: string): boolean {
  const payload = parseJwt(token);
  if (payload?.exp === undefined) return true;

  const now = Date.now() / 1000;
  return payload.exp < now;
}

/** Get time until token expires (in seconds) */
export function getTokenExpiryTime(token: string): number {
  const payload = parseJwt(token);
  if (payload?.exp === undefined) return 0;

  const now = Date.now() / 1000;
  return Math.max(0, payload.exp - now);
}
