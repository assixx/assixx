/**
 * Notifications API v2 Tests
 * Tests for notification endpoints with v2 standards
 */
import { Pool } from 'mysql2/promise';
import request from 'supertest';

import app from '../../../../app.js';
import {
  cleanupTestData,
  closeTestDatabase,
  createTestDatabase,
  createTestDepartment,
  createTestTenant,
  createTestUser,
} from '../../../mocks/database.js';

describe('Notifications API v2', () => {
  let testDb: Pool;
  let tenantId: number;
  let otherTenantId: number;
  let adminUser: any;
  let employeeUser: any;
  let otherTenantUser: any;
  let adminToken: string;
  let employeeToken: string;
  let otherTenantToken: string;
  let departmentId: number;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    await cleanupTestData();

    // Create test tenants
    tenantId = await createTestTenant(testDb, 'notiftest', 'Notification Test Company');
    otherTenantId = await createTestTenant(testDb, 'othernotif', 'Other Company');

    // Create department
    departmentId = await createTestDepartment(testDb, tenantId, 'Test Department');

    // Create test users
    adminUser = await createTestUser(testDb, {
      username: 'admin_notif',
      email: 'admin@test.com',
      password: 'AdminPass123!',
      role: 'admin',
      tenant_id: tenantId,
      first_name: 'Admin',
      last_name: 'User',
    });

    employeeUser = await createTestUser(testDb, {
      username: 'employee_notif',
      email: 'employee@test.com',
      password: 'EmpPass123!',
      role: 'employee',
      tenant_id: tenantId,
      first_name: 'Employee',
      last_name: 'User',
      department_id: departmentId,
    });

    otherTenantUser = await createTestUser(testDb, {
      username: 'other_notif',
      email: 'other@test.com',
      password: 'OtherPass123!',
      role: 'admin',
      tenant_id: otherTenantId,
      first_name: 'Other',
      last_name: 'Admin',
    });

    // Login to get tokens
    const adminLogin = await request(app).post('/api/v2/auth/login').send({
      email: adminUser.email,
      password: 'AdminPass123!',
    });
    adminToken = adminLogin.body.data.accessToken;

    const employeeLogin = await request(app).post('/api/v2/auth/login').send({
      email: employeeUser.email,
      password: 'EmpPass123!',
    });
    employeeToken = employeeLogin.body.data.accessToken;

    const otherLogin = await request(app).post('/api/v2/auth/login').send({
      email: otherTenantUser.email,
      password: 'OtherPass123!',
    });
    otherTenantToken = otherLogin.body.data.accessToken;
  });

  afterAll(async () => {
    await cleanupTestData();
    await closeTestDatabase();
  });

  beforeEach(async () => {
    // Clear notifications before each test
    await testDb.execute('DELETE FROM notification_read_status WHERE tenant_id IN (?, ?)', [
      tenantId,
      otherTenantId,
    ]);
    await testDb.execute('DELETE FROM notifications WHERE tenant_id IN (?, ?)', [
      tenantId,
      otherTenantId,
    ]);
  });

  describe('POST /api/v2/notifications', () => {
    it('should create notification as admin', async () => {
      const notificationData = {
        type: 'announcement',
        title: 'Company Announcement',
        message: 'Important update for all employees',
        priority: 'high',
        recipient_type: 'all',
        action_url: '/announcements/123',
        action_label: 'View Details',
      };

      const response = await request(app)
        .post('/api/v2/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send(notificationData);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          notificationId: expect.any(Number),
        },
      });

      // Verify in database
      const [rows] = await testDb.execute('SELECT * FROM notifications WHERE id = ?', [
        response.body.data.notificationId,
      ]);
      expect(rows).toHaveLength(1);
      expect((rows as any)[0]).toMatchObject({
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        priority: notificationData.priority,
        tenant_id: tenantId,
      });
    });

    it('should create targeted notification', async () => {
      const response = await request(app)
        .post('/api/v2/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send({
          type: 'task',
          title: 'Task Update',
          message: 'Your task has been updated',
          priority: 'normal',
          recipient_type: 'user',
          recipient_id: employeeUser.id,
        });

      expect(response.status).toBe(201);
    });

    it('should deny notification creation by employees', async () => {
      const response = await request(app)
        .post('/api/v2/notifications')
        .set('Authorization', `Bearer ${employeeToken}`)
        .set('Content-Type', 'application/json')
        .send({
          type: 'announcement',
          title: 'Unauthorized',
          message: 'Should not work',
          recipient_type: 'all',
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v2/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send({
          type: 'announcement',
          // Missing title and message
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should create notification with metadata', async () => {
      const response = await request(app)
        .post('/api/v2/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send({
          type: 'task',
          title: 'Task Complete',
          message: 'Task #123 has been completed',
          priority: 'normal',
          recipient_type: 'user',
          recipient_id: employeeUser.id,
          metadata: {
            taskId: 123,
            completedBy: 'John Doe',
            completionTime: new Date().toISOString(),
          },
        });

      expect(response.status).toBe(201);
    });
  });

  describe('GET /api/v2/notifications', () => {
    beforeEach(async () => {
      // Create test notifications
      const notifications = [
        {
          type: 'system',
          title: 'System Update',
          message: 'Scheduled maintenance tonight',
          priority: 'high',
          recipient_id: null,
          recipient_type: 'all',
          created_by: adminUser.id,
        },
        {
          type: 'task',
          title: 'Task Assigned',
          message: 'New task assigned to you',
          priority: 'medium',
          recipient_id: employeeUser.id,
          recipient_type: 'user',
          created_by: adminUser.id,
        },
        {
          type: 'message',
          title: 'New Message',
          message: 'You have a new message',
          priority: 'normal',
          recipient_id: employeeUser.id,
          recipient_type: 'user',
          created_by: adminUser.id,
        },
      ];

      for (const notif of notifications) {
        await testDb.execute(
          `INSERT INTO notifications 
          (type, title, message, priority, recipient_id, recipient_type, created_by, tenant_id) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            notif.type,
            notif.title,
            notif.message,
            notif.priority,
            notif.recipient_id,
            notif.recipient_type,
            notif.created_by,
            tenantId,
          ],
        );
      }
    });

    it('should list notifications for user', async () => {
      const response = await request(app)
        .get('/api/v2/notifications')
        .set('Authorization', `Bearer ${employeeToken}`);

      if (response.status !== 200) {
        console.error('List notifications error:', response.body);
      }
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          notifications: expect.any(Array),
          unreadCount: expect.any(Number),
          pagination: expect.objectContaining({
            page: 1,
            limit: 20,
          }),
        },
      });

      const notifications = response.body.data.notifications;
      expect(notifications.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by type', async () => {
      const response = await request(app)
        .get('/api/v2/notifications?type=task')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      const notifications = response.body.data.notifications;
      expect(notifications.every((n: any) => n.type === 'task')).toBe(true);
    });

    it('should filter by priority', async () => {
      const response = await request(app)
        .get('/api/v2/notifications?priority=high')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      const notifications = response.body.data.notifications;
      expect(notifications.every((n: any) => n.priority === 'high')).toBe(true);
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/v2/notifications?page=1&limit=2')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.notifications.length).toBeLessThanOrEqual(2);
      expect(response.body.data.pagination.limit).toBe(2);
    });

    it('should enforce tenant isolation', async () => {
      const response = await request(app)
        .get('/api/v2/notifications')
        .set('Authorization', `Bearer ${otherTenantToken}`);

      expect(response.status).toBe(200);
      const notifications = response.body.data.notifications;
      expect(notifications.length).toBe(0);
    });
  });

  describe('PUT /api/v2/notifications/:id/read', () => {
    let notificationId: number;

    beforeEach(async () => {
      const [result] = await testDb.execute(
        `INSERT INTO notifications 
        (type, title, message, priority, recipient_id, recipient_type, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'message',
          'Test Message',
          'Mark as read test',
          'normal',
          employeeUser.id,
          'user',
          adminUser.id,
          tenantId,
        ],
      );
      notificationId = (result as any).insertId;
    });

    it('should mark notification as read', async () => {
      const response = await request(app)
        .put(`/api/v2/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .set('Content-Type', 'application/json');

      if (response.status !== 200) {
        console.error('Mark as read error:', response.body);
      }
      expect(response.status).toBe(200);

      // Verify in database
      const [rows] = await testDb.execute(
        'SELECT * FROM notification_read_status WHERE notification_id = ? AND user_id = ?',
        [notificationId, employeeUser.id],
      );
      expect(rows).toHaveLength(1);
    });

    it('should handle already read notifications', async () => {
      // Mark as read first
      await request(app)
        .put(`/api/v2/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .set('Content-Type', 'application/json');

      // Try again
      const response = await request(app)
        .put(`/api/v2/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
    });

    it('should return 404 for notifications from other tenants', async () => {
      const response = await request(app)
        .put(`/api/v2/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${otherTenantToken}`)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/v2/notifications/mark-all-read', () => {
    beforeEach(async () => {
      // Create multiple unread notifications
      for (let i = 0; i < 5; i++) {
        await testDb.execute(
          `INSERT INTO notifications 
          (type, title, message, priority, recipient_id, recipient_type, created_by, tenant_id) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            'message',
            `Message ${i}`,
            `Content ${i}`,
            'normal',
            employeeUser.id,
            'user',
            adminUser.id,
            tenantId,
          ],
        );
      }
    });

    it('should mark all notifications as read', async () => {
      const response = await request(app)
        .put('/api/v2/notifications/mark-all-read')
        .set('Authorization', `Bearer ${employeeToken}`)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.data.markedCount).toBeGreaterThan(0);

      // Verify all marked as read
      const [rows] = await testDb.execute(
        `SELECT n.* FROM notifications n
         LEFT JOIN notification_read_status nrs ON n.id = nrs.notification_id AND nrs.user_id = ?
         WHERE n.recipient_id = ? AND n.tenant_id = ? AND nrs.id IS NULL`,
        [employeeUser.id, employeeUser.id, tenantId],
      );
      expect(rows).toHaveLength(0);
    });
  });

  describe('DELETE /api/v2/notifications/:id', () => {
    let notificationId: number;

    beforeEach(async () => {
      const [result] = await testDb.execute(
        `INSERT INTO notifications 
        (type, title, message, priority, recipient_id, recipient_type, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'message',
          'Delete Test',
          'To be deleted',
          'normal',
          employeeUser.id,
          'user',
          adminUser.id,
          tenantId,
        ],
      );
      notificationId = (result as any).insertId;
    });

    it('should delete notification as admin', async () => {
      const response = await request(app)
        .delete(`/api/v2/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      // Verify deletion
      const [rows] = await testDb.execute('SELECT * FROM notifications WHERE id = ?', [
        notificationId,
      ]);
      expect(rows).toHaveLength(0);
    });

    it('should allow users to delete their own notifications', async () => {
      const response = await request(app)
        .delete(`/api/v2/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
    });

    it('should enforce tenant isolation on delete', async () => {
      const response = await request(app)
        .delete(`/api/v2/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${otherTenantToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Notification Preferences', () => {
    describe('GET /api/v2/notifications/preferences', () => {
      it('should get default preferences', async () => {
        const response = await request(app)
          .get('/api/v2/notifications/preferences')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.preferences).toMatchObject({
          email_notifications: true,
          push_notifications: true,
          sms_notifications: false,
          notification_types: {
            system: { email: true, push: true, sms: false },
            task: { email: true, push: true, sms: false },
            message: { email: false, push: true, sms: false },
            announcement: { email: true, push: true, sms: false },
          },
        });
      });
    });

    describe('PUT /api/v2/notifications/preferences', () => {
      it('should update notification preferences', async () => {
        const preferences = {
          email_notifications: false,
          push_notifications: true,
          sms_notifications: false,
          notification_types: {
            system: { email: false, push: true, sms: false },
            task: { email: true, push: true, sms: false },
            message: { email: false, push: false, sms: false },
          },
        };

        const response = await request(app)
          .put('/api/v2/notifications/preferences')
          .set('Authorization', `Bearer ${employeeToken}`)
          .set('Content-Type', 'application/json')
          .send(preferences);

        expect(response.status).toBe(200);

        // Verify preferences were saved
        const getResponse = await request(app)
          .get('/api/v2/notifications/preferences')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(getResponse.status).toBe(200);
        expect(getResponse.body.data.preferences.email_notifications).toBe(false);
      });

      it('should validate preference structure', async () => {
        const response = await request(app)
          .put('/api/v2/notifications/preferences')
          .set('Authorization', `Bearer ${employeeToken}`)
          .set('Content-Type', 'application/json')
          .send({
            email_notifications: 'not-a-boolean',
          });

        expect(response.status).toBe(400);
      });
    });
  });

  describe('Notification Statistics', () => {
    beforeEach(async () => {
      // Create various notifications
      const types = ['system', 'task', 'message', 'announcement'];
      const priorities = ['high', 'medium', 'normal', 'low'];

      for (let i = 0; i < 10; i++) {
        await testDb.execute(
          `INSERT INTO notifications 
          (type, title, message, priority, recipient_id, recipient_type, created_by, tenant_id) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            types[i % types.length],
            `Test ${i}`,
            `Message ${i}`,
            priorities[i % priorities.length],
            i % 2 === 0 ? employeeUser.id : null,
            i % 2 === 0 ? 'user' : 'all',
            adminUser.id,
            tenantId,
          ],
        );
      }
    });

    it('should get notification statistics for admin', async () => {
      const response = await request(app)
        .get('/api/v2/notifications/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        total: expect.any(Number),
        byType: expect.any(Object),
        byPriority: expect.any(Object),
        readRate: expect.any(Number),
        trends: expect.any(Array),
      });
    });

    it('should deny stats access to employees', async () => {
      const response = await request(app)
        .get('/api/v2/notifications/stats')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
    });

    it('should get personal notification stats', async () => {
      const response = await request(app)
        .get('/api/v2/notifications/stats/me')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        total: expect.any(Number),
        unread: expect.any(Number),
        byType: expect.any(Object),
      });
    });
  });

  describe('Real-time Notifications', () => {
    it('should subscribe to notification updates', async () => {
      const response = await request(app)
        .post('/api/v2/notifications/subscribe')
        .set('Authorization', `Bearer ${employeeToken}`)
        .set('Content-Type', 'application/json')
        .send({
          deviceToken: 'test-device-token',
          platform: 'web',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.subscriptionId).toBeDefined();
    });

    it('should unsubscribe from notifications', async () => {
      const response = await request(app)
        .delete('/api/v2/notifications/subscribe/sub_123')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('Notification Templates', () => {
    it('should list notification templates for admin', async () => {
      const response = await request(app)
        .get('/api/v2/notifications/templates')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.templates).toBeDefined();
      expect(Array.isArray(response.body.data.templates)).toBe(true);
    });

    it('should return 404 for non-existent template', async () => {
      const response = await request(app)
        .post('/api/v2/notifications/from-template')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send({
          templateId: 'non_existent',
          variables: {},
          recipient_type: 'user',
          recipient_id: employeeUser.id,
        });

      expect(response.status).toBe(404);
    });
  });
});
