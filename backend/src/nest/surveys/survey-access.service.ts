/**
 * Survey Access Service
 *
 * Handles visibility filtering, access control, and assignment validation.
 * Injected into the SurveysService facade.
 */
import { ForbiddenException, Injectable, Logger } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import type { AssignmentInput, DbSurvey, DbSurveyAssignment } from './surveys.types.js';

/** SQL queries to verify leadership permissions per assignment entity type */
const LEADERSHIP_QUERIES: Record<string, string> = {
  area: `SELECT id FROM areas WHERE id = $1 AND area_lead_id = $2 AND tenant_id = $3`,
  department: `SELECT d.id FROM departments d
    LEFT JOIN areas a ON d.area_id = a.id
    WHERE d.id = $1 AND d.tenant_id = $3
      AND (d.department_lead_id = $2 OR a.area_lead_id = $2)`,
  team: `SELECT t.id FROM teams t
    LEFT JOIN departments d ON t.department_id = d.id
    LEFT JOIN areas a ON d.area_id = a.id
    WHERE t.id = $1 AND t.tenant_id = $3
      AND (d.department_lead_id = $2 OR a.area_lead_id = $2)`,
};

@Injectable()
export class SurveyAccessService {
  private readonly logger = new Logger(SurveyAccessService.name);

  constructor(private readonly db: DatabaseService) {}

  // ==========================================================================
  // ACCESS CHECKS
  // ==========================================================================

  /**
   * Check if user has unrestricted access (root OR has_full_access=true).
   * Mirrors calendar.service.ts: `userRole.has_full_access || userRole.role === 'root'`
   */
  async checkUnrestrictedAccess(
    userId: number,
    tenantId: number,
    userRole: string,
  ): Promise<boolean> {
    if (userRole === 'root') return true;
    const rows = await this.db.query<{ has_full_access: boolean }>(
      `SELECT has_full_access FROM users WHERE id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );
    return rows[0]?.has_full_access === true;
  }

  /** Verifies the user can view a specific survey */
  async checkSurveyAccess(
    surveyId: number,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<void> {
    const hasUnrestrictedAccess = await this.checkUnrestrictedAccess(userId, tenantId, userRole);
    if (hasUnrestrictedAccess) return;

    const visibilityClause = this.buildVisibilityClause('$2', '$3');
    const rows = await this.db.query<{ id: number }>(
      `SELECT s.id FROM surveys s
       WHERE s.id = $1 AND s.tenant_id = $2
       AND ${visibilityClause}`,
      [surveyId, tenantId, userId],
    );
    if (rows.length === 0) {
      throw new ForbiddenException("You don't have access to this survey");
    }
  }

  /**
   * Management-level access check: creator OR lead of assigned org unit.
   * Used for admin operations (edit, delete, view in admin panel).
   */
  async checkSurveyManagementAccess(
    surveyId: number,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<void> {
    const hasUnrestrictedAccess = await this.checkUnrestrictedAccess(userId, tenantId, userRole);
    if (hasUnrestrictedAccess) return;

    const managementClause = this.buildManagementVisibilityClause('$2', '$3');
    const rows = await this.db.query<{ id: number }>(
      `SELECT s.id FROM surveys s
       WHERE s.id = $1 AND s.tenant_id = $2
       AND ${managementClause}`,
      [surveyId, tenantId, userId],
    );
    if (rows.length === 0) {
      throw new ForbiddenException('No management permission for this survey');
    }
  }

  // ==========================================================================
  // SURVEY LISTING QUERIES
  // ==========================================================================

  /** Fetches surveys based on user's access level */
  async fetchSurveysByAccessLevel(
    tenantId: number,
    userId: number,
    status: string | undefined,
    limit: number,
    offset: number,
    hasUnrestrictedAccess: boolean,
    isManageMode: boolean,
  ): Promise<DbSurvey[]> {
    if (hasUnrestrictedAccess) {
      return await this.getAllSurveysUnrestricted(tenantId, status, limit, offset);
    }
    if (isManageMode) {
      return await this.getAllSurveysManageable(tenantId, userId, status, limit, offset);
    }
    return await this.getAllSurveysWithVisibility(tenantId, userId, status, limit, offset);
  }

  /**
   * Get the set of survey IDs the user can manage within a given set.
   * Used to compute the canManage flag for list responses.
   */
  async getManageableSurveyIds(
    surveyIds: number[],
    tenantId: number,
    userId: number,
  ): Promise<Set<number>> {
    if (surveyIds.length === 0) return new Set();

    const placeholders = surveyIds.map((_: number, idx: number) => `$${idx + 1}`).join(',');
    const tenantIdx = surveyIds.length + 1;
    const userIdx = surveyIds.length + 2;
    const managementClause = this.buildManagementVisibilityClause(`$${tenantIdx}`, `$${userIdx}`);

    const rows = await this.db.query<{ id: number }>(
      `SELECT s.id FROM surveys s
       WHERE s.id IN (${placeholders}) AND s.tenant_id = $${tenantIdx}
       AND ${managementClause}`,
      [...surveyIds, tenantId, userId],
    );
    return new Set(rows.map((r: { id: number }) => r.id));
  }

  /** Batch-loads assignments for a list of surveys */
  async attachAssignmentsToSurveys(surveys: DbSurvey[], tenantId: number): Promise<void> {
    if (surveys.length === 0) return;
    const surveyIds = surveys.map((s: DbSurvey) => s.id);
    const placeholders = surveyIds.map((_: number, idx: number) => `$${idx + 1}`).join(',');
    const tenantParamIndex = surveyIds.length + 1;

    const assignmentRows = await this.db.query<DbSurveyAssignment & { survey_id: number }>(
      `SELECT sa.*,
         a.name AS area_name,
         d.name AS department_name,
         t.name AS team_name
       FROM survey_assignments sa
       LEFT JOIN areas a ON sa.area_id = a.id
       LEFT JOIN departments d ON sa.department_id = d.id
       LEFT JOIN teams t ON sa.team_id = t.id
       WHERE sa.survey_id IN (${placeholders}) AND sa.tenant_id = $${tenantParamIndex}
       ORDER BY sa.survey_id, sa.id`,
      [...surveyIds, tenantId],
    );
    const assignmentsBySurveyId = new Map<number, DbSurveyAssignment[]>();
    for (const assignment of assignmentRows) {
      if (!assignmentsBySurveyId.has(assignment.survey_id)) {
        assignmentsBySurveyId.set(assignment.survey_id, []);
      }
      assignmentsBySurveyId.get(assignment.survey_id)?.push(assignment);
    }
    for (const survey of surveys) {
      survey.assignments = assignmentsBySurveyId.get(survey.id) ?? [];
    }
  }

  // ==========================================================================
  // ASSIGNMENT VALIDATION
  // ==========================================================================

  /**
   * Validates that the user has leadership permissions for all requested assignments.
   * Frontend filtering is UX only — this enforces server-side.
   */
  async validateAssignmentPermissions(
    userId: number,
    tenantId: number,
    userRole: string,
    assignments: unknown[],
  ): Promise<void> {
    if (assignments.length === 0) return;

    const hasUnrestrictedAccess = await this.checkUnrestrictedAccess(userId, tenantId, userRole);
    if (hasUnrestrictedAccess) return;

    for (const raw of assignments) {
      await this.validateSingleAssignment(raw as AssignmentInput, userId, tenantId);
    }
  }

  // ==========================================================================
  // NOTIFICATION COUNT
  // ==========================================================================

  /**
   * Get count of pending (unanswered) surveys for a user.
   * Used for notification badge in sidebar.
   * Counts active surveys assigned to the user where no completed response exists.
   */
  async getPendingSurveyCount(userId: number, tenantId: number): Promise<{ count: number }> {
    this.logger.debug(`Getting pending survey count for user ${userId}, tenant ${tenantId}`);

    const visibilityClause = this.buildVisibilityClause('$1', '$2');
    const rows = await this.db.query<{ count: number }>(
      `SELECT COUNT(DISTINCT s.id)::integer as count
       FROM surveys s
       LEFT JOIN survey_responses sr
         ON s.id = sr.survey_id AND sr.user_id = $2 AND sr.tenant_id = s.tenant_id AND sr.status = 'completed'
       WHERE s.tenant_id = $1
         AND s.status = 'active'
         AND sr.id IS NULL
         AND ${visibilityClause}`,
      [tenantId, userId],
    );

    return { count: rows[0]?.count ?? 0 };
  }

  // ==========================================================================
  // PRIVATE: VISIBILITY CLAUSE BUILDERS
  // ==========================================================================

  /**
   * Build the visibility WHERE clause for surveys.
   * Mirrors calendar's buildVisibilityClause().
   * Returns SQL fragment: (s.created_by = $X OR EXISTS(...))
   * Expects `s` as the survey table alias.
   */
  private buildVisibilityClause(tenantParam: string, userParam: string): string {
    return `(
      s.created_by = ${userParam}
      OR EXISTS (
        SELECT 1 FROM survey_assignments sa WHERE sa.survey_id = s.id AND (
          sa.assignment_type = 'all_users'
          OR (sa.assignment_type = 'area' AND (
            EXISTS (SELECT 1 FROM admin_area_permissions aap
                    WHERE aap.admin_user_id = ${userParam} AND aap.area_id = sa.area_id AND aap.tenant_id = ${tenantParam})
            OR EXISTS (SELECT 1 FROM areas a
                       WHERE a.id = sa.area_id AND a.area_lead_id = ${userParam} AND a.tenant_id = ${tenantParam})
            OR EXISTS (SELECT 1 FROM user_departments ud
                       JOIN departments d ON ud.department_id = d.id
                       WHERE ud.user_id = ${userParam} AND ud.tenant_id = ${tenantParam} AND d.area_id = sa.area_id)
          ))
          OR (sa.assignment_type = 'department' AND (
            EXISTS (SELECT 1 FROM admin_department_permissions adp
                    WHERE adp.admin_user_id = ${userParam} AND adp.department_id = sa.department_id AND adp.tenant_id = ${tenantParam})
            OR EXISTS (SELECT 1 FROM departments d
                       WHERE d.id = sa.department_id AND d.department_lead_id = ${userParam} AND d.tenant_id = ${tenantParam})
            OR EXISTS (SELECT 1 FROM user_departments ud
                       WHERE ud.user_id = ${userParam} AND ud.department_id = sa.department_id AND ud.tenant_id = ${tenantParam})
            OR EXISTS (SELECT 1 FROM departments d
                       JOIN admin_area_permissions aap ON aap.area_id = d.area_id
                       WHERE d.id = sa.department_id AND aap.admin_user_id = ${userParam} AND aap.tenant_id = ${tenantParam})
          ))
          OR (sa.assignment_type = 'team' AND (
            EXISTS (SELECT 1 FROM user_teams ut
                    WHERE ut.user_id = ${userParam} AND ut.team_id = sa.team_id AND ut.tenant_id = ${tenantParam})
            OR EXISTS (SELECT 1 FROM teams t
                       WHERE t.id = sa.team_id AND t.team_lead_id = ${userParam} AND t.tenant_id = ${tenantParam})
            OR EXISTS (SELECT 1 FROM teams t
                       JOIN admin_department_permissions adp ON adp.department_id = t.department_id
                       WHERE t.id = sa.team_id AND adp.admin_user_id = ${userParam} AND adp.tenant_id = ${tenantParam})
            OR EXISTS (SELECT 1 FROM teams t
                       JOIN departments d ON t.department_id = d.id
                       JOIN admin_area_permissions aap ON aap.area_id = d.area_id
                       WHERE t.id = sa.team_id AND aap.admin_user_id = ${userParam} AND aap.tenant_id = ${tenantParam})
          ))
          OR (sa.assignment_type = 'user' AND sa.user_id = ${userParam})
        )
      )
    )`;
  }

  /**
   * Build the management visibility WHERE clause for surveys.
   * Stricter than buildVisibilityClause(): only creator OR lead of assigned org unit.
   * Used for admin management operations (list/view/edit/delete in survey-admin).
   */
  private buildManagementVisibilityClause(tenantParam: string, userParam: string): string {
    return `(
      s.created_by = ${userParam}
      OR EXISTS (
        SELECT 1 FROM survey_assignments sa WHERE sa.survey_id = s.id AND (
          (sa.assignment_type = 'area' AND EXISTS (
            SELECT 1 FROM areas a
            WHERE a.id = sa.area_id AND a.area_lead_id = ${userParam} AND a.tenant_id = ${tenantParam}
          ))
          OR (sa.assignment_type = 'department' AND (
            EXISTS (SELECT 1 FROM departments d
                    WHERE d.id = sa.department_id AND d.department_lead_id = ${userParam} AND d.tenant_id = ${tenantParam})
            OR EXISTS (SELECT 1 FROM departments d
                       JOIN areas a ON d.area_id = a.id
                       WHERE d.id = sa.department_id AND a.area_lead_id = ${userParam} AND a.tenant_id = ${tenantParam})
          ))
          OR (sa.assignment_type = 'team' AND (
            EXISTS (SELECT 1 FROM teams t
                    WHERE t.id = sa.team_id AND t.team_lead_id = ${userParam} AND t.tenant_id = ${tenantParam})
            OR EXISTS (SELECT 1 FROM teams t
                       JOIN departments d ON t.department_id = d.id
                       WHERE t.id = sa.team_id AND d.department_lead_id = ${userParam} AND d.tenant_id = ${tenantParam})
            OR EXISTS (SELECT 1 FROM teams t
                       JOIN departments d ON t.department_id = d.id
                       JOIN areas a ON d.area_id = a.id
                       WHERE t.id = sa.team_id AND a.area_lead_id = ${userParam} AND a.tenant_id = ${tenantParam})
          ))
        )
      )
    )`;
  }

  // ==========================================================================
  // PRIVATE: QUERY HELPERS
  // ==========================================================================

  /** Unrestricted: root or has_full_access=true sees ALL surveys in tenant */
  private async getAllSurveysUnrestricted(
    tenantId: number,
    status: string | undefined,
    limit: number,
    offset: number,
  ): Promise<DbSurvey[]> {
    const params: unknown[] = [tenantId];
    let statusClause = '';
    if (status !== undefined) {
      statusClause = ' AND s.status = $2';
      params.push(status);
    }
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;
    params.push(limit, offset);

    return await this.db.query<DbSurvey>(
      `SELECT s.*, MAX(u.first_name) as creator_first_name, MAX(u.last_name) as creator_last_name,
       COUNT(DISTINCT sr.id) as response_count,
       COUNT(DISTINCT CASE WHEN sr.status = 'completed' THEN sr.id END) as completed_count
       FROM surveys s LEFT JOIN users u ON s.created_by = u.id
       LEFT JOIN survey_responses sr ON s.id = sr.survey_id
       WHERE s.tenant_id = $1${statusClause}
       GROUP BY s.id
       ORDER BY s.created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    );
  }

  /**
   * Permission-based visibility for admins (without full access) AND employees.
   * Unified query using EXISTS subqueries — mirrors calendar buildVisibilityClause().
   */
  private async getAllSurveysWithVisibility(
    tenantId: number,
    userId: number,
    status: string | undefined,
    limit: number,
    offset: number,
  ): Promise<DbSurvey[]> {
    const params: unknown[] = [tenantId, userId];
    let statusClause = '';
    if (status !== undefined) {
      statusClause = ` AND s.status = $${params.length + 1}`;
      params.push(status);
    }
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;
    params.push(limit, offset);

    const visibilityClause = this.buildVisibilityClause('$1', '$2');
    return await this.db.query<DbSurvey>(
      `SELECT s.*, MAX(u.first_name) as creator_first_name, MAX(u.last_name) as creator_last_name,
       COUNT(DISTINCT sr.id) as response_count,
       COUNT(DISTINCT CASE WHEN sr.status = 'completed' THEN sr.id END) as completed_count
       FROM surveys s
       LEFT JOIN users u ON s.created_by = u.id
       LEFT JOIN survey_responses sr ON s.id = sr.survey_id
       WHERE s.tenant_id = $1
       AND ${visibilityClause}${statusClause}
       GROUP BY s.id
       ORDER BY s.created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    );
  }

  /**
   * Management-level visibility: only surveys the admin can manage.
   * Creator OR lead of assigned org unit (with hierarchy inheritance).
   */
  private async getAllSurveysManageable(
    tenantId: number,
    userId: number,
    status: string | undefined,
    limit: number,
    offset: number,
  ): Promise<DbSurvey[]> {
    const params: unknown[] = [tenantId, userId];
    let statusClause = '';
    if (status !== undefined) {
      statusClause = ` AND s.status = $${params.length + 1}`;
      params.push(status);
    }
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;
    params.push(limit, offset);

    const managementClause = this.buildManagementVisibilityClause('$1', '$2');
    return await this.db.query<DbSurvey>(
      `SELECT s.*, MAX(u.first_name) as creator_first_name, MAX(u.last_name) as creator_last_name,
       COUNT(DISTINCT sr.id) as response_count,
       COUNT(DISTINCT CASE WHEN sr.status = 'completed' THEN sr.id END) as completed_count
       FROM surveys s
       LEFT JOIN users u ON s.created_by = u.id
       LEFT JOIN survey_responses sr ON s.id = sr.survey_id
       WHERE s.tenant_id = $1
       AND ${managementClause}${statusClause}
       GROUP BY s.id
       ORDER BY s.created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    );
  }

  // ==========================================================================
  // PRIVATE: ASSIGNMENT VALIDATION
  // ==========================================================================

  /** Validates a single assignment against the user's leadership permissions */
  private async validateSingleAssignment(
    assignment: AssignmentInput,
    userId: number,
    tenantId: number,
  ): Promise<void> {
    switch (assignment.type) {
      case 'all_users':
        throw new ForbiddenException(
          'Only users with full access can assign to the entire company',
        );
      case 'area':
        await this.validateLeadershipPermission('area', assignment.areaId, userId, tenantId);
        break;
      case 'department':
        await this.validateLeadershipPermission(
          'department',
          assignment.departmentId,
          userId,
          tenantId,
        );
        break;
      case 'team':
        await this.validateLeadershipPermission('team', assignment.teamId, userId, tenantId);
        break;
      default:
        break;
    }
  }

  /** Verifies user is a lead of the given organizational entity via DB lookup */
  private async validateLeadershipPermission(
    entityType: string,
    entityId: number | undefined,
    userId: number,
    tenantId: number,
  ): Promise<void> {
    if (entityId === undefined) return;

    const query = LEADERSHIP_QUERIES[entityType];
    if (query === undefined) return;

    const rows = await this.db.query<{ id: number }>(query, [entityId, userId, tenantId]);
    if (rows.length === 0) {
      throw new ForbiddenException(`No leadership permission for ${entityType} ${entityId}`);
    }
  }
}
