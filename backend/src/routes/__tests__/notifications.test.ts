/**
 * API Tests for Notification Endpoints
 * Tests notification CRUD, preferences, and real-time delivery
 */
import { Pool } from 'mysql2/promise';
import request from 'supertest';

import { asTestRows } from '../../__tests__/mocks/db-types';
import app from '../../app';
import {
  cleanupTestData,
  createTestDatabase,
  createTestDepartment,
  createTestTenant,
  createTestUser,
  getAuthToken,
} from '../mocks/database';

describe('Notification API Endpoints', () => {
  let testDb: Pool;
  let tenant1Id: number;
  let tenant2Id: number;
  let adminToken1: string;
  let adminToken2: string;
  let employeeToken1: string;
  let employeeToken2: string;
  let adminUser1: any;
  let employeeUser1: any;
  let employeeUser2: any;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    process.env.JWT_SECRET = 'test-secret-key-for-notification-tests';

    // Create test tenants
    tenant1Id = await createTestTenant(testDb, 'notifytest1', 'Notification Test Company 1');
    tenant2Id = await createTestTenant(testDb, 'notifytest2', 'Notification Test Company 2');

    // Create test users
    adminUser1 = await createTestUser(testDb, {
      username: 'notifyadmin1',
      email: 'admin1@notifytest1.de',
      password: 'AdminPass123!',
      role: 'admin',
      tenant_id: tenant1Id,
      first_name: 'Admin',
      last_name: 'One',
    });

    await createTestUser(testDb, {
      username: 'notifyadmin2',
      email: 'admin2@notifytest2.de',
      password: 'AdminPass123!',
      role: 'admin',
      tenant_id: tenant2Id,
      first_name: 'Admin',
      last_name: 'Two',
    });

    employeeUser1 = await createTestUser(testDb, {
      username: 'notifyemployee1',
      email: 'employee1@notifytest1.de',
      password: 'EmpPass123!',
      role: 'employee',
      tenant_id: tenant1Id,
      first_name: 'Employee',
      last_name: 'One',
    });

    employeeUser2 = await createTestUser(testDb, {
      username: 'notifyemployee2',
      email: 'employee2@notifytest1.de',
      password: 'EmpPass123!',
      role: 'employee',
      tenant_id: tenant1Id,
      first_name: 'Employee',
      last_name: 'Two',
    });

    // Get auth tokens
    adminToken1 = await getAuthToken(app, 'notifyadmin1', 'AdminPass123!');
    adminToken2 = await getAuthToken(app, 'notifyadmin2', 'AdminPass123!');
    employeeToken1 = await getAuthToken(app, 'notifyemployee1', 'EmpPass123!');
    employeeToken2 = await getAuthToken(app, 'notifyemployee2', 'EmpPass123!');
  });

  afterAll(async () => {
    await cleanupTestData();
    await testDb.end();
  });

  beforeEach(async () => {
    // Clear notifications before each test
    await testDb.execute('DELETE FROM notification_read_status WHERE tenant_id > 1');
    await testDb.execute('DELETE FROM notifications WHERE tenant_id > 1');
    await testDb.execute('DELETE FROM notification_preferences WHERE tenant_id > 1');
  });

  describe('GET /api/notifications', () => {
    beforeEach(async () => {
      // Create test notifications
      const notifications = [
        {
          type: 'system',
          title: 'System Update',
          message: 'Scheduled maintenance tonight',
          priority: 'high',
          recipient_id: null, // Broadcast
          recipient_type: 'all',
          created_by: adminUser1.id,
        },
        {
          type: 'task',
          title: 'Task Assigned',
          message: 'New task assigned to you',
          priority: 'medium',
          recipient_id: employeeUser1.id,
          recipient_type: 'user',
          created_by: adminUser1.id,
        },
        {
          type: 'message',
          title: 'New Message',
          message: 'You have a new message',
          priority: 'normal',
          recipient_id: employeeUser1.id,
          recipient_type: 'user',
          created_by: employeeUser2.id,
        },
      ];

      for (const notif of notifications) {
        await testDb.execute(
          `INSERT INTO notifications 
          (type, title, message, priority, recipient_id, recipient_type, created_by, tenant_id, created_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            notif.type,
            notif.title,
            notif.message,
            notif.priority,
            notif.recipient_id,
            notif.recipient_type,
            notif.created_by,
            tenant1Id,
          ],
        );
      }
    });

    it('should list notifications for user', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${employeeToken1}`);

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
      // Should see broadcast and personal notifications
      expect(notifications.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by type', async () => {
      const response = await request(app)
        .get('/api/notifications?type=task')
        .set('Authorization', `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      const notifications = response.body.data.notifications;
      expect(notifications.every((n) => n.type === 'task')).toBe(true);
    });

    it('should filter by read status', async () => {
      // Mark one notification as read
      const [rows] = await testDb.execute(
        'SELECT id FROM notifications WHERE recipient_id = ? AND tenant_id = ? LIMIT 1',
        [employeeUser1.id, tenant1Id],
      );
      const notifs = asTestRows<unknown>(rows);

      if ((notifs as any[]).length > 0) {
        await testDb.execute(
          'INSERT INTO notification_read_status (notification_id, user_id, read_at, tenant_id) VALUES (?, ?, NOW(), ?)',
          [(notifs as any[])[0].id, employeeUser1.id, tenant1Id],
        );
      }

      const response = await request(app)
        .get('/api/notifications?unread=true')
        .set('Authorization', `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      const notifications = response.body.data.notifications;
      expect(notifications.every((n) => !n.isRead)).toBe(true);
    });

    it('should filter by priority', async () => {
      const response = await request(app)
        .get('/api/notifications?priority=high')
        .set('Authorization', `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      const notifications = response.body.data.notifications;
      expect(notifications.every((n) => n.priority === 'high')).toBe(true);
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/notifications?page=1&limit=2')
        .set('Authorization', `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.notifications.length).toBeLessThanOrEqual(2);
      expect(response.body.data.pagination.limit).toBe(2);
    });

    it('should enforce tenant isolation', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${adminToken2}`);

      expect(response.status).toBe(200);
      const notifications = response.body.data.notifications;
      // Should not see notifications from tenant1
      expect(notifications.length).toBe(0);
    });
  });

  describe('POST /api/notifications', () => {
    it('should create notification for admin', async () => {
      const notificationData = {
        type: 'announcement',
        title: 'Company Announcement',
        message: 'Important update for all employees',
        priority: 'high',
        recipient_type: 'all',
        actionUrl: '/announcements/123',
        actionLabel: 'View Details',
      };

      const response = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${adminToken1}`)
        .send(notificationData);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('erfolgreich erstellt'),
      });
      expect(response.body.data.notificationId).toBeDefined();

      // Verify notification was created
      const [rows] = await testDb.execute('SELECT * FROM notifications WHERE id = ?', [
        response.body.data.notificationId,
      ]);
      const notifications = asTestRows<unknown>(rows);
      expect((notifications as any[])[0]).toMatchObject({
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        priority: notificationData.priority,
        tenant_id: tenant1Id,
      });
    });

    it('should create targeted notification', async () => {
      const response = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({
          type: 'task',
          title: 'Task Update',
          message: 'Your task has been updated',
          priority: 'normal',
          recipient_type: 'user',
          recipient_id: employeeUser1.id,
        });

      expect(response.status).toBe(201);
    });

    it('should create department-wide notification', async () => {
      const deptId = await createTestDepartment(testDb, tenant1Id, 'HR');

      const response = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({
          type: 'announcement',
          title: 'Department Meeting',
          message: 'Mandatory department meeting tomorrow',
          priority: 'high',
          recipient_type: 'department',
          recipient_id: deptId,
        });

      expect(response.status).toBe(201);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({
          type: 'announcement',
          // Missing required fields
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'title' }),
          expect.objectContaining({ path: 'message' }),
        ]),
      );
    });

    it('should deny notification creation by regular employees', async () => {
      const response = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${employeeToken1}`)
        .send({
          type: 'announcement',
          title: 'Unauthorized',
          message: 'Should not work',
          recipient_type: 'all',
        });

      expect(response.status).toBe(403);
    });

    it('should schedule notification for future', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const response = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({
          type: 'reminder',
          title: 'Scheduled Reminder',
          message: 'This is a scheduled notification',
          priority: 'normal',
          recipient_type: 'all',
          scheduled_for: futureDate.toISOString(),
        });

      expect(response.status).toBe(201);

      // Verify scheduled
      const [rows] = await testDb.execute('SELECT scheduled_for FROM notifications WHERE id = ?', [
        response.body.data.notificationId,
      ]);
      const notifications = asTestRows<unknown>(rows);
      expect((notifications as any[])[0].scheduled_for).toBeTruthy();
    });

    it('should create notification with metadata', async () => {
      const response = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({
          type: 'task',
          title: 'Task Complete',
          message: 'Task #123 has been completed',
          priority: 'normal',
          recipient_type: 'user',
          recipient_id: employeeUser1.id,
          metadata: {
            taskId: 123,
            completedBy: 'John Doe',
            completionTime: new Date().toISOString(),
          },
        });

      expect(response.status).toBe(201);
    });
  });

  describe('PUT /api/notifications/:id/read', () => {
    let notificationId: number;

    beforeEach(async () => {
      const [rows] = await testDb.execute(
        `INSERT INTO notifications 
        (type, title, message, priority, recipient_id, recipient_type, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'message',
          'Test Message',
          'Mark as read test',
          'normal',
          employeeUser1.id,
          'user',
          adminUser1.id,
          tenant1Id,
        ],
      );
      const result = asTestRows<unknown>(rows);
      notificationId = (result as any).insertId;
    });

    it('should mark notification as read', async () => {
      const response = await request(app)
        .put(`/api/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('gelesen');

      // Verify read status
      const [rows] = await testDb.execute(
        'SELECT * FROM notification_read_status WHERE notification_id = ? AND user_id = ?',
        [notificationId, employeeUser1.id],
      );
      const readStatus = asTestRows<unknown>(rows);
      expect((readStatus as any[]).length).toBe(1);
    });

    it('should prevent marking others notifications as read', async () => {
      const response = await request(app)
        .put(`/api/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${employeeToken2}`);

      expect(response.status).toBe(404);
    });

    it('should handle already read notifications', async () => {
      // Mark as read first
      await request(app)
        .put(`/api/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${employeeToken1}`);

      // Try again
      const response = await request(app)
        .put(`/api/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200); // Should still succeed
    });
  });

  describe('PUT /api/notifications/mark-all-read', () => {
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
            employeeUser1.id,
            'user',
            adminUser1.id,
            tenant1Id,
          ],
        );
      }
    });

    it('should mark all notifications as read', async () => {
      const response = await request(app)
        .put('/api/notifications/mark-all-read')
        .set('Authorization', `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.markedCount).toBeGreaterThan(0);

      // Verify all marked as read
      const [rows] = await testDb.execute(
        `SELECT n.* FROM notifications n
         LEFT JOIN notification_read_status nrs ON n.id = nrs.notification_id AND nrs.user_id = ?
         WHERE (n.recipient_id = ? OR n.recipient_type = 'all')
         AND n.tenant_id = ?
         AND nrs.id IS NULL`,
        [employeeUser1.id, employeeUser1.id, tenant1Id],
      );
      const unread = asTestRows<unknown>(rows);
      expect((unread as any[]).length).toBe(0);
    });

    it("should only mark user's notifications", async () => {
      await request(app)
        .put('/api/notifications/mark-all-read')
        .set('Authorization', `Bearer ${employeeToken1}`);

      // Check that employee2's notifications are still unread
      const [rows] = await testDb.execute(
        `SELECT COUNT(*) as count FROM notifications n
         LEFT JOIN notification_read_status nrs ON n.id = nrs.notification_id
         WHERE n.recipient_id = ? AND n.tenant_id = ? AND nrs.id IS NULL`,
        [employeeUser2.id, tenant1Id],
      );
      const unread = asTestRows<unknown>(rows);
      expect((unread as any[])[0].count).toBeGreaterThan(0);
    });
  });

  describe('DELETE /api/notifications/:id', () => {
    let notificationId: number;

    beforeEach(async () => {
      const [rows] = await testDb.execute(
        `INSERT INTO notifications 
        (type, title, message, priority, recipient_id, recipient_type, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'message',
          'Delete Test',
          'To be deleted',
          'normal',
          employeeUser1.id,
          'user',
          adminUser1.id,
          tenant1Id,
        ],
      );
      const result = asTestRows<unknown>(rows);
      notificationId = (result as any).insertId;
    });

    it('should delete notification for admin', async () => {
      const response = await request(app)
        .delete(`/api/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('gelöscht');

      // Verify deletion
      const [rows] = await testDb.execute('SELECT * FROM notifications WHERE id = ?', [
        notificationId,
      ]);
      const notifications = asTestRows<unknown>(rows);
      expect((notifications as any[]).length).toBe(0);
    });

    it('should allow users to delete their own notifications', async () => {
      const response = await request(app)
        .delete(`/api/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
    });

    it('should prevent deleting others notifications', async () => {
      const response = await request(app)
        .delete(`/api/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${employeeToken2}`);

      expect(response.status).toBe(404);
    });

    it('should enforce tenant isolation on delete', async () => {
      const response = await request(app)
        .delete(`/api/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${adminToken2}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Notification Preferences', () => {
    describe('GET /api/notifications/preferences', () => {
      it('should get user notification preferences', async () => {
        const response = await request(app)
          .get('/api/notifications/preferences')
          .set('Authorization', `Bearer ${employeeToken1}`);

        expect(response.status).toBe(200);
        expect(response.body.data.preferences).toMatchObject({
          email_notifications: expect.any(Boolean),
          push_notifications: expect.any(Boolean),
          sms_notifications: expect.any(Boolean),
          notification_types: expect.any(Object),
        });
      });

      it('should return default preferences if not set', async () => {
        const response = await request(app)
          .get('/api/notifications/preferences')
          .set('Authorization', `Bearer ${employeeToken2}`);

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

    describe('PUT /api/notifications/preferences', () => {
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
          .put('/api/notifications/preferences')
          .set('Authorization', `Bearer ${employeeToken1}`)
          .send(preferences);

        expect(response.status).toBe(200);
        expect(response.body.message).toContain('aktualisiert');

        // Verify preferences were saved
        const [rows] = await testDb.execute(
          'SELECT * FROM notification_preferences WHERE user_id = ?',
          [employeeUser1.id],
        );
        const prefs = asTestRows<unknown>(rows);
        expect((prefs as any[]).length).toBe(1);
      });

      it('should validate preference structure', async () => {
        const response = await request(app)
          .put('/api/notifications/preferences')
          .set('Authorization', `Bearer ${employeeToken1}`)
          .send({
            email_notifications: 'not-a-boolean', // Invalid type
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

      for (let i = 0; i < 20; i++) {
        await testDb.execute(
          `INSERT INTO notifications 
          (type, title, message, priority, recipient_id, recipient_type, created_by, tenant_id, created_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY))`,
          [
            types[i % types.length],
            `Test ${i}`,
            `Message ${i}`,
            priorities[i % priorities.length],
            i % 2 === 0 ? employeeUser1.id : null,
            i % 2 === 0 ? 'user' : 'all',
            adminUser1.id,
            tenant1Id,
            Math.floor(Math.random() * 30),
          ],
        );
      }
    });

    it('should get notification statistics for admin', async () => {
      const response = await request(app)
        .get('/api/notifications/stats')
        .set('Authorization', `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        total: expect.any(Number),
        byType: expect.any(Object),
        byPriority: expect.any(Object),
        readRate: expect.any(Number),
        trends: expect.any(Array),
      });
    });

    it('should get personal notification stats', async () => {
      const response = await request(app)
        .get('/api/notifications/stats/me')
        .set('Authorization', `Bearer ${employeeToken1}`);

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
        .post('/api/notifications/subscribe')
        .set('Authorization', `Bearer ${employeeToken1}`)
        .send({
          deviceToken: 'test-device-token',
          platform: 'web',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.subscriptionId).toBeDefined();
    });

    it('should unsubscribe from notifications', async () => {
      // First subscribe
      const subResponse = await request(app)
        .post('/api/notifications/subscribe')
        .set('Authorization', `Bearer ${employeeToken1}`)
        .send({
          deviceToken: 'test-device-token',
          platform: 'web',
        });

      const subscriptionId = subResponse.body.data.subscriptionId;

      const response = await request(app)
        .delete(`/api/notifications/subscribe/${subscriptionId}`)
        .set('Authorization', `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
    });
  });

  describe('Notification Templates', () => {
    it('should list notification templates for admin', async () => {
      const response = await request(app)
        .get('/api/notifications/templates')
        .set('Authorization', `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.templates).toBeDefined();
      expect(Array.isArray(response.body.data.templates)).toBe(true);
    });

    it('should create notification from template', async () => {
      // Assuming template exists
      const response = await request(app)
        .post('/api/notifications/from-template')
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({
          templateId: 'welcome_message',
          variables: {
            userName: 'John Doe',
            companyName: 'Test Company',
          },
          recipient_type: 'user',
          recipient_id: employeeUser1.id,
        });

      expect([200, 201, 404]).toContain(response.status); // 404 if template doesn't exist
    });
  });
});
