/**
 * Survey Model
 * Handles database operations for surveys
 */

import {
  query as typedQuery,
  getConnection,
  RowDataPacket,
  ResultSetHeader,
  PoolConnection,
} from "../utils/db";

// Database interfaces
interface DbSurvey extends RowDataPacket {
  id: number;
  tenant_id: number;
  title: string;
  description?: string | null;
  created_by: number;
  status: "draft" | "active" | "closed";
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
  question_type:
    | "text"
    | "single_choice"
    | "multiple_choice"
    | "rating"
    | "number";
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
  assignment_type: "company" | "department" | "team" | "individual";
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
  status?: "draft" | "active" | "closed";
  is_anonymous?: boolean;
  is_mandatory?: boolean;
  start_date?: Date | string | null;
  end_date?: Date | string | null;
  questions?: Array<{
    question_text: string;
    question_type:
      | "text"
      | "single_choice"
      | "multiple_choice"
      | "rating"
      | "number";
    is_required?: boolean;
    order_position?: number;
    options?: string[];
  }>;
  assignments?: Array<{
    type: "all_users" | "department" | "team" | "user";
    department_id?: number | null;
    team_id?: number | null;
    user_id?: number | null;
  }>;
}

interface SurveyUpdateData {
  title?: string;
  description?: string;
  status?: "draft" | "active" | "closed";
  is_anonymous?: boolean;
  is_mandatory?: boolean;
  start_date?: Date | string | null;
  end_date?: Date | string | null;
  questions?: Array<{
    question_text: string;
    question_type:
      | "text"
      | "single_choice"
      | "multiple_choice"
      | "rating"
      | "number";
    is_required?: boolean;
    order_position?: number;
    options?: string[];
  }>;
}

interface SurveyFilters {
  status?: "draft" | "active" | "closed";
  page?: number;
  limit?: number;
}

interface SurveyStatistics {
  survey_id: number;
  total_responses: number;
  completed_responses: number;
  completion_rate: number;
  first_response?: Date | null;
  last_response?: Date | null;
  questions: Array<{
    id: number;
    question_text: string;
    question_type: string;
    responses?: Array<{
      answer_text?: string;
      selected_option_id?: number;
      rating?: number;
    }>;
    options?: Array<{
      option_id: number;
      option_text: string;
      count: number;
    }>;
    statistics?: {
      average: number | null;
      min: number | null;
      max: number | null;
      total_responses: number;
    };
  }>;
}

export class Survey {
  /**
   * Create a new survey
   */
  static async create(
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

      // Create survey
      const [surveyResult] = await connection.query<ResultSetHeader>(
        `
        INSERT INTO surveys (
          tenant_id, title, description, created_by, status,
          is_anonymous, is_mandatory, start_date, end_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          tenantId,
          surveyData.title,
          surveyData.description ?? null,
          createdBy,
          surveyData.status ?? "draft",
          surveyData.is_anonymous ?? false,
          surveyData.is_mandatory ?? false,
          surveyData.start_date ?? null,
          surveyData.end_date ?? null,
        ],
      );

      const surveyId = surveyResult.insertId;

      // Add questions
      if (surveyData.questions && surveyData.questions.length > 0) {
        for (const [index, question] of surveyData.questions.entries()) {
          await connection.query<ResultSetHeader>(
            `
            INSERT INTO survey_questions (
              tenant_id, survey_id, question_text, question_type, is_required, order_index, options
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
            [
              tenantId,
              surveyId,
              question.question_text,
              question.question_type,
              question.is_required !== false,
              question.order_position ?? index + 1,
              question.options && question.options.length > 0
                ? JSON.stringify(question.options)
                : null,
            ],
          );

          // No need to insert options separately - they're stored as JSON in the questions table
        }
      }

      // Add assignments
      if (surveyData.assignments && surveyData.assignments.length > 0) {
        for (const assignment of surveyData.assignments) {
          await connection.query(
            `
            INSERT INTO survey_assignments (
              tenant_id, survey_id, assignment_type, department_id, team_id, user_id
            ) VALUES (?, ?, ?, ?, ?, ?)
          `,
            [
              tenantId,
              surveyId,
              assignment.type,
              assignment.department_id ?? null,
              assignment.team_id ?? null,
              assignment.user_id ?? null,
            ],
          );
        }
      }

      await connection.commit();
      return surveyId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get all surveys for a tenant (used by root users)
   */
  static async getAllByTenant(
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

    if (status) {
      query += " AND s.status = ?";
      params.push(status);
    }

    query += " GROUP BY s.id ORDER BY s.created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [surveys] = await typedQuery<DbSurvey[]>(query, params);
    return surveys;
  }

  /**
   * Get surveys for employee based on assignments
   * Returns surveys that are:
   * 1. Assigned to "all_users" (whole company), OR
   * 2. Assigned to the employee's department, OR
   * 3. Assigned to the employee's team, OR
   * 4. Assigned directly to the employee
   */
  static async getAllByTenantForEmployee(
    tenantId: number,
    employeeUserId: number,
    filters: SurveyFilters = {},
  ): Promise<DbSurvey[]> {
    const { status, page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;

    // First get employee's department info
    const [userInfo] = await typedQuery<RowDataPacket[]>(
      `SELECT department_id FROM users WHERE id = ? AND tenant_id = ?`,
      [employeeUserId, tenantId],
    );

    if (userInfo.length === 0) {
      return [];
    }

    const { department_id } = userInfo[0];
    const team_id: number | null = null; // No team_id in users table currently

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
      INNER JOIN survey_assignments sa ON s.id = sa.survey_id
      WHERE s.tenant_id = ?
      AND (
        -- Employee can see surveys assigned to all users
        sa.assignment_type = 'all_users'
        OR
        -- Employee can see surveys assigned to their department
        (sa.assignment_type = 'department' AND sa.department_id = ?)
        OR
        -- Employee can see surveys assigned to their team
        (sa.assignment_type = 'team' AND sa.team_id = ?)
        OR
        -- Employee can see surveys assigned directly to them
        (sa.assignment_type = 'user' AND sa.user_id = ?)
      )
    `;

    const params: unknown[] = [
      tenantId,
      department_id,
      team_id,
      employeeUserId,
    ];

    if (status) {
      query += " AND s.status = ?";
      params.push(status);
    }

    query += " GROUP BY s.id ORDER BY s.created_at DESC LIMIT ? OFFSET ?";
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
  static async getAllByTenantForAdmin(
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
        -- Admin can see surveys assigned to their departments
        (sa.assignment_type = 'department' AND sa.department_id = adp.department_id AND adp.can_read = 1)
        OR
        -- Admin created the survey
        s.created_by = ?
      )
    `;

    const params: unknown[] = [adminUserId, tenantId, adminUserId];

    if (status) {
      query += " AND s.status = ?";
      params.push(status);
    }

    query += " GROUP BY s.id ORDER BY s.created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [surveys] = await typedQuery<DbSurvey[]>(query, params);
    return surveys;
  }

  /**
   * Get survey by ID with questions and options
   */
  static async getById(
    surveyId: number,
    tenantId: number,
  ): Promise<DbSurvey | null> {
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

    if (!surveys || !Array.isArray(surveys) || surveys.length === 0) {
      return null;
    }

    const survey = surveys[0];

    // Convert Buffer to string if needed
    if (survey.description && Buffer.isBuffer(survey.description)) {
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

    // Parse options from JSON and convert Buffer to string for each question
    for (const question of questions) {
      // Convert Buffer to string if needed
      if (question.question_text && Buffer.isBuffer(question.question_text)) {
        question.question_text = question.question_text.toString();
      }

      if (
        ["multiple_choice", "single_choice"].includes(question.question_type) &&
        question.options
      ) {
        // Options are stored as JSON in the database
        try {
          question.options =
            typeof question.options === "string"
              ? JSON.parse(question.options)
              : question.options;
        } catch (e) {
          console.error("Error parsing options for question:", question.id, e);
          question.options = [];
        }
      }
    }

    survey.questions = questions as DbSurveyQuestion[];

    // Get assignments
    const [assignments] = await typedQuery<DbSurveyAssignment[]>(
      `
      SELECT * FROM survey_assignments
      WHERE survey_id = ?
    `,
      [surveyId],
    );

    survey.assignments = assignments as DbSurveyAssignment[];

    return survey;
  }

  /**
   * Update survey
   */
  static async update(
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

      // Update survey
      await connection.query(
        `
        UPDATE surveys SET
          title = ?,
          description = ?,
          status = ?,
          is_anonymous = ?,
          start_date = ?,
          end_date = ?
        WHERE id = ? AND tenant_id = ?
      `,
        [
          surveyData.title,
          surveyData.description ?? null,
          surveyData.status ?? "draft",
          surveyData.is_anonymous ?? false,
          surveyData.start_date ?? null,
          surveyData.end_date ?? null,
          surveyId,
          tenantId,
        ],
      );

      // Update questions if provided
      if (surveyData.questions) {
        // Delete existing questions and options (cascade will handle options)
        await connection.query(
          "DELETE FROM survey_questions WHERE survey_id = ?",
          [surveyId],
        );

        // Add new questions
        for (const [index, question] of surveyData.questions.entries()) {
          await connection.query<ResultSetHeader>(
            `
            INSERT INTO survey_questions (
              tenant_id, survey_id, question_text, question_type, is_required, order_index, options
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
            [
              tenantId,
              surveyId,
              question.question_text,
              question.question_type,
              question.is_required !== false,
              question.order_position ?? index + 1,
              question.options && question.options.length > 0
                ? JSON.stringify(question.options)
                : null,
            ],
          );

          // No need to insert options separately - they're stored as JSON in the questions table
        }
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Delete survey
   */
  static async delete(surveyId: number, tenantId: number): Promise<boolean> {
    const [result] = await typedQuery<ResultSetHeader>(
      "DELETE FROM surveys WHERE id = ? AND tenant_id = ?",
      [surveyId, tenantId],
    );
    return result.affectedRows > 0;
  }

  /**
   * Get survey templates
   */
  static async getTemplates(tenantId: number): Promise<DbSurveyTemplate[]> {
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
  static async createFromTemplate(
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
      throw new Error("Template not found");
    }

    const template = templates[0];
    const templateData = JSON.parse(template.template_data);

    const surveyData: SurveyCreateData = {
      title: templateData.title,
      description: templateData.description,
      questions: templateData.questions,
      status: "draft",
    };

    return this.create(surveyData, tenantId, createdBy);
  }

  /**
   * Get survey statistics
   */
  static async getStatistics(
    surveyId: number,
    tenantId: number,
  ): Promise<SurveyStatistics> {
    try {
      // Get basic statistics
      const [stats] = await typedQuery<RowDataPacket[]>(
        `
        SELECT 
          COUNT(DISTINCT sr.id) as total_responses,
          COUNT(DISTINCT CASE WHEN sr.status = 'completed' THEN sr.id END) as completed_responses,
          MIN(sr.started_at) as first_response,
          MAX(sr.completed_at) as last_response
        FROM surveys s
        LEFT JOIN survey_responses sr ON s.id = sr.survey_id
        WHERE s.id = ? AND s.tenant_id = ?
      `,
        [surveyId, tenantId],
      );

      // Get survey details with questions
      const survey = await this.getById(surveyId, tenantId);
      if (!survey) {
        throw new Error("Survey not found");
      }

      // Get question statistics
      interface QuestionStatistic {
        id: number;
        question_text: string;
        question_type: string;
        responses: Array<{
          answer_text?: string;
          selected_option_id?: number;
          rating?: number;
        }>;
        options?: Array<{
          option_id: number;
          option_text: string;
          count: number;
        }>;
        statistics?: {
          average: number | null;
          min: number | null;
          max: number | null;
          total_responses: number;
        };
      }

      const questionStats: QuestionStatistic[] = [];

      for (const question of survey.questions ?? []) {
        const questionStat: QuestionStatistic = {
          id: question.id,
          question_text: question.question_text,
          question_type: question.question_type,
          responses: [],
        };

        if (
          question.question_type === "single_choice" ||
          question.question_type === "multiple_choice"
        ) {
          // Get option statistics from JSON stored options
          const options = question.options
            ? typeof question.options === "string"
              ? JSON.parse(question.options)
              : question.options
            : [];

          // Get all answers for this question
          const [answers] = await typedQuery<RowDataPacket[]>(
            `
            SELECT sa.answer_options
            FROM survey_answers sa
            WHERE sa.question_id = ?
            AND sa.answer_options IS NOT NULL
          `,
            [question.id],
          );

          // Count responses per option
          const optionCounts: { [key: number]: number } = {};
          (answers as RowDataPacket[]).forEach((answer) => {
            const selectedOptions =
              typeof answer.answer_options === "string"
                ? JSON.parse(answer.answer_options)
                : answer.answer_options;

            if (Array.isArray(selectedOptions)) {
              selectedOptions.forEach((optionIndex: number) => {
                optionCounts[optionIndex] =
                  (optionCounts[optionIndex] || 0) + 1;
              });
            }
          });

          // Format option statistics
          questionStat.options = options.map(
            (optionText: string, index: number) => ({
              option_id: index,
              option_text: optionText,
              count: optionCounts[index] ?? 0,
            }),
          );
        } else if (question.question_type === "text") {
          // Get text responses
          const [textResponses] = await typedQuery<RowDataPacket[]>(
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
            [question.id],
          );
          questionStat.responses = textResponses.map((row) => ({
            answer_text: row.answer_text?.toString(),
          }));
        } else if (
          question.question_type === "rating" ||
          question.question_type === "number"
        ) {
          // Get numeric statistics
          const [numericStats] = await typedQuery<RowDataPacket[]>(
            `
            SELECT 
              AVG(sa.answer_number) as average,
              MIN(sa.answer_number) as min,
              MAX(sa.answer_number) as max,
              COUNT(sa.answer_number) as total_responses
            FROM survey_answers sa
            WHERE sa.question_id = ? AND sa.answer_number IS NOT NULL
          `,
            [question.id],
          );
          const stats = numericStats[0];
          questionStat.statistics = {
            average: stats.average ?? null,
            min: stats.min ?? null,
            max: stats.max ?? null,
            total_responses: stats.total_responses ?? 0,
          };
        }

        questionStats.push(questionStat);
      }

      return {
        survey_id: surveyId,
        total_responses: parseInt(stats[0].total_responses.toString()) ?? 0,
        completed_responses:
          parseInt(stats[0].completed_responses.toString()) || 0,
        completion_rate:
          stats[0].total_responses > 0
            ? Math.round(
                (stats[0].completed_responses / stats[0].total_responses) * 100,
              )
            : 0,
        first_response: stats[0].first_response,
        last_response: stats[0].last_response,
        questions: questionStats,
      };
    } catch (error) {
      console.error("Error in getStatistics:", error);
      throw error;
    }
  }
}

// Default export
export default Survey;

// CommonJS compatibility
