// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

/**
 * User role type - matches backend UserRole enum
 */
type UserRole = 'root' | 'admin' | 'employee';

/**
 * User data stored in locals after RBAC check
 */
interface LocalsUser {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  tenantId: number;
  hasFullAccess?: boolean;
}

declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      /** Authenticated user data (set by RBAC hook) */
      user: LocalsUser | null;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
