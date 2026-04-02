/**
 * KVP Constants
 *
 * Error messages and static defaults for the KVP module.
 */

export const ERROR_SUGGESTION_NOT_FOUND = 'Suggestion not found';

/** Query employee team/department membership for KVP content visibility */
export const EMPLOYEE_MEMBERSHIP_QUERY = `
  SELECT
    COALESCE(array_agg(DISTINCT ut.team_id) FILTER (WHERE ut.team_id IS NOT NULL), '{}') AS team_ids,
    COALESCE(array_agg(DISTINCT ud.department_id) FILTER (WHERE ud.department_id IS NOT NULL), '{}') AS dept_ids,
    COALESCE(array_agg(DISTINCT d_ud.area_id) FILTER (WHERE d_ud.area_id IS NOT NULL), '{}') AS dept_area_ids,
    COALESCE(array_agg(DISTINCT t.department_id) FILTER (WHERE t.department_id IS NOT NULL), '{}') AS teams_dept_ids
  FROM users u
  LEFT JOIN user_teams ut ON u.id = ut.user_id AND ut.tenant_id = $2
  LEFT JOIN teams t ON ut.team_id = t.id
  LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = $2
  LEFT JOIN departments d_ud ON ud.department_id = d_ud.id
  WHERE u.id = $1 AND u.tenant_id = $2`;
