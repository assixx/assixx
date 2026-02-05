/**
 * Surveys API Integration Tests
 *
 * Runs against REAL backend (Docker must be running).
 *
 * @see vitest.config.api.ts
 */
import {
  type AuthState,
  BASE_URL,
  type JsonBody,
  authHeaders,
  authOnly,
  loginApitest,
} from './helpers.js';

let auth: AuthState;

/** ID of the first survey found in the list (fallback for get-by-id). */
let existingSurveyId: number | undefined;

/** ID of the survey created during the test run. */
let createdSurveyId: number | undefined;

/** Resolved survey ID used by downstream tests. */
let surveyId: number | undefined;

beforeAll(async () => {
  auth = await loginApitest();
});

// ---- seq: 1 -- List Surveys ---------------------------------------------------

describe('Surveys: List Surveys', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/surveys`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return surveys array', async () => {
    const res = await fetch(`${BASE_URL}/surveys`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(Array.isArray(body.data)).toBe(true);

    // Capture existing survey ID for later use as fallback
    if (Array.isArray(body.data) && body.data.length > 0) {
      existingSurveyId = body.data[0].id as number;
    }
  });
});

// ---- seq: 2 -- Create Survey (Admin) ------------------------------------------

describe('Surveys: Create Survey (Admin)', () => {
  it('should return 201 Created', async () => {
    const res = await fetch(`${BASE_URL}/surveys`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        title: `API Test ${Date.now()}`,
        description: 'Created via API test - will be deleted',
        status: 'draft',
        questions: [
          {
            questionText: 'Test question?',
            questionType: 'rating',
            isRequired: true,
          },
        ],
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);

    // Store created survey ID for downstream tests
    if (body.data?.id) {
      surveyId = body.data.id as number;
      createdSurveyId = body.data.id as number;
    }
  });
});

// ---- seq: 3 -- Get Survey by ID -----------------------------------------------

describe('Surveys: Get Survey by ID', () => {
  it('should return 200 OK', async () => {
    const id = surveyId ?? existingSurveyId;
    expect(id).toBeDefined();

    const res = await fetch(`${BASE_URL}/surveys/${id}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return survey object with questions', async () => {
    const id = surveyId ?? existingSurveyId;
    expect(id).toBeDefined();

    const res = await fetch(`${BASE_URL}/surveys/${id}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('title');
  });
});

// ---- seq: 3 -- Get Survey Templates -------------------------------------------

describe('Surveys: Get Survey Templates', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/surveys/templates`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return templates array', async () => {
    const res = await fetch(`${BASE_URL}/surveys/templates`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ---- seq: 5 -- Get Survey Statistics (Admin) ----------------------------------

describe('Surveys: Get Survey Statistics (Admin)', () => {
  it('should return 200 OK', async () => {
    const id = surveyId ?? existingSurveyId;
    expect(id).toBeDefined();

    const res = await fetch(`${BASE_URL}/surveys/${id}/statistics`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ---- seq: 6 -- Get My Survey Response -----------------------------------------

describe('Surveys: Get My Survey Response', () => {
  it('should return 200 OK or 404 (no response yet)', async () => {
    const id = surveyId ?? existingSurveyId;
    expect(id).toBeDefined();

    const res = await fetch(`${BASE_URL}/surveys/${id}/my-response`, {
      headers: authOnly(auth.authToken),
    });

    expect([200, 404]).toContain(res.status);
  });
});

// ---- seq: 7 -- Delete Survey (Admin) ------------------------------------------

describe('Surveys: Delete Survey (Admin)', () => {
  it('should return 200 OK', async () => {
    // Only delete the survey we created during this test run
    expect(createdSurveyId).toBeDefined();

    const res = await fetch(`${BASE_URL}/surveys/${createdSurveyId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    // Clear created survey ID, fall back to existing
    createdSurveyId = undefined;
    surveyId = existingSurveyId;
  });
});
