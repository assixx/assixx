/**
 * Survey Management Routes
 * API endpoints for survey system with responses and analytics
 */

import express, { Router, Request, Response } from 'express';
import { authenticateToken } from '../auth';
import { checkFeature } from '../middleware/features';
import { reportLimiter, apiLimiter } from '../middleware/security-enhanced';
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

// All routes require authentication and survey feature access
router.use([authenticateToken] as any[]);
router.use([checkFeature('surveys')] as any[]);

// Get pending surveys count for employee
router.get('/pending-count', async (req, res) => {
  try {
    const authReq = req as any;
    const userId = authReq.user.id;
    const tenantId = authReq.user.tenant_id;

    // Get all active surveys for the tenant
    const [surveys] = await db.query(
      `SELECT s.id 
       FROM surveys s
       WHERE s.tenant_id = ? 
       AND s.status = 'active'
       AND (s.end_date IS NULL OR s.end_date > NOW())`,
      [tenantId]
    );

    // Count surveys not yet completed by the user
    let pendingCount = 0;
    for (const survey of surveys) {
      const [response] = await db.query(
        'SELECT id FROM survey_responses WHERE survey_id = ? AND user_id = ? AND is_complete = 1',
        [survey.id, userId]
      );

      if (response.length === 0) {
        pendingCount++;
      }
    }

    res.json({ pendingCount });
  } catch (error: any) {
    console.error('Error fetching pending surveys count:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der offenen Umfragen' });
  }
});

// Get all surveys
router.get(
  '/',
  [validatePaginationQuery] as any[],
  async (req: any, res: any) => {
    try {
      const authReq = req as any;
      const { status, page, limit } = req.query;
      const surveys = await Survey.getAllByTenant(authReq.user.tenant_id, {
        status: status ? String(status) : undefined,
        page: page ? parseInt(String(page)) : 1,
        limit: limit ? parseInt(String(limit)) : 20,
      });
      res.json(surveys);
    } catch (error: any) {
      console.error('Error fetching surveys:', error);
      res.status(500).json({ error: 'Fehler beim Abrufen der Umfragen' });
    }
  }
);

// Get survey templates
router.get('/templates', async (req, res) => {
  try {
    const authReq = req as any;
    const templates = await Survey.getTemplates(authReq.user.tenant_id);
    res.json(templates);
  } catch (error: any) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Vorlagen' });
  }
});

// Get single survey
router.get('/:id', async (req, res) => {
  try {
    const authReq = req as any;
    const survey = await Survey.getById(req.params.id, authReq.user.tenant_id);
    if (!survey) {
      res.status(404).json({ error: 'Umfrage nicht gefunden' });
      return;
    }
    res.json(survey);
  } catch (error: any) {
    console.error('Error fetching survey:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Umfrage' });
  }
});

// Get survey statistics (admin only)
router.get('/:id/statistics', async (req, res) => {
  try {
    const authReq = req as any;
    if (authReq.user.role !== 'admin' && authReq.user.role !== 'root') {
      res.status(403).json({ error: 'Keine Berechtigung' });
      return;
    }

    const stats = await Survey.getStatistics(
      req.params.id,
      authReq.user.tenant_id
    );
    res.json(stats);
  } catch (error: any) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Statistiken' });
  }
});

// Create survey (admin only)
router.post('/', ...(validateCreateSurvey as any[]), async (req, res) => {
  try {
    const authReq = req as any;
    if (authReq.user.role !== 'admin' && authReq.user.role !== 'root') {
      res.status(403).json({ error: 'Keine Berechtigung' });
      return;
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
    res.status(500).json({ error: 'Fehler beim Erstellen der Umfrage' });
  }
});

// Create survey from template (admin only)
router.post('/from-template/:templateId', async (req, res) => {
  try {
    const authReq = req as any;
    if (authReq.user.role !== 'admin' && authReq.user.role !== 'root') {
      res.status(403).json({ error: 'Keine Berechtigung' });
      return;
    }

    const surveyId = await Survey.createFromTemplate(
      req.params.templateId,
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
});

// Update survey (admin only)
router.put('/:id', ...(validateUpdateSurvey as any[]), async (req, res) => {
  try {
    const authReq = req as any;
    if (authReq.user.role !== 'admin' && authReq.user.role !== 'root') {
      res.status(403).json({ error: 'Keine Berechtigung' });
      return;
    }

    const success = await Survey.update(
      req.params.id,
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
});

// Delete survey (admin only)
router.delete('/:id', async (req, res) => {
  try {
    const authReq = req as any;
    if (authReq.user.role !== 'admin' && authReq.user.role !== 'root') {
      res.status(403).json({ error: 'Keine Berechtigung' });
      return;
    }

    const success = await Survey.delete(req.params.id, authReq.user.tenant_id);

    if (!success) {
      res.status(404).json({ error: 'Umfrage nicht gefunden' });
      return;
    }

    res.json({ message: 'Umfrage erfolgreich gelöscht' });
  } catch (error: any) {
    console.error('Error deleting survey:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Umfrage' });
  }
});

// Submit survey response
router.post(
  '/:id/responses',
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
        answers,
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
      if (
        !(
          survey.is_anonymous === '1' ||
          survey.is_anonymous === 1 ||
          survey.is_anonymous === true
        )
      ) {
        const [existing] = await db.query(
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

        const [responseResult] = await connection.query(
          `
        INSERT INTO survey_responses (survey_id, user_id, anonymous_id)
        VALUES (?, ?, ?)
      `,
          [
            surveyId,
            survey.is_anonymous === '1' ||
            survey.is_anonymous === 1 ||
            survey.is_anonymous === true
              ? null
              : userId,
            survey.is_anonymous === '1' ||
            survey.is_anonymous === 1 ||
            survey.is_anonymous === true
              ? `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
              : null,
          ]
        );

        const responseId = responseResult.insertId;

        // Save answers
        for (const answer of answers) {
          await connection.query(
            `
          INSERT INTO survey_answers (
            response_id, question_id, answer_text, option_id, 
            answer_number, answer_date
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
            [
              responseId,
              answer.question_id,
              answer.answer_text || null,
              answer.option_id || null,
              answer.answer_number || null,
              answer.answer_date || null,
            ]
          );
        }

        // Mark response as complete
        await connection.query(
          'UPDATE survey_responses SET is_complete = 1, completed_at = NOW() WHERE id = ?',
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
router.get('/:id/my-response', async (req, res) => {
  try {
    const authReq = req as any;
    const surveyId = parseInt(req.params.id);
    const userId = authReq.user.id; // Already a number from auth middleware

    console.log(`Checking response for survey ${surveyId} and user ${userId}`);

    const [responses] = await db.query(
      `
      SELECT sr.*, sa.question_id, sa.answer_text, sa.option_id, 
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
          answer_text: r.answer_text,
          option_id: r.option_id,
          answer_number: r.answer_number,
          answer_date: r.answer_date,
        })),
      },
    });
  } catch (error: any) {
    console.error('Error fetching user response:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Antwort' });
  }
});

// Export survey results to Excel - with rate limiting
router.get(
  '/:id/export',
  [reportLimiter] as any[],
  async (req: any, res: any) => {
    try {
      const authReq = req as any;
      const surveyId = req.params.id;
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
            const [responses] = await db.query(
              `SELECT sa.*, so.option_text, u.first_name, u.last_name
             FROM survey_answers sa
             LEFT JOIN survey_question_options so ON sa.option_id = so.id
             LEFT JOIN survey_responses sr ON sa.response_id = sr.id
             LEFT JOIN users u ON sr.user_id = u.id
             WHERE sa.question_id = ?`,
              [question.id]
            );

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
                if (
                  resp.option_id &&
                  optionCounts[resp.option_id] !== undefined
                ) {
                  optionCounts[resp.option_id]++;
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
