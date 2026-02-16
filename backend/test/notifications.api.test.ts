/**
 * Notifications API Integration Tests
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

// Module-level state shared across sequential describe blocks
let notificationId: number;
let existingNotificationId: number;

beforeAll(async () => {
  auth = await loginApitest();
});

// ─── List Notifications (seq: 1) ────────────────────────────────────────────

describe('List Notifications', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/notifications`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return notifications array', async () => {
    const res = await fetch(`${BASE_URL}/notifications`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(body.data.notifications).toBeInstanceOf(Array);

    // Store first existing notification ID for fallback after delete
    if (body.data.notifications.length > 0) {
      existingNotificationId = body.data.notifications[0].id;
    }
  });
});

// ─── Create Notification (seq: 2) ───────────────────────────────────────────

describe('Create Notification (Admin)', () => {
  it('should return 201 Created', async () => {
    const res = await fetch(`${BASE_URL}/notifications`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        title: `API Test ${Date.now()}`,
        message: 'Created via API test - will be deleted',
        type: 'announcement',
        recipientType: 'all',
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);

    // Store created notification ID for subsequent tests
    if (body.data?.notificationId) {
      notificationId = body.data.notificationId;
    }
  });
});

// ─── Get Notification Preferences (seq: 3) ──────────────────────────────────

describe('Get Notification Preferences', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/notifications/preferences`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ─── Update Notification Preferences (seq: 4) ──────────────────────────────

describe('Update Notification Preferences', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/notifications/preferences`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        emailEnabled: true,
        pushEnabled: true,
        categories: {
          system: true,
          chat: true,
          blackboard: true,
        },
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ─── Mark Notification as Read (seq: 5) ─────────────────────────────────────

describe('Mark Notification as Read', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(
      `${BASE_URL}/notifications/${notificationId}/read`,
      {
        method: 'PUT',
        headers: authOnly(auth.authToken),
      },
    );
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ─── Mark All Notifications as Read (seq: 6) ────────────────────────────────

describe('Mark All Notifications as Read', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/notifications/mark-all-read`, {
      method: 'PUT',
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ─── Mark Feature Type as Read: vacation (seq: 6b) ──────────────────────────

describe('Mark Feature Type as Read (vacation)', () => {
  it('should return 200 OK for vacation type', async () => {
    const res = await fetch(`${BASE_URL}/notifications/mark-read/vacation`, {
      method: 'POST',
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('marked');
    expect(typeof body.data.marked).toBe('number');
  });

  it('should reject invalid feature type', async () => {
    const res = await fetch(`${BASE_URL}/notifications/mark-read/invalid`, {
      method: 'POST',
      headers: authOnly(auth.authToken),
    });

    expect(res.status).toBe(400);
  });
});

// ─── Get Notification Statistics (seq: 7) ───────────────────────────────────

describe('Get Notification Statistics (Admin)', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/notifications/stats`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ─── Delete Notification (seq: 8) ───────────────────────────────────────────

describe('Delete Notification', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/notifications/${notificationId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    // Reset created ID; fall back to existing notification for future use
    if (existingNotificationId) {
      notificationId = existingNotificationId;
    }
  });
});
