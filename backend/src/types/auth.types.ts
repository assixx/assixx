// Authentication-specific Type Definitions
import { User } from './models';

// Authentication Results
export interface AuthResult {
  success: boolean;
  user: User | null;
  token?: string;
  refreshToken?: string;
  message?: string;
  error?: string;
}

export interface TokenPayload {
  id: number;
  username: string;
  role: 'admin' | 'employee' | 'root';
  activeRole?: 'admin' | 'employee' | 'root'; // For role switching
  tenant_id: number | null;
  tenantId?: number | null; // Alternative camelCase naming from v2 APIs
  fingerprint?: string; // Browser fingerprint for session isolation
  sessionId?: string; // Unique session identifier
  iat?: number;
  exp?: number;
}

export interface TokenValidationResult {
  valid: boolean;
  user?: TokenPayload;
  error?: string;
}

// Registration Types
export interface UserRegistrationData {
  username: string;
  password: string;
  email: string;
  vorname: string;
  nachname: string;
  role?: 'admin' | 'employee';
  tenant_id?: number;
}

// Extended User for Auth Context
export interface AuthenticatedUser extends User {
  userId: number; // Alias for id
  tenant_id: number | null;
}

// JWT Configuration
export interface JwtConfig {
  secret: string;
  expiresIn: string;
}
