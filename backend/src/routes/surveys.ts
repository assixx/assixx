/**
 * Survey Management Routes
 * API endpoints for survey system with responses and analytics
 * @swagger
 * tags:
 *   name: Survey
 *   description: Survey creation, management and responses
 */

import express, { Router } from 'express';
import { authenticateToken } from '../auth';
import { checkFeature } from '../middleware/features';
import { reportLimiter } from '../middleware/security-enhanced';
import {
  validateCreateSurvey,
  validateUpdateSurvey,
  validateSurveyResponse,
  validatePaginationQuery,
} from '../middleware/validators';

// Import models and database (now ES modules)
import Survey from '../models/survey';
import db from '../database';

const router: Router = express.Router();

// Get pending surveys count for employee
router.get(
  '/pending-count',
  authenticateToken as any,
  checkFeature('surveys') as any,
  async (req, res) => {
    try {
      const authReq = req as any;
      const userId = authReq.user.id;
      const tenantId = authReq.user.tenant_id;

      // First get the user's department_id
      const [userInfo] = await (db as any).execute(
        'SELECT department_id FROM users WHERE id = ? AND tenant_id = ?',
        [userId, tenantId]
      );

      const userDepartmentId = userInfo[0]?.department_id || null;

      // Get all active surveys assigned to the employee
      const [surveys] = await (db as any).execute(
        `SELECT DISTINCT s.id 
       FROM surveys s
       INNER JOIN survey_assignments sa ON s.id = sa.survey_id
       WHERE s.tenant_id = ? 
       AND s.status = 'active'
       AND (s.end_date IS NULL OR s.end_date > NOW())
       AND (
         sa.assignment_type = 'all_users'
         OR (sa.assignment_type = 'department' AND sa.department_id = ?)
         OR (sa.assignment_type = 'user' AND sa.user_id = ?)
       )`,
        [tenantId, userDepartmentId, userId]
      );

      // Count surveys not yet completed by the user
      let pendingCount = 0;
      for (const survey of surveys) {
        const [response] = await (db as any).execute(
          "SELECT id FROM survey_responses WHERE survey_id = ? AND user_id = ? AND status = 'completed'",
          [survey.id, userId]
        );

        if (response.length === 0) {
          pendingCount++;
        }
      }

      res.json({ pendingCount });
    } catch (error: any) {
      console.error('Error fetching pending surveys count:', error);
      res
        .status(500)
        .json({ error: 'Fehler beim Abrufen der offenen Umfragen' });
    }
  }
);

/**
 * @swagger
 * /surveys:
 *   get:
 *     summary: Get all surveys
 *     description: Retrieve all surveys for the tenant with pagination and filtering
 *     tags: [Survey]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, draft, closed]
 *         description: Filter by survey status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Surveys retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 surveys:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Survey'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalItems:
 *                       type: integer
 *                     itemsPerPage:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Feature not available
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Feature not available for your subscription
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Fehler beim Abrufen der Umfragen
 */
// Get all surveys
router.get(
  '/',
  authenticateToken as any,
  checkFeature('surveys') as any,
  validatePaginationQuery as any,
  async (req: any, res: any) => {
    try {
      const authReq = req as any;
      const { status, page, limit } = req.query;

      let surveys;

      // Root users see all surveys
      if (authReq.user.role === 'root') {
        surveys = await Survey.getAllByTenant(authReq.user.tenant_id, {
          status: status
            ? (String(status) as 'active' | 'draft' | 'closed')
            : undefined,
          page: page ? parseInt(String(page)) : 1,
          limit: limit ? parseInt(String(limit)) : 20,
        });
      }
      // Admin users see filtered surveys based on department permissions
      else if (authReq.user.role === 'admin') {
        surveys = await Survey.getAllByTenantForAdmin(
          authReq.user.tenant_id,
          authReq.user.id,
          {
            status: status
              ? (String(status) as 'active' | 'draft' | 'closed')
              : undefined,
            page: page ? parseInt(String(page)) : 1,
            limit: limit ? parseInt(String(limit)) : 20,
          }
        );
      }
      // Employee users see surveys assigned to them
      else if (authReq.user.role === 'employee') {
        surveys = await Survey.getAllByTenantForEmployee(
          authReq.user.tenant_id,
          authReq.user.id,
          {
            status: status
              ? (String(status) as 'active' | 'draft' | 'closed')
              : undefined,
            page: page ? parseInt(String(page)) : 1,
            limit: limit ? parseInt(String(limit)) : 20,
          }
        );
      }
      // Other roles don't have access
      else {
        res.status(403).json({ error: 'Keine Berechtigung' });
        return;
      }

      res.json(surveys);
    } catch (error: any) {
      console.error('Error fetching surveys:', error);
      res.status(500).json({ error: 'Fehler beim Abrufen der Umfragen' });
    }
  }
);

// Get survey templates
router.get(
  '/templates',
  authenticateToken as any,
  checkFeature('surveys') as any,
  async (req, res) => {
    try {
      const authReq = req as any;
      const templates = await Survey.getTemplates(authReq.user.tenant_id);
      res.json(templates);
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      res.status(500).json({ error: 'Fehler beim Abrufen der Vorlagen' });
    }
  }
);

// Get single survey
router.get(
  '/:id',
  authenticateToken as any,
  checkFeature('surveys') as any,
  async (req, res) => {
    try {
      const authReq = req as any;
      const survey = await Survey.getById(
        parseInt(req.params.id, 10),
        authReq.user.tenant_id
      );
      if (!survey) {
        res.status(404).json({ error: 'Umfrage nicht gefunden' });
        return;
      }
      res.json(survey);
    } catch (error: any) {
      console.error('Error fetching survey:', error);
      res.status(500).json({ error: 'Fehler beim Abrufen der Umfrage' });
    }
  }
);

// Get survey statistics (admin only)
router.get(
  '/:id/statistics',
  authenticateToken as any,
  checkFeature('surveys') as any,
  async (req, res) => {
    try {
      const authReq = req as any;
      if (authReq.user.role !== 'admin' && authReq.user.role !== 'root') {
        res.status(403).json({ error: 'Keine Berechtigung' });
        return;
      }

      const stats = await Survey.getStatistics(
        parseInt(req.params.id, 10),
        authReq.user.tenant_id
      );
      res.json(stats);
    } catch (error: any) {
      console.error('Error fetching statistics:', error);
      res.status(500).json({ error: 'Fehler beim Abrufen der Statistiken' });
    }
  }
);

// Create survey (admin only)
router.post(
  '/',
  authenticateToken as any,
  checkFeature('surveys') as any,
  ...(validateCreateSurvey as any[]),
  async (req, res) => {
    try {
      const authReq = req as any;
      if (authReq.user.role !== 'admin' && authReq.user.role !== 'root') {
        res.status(403).json({ error: 'Keine Berechtigung' });
        return;
      }

      // For admin users, validate department assignments
      if (authReq.user.role === 'admin' && req.body.assignments) {
        // Get admin's authorized departments
        const [adminDepts] = await (db as any).execute(
          `SELECT department_id FROM admin_department_permissions 
           WHERE admin_user_id = ? AND tenant_id = ? AND can_write = 1`,
          [authReq.user.id, authReq.user.tenant_id]
        );

        const authorizedDeptIds = adminDepts.map((d: any) => d.department_id);

        // Check each assignment
        for (const assignment of req.body.assignments) {
          if (assignment.type === 'department') {
            if (!authorizedDeptIds.includes(assignment.department_id)) {
              res.status(403).json({
                error: 'Sie haben keine Berechtigung für diese Abteilung',
              });
              return;
            }
          }
          // Admins can always create surveys for "all_users"
          else if (assignment.type !== 'all_users') {
            res.status(403).json({
              error:
                'Sie können nur Umfragen für Ihre Abteilungen oder die ganze Firma erstellen',
            });
            return;
          }
        }
      }

      const surveyId = await Survey.create(
        req.body,
        authReq.user.tenant_id,
        authReq.user.id
      );

      res.status(201).json({
        id: surveyId,
        message: 'Umfrage erfolgreich erstellt',
      });
    } catch (error: any) {
      console.error('Error creating survey:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({
        error: 'Fehler beim Erstellen der Umfrage',
        details:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

// Create survey from template (admin only)
router.post(
  '/from-template/:templateId',
  authenticateToken as any,
  checkFeature('surveys') as any,
  async (req, res) => {
    try {
      const authReq = req as any;
      if (authReq.user.role !== 'admin' && authReq.user.role !== 'root') {
        res.status(403).json({ error: 'Keine Berechtigung' });
        return;
      }

      const surveyId = await Survey.createFromTemplate(
        parseInt(req.params.templateId, 10),
        authReq.user.tenant_id,
        authReq.user.id
      );

      res.status(201).json({
        id: surveyId,
        message: 'Umfrage aus Vorlage erstellt',
      });
    } catch (error: any) {
      console.error('Error creating survey from template:', error);
      res
        .status(500)
        .json({ error: 'Fehler beim Erstellen der Umfrage aus Vorlage' });
    }
  }
);

// Update survey (admin only)
router.put(
  '/:id',
  authenticateToken as any,
  checkFeature('surveys') as any,
  ...(validateUpdateSurvey as any[]),
  async (req, res) => {
    try {
      const authReq = req as any;
      if (authReq.user.role !== 'admin' && authReq.user.role !== 'root') {
        res.status(403).json({ error: 'Keine Berechtigung' });
        return;
      }

      const success = await Survey.update(
        parseInt(req.params.id, 10),
        req.body,
        authReq.user.tenant_id
      );

      if (!success) {
        res.status(404).json({ error: 'Umfrage nicht gefunden' });
        return;
      }

      res.json({ message: 'Umfrage erfolgreich aktualisiert' });
    } catch (error: any) {
      console.error('Error updating survey:', error);
      res.status(500).json({ error: 'Fehler beim Aktualisieren der Umfrage' });
    }
  }
);

// Delete survey (admin only)
router.delete(
  '/:id',
  authenticateToken as any,
  checkFeature('surveys') as any,
  async (req, res) => {
    try {
      const authReq = req as any;
      if (authReq.user.role !== 'admin' && authReq.user.role !== 'root') {
        res.status(403).json({ error: 'Keine Berechtigung' });
        return;
      }

      const success = await Survey.delete(
        parseInt(req.params.id, 10),
        authReq.user.tenant_id
      );

      if (!success) {
        res.status(404).json({ error: 'Umfrage nicht gefunden' });
        return;
      }

      res.json({ message: 'Umfrage erfolgreich gelöscht' });
    } catch (error: any) {
      console.error('Error deleting survey:', error);
      res.status(500).json({ error: 'Fehler beim Löschen der Umfrage' });
    }
  }
);

// Submit survey response
router.post(
  '/:id/responses',
  authenticateToken as any,
  checkFeature('surveys') as any,
  ...(validateSurveyResponse as any[]),
  async (req, res) => {
    try {
      const authReq = req as any;
      const surveyId = parseInt(req.params.id);
      const userId = authReq.user.id; // Already a number from auth middleware
      const answers = req.body.answers;

      console.log('Submitting response:', {
        surveyId,
        userId,
        userIdType: typeof userId,
        answersCount: answers ? answers.length : 0,
        answers: JSON.stringify(answers, null, 2),
        tenantId: authReq.user.tenant_id,
      });

      // Check if survey exists and is active
      const survey = await Survey.getById(surveyId, authReq.user.tenant_id);
      if (!survey) {
        res.status(404).json({ error: 'Umfrage nicht gefunden' });
        return;
      }

      if (survey.status !== 'active') {
        res.status(400).json({ error: 'Umfrage ist nicht aktiv' });
        return;
      }

      console.log(
        'Survey is_anonymous:',
        survey.is_anonymous,
        typeof survey.is_anonymous
      );

      // Check if user already responded (unless anonymous)
      const isAnonymous =
        String(survey.is_anonymous) === '1' ||
        survey.is_anonymous === 1 ||
        survey.is_anonymous === true;

      if (!isAnonymous) {
        const [existing] = await (db as any).execute(
          'SELECT id FROM survey_responses WHERE survey_id = ? AND user_id = ?',
          [surveyId, userId]
        );

        if (existing.length > 0) {
          res.status(400).json({
            error: 'Sie haben bereits an dieser Umfrage teilgenommen',
          });
          return;
        }
      }

      // Create response
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();

        const [responseResult] = (await connection.execute(
          `
        INSERT INTO survey_responses (tenant_id, survey_id, user_id, session_id)
        VALUES (?, ?, ?, ?)
      `,
          [
            authReq.user.tenant_id,
            surveyId,
            isAnonymous ? null : userId,
            isAnonymous
              ? `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
              : null,
          ]
        )) as any;

        const responseId = responseResult.insertId;

        // Save answers
        for (const answer of answers) {
          console.log('Saving answer:', {
            tenant_id: authReq.user.tenant_id,
            response_id: responseId,
            question_id: answer.question_id,
            answer_text: answer.answer_text || null,
            answer_options: answer.answer_options
              ? JSON.stringify(answer.answer_options)
              : null,
            answer_number: answer.answer_number || null,
            answer_date: answer.answer_date || null,
          });

          await connection.execute(
            `
          INSERT INTO survey_answers (
            tenant_id, response_id, question_id, answer_text, answer_options, 
            answer_number, answer_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
            [
              authReq.user.tenant_id,
              responseId,
              answer.question_id,
              answer.answer_text || null,
              answer.answer_options
                ? JSON.stringify(answer.answer_options)
                : null,
              answer.answer_number || null,
              answer.answer_date || null,
            ]
          );
        }

        // Mark response as complete
        await connection.execute(
          "UPDATE survey_responses SET status = 'completed', completed_at = NOW() WHERE id = ?",
          [responseId]
        );

        await connection.commit();
        console.log(
          `Response ${responseId} saved successfully for user ${userId} on survey ${surveyId}`
        );
        res.json({ message: 'Antworten erfolgreich gespeichert', responseId });
      } catch (error) {
        await connection.rollback();
        console.error('Error in transaction:', error);
        throw error;
      } finally {
        connection.release();
      }
    } catch (error: any) {
      console.error('Error submitting response:', error);
      res.status(500).json({ error: 'Fehler beim Speichern der Antworten' });
    }
  }
);

// Get user's response to a survey
router.get(
  '/:id/my-response',
  authenticateToken as any,
  checkFeature('surveys') as any,
  async (req, res) => {
    try {
      const authReq = req as any;
      const surveyId = parseInt(req.params.id);
      const userId = authReq.user.id; // Already a number from auth middleware

      console.log(
        `Checking response for survey ${surveyId} and user ${userId}`
      );

      const [responses] = await (db as any).execute(
        `
      SELECT sr.*, sa.question_id, sa.answer_text, sa.answer_options, 
             sa.answer_number, sa.answer_date
      FROM survey_responses sr
      LEFT JOIN survey_answers sa ON sr.id = sa.response_id
      WHERE sr.survey_id = ? AND sr.user_id = ?
    `,
        [surveyId, userId]
      );

      console.log(
        `Found ${responses.length} responses for user ${userId} on survey ${surveyId}`
      );

      if (responses.length === 0) {
        res.json({ responded: false });
        return;
      }

      res.json({
        responded: true,
        response: {
          id: responses[0].id,
          completed_at: responses[0].completed_at,
          answers: responses.map((r: any) => ({
            question_id: r.question_id,
            answer_text:
              r.answer_text && Buffer.isBuffer(r.answer_text)
                ? r.answer_text.toString()
                : r.answer_text,
            answer_options: r.answer_options,
            answer_number: r.answer_number,
            answer_date: r.answer_date,
          })),
        },
      });
    } catch (error: any) {
      console.error('Error fetching user response:', error);
      res.status(500).json({ error: 'Fehler beim Abrufen der Antwort' });
    }
  }
);

// Export survey results to Excel - with rate limiting
router.get(
  '/:id/export',
  [reportLimiter] as any[],
  async (req: any, res: any) => {
    try {
      const authReq = req as any;
      const surveyId = parseInt(req.params.id, 10);
      const format = req.query.format ? String(req.query.format) : 'excel';

      // Get survey with all responses
      const survey = await Survey.getById(surveyId, authReq.user.tenant_id);
      if (!survey) {
        res.status(404).json({ error: 'Umfrage nicht gefunden' });
        return;
      }

      // Get statistics with all responses
      const statistics = await Survey.getStatistics(
        surveyId,
        authReq.user.tenant_id
      );

      if (format === 'excel') {
        // Create Excel export
        const ExcelJS = await import('exceljs');
        const workbook = new ExcelJS.default.Workbook();

        // Summary sheet
        const summarySheet = workbook.addWorksheet('Zusammenfassung');
        summarySheet.columns = [
          { header: 'Eigenschaft', key: 'property', width: 30 },
          { header: 'Wert', key: 'value', width: 50 },
        ];

        summarySheet.addRows([
          { property: 'Umfrage-Titel', value: survey.title },
          {
            property: 'Erstellt am',
            value: new Date(survey.created_at).toLocaleDateString('de-DE'),
          },
          {
            property: 'Endet am',
            value: survey.end_date
              ? new Date(survey.end_date).toLocaleDateString('de-DE')
              : 'N/A',
          },
          { property: 'Status', value: survey.status },
          { property: 'Anonym', value: survey.is_anonymous ? 'Ja' : 'Nein' },
          {
            property: 'Anzahl Antworten',
            value: statistics.total_responses || 0,
          },
          {
            property: 'Abschlussrate',
            value: `${statistics.completed_responses || 0} von ${statistics.total_responses || 0}`,
          },
        ]);

        // Questions sheet
        const questionsSheet = workbook.addWorksheet('Fragen & Antworten');

        // Add headers based on question types
        const headers = ['Frage', 'Typ', 'Antworten'];
        questionsSheet.addRow(headers);

        // Add question results
        if (survey.questions) {
          for (const question of survey.questions) {
            const row = [
              question.question_text,
              question.question_type,
              'Siehe Details unten',
            ];
            questionsSheet.addRow(row);

            // Get responses for this question
            const [responses] = (await (db as any).execute(
              `SELECT sa.*, u.first_name, u.last_name
             FROM survey_answers sa
             LEFT JOIN survey_responses sr ON sa.response_id = sr.id
             LEFT JOIN users u ON sr.user_id = u.id
             WHERE sa.question_id = ?`,
              [question.id]
            )) as any;

            // Add details based on question type
            if (
              ['single_choice', 'multiple_choice'].includes(
                question.question_type
              ) &&
              question.options
            ) {
              // Count responses per option
              const optionCounts: { [key: number]: number } = {};
              question.options.forEach((opt: any) => {
                optionCounts[opt.id] = 0;
              });

              responses.forEach((resp: any) => {
                // Parse answer_options if it's stored as JSON
                if (resp.answer_options) {
                  try {
                    const selectedOptions = JSON.parse(resp.answer_options);
                    selectedOptions.forEach((optionId: number) => {
                      if (optionCounts[optionId] !== undefined) {
                        optionCounts[optionId]++;
                      }
                    });
                  } catch {
                    // Handle non-JSON or invalid data
                  }
                }
              });

              question.options.forEach((option: any) => {
                const count = optionCounts[option.id] || 0;
                const percentage =
                  responses.length > 0
                    ? Math.round((count / responses.length) * 100)
                    : 0;
                questionsSheet.addRow([
                  '',
                  option.option_text,
                  `${count} (${percentage}%)`,
                ]);
              });
            } else if (question.question_type === 'text') {
              responses.forEach((response: any) => {
                questionsSheet.addRow([
                  '',
                  survey.is_anonymous
                    ? 'Anonym'
                    : `${response.first_name || ''} ${response.last_name || ''}`.trim() ||
                      'N/A',
                  response.answer_text || '',
                ]);
              });
            } else if (
              question.question_type === 'number' ||
              question.question_type === 'rating'
            ) {
              const numbers = responses
                .map((r: any) => r.answer_number)
                .filter((n: any) => n !== null);
              if (numbers.length > 0) {
                const avg =
                  numbers.reduce((a: number, b: number) => a + b, 0) /
                  numbers.length;
                const min = Math.min(...numbers);
                const max = Math.max(...numbers);
                questionsSheet.addRow(['', 'Durchschnitt', avg.toFixed(2)]);
                questionsSheet.addRow(['', 'Min/Max', `${min} / ${max}`]);
              }
            }

            // Add empty row for spacing
            questionsSheet.addRow([]);
          }
        }

        // Set response headers
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename=umfrage_${surveyId}_export.xlsx`
        );

        // Write to response
        await workbook.xlsx.write(res);
        res.end();
      } else {
        res.status(400).json({ error: 'Nicht unterstütztes Format' });
      }
    } catch (error: any) {
      console.error('Error exporting survey:', error);
      res.status(500).json({ error: 'Fehler beim Exportieren der Umfrage' });
    }
  }
);

export default router;

// CommonJS compatibility
