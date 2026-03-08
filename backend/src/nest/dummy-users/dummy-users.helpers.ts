/**
 * Dummy Users Helpers — Pure functions for mapping
 *
 * Stateless helper functions. No DI, no DB calls, no side effects.
 * Maps DB Row types (snake_case) to API types (camelCase).
 */
import {
  parseStringAgg,
  parseStringAggNumbers,
  toIsoString,
} from '../../utils/db-helpers.js';
import type { DummyUser, DummyUserWithTeamsRow } from './dummy-users.types.js';
import {
  DUMMY_EMAIL_DOMAIN,
  DUMMY_EMPLOYEE_PREFIX,
} from './dummy-users.types.js';

/** Map dummy user DB row (with JOINs) to API response */
export function mapDummyUserRowToApi(row: DummyUserWithTeamsRow): DummyUser {
  return {
    uuid: row.uuid.trim(),
    email: row.email,
    displayName: row.display_name,
    employeeNumber: row.employee_number,
    isActive: row.is_active,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    teamIds: parseStringAggNumbers(row.team_ids),
    teamNames: parseStringAgg(row.team_names),
    departmentIds: parseStringAggNumbers(row.department_ids),
    departmentNames: parseStringAgg(row.department_names),
    areaIds: parseStringAggNumbers(row.area_ids),
    areaNames: parseStringAgg(row.area_names),
  };
}

/** Generate auto-email for a dummy user: dummy_{n}@{subdomain}.display */
export function buildDummyEmail(nextNumber: number, subdomain: string): string {
  return `dummy_${nextNumber}@${subdomain}.${DUMMY_EMAIL_DOMAIN}`;
}

/** Generate auto employee number: DUMMY-001, DUMMY-010, etc. */
export function buildDummyEmployeeNumber(nextNumber: number): string {
  return `${DUMMY_EMPLOYEE_PREFIX}-${String(nextNumber).padStart(3, '0')}`;
}
