/**
 * Survey Management Routes
 * API endpoints for survey system with responses and analytics
 * @swagger
 * tags:
 *   name: Survey
 *   description: Survey creation, management and responses
 */

import { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import express, { Router } from "express";
import db, { execute } from "../database";
import { checkFeature } from "../middleware/features";
import { rateLimiter } from "../middleware/rateLimiter";
import { security } from "../middleware/security";
import {
  validateCreateSurvey,
  validateUpdateSurvey,
  validateSurveyResponse,
  validatePaginationQuery,
} from "../middleware/validators";
import Survey from "../models/survey";
import { successResponse, errorResponse } from "../types/response.types";
import { getErrorStack } from "../utils/errorHandler";
import { typed } from "../utils/routeHandlers";

// Import models and database (now ES modules)

const router: Router = express.Router();

// Get pending surveys count for employee
router.get(
  "/pending-count",
  ...security.user(),
  checkFeature("surveys"),
  typed.auth(async (req, res) => {
    try {
      const userId = req.user.id;
      const tenantId = req.user.tenant_id;

      // First get the user's department_id
      const [userInfo] = await execute<RowDataPacket[]>(
        "SELECT department_id FROM users WHERE id = ? AND tenant_id = ?",
        [userId, tenantId],
      );

      const userDepartmentId: number | null = userInfo[0]?.department_id as
        | number
        | null;

      // Get all active surveys assigned to the employee
      const [surveys] = await execute<RowDataPacket[]>(
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
        [tenantId, userDepartmentId, userId],
      );

      // Count surveys not yet completed by the user
      let pendingCount = 0;
      for (const survey of surveys) {
        const [response] = await execute<RowDataPacket[]>(
          "SELECT id FROM survey_responses WHERE survey_id = ? AND user_id = ? AND status = 'completed'",
          [survey.id, userId],
        );

        if (response.length === 0) {
          pendingCount++;
        }
      }

      res.json(successResponse({ pendingCount }));
    } catch (error: unknown) {
      console.error("Error fetching pending surveys count:", error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Abrufen der offenen Umfragen", 500));
    }
  }),
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
  "/",
  ...security.user(),
  validatePaginationQuery,
  checkFeature("surveys"),
  typed.auth(async (req, res) => {
    try {
      const { status, page, limit } = req.query;

      let surveys;

      // Root users see all surveys
      if (req.user.role === "root") {
        surveys = await Survey.getAllByTenant(req.user.tenant_id, {
          status:
            status != null && status !== ""
              ? ((typeof status === "string"
                  ? status
                  : typeof status === "object"
                    ? JSON.stringify(status)
                    : String(status)) as "active" | "draft" | "closed")
              : undefined,
          page:
            page != null && page !== ""
              ? Number.parseInt(
                  typeof page === "string"
                    ? page
                    : typeof page === "number"
                      ? String(page)
                      : "1",
                )
              : 1,
          limit:
            limit != null && limit !== ""
              ? Number.parseInt(
                  typeof limit === "string"
                    ? limit
                    : typeof limit === "number"
                      ? String(limit)
                      : "20",
                )
              : 20,
        });
      }
      // Admin users see filtered surveys based on department permissions
      else if (req.user.role === "admin") {
        surveys = await Survey.getAllByTenantForAdmin(
          req.user.tenant_id,
          req.user.id,
          {
            status:
              status != null && status !== ""
                ? ((typeof status === "string"
                    ? status
                    : typeof status === "object"
                      ? JSON.stringify(status)
                      : String(status)) as "active" | "draft" | "closed")
                : undefined,
            page:
              page != null && page !== ""
                ? Number.parseInt(
                    typeof page === "string"
                      ? page
                      : typeof page === "number"
                        ? String(page)
                        : "1",
                  )
                : 1,
            limit:
              limit != null && limit !== ""
                ? Number.parseInt(
                    typeof limit === "string"
                      ? limit
                      : typeof limit === "number"
                        ? String(limit)
                        : "20",
                  )
                : 20,
          },
        );
      }
      // Employee users see surveys assigned to them
      else if (req.user.role === "employee") {
        surveys = await Survey.getAllByTenantForEmployee(
          req.user.tenant_id,
          req.user.id,
          {
            status:
              status != null && status !== ""
                ? ((typeof status === "string"
                    ? status
                    : typeof status === "object"
                      ? JSON.stringify(status)
                      : String(status)) as "active" | "draft" | "closed")
                : undefined,
            page:
              page != null && page !== ""
                ? Number.parseInt(
                    typeof page === "string"
                      ? page
                      : typeof page === "number"
                        ? String(page)
                        : "1",
                  )
                : 1,
            limit:
              limit != null && limit !== ""
                ? Number.parseInt(
                    typeof limit === "string"
                      ? limit
                      : typeof limit === "number"
                        ? String(limit)
                        : "20",
                  )
                : 20,
          },
        );
      }
      // Other roles don't have access
      else {
        res.status(403).json(errorResponse("Keine Berechtigung", 403));
        return;
      }

      res.json(successResponse(surveys));
    } catch (error: unknown) {
      console.error("Error fetching surveys:", error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Abrufen der Umfragen", 500));
    }
  }),
);

// Get survey templates
router.get(
  "/templates",
  ...security.user(),
  checkFeature("surveys"),
  typed.auth(async (req, res) => {
    try {
      const templates = await Survey.getTemplates(req.user.tenant_id);
      res.json(successResponse(templates));
    } catch (error: unknown) {
      console.error("Error fetching templates:", error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Abrufen der Vorlagen", 500));
    }
  }),
);

// Get single survey
router.get(
  "/:id",
  ...security.user(),
  checkFeature("surveys"),
  typed.params<{ id: string }>(async (req, res) => {
    try {
      const survey = await Survey.getById(
        Number.parseInt(req.params.id, 10),
        req.user.tenant_id,
      );
      if (!survey) {
        res.status(404).json(errorResponse("Umfrage nicht gefunden", 404));
        return;
      }
      res.json(successResponse(survey));
    } catch (error: unknown) {
      console.error("Error fetching survey:", error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Abrufen der Umfrage", 500));
    }
  }),
);

// Get survey statistics (admin only)
router.get(
  "/:id/statistics",
  ...security.admin(),
  checkFeature("surveys"),
  typed.params<{ id: string }>(async (req, res) => {
    try {
      const stats = await Survey.getStatistics(
        Number.parseInt(req.params.id, 10),
        req.user.tenant_id,
      );
      res.json(successResponse(stats));
    } catch (error: unknown) {
      console.error("Error fetching statistics:", error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Abrufen der Statistiken", 500));
    }
  }),
);

// Create survey (admin only)
router.post(
  "/",
  ...security.admin(validateCreateSurvey),
  checkFeature("surveys"),
  typed.body<{
    title: string;
    description?: string;
    start_date: string;
    end_date: string;
    is_anonymous?: boolean;
    status?: "draft" | "active" | "closed";
    questions?: {
      question_text: string;
      question_type:
        | "text"
        | "single_choice"
        | "multiple_choice"
        | "rating"
        | "number";
      options?: string[];
    }[];
    assignments?: {
      type: "company" | "department" | "team" | "individual";
      department_id?: number;
      team_id?: number;
      user_id?: number;
    }[];
  }>(async (req, res) => {
    try {
      // For admin users, validate department assignments
      if (req.user.role === "admin" && req.body.assignments) {
        // Get admin's authorized departments
        const [adminDepts] = await execute<RowDataPacket[]>(
          `SELECT department_id FROM admin_department_permissions
           WHERE admin_user_id = ? AND tenant_id = ? AND can_write = 1`,
          [req.user.id, req.user.tenant_id],
        );

        const authorizedDeptIds = adminDepts.map(
          (d) => d.department_id as number,
        );

        // Check each assignment
        for (const assignment of req.body.assignments) {
          if (assignment.type === "department") {
            if (
              assignment.department_id === undefined ||
              !authorizedDeptIds.includes(assignment.department_id)
            ) {
              res.status(403).json({
                error: "Sie haben keine Berechtigung für diese Abteilung",
              });
              return;
            }
          }
          // Admins can always create surveys for "all_users"
          else if (!["company", "all_users"].includes(assignment.type)) {
            res.status(403).json({
              error:
                "Sie können nur Umfragen für Ihre Abteilungen oder die ganze Firma erstellen",
            });
            return;
          }
        }
      }

      // Map v1 assignment types to v2 types
      const mappedBody = {
        ...req.body,
        assignments: req.body.assignments?.map(
          (a: {
            type: string;
            department_id?: number;
            team_id?: number;
            user_id?: number;
          }) => ({
            ...a,
            type: (a.type === "company"
              ? "all_users"
              : a.type === "individual"
                ? "user"
                : a.type) as "all_users" | "department" | "team" | "user",
          }),
        ),
      };

      const surveyId = await Survey.create(
        mappedBody,
        req.user.tenant_id,
        req.user.id,
      );

      res.status(201).json(
        successResponse({
          id: surveyId,
          message: "Umfrage erfolgreich erstellt",
        }),
      );
    } catch (error: unknown) {
      console.error("Error creating survey:", error);
      const stack = getErrorStack(error);
      if (stack !== "") {
        console.error("Error stack:", stack);
      }
      res
        .status(500)
        .json(errorResponse("Fehler beim Erstellen der Umfrage", 500));
    }
  }),
);

// Create survey from template (admin only)
router.post(
  "/from-template/:templateId",
  ...security.admin(),
  checkFeature("surveys"),
  typed.params<{ templateId: string }>(async (req, res) => {
    try {
      const surveyId = await Survey.createFromTemplate(
        Number.parseInt(req.params.templateId, 10),
        req.user.tenant_id,
        req.user.id,
      );

      res.status(201).json(
        successResponse({
          id: surveyId,
          message: "Umfrage aus Vorlage erstellt",
        }),
      );
    } catch (error: unknown) {
      console.error("Error creating survey from template:", error);
      res
        .status(500)
        .json(
          errorResponse("Fehler beim Erstellen der Umfrage aus Vorlage", 500),
        );
    }
  }),
);

// Update survey (admin only)
router.put(
  "/:id",
  ...security.admin(validateUpdateSurvey),
  checkFeature("surveys"),
  typed.paramsBody<
    { id: string },
    {
      title?: string;
      description?: string;
      start_date?: string;
      end_date?: string;
      is_anonymous?: boolean;
      status?: "draft" | "active" | "closed";
    }
  >(async (req, res) => {
    try {
      const success = await Survey.update(
        Number.parseInt(req.params.id, 10),
        req.body,
        req.user.tenant_id,
      );

      if (!success) {
        res.status(404).json(errorResponse("Umfrage nicht gefunden", 404));
        return;
      }

      res.json(
        successResponse({ message: "Umfrage erfolgreich aktualisiert" }),
      );
    } catch (error: unknown) {
      console.error("Error updating survey:", error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Aktualisieren der Umfrage", 500));
    }
  }),
);

// Delete survey (admin only)
router.delete(
  "/:id",
  ...security.admin(),
  checkFeature("surveys"),
  typed.params<{ id: string }>(async (req, res) => {
    try {
      const success = await Survey.delete(
        Number.parseInt(req.params.id, 10),
        req.user.tenant_id,
      );

      if (!success) {
        res.status(404).json(errorResponse("Umfrage nicht gefunden", 404));
        return;
      }

      res.json(successResponse({ message: "Umfrage erfolgreich gelöscht" }));
    } catch (error: unknown) {
      console.error("Error deleting survey:", error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Löschen der Umfrage", 500));
    }
  }),
);

// Submit survey response
router.post(
  "/:id/responses",
  ...security.user(validateSurveyResponse),
  checkFeature("surveys"),
  typed.paramsBody<
    { id: string },
    {
      answers: {
        question_id: number;
        answer_text?: string;
        selected_option_id?: number;
        answer_options?: string;
        answer_number?: number;
        answer_date?: string;
      }[];
    }
  >(async (req, res) => {
    try {
      const surveyId = Number.parseInt(req.params.id);
      const userId = req.user.id;
      const answers = req.body.answers;

      console.info("Submitting response:", {
        surveyId,
        userId,
        userIdType: typeof userId,
        answersCount: answers.length,
        answers: JSON.stringify(answers, null, 2),
        tenantId: req.user.tenant_id,
      });

      // Check if survey exists and is active
      const survey = await Survey.getById(surveyId, req.user.tenant_id);
      if (!survey) {
        res.status(404).json(errorResponse("Umfrage nicht gefunden", 404));
        return;
      }

      if (survey.status !== "active") {
        res.status(400).json(errorResponse("Umfrage ist nicht aktiv", 400));
        return;
      }

      console.info(
        "Survey is_anonymous:",
        survey.is_anonymous,
        typeof survey.is_anonymous,
      );

      // Check if user already responded (unless anonymous)
      const isAnonymous =
        String(survey.is_anonymous) === "1" ||
        survey.is_anonymous === 1 ||
        survey.is_anonymous === true;

      if (!isAnonymous) {
        const [existing] = await execute<RowDataPacket[]>(
          "SELECT id FROM survey_responses WHERE survey_id = ? AND user_id = ?",
          [surveyId, userId],
        );

        if (existing.length > 0) {
          res
            .status(400)
            .json(
              errorResponse(
                "Sie haben bereits an dieser Umfrage teilgenommen",
                400,
              ),
            );
          return;
        }
      }

      // Create response
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();

        const [responseResult] = await connection.execute(
          `
        INSERT INTO survey_responses (tenant_id, survey_id, user_id, session_id)
        VALUES (?, ?, ?, ?)
      `,
          [
            req.user.tenant_id,
            surveyId,
            isAnonymous ? null : userId,
            isAnonymous
              ? `anon_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
              : null,
          ],
        );

        const responseId = (responseResult as ResultSetHeader).insertId;

        // Save answers
        for (const answer of answers) {
          console.info("Saving answer:", {
            tenant_id: req.user.tenant_id,
            response_id: responseId,
            question_id: answer.question_id,
            answer_text: answer.answer_text ?? null,
            answer_options:
              answer.answer_options != null && answer.answer_options !== ""
                ? JSON.stringify(answer.answer_options)
                : null,
            answer_number: answer.answer_number ?? null,
            answer_date: answer.answer_date ?? null,
          });

          await connection.execute(
            `
          INSERT INTO survey_answers (
            tenant_id, response_id, question_id, answer_text, answer_options,
            answer_number, answer_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
            [
              req.user.tenant_id,
              responseId,
              answer.question_id,
              answer.answer_text ?? null,
              answer.answer_options != null && answer.answer_options !== ""
                ? JSON.stringify(answer.answer_options)
                : null,
              answer.answer_number ?? null,
              answer.answer_date ?? null,
            ],
          );
        }

        // Mark response as complete
        await connection.execute(
          "UPDATE survey_responses SET status = 'completed', completed_at = NOW() WHERE id = ?",
          [responseId],
        );

        await connection.commit();
        console.info(
          `Response ${responseId} saved successfully for user ${userId} on survey ${surveyId}`,
        );
        res.json(
          successResponse({
            message: "Antworten erfolgreich gespeichert",
            responseId,
          }),
        );
      } catch (error: unknown) {
        await connection.rollback();
        console.error("Error in transaction:", error);
        throw error;
      } finally {
        connection.release();
      }
    } catch (error: unknown) {
      console.error("Error submitting response:", error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Speichern der Antworten", 500));
    }
  }),
);

// Get user's response to a survey
router.get(
  "/:id/my-response",
  ...security.user(),
  checkFeature("surveys"),
  typed.params<{ id: string }>(async (req, res) => {
    try {
      const surveyId = Number.parseInt(req.params.id);
      const userId = req.user.id;

      console.info(
        `Checking response for survey ${surveyId} and user ${userId}`,
      );

      const [responses] = await execute<RowDataPacket[]>(
        `
      SELECT sr.*, sa.question_id, sa.answer_text, sa.answer_options,
             sa.answer_number, sa.answer_date
      FROM survey_responses sr
      LEFT JOIN survey_answers sa ON sr.id = sa.response_id
      WHERE sr.survey_id = ? AND sr.user_id = ?
    `,
        [surveyId, userId],
      );

      console.info(
        `Found ${responses.length} responses for user ${userId} on survey ${surveyId}`,
      );

      if (responses.length === 0) {
        res.json(successResponse({ responded: false }));
        return;
      }

      res.json(
        successResponse({
          responded: true,
          response: {
            id: responses[0].id as number,
            completed_at: responses[0].completed_at as Date,
            answers: responses.map((r) => ({
              question_id: r.question_id as number,
              answer_text:
                r.answer_text != null && Buffer.isBuffer(r.answer_text)
                  ? r.answer_text.toString()
                  : (r.answer_text as string | null),
              answer_options: r.answer_options as string | null,
              answer_number: r.answer_number as number | null,
              answer_date: r.answer_date as Date | null,
            })),
          },
        }),
      );
    } catch (error: unknown) {
      console.error("Error fetching user response:", error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Abrufen der Antwort", 500));
    }
  }),
);

// Export survey results to Excel - with rate limiting
router.get(
  "/:id/export",
  ...security.admin(),
  rateLimiter.api,
  checkFeature("surveys"),
  typed.params<{ id: string }>(async (req, res) => {
    try {
      const surveyId = Number.parseInt(req.params.id, 10);
      const format =
        req.query.format != null && req.query.format !== ""
          ? typeof req.query.format === "string"
            ? req.query.format
            : typeof req.query.format === "object"
              ? JSON.stringify(req.query.format)
              : String(req.query.format)
          : "excel";

      // Get survey with all responses
      const survey = await Survey.getById(surveyId, req.user.tenant_id);
      if (!survey) {
        res.status(404).json(errorResponse("Umfrage nicht gefunden", 404));
        return;
      }

      // Get statistics with all responses
      const statistics = await Survey.getStatistics(
        surveyId,
        req.user.tenant_id,
      );

      if (format === "excel") {
        // Create Excel export
        const ExcelJS = await import("exceljs");
        const workbook = new ExcelJS.default.Workbook();

        // Summary sheet
        const summarySheet = workbook.addWorksheet("Zusammenfassung");
        summarySheet.columns = [
          { header: "Eigenschaft", key: "property", width: 30 },
          { header: "Wert", key: "value", width: 50 },
        ];

        summarySheet.addRows([
          { property: "Umfrage-Titel", value: survey.title },
          {
            property: "Erstellt am",
            value: new Date(survey.created_at).toLocaleDateString("de-DE"),
          },
          {
            property: "Endet am",
            value: survey.end_date
              ? new Date(survey.end_date).toLocaleDateString("de-DE")
              : "N/A",
          },
          { property: "Status", value: survey.status },
          {
            property: "Anonym",
            value: survey.is_anonymous === true ? "Ja" : "Nein",
          },
          {
            property: "Anzahl Antworten",
            value: statistics.total_responses,
          },
          {
            property: "Abschlussrate",
            value: `${statistics.completed_responses} von ${statistics.total_responses}`,
          },
        ]);

        // Questions sheet
        const questionsSheet = workbook.addWorksheet("Fragen & Antworten");

        // Add headers based on question types
        const headers = ["Frage", "Typ", "Antworten"];
        questionsSheet.addRow(headers);

        // Add question results
        if (survey.questions) {
          for (const question of survey.questions) {
            const row = [
              question.question_text,
              question.question_type,
              "Siehe Details unten",
            ];
            questionsSheet.addRow(row);

            // Get responses for this question
            const [responses] = await execute<RowDataPacket[]>(
              `SELECT sa.*, u.first_name, u.last_name
             FROM survey_answers sa
             LEFT JOIN survey_responses sr ON sa.response_id = sr.id
             LEFT JOIN users u ON sr.user_id = u.id
             WHERE sa.question_id = ?`,
              [question.id],
            );

            // Add details based on question type
            if (
              ["single_choice", "multiple_choice"].includes(
                question.question_type,
              ) &&
              question.options
            ) {
              // Count responses per option
              const optionCounts: Record<number, number> = {};
              question.options.forEach((opt) => {
                optionCounts[opt.id] = 0;
              });

              responses.forEach((resp) => {
                // Parse answer_options if it's stored as JSON
                if (resp.answer_options != null) {
                  try {
                    const selectedOptions = JSON.parse(
                      resp.answer_options as string,
                    ) as number[];
                    selectedOptions.forEach((optionId: number) => {
                      if (optionId in optionCounts) {
                        optionCounts[optionId]++;
                      }
                    });
                  } catch {
                    // Handle non-JSON or invalid data
                  }
                }
              });

              question.options.forEach((option) => {
                const count = optionCounts[option.id] ?? 0;
                const percentage =
                  responses.length > 0
                    ? Math.round((count / responses.length) * 100)
                    : 0;
                questionsSheet.addRow([
                  "",
                  option.option_text,
                  `${count} (${percentage}%)`,
                ]);
              });
            } else if (question.question_type === "text") {
              responses.forEach((response) => {
                questionsSheet.addRow([
                  "",
                  survey.is_anonymous === true
                    ? "Anonym"
                    : `${String(response.first_name ?? "")} ${String(response.last_name ?? "")}`.trim() ||
                      "N/A",
                  response.answer_text ?? "",
                ]);
              });
            } else if (
              question.question_type === "number" ||
              question.question_type === "rating"
            ) {
              const numbers = responses
                .map((r) => r.answer_number as number | null | undefined)
                .filter((n): n is number => n !== null && n !== undefined);
              if (numbers.length > 0) {
                const avg =
                  numbers.reduce((a: number, b: number) => a + b, 0) /
                  numbers.length;
                const min = Math.min(...numbers);
                const max = Math.max(...numbers);
                questionsSheet.addRow(["", "Durchschnitt", avg.toFixed(2)]);
                questionsSheet.addRow(["", "Min/Max", `${min} / ${max}`]);
              }
            }

            // Add empty row for spacing
            questionsSheet.addRow([]);
          }
        }

        // Set response headers
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=umfrage_${surveyId}_export.xlsx`,
        );

        // Write to response
        await workbook.xlsx.write(res);
        res.end();
      } else {
        res.status(400).json(errorResponse("Nicht unterstütztes Format", 400));
      }
    } catch (error: unknown) {
      console.error("Error exporting survey:", error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Exportieren der Umfrage", 500));
    }
  }),
);

export default router;

// CommonJS compatibility
