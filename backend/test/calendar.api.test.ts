/**
 * Calendar API Integration Tests
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

// Shared state across sequential describe blocks
let calendarEventId: number;
let _existingCalendarId: number;
let _createdCalendarId: number;

beforeAll(async () => {
  auth = await loginApitest();
});

// ---- seq: 1 -- List Calendar Events ------------------------------------------

describe('Calendar: List Events', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/calendar/events`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return events array', async () => {
    const res = await fetch(`${BASE_URL}/calendar/events`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(Array.isArray(body.data.events)).toBe(true);

    // Store first existing event ID for fallback after delete
    if (body.data.events.length > 0) {
      _existingCalendarId = body.data.events[0].id;
    }
  });
});

// ---- seq: 2 -- Create Calendar Event ----------------------------------------

describe('Calendar: Create Event', () => {
  it('should return 201 Created', async () => {
    const res = await fetch(`${BASE_URL}/calendar/events`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        title: `API Test ${Date.now()}`,
        description: 'Created via API test - will be deleted',
        startTime: '2025-01-15T10:00:00Z',
        endTime: '2025-01-15T11:00:00Z',
        allDay: false,
        orgLevel: 'personal',
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);

    // Store created event ID for subsequent tests
    if (body.data?.id) {
      calendarEventId = body.data.id;
      _createdCalendarId = body.data.id;
    }
  });
});

// ---- seq: 3 -- Get Calendar Event -------------------------------------------

describe('Calendar: Get Event', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/calendar/events/${calendarEventId}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return event object with id and title', async () => {
    const res = await fetch(`${BASE_URL}/calendar/events/${calendarEventId}`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('title');
  });
});

// ---- seq: 4 -- Update Calendar Event ----------------------------------------

describe('Calendar: Update Event', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/calendar/events/${calendarEventId}`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        title: 'Updated Meeting',
        description: 'Updated via API test',
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ---- seq: 5 -- Delete Calendar Event ----------------------------------------

describe('Calendar: Delete Event', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/calendar/events/${calendarEventId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    // Clear created ID and fall back to existing event
    _createdCalendarId = 0;
    if (_existingCalendarId) {
      calendarEventId = _existingCalendarId;
    }
  });
});

// ---- seq: 6 -- Get Dashboard Events -----------------------------------------

describe('Calendar: Dashboard Events', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/calendar/dashboard`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
