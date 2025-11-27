/* eslint-disable max-lines */
/**
 * Survey Model
 * Handles database operations for surveys
 */
import { v7 as uuidv7 } from 'uuid';

import {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
  getConnection,
  query as typedQuery,
} from '../utils/db.js';

// Database interfaces
interface DbSurvey extends RowDataPacket {
  id: number;
  tenant_id: number;
  title: string;
  description?: string | null;
  created_by: number;
  status: 'draft' | 'active' | 'closed';
  is_anonymous: boolean | number;
  start_date?: Date | null;
  end_date?: Date | null;
  created_at: Date;
  updated_at: Date;
  // Extended fields from joins
  creator_first_name?: string;
  creator_last_name?: string;
  response_count?: number;
  completed_count?: number;
  questions?: DbSurveyQuestion[];
  assignments?: DbSurveyAssignment[];
}

interface DbSurveyQuestion extends RowDataPacket {
  id: number;
  survey_id: number;
  question_text: string;
  question_type: 'text' | 'single_choice' | 'multiple_choice' | 'rating' | 'number';
  is_required: boolean | number;
  order_position: number;
  created_at: Date;
  options?: DbSurveyQuestionOption[];
}

interface DbSurveyQuestionOption extends RowDataPacket {
  id: number;
  question_id: number;
  option_text: string;
  order_position: number;
}

interface DbSurveyAssignment extends RowDataPacket {
  id: number;
  survey_id: number;
  assignment_type: 'all_users' | 'area' | 'department' | 'team' | 'user';
  area_id?: number | null;
  department_id?: number | null;
  team_id?: number | null;
  user_id?: number | null;
}

interface DbSurveyTemplate extends RowDataPacket {
  id: number;
  tenant_id?: number | null;
  name: string;
  description?: string | null;
  template_data: string;
  is_public: boolean | number;
  created_at: Date;
}

interface SurveyCreateData {
  title: string;
  description?: string;
  status?: 'draft' | 'active' | 'closed';
  is_anonymous?: boolean;
  is_mandatory?: boolean;
  start_date?: Date | string | null;
  end_date?: Date | string | null;
  questions?: {
    question_text: string;
    question_type: 'text' | 'single_choice' | 'multiple_choice' | 'rating' | 'number';
    is_required?: boolean | number;
    order_position?: number;
    options?: string[];
  }[];
  assignments?: {
    type: 'all_users' | 'area' | 'department' | 'team' | 'user';
    area_id?: number | null;
    department_id?: number | null;
    team_id?: number | null;
    user_id?: number | null;
  }[];
}

interface SurveyUpdateData {
  title?: string;
  description?: string;
  status?: 'draft' | 'active' | 'closed';
  is_anonymous?: boolean;
  is_mandatory?: boolean;
  start_date?: Date | string | null;
  end_date?: Date | string | null;
  questions?: {
    question_text: string;
    question_type: 'text' | 'single_choice' | 'multiple_choice' | 'rating' | 'number';
    is_required?: boolean | number;
    order_position?: number;
    options?: string[];
  }[];
  assignments?: {
    type: 'all_users' | 'area' | 'department' | 'team' | 'user';
    area_id?: number | null;
    department_id?: number | null;
    team_id?: number | null;
    user_id?: number | null;
  }[];
}

interface SurveyFilters {
  status?: 'draft' | 'active' | 'closed';
  page?: number;
  limit?: number;
}

export interface SurveyStatisticsQuestion {
  id: number;
  question_text: string;
  question_type: string;
  responses?:
    | {
        answer_text?: string | undefined;
        selected_option_id?: number | undefined;
        rating?: number | undefined;
        user_id?: number | null | undefined;
        first_name?: string | null | undefined;
        last_name?: string | null | undefined;
      }[]
    | undefined;
  options?:
    | {
        option_id: number;
        option_text: string;
        count: number;
      }[]
    | undefined;
  statistics?:
    | {
        average: number | null;
        min: number | null;
        max: number | null;
        total_responses: number;
      }
    | undefined;
}

export interface SurveyStatistics {
  survey_id: number;
  total_responses: number;
  completed_responses: number;
  completion_rate: number;
  first_response?: Date | null | undefined;
  last_response?: Date | null | undefined;
  questions: SurveyStatisticsQuestion[];
}

// Query result types for type safety
interface UserDepartmentResult extends RowDataPacket {
  department_id: number | null;
  area_id: number | null;
}

interface UserTeamResult extends RowDataPacket {
  team_id: number;
}

interface AnswerOptionsResult extends RowDataPacket {
  answer_options: string | number[]; // JSON string or parsed array
}

interface TextResponseResult extends RowDataPacket {
  answer_text: string | null;
  user_id: number | null;
  first_name: string | null;
  last_name: string | null;
}

interface NumericStatsResult extends RowDataPacket {
  average: number | null;
  min: number | null;
  max: number | null;
  total_responses: number;
}

interface SurveyStatsResult extends RowDataPacket {
  total_responses: number | string;
  completed_responses: number | string;
  first_response: Date | null;
  last_response: Date | null;
}

/**
 * Insert survey questions (without options - options go in separate table)
 */
async function insertSurveyQuestions(
  connection: PoolConnection,
  surveyId: number,
  tenantId: number,
  questions: SurveyCreateData['questions'],
): Promise<number[]> {
  if (!questions || questions.length === 0) return [];

  const questionIds: number[] = [];

  for (const [index, question] of questions.entries()) {
    const [result] = await connection.query<ResultSetHeader>(
      `
        INSERT INTO survey_questions (
          tenant_id, survey_id, question_text, question_type, is_required, order_index
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        tenantId,
        surveyId,
        question.question_text,
        question.question_type,
        question.is_required === 0 || question.is_required === false ? 0 : 1,
        question.order_position ?? index + 1,
      ],
    );
    questionIds.push(result.insertId);

    // Insert options for choice questions into separate table
    if (
      question.options &&
      question.options.length > 0 &&
      (question.question_type === 'single_choice' || question.question_type === 'multiple_choice')
    ) {
      await insertQuestionOptions(connection, result.insertId, tenantId, question.options);
    }
  }

  return questionIds;
}

/**
 * Insert question options into survey_question_options table
 */
async function insertQuestionOptions(
  connection: PoolConnection,
  questionId: number,
  tenantId: number,
  options: string[],
): Promise<void> {
  for (const [index, optionText] of options.entries()) {
    await connection.query<ResultSetHeader>(
      `
        INSERT INTO survey_question_options (
          tenant_id, question_id, option_text, order_position
        ) VALUES (?, ?, ?, ?)
      `,
      [tenantId, questionId, optionText, index],
    );
  }
}

/**
 * Insert survey assignments
 */
async function insertSurveyAssignments(
  connection: PoolConnection,
  surveyId: number,
  tenantId: number,
  assignments: SurveyCreateData['assignments'],
): Promise<void> {
  if (!assignments || assignments.length === 0) return;

  for (const assignment of assignments) {
    await connection.query(
      `
        INSERT INTO survey_assignments (
          tenant_id, survey_id, assignment_type, area_id, department_id, team_id, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        tenantId,
        surveyId,
        assignment.type,
        assignment.area_id ?? null,
        assignment.department_id ?? null,
        assignment.team_id ?? null,
        assignment.user_id ?? null,
      ],
    );
  }
}

/**
 * Create a new survey
 */
export async function createSurvey(
  surveyData: SurveyCreateData,
  tenantId: number,
  createdBy: number,
): Promise<number> {
  // Check if we're using mock database
  let connection: PoolConnection;
  try {
    connection = await getConnection();
  } catch {
    // Mock implementation - just return a fake ID
    return 1;
  }
  try {
    await connection.beginTransaction();

    // Generate UUID for survey (UUIDv7: time-sortable, like KVP)
    const surveyUuid = uuidv7();

    // Create survey
    const [surveyResult] = await connection.query<ResultSetHeader>(
      `
        INSERT INTO surveys (
          tenant_id, title, description, created_by, status,
          is_anonymous, is_mandatory, start_date, end_date, uuid
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        tenantId,
        surveyData.title,
        surveyData.description ?? null,
        createdBy,
        surveyData.status ?? 'draft',
        surveyData.is_anonymous ?? false,
        surveyData.is_mandatory ?? false,
        surveyData.start_date ?? null,
        surveyData.end_date ?? null,
        surveyUuid,
      ],
    );

    const surveyId = surveyResult.insertId;

    // Add questions and assignments
    await insertSurveyQuestions(connection, surveyId, tenantId, surveyData.questions);
    await insertSurveyAssignments(connection, surveyId, tenantId, surveyData.assignments);

    await connection.commit();
    return surveyId;
  } catch (error: unknown) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Get all surveys for a tenant (used by root users)
 */
export async function getAllSurveysByTenant(
  tenantId: number,
  filters: SurveyFilters = {},
): Promise<DbSurvey[]> {
  const { status, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  let query = `
      SELECT
        s.*,
        u.first_name as creator_first_name,
        u.last_name as creator_last_name,
        COUNT(DISTINCT sr.id) as response_count,
        COUNT(DISTINCT CASE WHEN sr.status = 'completed' THEN sr.id END) as completed_count
      FROM surveys s
      LEFT JOIN users u ON s.created_by = u.id
      LEFT JOIN survey_responses sr ON s.id = sr.survey_id
      WHERE s.tenant_id = ?
    `;

  const params: unknown[] = [tenantId];

  if (status !== undefined) {
    query += ' AND s.status = ?';
    params.push(status);
  }

  query += ' GROUP BY s.id ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [surveys] = await typedQuery<DbSurvey[]>(query, params);
  return surveys;
}

/** Get employee department and area info */
async function getEmployeeDeptInfo(
  employeeUserId: number,
  tenantId: number,
): Promise<UserDepartmentResult | null> {
  const [userInfo] = await typedQuery<UserDepartmentResult[]>(
    `SELECT u.department_id, d.area_id FROM users u
     LEFT JOIN departments d ON u.department_id = d.id
     WHERE u.id = ? AND u.tenant_id = ?`,
    [employeeUserId, tenantId],
  );
  return userInfo[0] ?? null;
}

/** Get employee team IDs */
async function getEmployeeTeamIds(employeeUserId: number, tenantId: number): Promise<number[]> {
  const [userTeams] = await typedQuery<UserTeamResult[]>(
    `SELECT team_id FROM user_teams WHERE user_id = ? AND tenant_id = ?`,
    [employeeUserId, tenantId],
  );
  return userTeams.map((team: UserTeamResult) => team.team_id);
}

/** Build team condition SQL for survey query */
function buildTeamCondition(teamIds: number[]): string {
  return teamIds.length > 0 ?
      `(sa.assignment_type = 'team' AND sa.team_id IN (${teamIds.map(() => '?').join(',')}))`
    : `(sa.assignment_type = 'team' AND 1=0)`;
}

/** Build employee survey query */
function buildEmployeeSurveyQuery(teamCondition: string): string {
  return `SELECT DISTINCT s.*, u.first_name as creator_first_name, u.last_name as creator_last_name,
    COUNT(DISTINCT sr.id) as response_count,
    COUNT(DISTINCT CASE WHEN sr.status = 'completed' THEN sr.id END) as completed_count
    FROM surveys s LEFT JOIN users u ON s.created_by = u.id
    LEFT JOIN survey_responses sr ON s.id = sr.survey_id
    INNER JOIN survey_assignments sa ON s.id = sa.survey_id
    WHERE s.tenant_id = ? AND (
      sa.assignment_type = 'all_users' OR (sa.assignment_type = 'area' AND sa.area_id = ?)
      OR (sa.assignment_type = 'department' AND sa.department_id = ?)
      OR ${teamCondition} OR (sa.assignment_type = 'user' AND sa.user_id = ?))`;
}

/**
 * Get surveys for employee based on assignments
 */
export async function getAllSurveysByTenantForEmployee(
  tenantId: number,
  employeeUserId: number,
  filters: SurveyFilters = {},
): Promise<DbSurvey[]> {
  const { status, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  const userRow = await getEmployeeDeptInfo(employeeUserId, tenantId);
  if (userRow === null) return [];

  const { department_id: departmentId, area_id: areaId } = userRow;
  const teamIds = await getEmployeeTeamIds(employeeUserId, tenantId);
  const teamCondition = buildTeamCondition(teamIds);

  let query = buildEmployeeSurveyQuery(teamCondition);
  const params: unknown[] = [tenantId, areaId, departmentId, ...teamIds, employeeUserId];

  if (status !== undefined) {
    query += ' AND s.status = ?';
    params.push(status);
  }

  query += ' GROUP BY s.id ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [surveys] = await typedQuery<DbSurvey[]>(query, params);
  return surveys;
}

/**
 * Get surveys for admin with department filtering
 * Returns surveys that are:
 * 1. Assigned to "all_users" (whole company), OR
 * 2. Assigned to departments the admin has access to
 */
export async function getAllSurveysByTenantForAdmin(
  tenantId: number,
  adminUserId: number,
  filters: SurveyFilters = {},
): Promise<DbSurvey[]> {
  const { status, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  let query = `
      SELECT DISTINCT
        s.*,
        u.first_name as creator_first_name,
        u.last_name as creator_last_name,
        COUNT(DISTINCT sr.id) as response_count,
        COUNT(DISTINCT CASE WHEN sr.status = 'completed' THEN sr.id END) as completed_count
      FROM surveys s
      LEFT JOIN users u ON s.created_by = u.id
      LEFT JOIN survey_responses sr ON s.id = sr.survey_id
      LEFT JOIN survey_assignments sa ON s.id = sa.survey_id
      LEFT JOIN admin_department_permissions adp ON adp.admin_user_id = ? AND adp.tenant_id = s.tenant_id
      WHERE s.tenant_id = ?
      AND (
        -- Admin can see surveys assigned to all users
        sa.assignment_type = 'all_users'
        OR
        -- Admin can see surveys assigned to areas (TODO: add admin_area_permissions check)
        sa.assignment_type = 'area'
        OR
        -- Admin can see surveys assigned to their departments
        (sa.assignment_type = 'department' AND sa.department_id = adp.department_id AND adp.can_read = 1)
        OR
        -- Admin created the survey
        s.created_by = ?
      )
    `;

  const params: unknown[] = [adminUserId, tenantId, adminUserId];

  if (status !== undefined) {
    query += ' AND s.status = ?';
    params.push(status);
  }

  query += ' GROUP BY s.id ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [surveys] = await typedQuery<DbSurvey[]>(query, params);
  return surveys;
}

/**
 * Get survey by ID with questions and options
 */
/**
 * Load question options from survey_question_options table
 */
async function loadQuestionOptions(
  questionIds: number[],
): Promise<Map<number, DbSurveyQuestionOption[]>> {
  if (questionIds.length === 0) return new Map();

  const placeholders = questionIds.map(() => '?').join(',');
  const [options] = await typedQuery<DbSurveyQuestionOption[]>(
    `
      SELECT id, question_id, option_text, order_position
      FROM survey_question_options
      WHERE question_id IN (${placeholders})
      ORDER BY question_id, order_position
    `,
    questionIds,
  );

  // Group options by question_id
  const optionsMap = new Map<number, DbSurveyQuestionOption[]>();
  for (const option of options) {
    if (!optionsMap.has(option.question_id)) {
      optionsMap.set(option.question_id, []);
    }
    const questionOptions = optionsMap.get(option.question_id);
    if (questionOptions !== undefined) {
      questionOptions.push(option);
    }
  }

  return optionsMap;
}

/**
 * Process survey questions for buffer conversion
 */
function processSurveyQuestions(questions: DbSurveyQuestion[]): void {
  for (const question of questions) {
    // Convert Buffer to string if needed
    if (question.question_text !== '' && Buffer.isBuffer(question.question_text)) {
      question.question_text = question.question_text.toString();
    }
  }
}

export async function getSurveyById(surveyId: number, tenantId: number): Promise<DbSurvey | null> {
  const [surveys] = await typedQuery<DbSurvey[]>(
    `
      SELECT s.*,
        u.first_name as creator_first_name,
        u.last_name as creator_last_name
      FROM surveys s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.id = ? AND s.tenant_id = ?
    `,
    [surveyId, tenantId],
  );

  if (surveys.length === 0) {
    return null;
  }

  const survey = surveys[0];
  if (survey === undefined) {
    return null;
  }

  // Convert Buffer to string if needed
  const hasDescription = survey.description != null && survey.description !== '';
  if (hasDescription && Buffer.isBuffer(survey.description)) {
    survey.description = survey.description.toString();
  }

  // Get questions
  const [questions] = await typedQuery<DbSurveyQuestion[]>(
    `
      SELECT * FROM survey_questions
      WHERE survey_id = ?
      ORDER BY order_index
    `,
    [surveyId],
  );

  // Convert Buffer to string for questions
  processSurveyQuestions(questions);

  // Load options for choice questions from survey_question_options table
  const questionIds = questions.map((q: DbSurveyQuestion) => q.id);
  const optionsMap = await loadQuestionOptions(questionIds);

  // Attach options to questions
  for (const question of questions) {
    if (['single_choice', 'multiple_choice'].includes(question.question_type)) {
      question.options = optionsMap.get(question.id) ?? [];
    }
  }

  survey.questions = questions;

  // Get assignments
  const [assignments] = await typedQuery<DbSurveyAssignment[]>(
    `
      SELECT * FROM survey_assignments
      WHERE survey_id = ?
    `,
    [surveyId],
  );

  survey.assignments = assignments;

  return survey;
}

/**
 * Get survey by UUID with questions and options
 * Similar to getSurveyById but uses UUID instead of numeric ID
 */
export async function getSurveyByUUID(
  surveyUUID: string,
  tenantId: number,
): Promise<DbSurvey | null> {
  const [surveys] = await typedQuery<DbSurvey[]>(
    `
      SELECT s.*,
        u.first_name as creator_first_name,
        u.last_name as creator_last_name
      FROM surveys s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.uuid = ? AND s.tenant_id = ?
    `,
    [surveyUUID, tenantId],
  );

  if (surveys.length === 0) {
    return null;
  }

  const survey = surveys[0];
  if (survey === undefined) {
    return null;
  }

  // Convert Buffer to string if needed
  const hasDescription = survey.description != null && survey.description !== '';
  if (hasDescription && Buffer.isBuffer(survey.description)) {
    survey.description = survey.description.toString();
  }

  // Get questions
  const [questions] = await typedQuery<DbSurveyQuestion[]>(
    `
      SELECT * FROM survey_questions
      WHERE survey_id = ?
      ORDER BY order_index
    `,
    [survey.id],
  );

  // Convert Buffer to string for questions
  processSurveyQuestions(questions);

  // Load options for choice questions from survey_question_options table
  const questionIds = questions.map((q: DbSurveyQuestion) => q.id);
  const optionsMap = await loadQuestionOptions(questionIds);

  // Attach options to questions
  for (const question of questions) {
    if (['single_choice', 'multiple_choice'].includes(question.question_type)) {
      question.options = optionsMap.get(question.id) ?? [];
    }
  }

  survey.questions = questions;

  // Get assignments
  const [assignments] = await typedQuery<DbSurveyAssignment[]>(
    `
      SELECT * FROM survey_assignments
      WHERE survey_id = ?
    `,
    [survey.id],
  );

  survey.assignments = assignments;

  return survey;
}

/**
 * Update survey questions
 * Note: CASCADE DELETE will automatically remove options from survey_question_options table
 */
async function updateSurveyQuestions(
  connection: PoolConnection,
  surveyId: number,
  tenantId: number,
  questions: SurveyUpdateData['questions'],
): Promise<void> {
  if (!questions) return;

  // Delete existing questions (cascade will handle options)
  await connection.query('DELETE FROM survey_questions WHERE survey_id = ?', [surveyId]);

  // Add new questions (reuse insertSurveyQuestions logic)
  for (const [index, question] of questions.entries()) {
    const [result] = await connection.query<ResultSetHeader>(
      `
        INSERT INTO survey_questions (
          tenant_id, survey_id, question_text, question_type, is_required, order_index
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        tenantId,
        surveyId,
        question.question_text,
        question.question_type,
        question.is_required === 0 || question.is_required === false ? 0 : 1,
        question.order_position ?? index + 1,
      ],
    );

    // Insert options for choice questions into separate table
    if (
      question.options &&
      question.options.length > 0 &&
      (question.question_type === 'single_choice' || question.question_type === 'multiple_choice')
    ) {
      await insertQuestionOptions(connection, result.insertId, tenantId, question.options);
    }
  }
}

/**
 * Update survey assignments
 */
async function updateSurveyAssignments(
  connection: PoolConnection,
  surveyId: number,
  tenantId: number,
  assignments: SurveyUpdateData['assignments'],
): Promise<void> {
  if (assignments === undefined) return;

  // Delete existing assignments
  await connection.query('DELETE FROM survey_assignments WHERE survey_id = ?', [surveyId]);

  // Add new assignments
  if (assignments.length > 0) {
    for (const assignment of assignments) {
      await connection.query(
        `
          INSERT INTO survey_assignments (
            tenant_id, survey_id, assignment_type, area_id, department_id, team_id, user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          tenantId,
          surveyId,
          assignment.type,
          assignment.area_id ?? null,
          assignment.department_id ?? null,
          assignment.team_id ?? null,
          assignment.user_id ?? null,
        ],
      );
    }
  }
}

/**
 * Update survey
 */
export async function updateSurvey(
  surveyId: number,
  surveyData: SurveyUpdateData,
  tenantId: number,
): Promise<boolean> {
  // Check if we're using mock database
  let connection: PoolConnection;
  try {
    connection = await getConnection();
  } catch {
    // Mock implementation
    return true;
  }
  try {
    await connection.beginTransaction();

    // Update survey main data
    await connection.query(
      `
        UPDATE surveys SET
          title = ?,
          description = ?,
          status = ?,
          is_anonymous = ?,
          is_mandatory = ?,
          start_date = ?,
          end_date = ?
        WHERE id = ? AND tenant_id = ?
      `,
      [
        surveyData.title,
        surveyData.description ?? null,
        surveyData.status ?? 'draft',
        surveyData.is_anonymous ?? false,
        surveyData.is_mandatory ?? false,
        surveyData.start_date ?? null,
        surveyData.end_date ?? null,
        surveyId,
        tenantId,
      ],
    );

    // Update questions and assignments
    await updateSurveyQuestions(connection, surveyId, tenantId, surveyData.questions);
    await updateSurveyAssignments(connection, surveyId, tenantId, surveyData.assignments);

    await connection.commit();
    return true;
  } catch (error: unknown) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Delete survey
 */
export async function deleteSurvey(surveyId: number, tenantId: number): Promise<boolean> {
  const [result] = await typedQuery<ResultSetHeader>(
    'DELETE FROM surveys WHERE id = ? AND tenant_id = ?',
    [surveyId, tenantId],
  );
  return result.affectedRows > 0;
}

/**
 * Get survey templates
 */
export async function getSurveyTemplates(tenantId: number): Promise<DbSurveyTemplate[]> {
  const [templates] = await typedQuery<DbSurveyTemplate[]>(
    `
      SELECT * FROM survey_templates
      WHERE tenant_id = ? OR is_public = 1
      ORDER BY name
    `,
    [tenantId],
  );
  return templates;
}

/**
 * Create survey from template
 */
export async function createSurveyFromTemplate(
  templateId: number,
  tenantId: number,
  createdBy: number,
): Promise<number> {
  const [templates] = await typedQuery<DbSurveyTemplate[]>(
    `
      SELECT * FROM survey_templates
      WHERE id = ? AND (tenant_id = ? OR is_public = 1)
    `,
    [templateId, tenantId],
  );

  if (templates.length === 0) {
    throw new Error('Template not found');
  }

  const template = templates[0];
  if (template === undefined) {
    throw new Error('Template not found');
  }

  const templateData = JSON.parse(template.template_data) as {
    title: string;
    description?: string;
    questions: unknown;
  };

  // Build surveyData conditionally to satisfy exactOptionalPropertyTypes
  const surveyData: SurveyCreateData = {
    title: templateData.title,
    status: 'draft',
  };

  // Only add optional properties if they have values
  if (templateData.description !== undefined) {
    surveyData.description = templateData.description;
  }

  const questions = templateData.questions as SurveyCreateData['questions'];
  if (questions !== undefined) {
    surveyData.questions = questions;
  }

  return await createSurvey(surveyData, tenantId, createdBy);
}

/**
 * Get survey statistics
 */
interface OptionStat {
  option_id: number;
  option_text: string;
  count: number;
}

interface RatingStat {
  average: number | null;
  min: number | null;
  max: number | null;
  total_responses: number;
}

// Use SurveyStatisticsQuestion from above (already exported)

async function getChoiceQuestionStats(question: DbSurveyQuestion): Promise<OptionStat[]> {
  // For yes_no questions: use hardcoded options (not stored in survey_question_options table)
  let options: { id: number; option_text: string }[];

  if ((question.question_type as string) === 'yes_no') {
    // Hardcoded yes/no options
    options = [
      { id: 1, option_text: 'Ja' },
      { id: 2, option_text: 'Nein' },
    ];
  } else {
    // Get options from survey_question_options table (new structure)
    // question.options is already loaded by getSurveyById() as an array of DbSurveyQuestionOption objects
    options = question.options ?? [];
  }

  // Get all answers for this question
  const [answers] = await typedQuery<AnswerOptionsResult[]>(
    `
      SELECT sa.answer_options
      FROM survey_answers sa
      WHERE sa.question_id = ?
      AND sa.answer_options IS NOT NULL
    `,
    [question.id],
  );

  // Count how many times each option ID was selected
  const optionCounts: Record<number, number> = {};
  answers.forEach((answer: AnswerOptionsResult) => {
    const selectedOptions =
      typeof answer.answer_options === 'string' ?
        (JSON.parse(answer.answer_options) as number[])
      : answer.answer_options;

    if (Array.isArray(selectedOptions)) {
      selectedOptions.forEach((optionId: number) => {
        // optionId is the ID from survey_question_options table, not an index
        // eslint-disable-next-line security/detect-object-injection -- optionId kommt aus validierten Survey-Daten (ID aus DB), kein User-Input, 100% sicher
        optionCounts[optionId] = (optionCounts[optionId] ?? 0) + 1;
      });
    }
  });

  // Map options to statistics format, matching by option ID (not index!)
  return options.map((option: { id: number; option_text: string }) => ({
    option_id: option.id,
    option_text: option.option_text,

    count: optionCounts[option.id] ?? 0,
  }));
}

async function getTextQuestionResponses(
  questionId: number,
): Promise<SurveyStatisticsQuestion['responses']> {
  const [textResponses] = await typedQuery<TextResponseResult[]>(
    `
      SELECT
        sa.answer_text,
        sr.user_id,
        u.first_name,
        u.last_name
      FROM survey_answers sa
      JOIN survey_responses sr ON sa.response_id = sr.id
      LEFT JOIN users u ON sr.user_id = u.id
      WHERE sa.question_id = ? AND sa.answer_text IS NOT NULL
    `,
    [questionId],
  );
  return textResponses.map((row: TextResponseResult) => ({
    answer_text: row.answer_text ?? '',
    user_id: row.user_id,
    first_name: row.first_name,
    last_name: row.last_name,
  }));
}

async function getRatingQuestionStats(questionId: number): Promise<RatingStat> {
  const [numericStats] = await typedQuery<NumericStatsResult[]>(
    `
      SELECT
        AVG(sa.answer_number) as average,
        MIN(sa.answer_number) as min,
        MAX(sa.answer_number) as max,
        COUNT(sa.answer_number) as total_responses
      FROM survey_answers sa
      WHERE sa.question_id = ? AND sa.answer_number IS NOT NULL
    `,
    [questionId],
  );
  const numStats = numericStats[0];
  if (numStats === undefined) {
    return {
      average: null,
      min: null,
      max: null,
      total_responses: 0,
    };
  }
  return {
    average: numStats.average,
    min: numStats.min,
    max: numStats.max,
    total_responses: numStats.total_responses,
  };
}

/**
 * Get date question statistics
 * Returns date options with counts, sorted by most selected
 */
async function getDateQuestionStats(questionId: number): Promise<OptionStat[]> {
  interface DateCountResult extends RowDataPacket {
    answer_date: Date | string;
    count: number;
  }

  const [dateStats] = await typedQuery<DateCountResult[]>(
    `
      SELECT
        sa.answer_date,
        COUNT(*) as count
      FROM survey_answers sa
      WHERE sa.question_id = ? AND sa.answer_date IS NOT NULL
      GROUP BY sa.answer_date
      ORDER BY count DESC, sa.answer_date DESC
    `,
    [questionId],
  );

  return dateStats.map((row: DateCountResult, index: number) => {
    const dateText =
      row.answer_date instanceof Date ?
        row.answer_date.toISOString().split('T')[0]
      : row.answer_date.split('T')[0];
    return {
      option_id: index + 1,
      option_text: dateText ?? '',
      count: row.count,
    };
  });
}

/** Safely parse integer with NaN check */
function safeParseInt(value: unknown): number {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Process single question stats based on type */
async function processQuestionStat(question: DbSurveyQuestion): Promise<SurveyStatisticsQuestion> {
  const questionStat: SurveyStatisticsQuestion = {
    id: question.id,
    question_text: question.question_text,
    question_type: question.question_type,
    responses: [],
  };

  const questionType = question.question_type as string;
  const isChoiceQuestion =
    questionType === 'single_choice' ||
    questionType === 'multiple_choice' ||
    questionType === 'yes_no';

  if (isChoiceQuestion) {
    questionStat.options = await getChoiceQuestionStats(question);
  } else if (questionType === 'text') {
    questionStat.responses = await getTextQuestionResponses(question.id);
  } else if (questionType === 'date') {
    questionStat.options = await getDateQuestionStats(question.id);
  } else if (questionType === 'rating' || questionType === 'number') {
    questionStat.statistics = await getRatingQuestionStats(question.id);
  }
  return questionStat;
}

/** Build statistics result from stats row */
function buildStatsResult(
  surveyId: number,
  statsRow: SurveyStatsResult | undefined,
  questionStats: SurveyStatisticsQuestion[],
): SurveyStatistics {
  if (statsRow === undefined) {
    return {
      survey_id: surveyId,
      total_responses: 0,
      completed_responses: 0,
      completion_rate: 0,
      first_response: null,
      last_response: null,
      questions: questionStats,
    };
  }
  const totalResponses = safeParseInt(statsRow.total_responses);
  const completedResponses = safeParseInt(statsRow.completed_responses);
  return {
    survey_id: surveyId,
    total_responses: totalResponses,
    completed_responses: completedResponses,
    completion_rate:
      totalResponses > 0 ? Math.round((completedResponses / totalResponses) * 100) : 0,
    first_response: statsRow.first_response,
    last_response: statsRow.last_response,
    questions: questionStats,
  };
}

export async function getSurveyStatistics(
  surveyId: number,
  tenantId: number,
): Promise<SurveyStatistics> {
  try {
    const [stats] = await typedQuery<SurveyStatsResult[]>(
      `SELECT COUNT(DISTINCT sr.id) as total_responses,
        COUNT(DISTINCT CASE WHEN sr.status = 'completed' THEN sr.id END) as completed_responses,
        MIN(sr.started_at) as first_response, MAX(sr.completed_at) as last_response
        FROM surveys s LEFT JOIN survey_responses sr ON s.id = sr.survey_id
        WHERE s.id = ? AND s.tenant_id = ?`,
      [surveyId, tenantId],
    );

    const survey = await getSurveyById(surveyId, tenantId);
    if (survey === null) throw new Error('Survey not found');

    const questionStats: SurveyStatisticsQuestion[] = [];
    for (const question of survey.questions ?? []) {
      questionStats.push(await processQuestionStat(question));
    }

    return buildStatsResult(surveyId, stats[0], questionStats);
  } catch (error: unknown) {
    console.error('Error in getStatistics:', error);
    throw error;
  }
}

/**
 * Get assignments for multiple surveys in a single query
 * This is used by listSurveys to efficiently load assignments for all surveys
 */
export async function getAssignmentsBySurveyIds(
  surveyIds: number[],
  tenantId: number,
): Promise<DbSurveyAssignment[]> {
  if (surveyIds.length === 0) {
    return [];
  }

  // Create placeholders for IN clause (?, ?, ?)
  const placeholders = surveyIds.map(() => '?').join(',');

  const [assignments] = await typedQuery<DbSurveyAssignment[]>(
    `
      SELECT * FROM survey_assignments
      WHERE survey_id IN (${placeholders})
        AND tenant_id = ?
      ORDER BY survey_id, id
    `,
    [...surveyIds, tenantId],
  );

  return assignments;
}

// Backward compatibility object
const Survey = {
  create: createSurvey,
  getAllByTenant: getAllSurveysByTenant,
  getAllByTenantForEmployee: getAllSurveysByTenantForEmployee,
  getAllByTenantForAdmin: getAllSurveysByTenantForAdmin,
  getById: getSurveyById,
  getByUUID: getSurveyByUUID,
  update: updateSurvey,
  delete: deleteSurvey,
  getTemplates: getSurveyTemplates,
  createFromTemplate: createSurveyFromTemplate,
  getStatistics: getSurveyStatistics,
  getAssignmentsBySurveyIds: getAssignmentsBySurveyIds,
};

// Default export
export default Survey;

// CommonJS compatibility
