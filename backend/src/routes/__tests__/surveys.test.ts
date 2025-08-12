/**
 * API Tests for Survey Endpoints
 * Tests survey CRUD operations, responses, analytics, and templates
 */

import request from "supertest";
import { Pool } from "mysql2/promise";
import app from "../../app";
import {
  createTestDatabase,
  cleanupTestData,
  createTestTenant,
  createTestUser,
  createTestDepartment,
  createTestTeam,
  getAuthToken,
} from "../mocks/database";
import { asTestRows } from "../../__tests__/mocks/db-types";

describe("Survey API Endpoints", () => {
  let testDb: Pool;
  let tenant1Id: number;
  let tenant2Id: number;
  let dept1Id: number;
  let team1Id: number;
  let adminToken1: string;
  let adminToken2: string;
  let employeeToken1: string;
  let employeeToken2: string;
  let adminUser1: any;
  let employeeUser1: any;
  let employeeUser2: any;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    process.env.JWT_SECRET = "test-secret-key-for-survey-tests";

    // Create test tenants
    tenant1Id = await createTestTenant(
      testDb,
      "surveytest1",
      "Survey Test Company 1",
    );
    tenant2Id = await createTestTenant(
      testDb,
      "surveytest2",
      "Survey Test Company 2",
    );

    // Create department and team
    dept1Id = await createTestDepartment(testDb, tenant1Id, "Engineering");
    team1Id = await createTestTeam(testDb, tenant1Id, dept1Id, "Frontend Team");

    // Create test users
    adminUser1 = await createTestUser(testDb, {
      username: "surveyadmin1",
      email: "admin1@surveytest1.de",
      password: "AdminPass123!",
      role: "admin",
      tenant_id: tenant1Id,
      first_name: "Admin",
      last_name: "One",
    });

    await createTestUser(testDb, {
      username: "surveyadmin2",
      email: "admin2@surveytest2.de",
      password: "AdminPass123!",
      role: "admin",
      tenant_id: tenant2Id,
      first_name: "Admin",
      last_name: "Two",
    });

    employeeUser1 = await createTestUser(testDb, {
      username: "surveyemployee1",
      email: "employee1@surveytest1.de",
      password: "EmpPass123!",
      role: "employee",
      tenant_id: tenant1Id,
      department_id: dept1Id,
      team_id: team1Id,
      first_name: "Employee",
      last_name: "One",
    });

    employeeUser2 = await createTestUser(testDb, {
      username: "surveyemployee2",
      email: "employee2@surveytest1.de",
      password: "EmpPass123!",
      role: "employee",
      tenant_id: tenant1Id,
      department_id: dept1Id,
      team_id: team1Id,
      first_name: "Employee",
      last_name: "Two",
    });

    // Get auth tokens
    adminToken1 = await getAuthToken(app, "surveyadmin1", "AdminPass123!");
    adminToken2 = await getAuthToken(app, "surveyadmin2", "AdminPass123!");
    employeeToken1 = await getAuthToken(app, "surveyemployee1", "EmpPass123!");
    employeeToken2 = await getAuthToken(app, "surveyemployee2", "EmpPass123!");
  });

  afterAll(async () => {
    await cleanupTestData();
    await testDb.end();
  });

  beforeEach(async () => {
    // Clear survey data before each test
    await testDb.execute("DELETE FROM survey_responses WHERE tenant_id > 1");
    await testDb.execute("DELETE FROM survey_questions WHERE tenant_id > 1");
    await testDb.execute("DELETE FROM surveys WHERE tenant_id > 1");
  });

  describe("POST /api/surveys", () => {
    const validSurveyData = {
      title: "Employee Satisfaction Survey",
      description: "Quarterly employee satisfaction assessment",
      type: "feedback",
      visibility_scope: "company",
      start_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      is_anonymous: true,
      questions: [
        {
          question_text: "How satisfied are you with your current role?",
          question_type: "scale",
          required: true,
          order_position: 1,
          options: {
            min: 1,
            max: 10,
            min_label: "Very Unsatisfied",
            max_label: "Very Satisfied",
          },
        },
        {
          question_text: "What aspects of your job do you enjoy most?",
          question_type: "text",
          required: true,
          order_position: 2,
          options: {
            max_length: 500,
          },
        },
        {
          question_text: "Which benefits are most important to you?",
          question_type: "multiple_choice",
          required: true,
          order_position: 3,
          options: {
            choices: [
              "Health Insurance",
              "Retirement Plan",
              "Flexible Hours",
              "Remote Work",
              "Professional Development",
            ],
            allow_multiple: true,
            max_selections: 3,
          },
        },
      ],
    };

    it("should create survey for admin", async () => {
      const response = await request(app)
        .post("/api/surveys")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send(validSurveyData);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining("erfolgreich erstellt"),
      });
      expect(response.body.data.surveyId).toBeDefined();

      // Verify survey creation
      const [rows] = await testDb.execute(
        "SELECT * FROM surveys WHERE id = ?",
        [response.body.data.surveyId],
      );
      const surveys = asTestRows<unknown>(rows);
      expect(surveys[0]).toMatchObject({
        title: validSurveyData.title,
        description: validSurveyData.description,
        type: validSurveyData.type,
        visibility_scope: validSurveyData.visibility_scope,
        is_anonymous: 1,
        tenant_id: tenant1Id,
        created_by: adminUser1.id,
      });

      // Verify questions were created
      const [rows] = await testDb.execute(
        "SELECT * FROM survey_questions WHERE survey_id = ? ORDER BY order_position",
        [response.body.data.surveyId],
      );
      const questions = asTestRows<unknown>(rows);
      expect(questions.length).toBe(3);
    });

    it("should create department-specific survey", async () => {
      const response = await request(app)
        .post("/api/surveys")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          ...validSurveyData,
          title: "Engineering Department Survey",
          visibility_scope: "department",
          target_id: dept1Id,
        });

      expect(response.status).toBe(201);

      const [rows] = await testDb.execute(
        "SELECT visibility_scope, target_id FROM surveys WHERE id = ?",
        [response.body.data.surveyId],
      );
      const surveys = asTestRows<unknown>(rows);
      expect(surveys[0].visibility_scope).toBe("department");
      expect(surveys[0].target_id).toBe(dept1Id);
    });

    it("should create team-specific survey", async () => {
      const response = await request(app)
        .post("/api/surveys")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          ...validSurveyData,
          title: "Frontend Team Survey",
          visibility_scope: "team",
          target_id: team1Id,
        });

      expect(response.status).toBe(201);
    });

    it("should create poll with single question", async () => {
      const pollData = {
        title: "Office Location Preference",
        description: "Quick poll about office location",
        type: "poll",
        visibility_scope: "company",
        is_anonymous: false,
        questions: [
          {
            question_text: "Which office location do you prefer?",
            question_type: "single_choice",
            required: true,
            order_position: 1,
            options: {
              choices: ["Downtown", "Suburbs", "Remote Only"],
            },
          },
        ],
      };

      const response = await request(app)
        .post("/api/surveys")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send(pollData);

      expect(response.status).toBe(201);
    });

    it("should validate required fields", async () => {
      const response = await request(app)
        .post("/api/surveys")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          description: "Missing title",
          questions: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "title" }),
          expect.objectContaining({ path: "questions" }),
        ]),
      );
    });

    it("should validate date range", async () => {
      const response = await request(app)
        .post("/api/surveys")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          ...validSurveyData,
          start_date: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
          end_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // End before start
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Enddatum");
    });

    it("should validate question types", async () => {
      const response = await request(app)
        .post("/api/surveys")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          ...validSurveyData,
          questions: [
            {
              question_text: "Invalid question",
              question_type: "invalid_type",
              required: true,
              order_position: 1,
            },
          ],
        });

      expect(response.status).toBe(400);
    });

    it("should create survey with conditional logic", async () => {
      const surveyWithLogic = {
        ...validSurveyData,
        questions: [
          {
            question_text: "Do you work remotely?",
            question_type: "yes_no",
            required: true,
            order_position: 1,
            id: "remote_work",
          },
          {
            question_text: "How often do you visit the office?",
            question_type: "single_choice",
            required: true,
            order_position: 2,
            conditional_logic: {
              show_if: {
                question_id: "remote_work",
                operator: "equals",
                value: "yes",
              },
            },
            options: {
              choices: ["Daily", "Weekly", "Monthly", "Rarely"],
            },
          },
        ],
      };

      const response = await request(app)
        .post("/api/surveys")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send(surveyWithLogic);

      expect(response.status).toBe(201);
    });

    it("should deny survey creation by employees", async () => {
      const response = await request(app)
        .post("/api/surveys")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send(validSurveyData);

      expect(response.status).toBe(403);
    });

    it("should create survey from template", async () => {
      // First create a template
      const [rows] = await testDb.execute(
        `INSERT INTO survey_templates 
        (name, description, template_data, tenant_id) 
        VALUES (?, ?, ?, ?)`,
        [
          "Employee Onboarding",
          "Standard onboarding survey",
          JSON.stringify(validSurveyData),
          tenant1Id,
        ],
      );
      const result = asTestRows<unknown>(rows);
      const templateId = (result as any).insertId;

      const response = await request(app)
        .post("/api/surveys")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          template_id: templateId,
          title: "Q1 2025 Onboarding Survey",
          start_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          end_date: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        });

      expect(response.status).toBe(201);
    });
  });

  describe("GET /api/surveys", () => {
    let activeSurveyId: number;
    let draftSurveyId: number;
    let completedSurveyId: number;
    let deptSurveyId: number;

    beforeEach(async () => {
      // Create test surveys
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Active survey
      const [rows] = await testDb.execute(
        `INSERT INTO surveys 
        (title, type, visibility_scope, status, start_date, end_date, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "Active Survey",
          "feedback",
          "company",
          "active",
          yesterday,
          nextWeek,
          adminUser1.id,
          tenant1Id,
        ],
      );
      const result1 = asTestRows<unknown>(rows);
      activeSurveyId = (result1 as any).insertId;

      // Draft survey
      const [rows] = await testDb.execute(
        `INSERT INTO surveys 
        (title, type, visibility_scope, status, start_date, end_date, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "Draft Survey",
          "assessment",
          "company",
          "draft",
          tomorrow,
          nextWeek,
          adminUser1.id,
          tenant1Id,
        ],
      );
      const result2 = asTestRows<unknown>(rows);
      draftSurveyId = (result2 as any).insertId;

      // Completed survey
      const [rows] = await testDb.execute(
        `INSERT INTO surveys 
        (title, type, visibility_scope, status, start_date, end_date, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "Completed Survey",
          "poll",
          "company",
          "completed",
          lastWeek,
          yesterday,
          adminUser1.id,
          tenant1Id,
        ],
      );
      const result3 = asTestRows<unknown>(rows);
      completedSurveyId = (result3 as any).insertId;

      // Department survey
      const [rows] = await testDb.execute(
        `INSERT INTO surveys 
        (title, type, visibility_scope, target_id, status, start_date, end_date, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "Engineering Survey",
          "feedback",
          "department",
          dept1Id,
          "active",
          yesterday,
          nextWeek,
          adminUser1.id,
          tenant1Id,
        ],
      );
      const result4 = asTestRows<unknown>(rows);
      deptSurveyId = (result4 as any).insertId;
    });

    it("should list surveys for admin", async () => {
      const response = await request(app)
        .get("/api/surveys")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.surveys).toBeDefined();
      expect(response.body.data.surveys.length).toBeGreaterThanOrEqual(4);
      expect(response.body.data.pagination).toBeDefined();
    });

    it("should list only active surveys for employees", async () => {
      const response = await request(app)
        .get("/api/surveys")
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      const surveys = response.body.data.surveys;

      // Employees should see active surveys they have access to
      expect(surveys.some((s) => s.id === activeSurveyId)).toBe(true);
      expect(surveys.some((s) => s.id === draftSurveyId)).toBe(false);
      expect(surveys.some((s) => s.id === deptSurveyId)).toBe(true); // In engineering dept
    });

    it("should filter by status", async () => {
      const response = await request(app)
        .get("/api/surveys?status=active")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      const surveys = response.body.data.surveys;
      expect(surveys.every((s) => s.status === "active")).toBe(true);
    });

    it("should filter by type", async () => {
      const response = await request(app)
        .get("/api/surveys?type=feedback")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      const surveys = response.body.data.surveys;
      expect(surveys.every((s) => s.type === "feedback")).toBe(true);
    });

    it("should include response statistics", async () => {
      // Add some responses
      await testDb.execute(
        `INSERT INTO survey_responses 
        (survey_id, user_id, completed_at, tenant_id) 
        VALUES (?, ?, NOW(), ?), (?, ?, NOW(), ?)`,
        [
          activeSurveyId,
          employeeUser1.id,
          tenant1Id,
          activeSurveyId,
          employeeUser2.id,
          tenant1Id,
        ],
      );

      const response = await request(app)
        .get("/api/surveys?include=stats")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      const activeSurvey = response.body.data.surveys.find(
        (s) => s.id === activeSurveyId,
      );
      expect(activeSurvey.stats).toMatchObject({
        total_responses: 2,
        completion_rate: expect.any(Number),
      });
    });

    it("should show user response status", async () => {
      // Add user response
      await testDb.execute(
        `INSERT INTO survey_responses 
        (survey_id, user_id, completed_at, tenant_id) 
        VALUES (?, ?, NOW(), ?)`,
        [activeSurveyId, employeeUser1.id, tenant1Id],
      );

      const response = await request(app)
        .get("/api/surveys?include=user_status")
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      const activeSurvey = response.body.data.surveys.find(
        (s) => s.id === activeSurveyId,
      );
      expect(activeSurvey.user_has_responded).toBe(true);
    });

    it("should enforce tenant isolation", async () => {
      const response = await request(app)
        .get("/api/surveys")
        .set("Authorization", `Bearer ${adminToken2}`);

      expect(response.status).toBe(200);
      const surveys = response.body.data.surveys;
      expect(surveys.every((s) => s.tenant_id !== tenant1Id)).toBe(true);
    });

    it("should search surveys", async () => {
      const response = await request(app)
        .get("/api/surveys?search=engineering")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      const surveys = response.body.data.surveys;
      expect(
        surveys.some((s) => s.title.toLowerCase().includes("engineering")),
      ).toBe(true);
    });
  });

  describe("GET /api/surveys/:id", () => {
    let surveyId: number;
    let questionIds: number[] = [];

    beforeEach(async () => {
      // Create survey with questions
      const [rows] = await testDb.execute(
        `INSERT INTO surveys 
        (title, description, type, visibility_scope, status, start_date, end_date, is_anonymous, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "Detailed Survey",
          "Test survey with questions",
          "feedback",
          "company",
          "active",
          new Date(),
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          1,
          adminUser1.id,
          tenant1Id,
        ],
      );
      const surveyResult = asTestRows<unknown>(rows);
      surveyId = (surveyResult as any).insertId;

      // Add questions
      const questions = [
        {
          text: "Rate your satisfaction",
          type: "scale",
          required: true,
          order: 1,
          options: { min: 1, max: 5 },
        },
        {
          text: "Comments",
          type: "text",
          required: false,
          order: 2,
          options: { max_length: 500 },
        },
      ];

      for (const q of questions) {
        const [rows] = await testDb.execute(
          `INSERT INTO survey_questions 
          (survey_id, question_text, question_type, required, order_position, options, tenant_id) 
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            surveyId,
            q.text,
            q.type,
            q.required,
            q.order,
            JSON.stringify(q.options),
            tenant1Id,
          ],
        );
        const result = asTestRows<unknown>(rows);
        questionIds.push((result as any).insertId);
      }
    });

    it("should get survey details with questions", async () => {
      const response = await request(app)
        .get(`/api/surveys/${surveyId}`)
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        id: surveyId,
        title: "Detailed Survey",
        description: "Test survey with questions",
        type: "feedback",
        is_anonymous: true,
        questions: expect.arrayContaining([
          expect.objectContaining({
            question_text: "Rate your satisfaction",
            question_type: "scale",
            required: true,
          }),
        ]),
      });
      expect(response.body.data.questions.length).toBe(2);
    });

    it("should include user response if exists", async () => {
      // Add user response
      const [rows] = await testDb.execute(
        `INSERT INTO survey_responses 
        (survey_id, user_id, started_at, tenant_id) 
        VALUES (?, ?, NOW(), ?)`,
        [surveyId, employeeUser1.id, tenant1Id],
      );
      const responseResult = asTestRows<unknown>(rows);
      const responseId = (responseResult as any).insertId;

      // Add answer
      await testDb.execute(
        `INSERT INTO survey_answers 
        (response_id, question_id, answer_value, tenant_id) 
        VALUES (?, ?, ?, ?)`,
        [responseId, questionIds[0], JSON.stringify({ value: 4 }), tenant1Id],
      );

      const response = await request(app)
        .get(`/api/surveys/${surveyId}?include=user_response`)
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.user_response).toBeDefined();
      expect(response.body.data.user_response.answers).toBeDefined();
    });

    it("should return 404 for non-existent survey", async () => {
      const response = await request(app)
        .get("/api/surveys/99999")
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(404);
    });

    it("should enforce visibility rules", async () => {
      // Create team-specific survey
      const [rows] = await testDb.execute(
        `INSERT INTO surveys 
        (title, type, visibility_scope, target_id, status, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "Team Survey",
          "poll",
          "team",
          99999,
          "active",
          adminUser1.id,
          tenant1Id,
        ],
      );
      const result = asTestRows<unknown>(rows);
      const teamSurveyId = (result as any).insertId;

      const response = await request(app)
        .get(`/api/surveys/${teamSurveyId}`)
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(404); // Not in that team
    });

    it("should allow admin to view any survey", async () => {
      // Create draft survey
      const [rows] = await testDb.execute(
        `INSERT INTO surveys 
        (title, type, visibility_scope, status, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          "Admin Only",
          "assessment",
          "company",
          "draft",
          adminUser1.id,
          tenant1Id,
        ],
      );
      const result = asTestRows<unknown>(rows);
      const draftId = (result as any).insertId;

      const response = await request(app)
        .get(`/api/surveys/${draftId}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
    });
  });

  describe("POST /api/surveys/:id/responses", () => {
    let surveyId: number;
    let scaleQuestionId: number;
    let textQuestionId: number;
    let choiceQuestionId: number;

    beforeEach(async () => {
      // Create survey
      const [rows] = await testDb.execute(
        `INSERT INTO surveys 
        (title, type, visibility_scope, status, start_date, end_date, is_anonymous, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "Response Test Survey",
          "feedback",
          "company",
          "active",
          new Date(Date.now() - 24 * 60 * 60 * 1000),
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          0,
          adminUser1.id,
          tenant1Id,
        ],
      );
      const surveyResult = asTestRows<unknown>(rows);
      surveyId = (surveyResult as any).insertId;

      // Add questions
      const [rows] = await testDb.execute(
        `INSERT INTO survey_questions 
        (survey_id, question_text, question_type, required, order_position, options, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          surveyId,
          "Rate satisfaction",
          "scale",
          1,
          1,
          JSON.stringify({ min: 1, max: 5 }),
          tenant1Id,
        ],
      );
      const q1 = asTestRows<unknown>(rows);
      scaleQuestionId = (q1 as any).insertId;

      const [rows] = await testDb.execute(
        `INSERT INTO survey_questions 
        (survey_id, question_text, question_type, required, order_position, options, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          surveyId,
          "Additional comments",
          "text",
          0,
          2,
          JSON.stringify({ max_length: 500 }),
          tenant1Id,
        ],
      );
      const q2 = asTestRows<unknown>(rows);
      textQuestionId = (q2 as any).insertId;

      const [rows] = await testDb.execute(
        `INSERT INTO survey_questions 
        (survey_id, question_text, question_type, required, order_position, options, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          surveyId,
          "Preferred benefits",
          "multiple_choice",
          1,
          3,
          JSON.stringify({
            choices: ["Health", "Dental", "Vision", "401k"],
            allow_multiple: true,
            max_selections: 2,
          }),
          tenant1Id,
        ],
      );
      const q3 = asTestRows<unknown>(rows);
      choiceQuestionId = (q3 as any).insertId;
    });

    it("should submit survey response", async () => {
      const responseData = {
        answers: [
          {
            question_id: scaleQuestionId,
            value: 4,
          },
          {
            question_id: textQuestionId,
            value: "Great experience overall",
          },
          {
            question_id: choiceQuestionId,
            value: ["Health", "401k"],
          },
        ],
      };

      const response = await request(app)
        .post(`/api/surveys/${surveyId}/responses`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send(responseData);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining("erfolgreich abgesendet"),
      });
      expect(response.body.data.responseId).toBeDefined();

      // Verify response was saved
      const [rows] = await testDb.execute(
        "SELECT * FROM survey_responses WHERE id = ?",
        [response.body.data.responseId],
      );
      const responses = asTestRows<unknown>(rows);
      expect(responses[0]).toMatchObject({
        survey_id: surveyId,
        user_id: employeeUser1.id,
        tenant_id: tenant1Id,
      });
      expect(responses[0].completed_at).toBeTruthy();

      // Verify answers were saved
      const [rows] = await testDb.execute(
        "SELECT * FROM survey_answers WHERE response_id = ?",
        [response.body.data.responseId],
      );
      const answers = asTestRows<unknown>(rows);
      expect(answers.length).toBe(3);
    });

    it("should save partial response", async () => {
      const partialData = {
        answers: [
          {
            question_id: scaleQuestionId,
            value: 3,
          },
        ],
        is_partial: true,
      };

      const response = await request(app)
        .post(`/api/surveys/${surveyId}/responses`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send(partialData);

      expect(response.status).toBe(201);

      // Verify partial save
      const [rows] = await testDb.execute(
        "SELECT completed_at FROM survey_responses WHERE id = ?",
        [response.body.data.responseId],
      );
      const responses = asTestRows<unknown>(rows);
      expect(responses[0].completed_at).toBeNull();
    });

    it("should update existing response", async () => {
      // Create initial response
      const [rows] = await testDb.execute(
        `INSERT INTO survey_responses 
        (survey_id, user_id, started_at, tenant_id) 
        VALUES (?, ?, NOW(), ?)`,
        [surveyId, employeeUser1.id, tenant1Id],
      );
      const responseResult = asTestRows<unknown>(rows);
      const responseId = (responseResult as any).insertId;

      // Add initial answer
      await testDb.execute(
        `INSERT INTO survey_answers 
        (response_id, question_id, answer_value, tenant_id) 
        VALUES (?, ?, ?, ?)`,
        [responseId, scaleQuestionId, JSON.stringify({ value: 3 }), tenant1Id],
      );

      // Update response
      const updateData = {
        response_id: responseId,
        answers: [
          {
            question_id: scaleQuestionId,
            value: 5, // Changed from 3 to 5
          },
          {
            question_id: textQuestionId,
            value: "Updated comment",
          },
        ],
      };

      const response = await request(app)
        .post(`/api/surveys/${surveyId}/responses`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send(updateData);

      expect(response.status).toBe(201);
    });

    it("should validate required questions", async () => {
      const incompleteData = {
        answers: [
          {
            question_id: textQuestionId,
            value: "Only optional question answered",
          },
          // Missing required scale and choice questions
        ],
      };

      const response = await request(app)
        .post(`/api/surveys/${surveyId}/responses`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send(incompleteData);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Pflichtfragen");
    });

    it("should validate answer formats", async () => {
      const invalidData = {
        answers: [
          {
            question_id: scaleQuestionId,
            value: 10, // Out of range (max is 5)
          },
          {
            question_id: choiceQuestionId,
            value: ["Health", "Dental", "Vision"], // Too many selections (max 2)
          },
        ],
      };

      const response = await request(app)
        .post(`/api/surveys/${surveyId}/responses`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send(invalidData);

      expect(response.status).toBe(400);
    });

    it("should prevent duplicate responses", async () => {
      // Submit first response
      await request(app)
        .post(`/api/surveys/${surveyId}/responses`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({
          answers: [
            { question_id: scaleQuestionId, value: 4 },
            { question_id: choiceQuestionId, value: ["Health"] },
          ],
        });

      // Try to submit again
      const response = await request(app)
        .post(`/api/surveys/${surveyId}/responses`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({
          answers: [
            { question_id: scaleQuestionId, value: 5 },
            { question_id: choiceQuestionId, value: ["Dental"] },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("bereits teilgenommen");
    });

    it("should handle anonymous surveys", async () => {
      // Create anonymous survey
      const [rows] = await testDb.execute(
        `INSERT INTO surveys 
        (title, type, visibility_scope, status, is_anonymous, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "Anonymous Survey",
          "feedback",
          "company",
          "active",
          1,
          adminUser1.id,
          tenant1Id,
        ],
      );
      const anonResult = asTestRows<unknown>(rows);
      const anonSurveyId = (anonResult as any).insertId;

      // Add question
      const [rows] = await testDb.execute(
        `INSERT INTO survey_questions 
        (survey_id, question_text, question_type, required, order_position, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [anonSurveyId, "Anonymous feedback", "text", 1, 1, tenant1Id],
      );
      const qResult = asTestRows<unknown>(rows);
      const questionId = (qResult as any).insertId;

      const response = await request(app)
        .post(`/api/surveys/${anonSurveyId}/responses`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({
          answers: [
            {
              question_id: questionId,
              value: "This is anonymous feedback",
            },
          ],
        });

      expect(response.status).toBe(201);

      // Verify anonymity
      const [rows] = await testDb.execute(
        "SELECT user_id, is_anonymous FROM survey_responses WHERE survey_id = ?",
        [anonSurveyId],
      );
      const responses = asTestRows<unknown>(rows);
      expect(responses[0].is_anonymous).toBe(1);
      // User ID might still be stored but marked as anonymous
    });

    it("should enforce survey dates", async () => {
      // Create expired survey
      const [rows] = await testDb.execute(
        `INSERT INTO surveys 
        (title, type, visibility_scope, status, start_date, end_date, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "Expired Survey",
          "poll",
          "company",
          "active",
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          new Date(Date.now() - 24 * 60 * 60 * 1000),
          adminUser1.id,
          tenant1Id,
        ],
      );
      const expiredResult = asTestRows<unknown>(rows);
      const expiredId = (expiredResult as any).insertId;

      const response = await request(app)
        .post(`/api/surveys/${expiredId}/responses`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({ answers: [] });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("abgelaufen");
    });
  });

  describe("GET /api/surveys/:id/results", () => {
    let surveyId: number;
    let scaleQuestionId: number;
    let choiceQuestionId: number;

    beforeEach(async () => {
      // Create survey
      const [rows] = await testDb.execute(
        `INSERT INTO surveys 
        (title, type, visibility_scope, status, is_anonymous, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "Results Test Survey",
          "feedback",
          "company",
          "active",
          0,
          adminUser1.id,
          tenant1Id,
        ],
      );
      const surveyResult = asTestRows<unknown>(rows);
      surveyId = (surveyResult as any).insertId;

      // Add questions
      const [rows] = await testDb.execute(
        `INSERT INTO survey_questions 
        (survey_id, question_text, question_type, required, order_position, options, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          surveyId,
          "Satisfaction",
          "scale",
          1,
          1,
          JSON.stringify({ min: 1, max: 5 }),
          tenant1Id,
        ],
      );
      const q1 = asTestRows<unknown>(rows);
      scaleQuestionId = (q1 as any).insertId;

      const [rows] = await testDb.execute(
        `INSERT INTO survey_questions 
        (survey_id, question_text, question_type, required, order_position, options, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          surveyId,
          "Department",
          "single_choice",
          1,
          2,
          JSON.stringify({
            choices: ["Engineering", "Sales", "Marketing", "HR"],
          }),
          tenant1Id,
        ],
      );
      const q2 = asTestRows<unknown>(rows);
      choiceQuestionId = (q2 as any).insertId;

      // Add responses
      const users = [employeeUser1, employeeUser2];
      const ratings = [4, 5];
      const departments = ["Engineering", "Engineering"];

      for (let i = 0; i < users.length; i++) {
        const [rows] = await testDb.execute(
          `INSERT INTO survey_responses 
          (survey_id, user_id, completed_at, tenant_id) 
          VALUES (?, ?, NOW(), ?)`,
          [surveyId, users[i].id, tenant1Id],
        );
        const responseResult = asTestRows<unknown>(rows);
        const responseId = (responseResult as any).insertId;

        await testDb.execute(
          `INSERT INTO survey_answers 
          (response_id, question_id, answer_value, tenant_id) 
          VALUES (?, ?, ?, ?), (?, ?, ?, ?)`,
          [
            responseId,
            scaleQuestionId,
            JSON.stringify({ value: ratings[i] }),
            tenant1Id,
            responseId,
            choiceQuestionId,
            JSON.stringify({ value: departments[i] }),
            tenant1Id,
          ],
        );
      }
    });

    it("should get survey results for admin", async () => {
      const response = await request(app)
        .get(`/api/surveys/${surveyId}/results`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        survey: expect.objectContaining({
          id: surveyId,
          title: "Results Test Survey",
        }),
        summary: expect.objectContaining({
          total_responses: 2,
          completion_rate: expect.any(Number),
        }),
        questions: expect.arrayContaining([
          expect.objectContaining({
            id: scaleQuestionId,
            question_text: "Satisfaction",
            results: expect.objectContaining({
              average: 4.5,
              distribution: expect.any(Object),
            }),
          }),
        ]),
      });
    });

    it("should aggregate scale question results", async () => {
      const response = await request(app)
        .get(`/api/surveys/${surveyId}/results`)
        .set("Authorization", `Bearer ${adminToken1}`);

      const scaleQuestion = response.body.data.questions.find(
        (q) => q.id === scaleQuestionId,
      );
      expect(scaleQuestion.results).toMatchObject({
        average: 4.5,
        median: expect.any(Number),
        distribution: expect.objectContaining({
          "4": 1,
          "5": 1,
        }),
      });
    });

    it("should aggregate choice question results", async () => {
      const response = await request(app)
        .get(`/api/surveys/${surveyId}/results`)
        .set("Authorization", `Bearer ${adminToken1}`);

      const choiceQuestion = response.body.data.questions.find(
        (q) => q.id === choiceQuestionId,
      );
      expect(choiceQuestion.results).toMatchObject({
        counts: expect.objectContaining({
          Engineering: 2,
        }),
        percentages: expect.objectContaining({
          Engineering: 100,
        }),
      });
    });

    it("should filter results by date range", async () => {
      const response = await request(app)
        .get(`/api/surveys/${surveyId}/results`)
        .query({
          from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          to: new Date().toISOString(),
        })
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.summary.total_responses).toBe(2);
    });

    it("should export results as CSV", async () => {
      const response = await request(app)
        .get(`/api/surveys/${surveyId}/results/export?format=csv`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("text/csv");
      expect(response.headers["content-disposition"]).toContain("attachment");
    });

    it("should include text responses", async () => {
      // Add text question
      const [rows] = await testDb.execute(
        `INSERT INTO survey_questions 
        (survey_id, question_text, question_type, required, order_position, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [surveyId, "Comments", "text", 0, 3, tenant1Id],
      );
      const textQ = asTestRows<unknown>(rows);
      const textQuestionId = (textQ as any).insertId;

      // Add text answer
      const [rows] = await testDb.execute(
        "SELECT id FROM survey_responses WHERE survey_id = ? LIMIT 1",
        [surveyId],
      );
      const responses = asTestRows<unknown>(rows);
      await testDb.execute(
        `INSERT INTO survey_answers 
        (response_id, question_id, answer_value, tenant_id) 
        VALUES (?, ?, ?, ?)`,
        [
          responses[0].id,
          textQuestionId,
          JSON.stringify({ value: "Great survey!" }),
          tenant1Id,
        ],
      );

      const response = await request(app)
        .get(`/api/surveys/${surveyId}/results?include_text=true`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      const textQuestion = response.body.data.questions.find(
        (q) => q.id === textQuestionId,
      );
      expect(textQuestion.results.responses).toContain("Great survey!");
    });

    it("should deny results access to non-admins", async () => {
      const response = await request(app)
        .get(`/api/surveys/${surveyId}/results`)
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(403);
    });

    it("should handle anonymous survey results", async () => {
      // Update survey to anonymous
      await testDb.execute("UPDATE surveys SET is_anonymous = 1 WHERE id = ?", [
        surveyId,
      ]);

      const response = await request(app)
        .get(`/api/surveys/${surveyId}/results?include_respondents=true`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      // Should not include respondent identities
      expect(response.body.data.respondents).toBeUndefined();
    });

    it("should generate insights", async () => {
      const response = await request(app)
        .get(`/api/surveys/${surveyId}/results?include_insights=true`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.insights).toBeDefined();
      // Might include trend analysis, correlations, etc.
    });
  });

  describe("Survey Templates", () => {
    it("should create survey template", async () => {
      const templateData = {
        name: "Employee Satisfaction Template",
        description: "Standard quarterly satisfaction survey",
        category: "feedback",
        questions: [
          {
            question_text: "Overall satisfaction",
            question_type: "scale",
            required: true,
            order_position: 1,
            options: { min: 1, max: 10 },
          },
        ],
      };

      const response = await request(app)
        .post("/api/surveys/templates")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send(templateData);

      expect(response.status).toBe(201);
      expect(response.body.data.templateId).toBeDefined();
    });

    it("should list available templates", async () => {
      // Create some templates
      await testDb.execute(
        `INSERT INTO survey_templates 
        (name, category, template_data, is_public, tenant_id) 
        VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)`,
        [
          "Onboarding",
          "hr",
          "{}",
          0,
          tenant1Id,
          "Exit Interview",
          "hr",
          "{}",
          0,
          tenant1Id,
        ],
      );

      const response = await request(app)
        .get("/api/surveys/templates")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.templates.length).toBeGreaterThanOrEqual(2);
    });

    it("should filter templates by category", async () => {
      const response = await request(app)
        .get("/api/surveys/templates?category=hr")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(
        response.body.data.templates.every((t) => t.category === "hr"),
      ).toBe(true);
    });
  });

  describe("Survey Analytics", () => {
    it("should get response trends over time", async () => {
      const response = await request(app)
        .get("/api/surveys/analytics/trends")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        daily: expect.any(Array),
        weekly: expect.any(Array),
        monthly: expect.any(Array),
      });
    });

    it("should compare survey results", async () => {
      // Create multiple surveys
      const surveyIds = [];
      for (let i = 0; i < 2; i++) {
        const [rows] = await testDb.execute(
          `INSERT INTO surveys 
          (title, type, visibility_scope, status, created_by, tenant_id) 
          VALUES (?, ?, ?, ?, ?, ?)`,
          [
            `Q${i + 1} Survey`,
            "feedback",
            "company",
            "completed",
            adminUser1.id,
            tenant1Id,
          ],
        );
        const result = asTestRows<unknown>(rows);
        surveyIds.push((result as any).insertId);
      }

      const response = await request(app)
        .get("/api/surveys/analytics/compare")
        .query({ surveyIds: surveyIds.join(",") })
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.comparison).toBeDefined();
    });

    it("should get department-wise breakdown", async () => {
      const response = await request(app)
        .get("/api/surveys/analytics/departments")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.departments).toBeDefined();
    });
  });

  describe("Survey Notifications", () => {
    let surveyId: number;

    beforeEach(async () => {
      // Create survey
      const [rows] = await testDb.execute(
        `INSERT INTO surveys 
        (title, type, visibility_scope, status, start_date, end_date, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "Reminder Survey",
          "feedback",
          "company",
          "active",
          new Date(),
          new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          adminUser1.id,
          tenant1Id,
        ],
      );
      const result = asTestRows<unknown>(rows);
      surveyId = (result as any).insertId;
    });

    it("should send survey reminder", async () => {
      const response = await request(app)
        .post(`/api/surveys/${surveyId}/remind`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          target: "non_respondents",
          message: "Please complete the survey by Friday",
        });

      expect(response.status).toBe(200);
      expect(response.body.data.sent_to).toBeGreaterThan(0);
    });

    it("should schedule automatic reminders", async () => {
      const response = await request(app)
        .put(`/api/surveys/${surveyId}/reminders`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          schedule: [
            { days_before_end: 3, time: "09:00" },
            { days_before_end: 1, time: "14:00" },
          ],
        });

      expect(response.status).toBe(200);
    });
  });
});
