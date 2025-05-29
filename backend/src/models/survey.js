const db = require('../database');

class Survey {
  /**
   * Create a new survey
   */
  static async create(surveyData, tenantId, createdBy) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Create survey
      const [surveyResult] = await connection.query(
        `
        INSERT INTO surveys (
          tenant_id, title, description, created_by, status,
          is_anonymous, is_mandatory, start_date, end_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          tenantId,
          surveyData.title,
          surveyData.description,
          createdBy,
          surveyData.status || 'draft',
          surveyData.is_anonymous || false,
          surveyData.is_mandatory || false,
          surveyData.start_date || null,
          surveyData.end_date || null,
        ]
      );

      const surveyId = surveyResult.insertId;

      // Add questions
      if (surveyData.questions && surveyData.questions.length > 0) {
        for (const [index, question] of surveyData.questions.entries()) {
          const [questionResult] = await connection.query(
            `
            INSERT INTO survey_questions (
              survey_id, question_text, question_type, is_required, order_position
            ) VALUES (?, ?, ?, ?, ?)
          `,
            [
              surveyId,
              question.question_text,
              question.question_type,
              question.is_required !== false,
              question.order_position || index + 1,
            ]
          );

          const questionId = questionResult.insertId;

          // Add options for multiple choice questions
          if (question.options && question.options.length > 0) {
            for (const [optIndex, option] of question.options.entries()) {
              await connection.query(
                `
                INSERT INTO survey_question_options (
                  question_id, option_text, order_position
                ) VALUES (?, ?, ?)
              `,
                [questionId, option, optIndex + 1]
              );
            }
          }
        }
      }

      // Add assignments
      if (surveyData.assignments && surveyData.assignments.length > 0) {
        for (const assignment of surveyData.assignments) {
          await connection.query(
            `
            INSERT INTO survey_assignments (
              survey_id, assignment_type, department_id, team_id, user_id
            ) VALUES (?, ?, ?, ?, ?)
          `,
            [
              surveyId,
              assignment.type,
              assignment.department_id || null,
              assignment.team_id || null,
              assignment.user_id || null,
            ]
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
   * Get all surveys for a tenant
   */
  static async getAllByTenant(tenantId, filters = {}) {
    const { status, page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        s.*,
        u.first_name as creator_first_name,
        u.last_name as creator_last_name,
        COUNT(DISTINCT sr.id) as response_count,
        COUNT(DISTINCT CASE WHEN sr.is_complete = 1 THEN sr.id END) as completed_count
      FROM surveys s
      LEFT JOIN users u ON s.created_by = u.id
      LEFT JOIN survey_responses sr ON s.id = sr.survey_id
      WHERE s.tenant_id = ?
    `;

    const params = [tenantId];

    if (status) {
      query += ' AND s.status = ?';
      params.push(status);
    }

    query += ' GROUP BY s.id ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [surveys] = await db.query(query, params);
    return surveys;
  }

  /**
   * Get survey by ID with questions and options
   */
  static async getById(surveyId, tenantId) {
    const [surveys] = await db.query(
      `
      SELECT s.*, 
        u.first_name as creator_first_name,
        u.last_name as creator_last_name
      FROM surveys s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.id = ? AND s.tenant_id = ?
    `,
      [surveyId, tenantId]
    );

    if (surveys.length === 0) {
      return null;
    }

    const survey = surveys[0];

    // Get questions
    const [questions] = await db.query(
      `
      SELECT * FROM survey_questions
      WHERE survey_id = ?
      ORDER BY order_position
    `,
      [surveyId]
    );

    // Get options for each question
    for (const question of questions) {
      if (
        ['multiple_choice', 'single_choice'].includes(question.question_type)
      ) {
        const [options] = await db.query(
          `
          SELECT * FROM survey_question_options
          WHERE question_id = ?
          ORDER BY order_position
        `,
          [question.id]
        );
        question.options = options;
      }
    }

    survey.questions = questions;

    // Get assignments
    const [assignments] = await db.query(
      `
      SELECT * FROM survey_assignments
      WHERE survey_id = ?
    `,
      [surveyId]
    );

    survey.assignments = assignments;

    return survey;
  }

  /**
   * Update survey
   */
  static async update(surveyId, surveyData, tenantId) {
    const connection = await db.getConnection();
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
          is_mandatory = ?,
          start_date = ?,
          end_date = ?
        WHERE id = ? AND tenant_id = ?
      `,
        [
          surveyData.title,
          surveyData.description,
          surveyData.status,
          surveyData.is_anonymous,
          surveyData.is_mandatory,
          surveyData.start_date,
          surveyData.end_date,
          surveyId,
          tenantId,
        ]
      );

      // Update questions if provided
      if (surveyData.questions) {
        // Delete existing questions and options (cascade will handle options)
        await connection.query(
          'DELETE FROM survey_questions WHERE survey_id = ?',
          [surveyId]
        );

        // Add new questions
        for (const [index, question] of surveyData.questions.entries()) {
          const [questionResult] = await connection.query(
            `
            INSERT INTO survey_questions (
              survey_id, question_text, question_type, is_required, order_position
            ) VALUES (?, ?, ?, ?, ?)
          `,
            [
              surveyId,
              question.question_text,
              question.question_type,
              question.is_required !== false,
              question.order_position || index + 1,
            ]
          );

          const questionId = questionResult.insertId;

          // Add options
          if (question.options && question.options.length > 0) {
            for (const [optIndex, option] of question.options.entries()) {
              await connection.query(
                `
                INSERT INTO survey_question_options (
                  question_id, option_text, order_position
                ) VALUES (?, ?, ?)
              `,
                [questionId, option, optIndex + 1]
              );
            }
          }
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
  static async delete(surveyId, tenantId) {
    const result = await db.query(
      'DELETE FROM surveys WHERE id = ? AND tenant_id = ?',
      [surveyId, tenantId]
    );
    return result[0].affectedRows > 0;
  }

  /**
   * Get survey templates
   */
  static async getTemplates(tenantId) {
    const [templates] = await db.query(
      `
      SELECT * FROM survey_templates
      WHERE tenant_id = ? OR is_public = 1
      ORDER BY name
    `,
      [tenantId]
    );
    return templates;
  }

  /**
   * Create survey from template
   */
  static async createFromTemplate(templateId, tenantId, createdBy) {
    const [templates] = await db.query(
      `
      SELECT * FROM survey_templates
      WHERE id = ? AND (tenant_id = ? OR is_public = 1)
    `,
      [templateId, tenantId]
    );

    if (templates.length === 0) {
      throw new Error('Template not found');
    }

    const template = templates[0];
    const templateData = JSON.parse(template.template_data);

    const surveyData = {
      title: templateData.title,
      description: templateData.description,
      questions: templateData.questions,
      status: 'draft',
    };

    return this.create(surveyData, tenantId, createdBy);
  }

  /**
   * Get survey statistics
   */
  static async getStatistics(surveyId, tenantId) {
    try {
      // Get basic statistics
      const [stats] = await db.query(
        `
        SELECT 
          COUNT(DISTINCT sr.id) as total_responses,
          COUNT(DISTINCT CASE WHEN sr.is_complete = 1 THEN sr.id END) as completed_responses,
          MIN(sr.started_at) as first_response,
          MAX(sr.completed_at) as last_response
        FROM surveys s
        LEFT JOIN survey_responses sr ON s.id = sr.survey_id
        WHERE s.id = ? AND s.tenant_id = ?
      `,
        [surveyId, tenantId]
      );

      // Get survey details with questions
      const survey = await this.getById(surveyId, tenantId);
      if (!survey) {
        throw new Error('Survey not found');
      }

      // Get question statistics
      const questionStats = [];
      
      for (const question of survey.questions || []) {
        const questionStat = {
          id: question.id,
          question_text: question.question_text,
          question_type: question.question_type,
          responses: []
        };

        if (question.question_type === 'single_choice' || question.question_type === 'multiple_choice') {
          // Get option statistics
          const [optionStats] = await db.query(
            `
            SELECT 
              sqo.id as option_id,
              sqo.option_text,
              COUNT(DISTINCT sa.response_id) as count
            FROM survey_question_options sqo
            LEFT JOIN survey_answers sa ON sa.option_id = sqo.id
            WHERE sqo.question_id = ?
            GROUP BY sqo.id, sqo.option_text
            ORDER BY sqo.order_position
          `,
            [question.id]
          );
          questionStat.options = optionStats;
        } else if (question.question_type === 'text') {
          // Get text responses
          const [textResponses] = await db.query(
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
            [question.id]
          );
          questionStat.responses = textResponses;
        } else if (question.question_type === 'rating' || question.question_type === 'number') {
          // Get numeric statistics
          const [numericStats] = await db.query(
            `
            SELECT 
              AVG(sa.answer_number) as average,
              MIN(sa.answer_number) as min,
              MAX(sa.answer_number) as max,
              COUNT(sa.answer_number) as count
            FROM survey_answers sa
            WHERE sa.question_id = ? AND sa.answer_number IS NOT NULL
          `,
            [question.id]
          );
          questionStat.statistics = numericStats[0];
        }

        questionStats.push(questionStat);
      }

      return {
        survey_id: surveyId,
        total_responses: parseInt(stats[0].total_responses) || 0,
        completed_responses: parseInt(stats[0].completed_responses) || 0,
        completion_rate: stats[0].total_responses > 0 
          ? Math.round((stats[0].completed_responses / stats[0].total_responses) * 100) 
          : 0,
        first_response: stats[0].first_response,
        last_response: stats[0].last_response,
        questions: questionStats
      };
    } catch (error) {
      console.error('Error in getStatistics:', error);
      throw error;
    }
  }
}

module.exports = Survey;
