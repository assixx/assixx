/**
 * KVP Constants
 *
 * Error messages, SQL queries, and static defaults for the KVP module.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';

import type { ExtendedUserOrgInfo } from './kvp.types.js';

export const ERROR_SUGGESTION_NOT_FOUND = 'Suggestion not found';

/** Default empty org info for users not found in the system */
export const EMPTY_ORG_INFO: ExtendedUserOrgInfo = {
  teamIds: [],
  departmentIds: [],
  areaIds: [],
  teamLeadOf: [],
  departmentLeadOf: [],
  areaLeadOf: [],
  teamsDepartmentIds: [],
  departmentsAreaIds: [],
  hasFullAccess: false,
};

/**
 * SQL query to get all user org info in one query
 * SECURITY: Only returns data for ACTIVE users (is_active = 1)
 */
export const EXTENDED_ORG_INFO_QUERY = `
  WITH user_data AS (
    SELECT has_full_access FROM users WHERE id = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}
  ),
  user_team_ids AS (
    SELECT DISTINCT team_id FROM user_teams WHERE user_id = $1 AND tenant_id = $2
  ),
  user_dept_ids AS (
    SELECT DISTINCT department_id FROM user_departments WHERE user_id = $1 AND tenant_id = $2
  ),
  team_lead_ids AS (
    SELECT DISTINCT id FROM teams WHERE team_lead_id = $1 AND tenant_id = $2
  ),
  dept_lead_ids AS (
    SELECT DISTINCT id FROM departments WHERE department_lead_id = $1 AND tenant_id = $2
  ),
  area_lead_ids AS (
    SELECT DISTINCT id FROM areas WHERE area_lead_id = $1 AND tenant_id = $2
  ),
  teams_dept_ids AS (
    SELECT DISTINCT t.department_id FROM teams t
    JOIN user_team_ids ut ON t.id = ut.team_id WHERE t.department_id IS NOT NULL
  ),
  depts_area_ids AS (
    SELECT DISTINCT d.area_id FROM departments d
    WHERE d.id IN (SELECT department_id FROM user_dept_ids) AND d.area_id IS NOT NULL
    UNION
    SELECT DISTINCT d.area_id FROM departments d
    WHERE d.id IN (SELECT department_id FROM teams_dept_ids) AND d.area_id IS NOT NULL
  )
  SELECT
    (SELECT COALESCE(has_full_access, false) FROM user_data) as has_full_access,
    COALESCE(ARRAY(SELECT team_id FROM user_team_ids), '{}') as team_ids,
    COALESCE(ARRAY(SELECT department_id FROM user_dept_ids), '{}') as department_ids,
    COALESCE(ARRAY(SELECT area_id FROM depts_area_ids), '{}') as area_ids,
    COALESCE(ARRAY(SELECT id FROM team_lead_ids), '{}') as team_lead_of,
    COALESCE(ARRAY(SELECT id FROM dept_lead_ids), '{}') as department_lead_of,
    COALESCE(ARRAY(SELECT id FROM area_lead_ids), '{}') as area_lead_of,
    COALESCE(ARRAY(SELECT department_id FROM teams_dept_ids), '{}') as teams_department_ids,
    COALESCE(ARRAY(SELECT area_id FROM depts_area_ids), '{}') as departments_area_ids
`;
