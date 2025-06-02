// Authentication-specific Type Definitions

import { User } from "./models";

// Authentication Results
export interface AuthResult {
  success: boolean;
  user: User | null;
  token?: string;
  message?: string;
  error?: string;
}

export interface TokenPayload {
  id: number;
  username: string;
  role: "admin" | "employee" | "root";
  tenant_id: number | null;
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
  role?: "admin" | "employee";
  tenantId?: number;
}

// Extended User for Auth Context
export interface AuthenticatedUser extends User {
  userId: number; // Alias for id
  tenantId: number | null; // Alias for tenant_id
}

// JWT Configuration
export interface JwtConfig {
  secret: string;
  expiresIn: string;
}
