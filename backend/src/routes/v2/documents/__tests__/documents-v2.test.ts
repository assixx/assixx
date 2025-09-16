/**
 * Documents API v2 Integration Tests
 * Tests for document management endpoints
 */
import { Pool } from 'mysql2/promise';
import request from 'supertest';

import app from '../../../../app.js';
import {
  cleanupTestData,
  closeTestDatabase,
  createTestDatabase,
  createTestDepartment,
  createTestTeam,
  createTestTenant,
  createTestUser,
} from '../../../mocks/database.js';

describe('Documents API v2', () => {
  let testDb: Pool;
  let tenantId: number;
  let adminUser: any;
  let regularUser: any;
  let adminToken: string;
  let userToken: string;
  let teamId: number;
  let departmentId: number;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    await cleanupTestData();

    // Create test tenant
    tenantId = await createTestTenant(testDb, 'doctest', 'Document Test Company');

    // Create department
    departmentId = await createTestDepartment(testDb, tenantId, 'Test Department');

    // Create team
    teamId = await createTestTeam(testDb, tenantId, departmentId, 'Test Team');

    // Create admin user
    adminUser = await createTestUser(testDb, {
      username: '__AUTOTEST__admin_doctest',
      email: '__AUTOTEST__admin@doctest.com',
      password: 'AdminPass123!',
      role: 'admin',
      tenant_id: tenantId,
      department_id: departmentId,
    });

    // Create regular user
    regularUser = await createTestUser(testDb, {
      username: '__AUTOTEST__user_doctest',
      email: '__AUTOTEST__user@doctest.com',
      password: 'UserPass123!',
      role: 'employee',
      tenant_id: tenantId,
      department_id: departmentId,
    });

    // Add user to team
    await testDb.execute(
      'INSERT INTO user_teams (tenant_id, user_id, team_id, joined_at) VALUES (?, ?, ?, NOW())',
      [tenantId, regularUser.id, teamId],
    );

    // Login admin
    const adminLoginRes = await request(app)
      .post('/api/v2/auth/login')
      .set('Content-Type', 'application/json')
      .send({
        email: adminUser.email,
        password: 'AdminPass123!',
      });
    adminToken = adminLoginRes.body.data.accessToken;

    // Login regular user
    const userLoginRes = await request(app)
      .post('/api/v2/auth/login')
      .set('Content-Type', 'application/json')
      .send({
        email: regularUser.email,
        password: 'UserPass123!',
      });
    userToken = userLoginRes.body.data.accessToken;
  });

  afterAll(async () => {
    await cleanupTestData();
    await closeTestDatabase();
  });

  describe('POST /api/v2/documents', () => {
    it('should upload a PDF document', async () => {
      const response = await request(app)
        .post('/api/v2/documents')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('category', 'general')
        .field('recipientType', 'user')
        .field('userId', regularUser.id.toString())
        .field('description', 'Test document')
        .attach('document', Buffer.from('fake pdf content'), {
          filename: 'test.pdf',
          contentType: 'application/pdf',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        category: 'general',
        recipientType: 'user',
        userId: regularUser.id,
        description: 'Test document',
        originalName: 'test.pdf',
      });
    });

    it('should reject non-PDF files', async () => {
      const response = await request(app)
        .post('/api/v2/documents')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('category', 'general')
        .field('recipientType', 'company')
        .attach('document', Buffer.from('fake text content'), {
          filename: 'test.txt',
          contentType: 'text/plain',
        });

      expect(response.status).toBe(500); // Multer error handling
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v2/documents')
        .field('category', 'general')
        .field('recipientType', 'company')
        .attach('document', Buffer.from('fake pdf content'), {
          filename: 'test.pdf',
          contentType: 'application/pdf',
        });

      expect(response.status).toBe(401);
    });

    it('should upload document for team', async () => {
      const response = await request(app)
        .post('/api/v2/documents')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('category', 'work')
        .field('recipientType', 'team')
        .field('teamId', teamId.toString())
        .field('description', 'Team document')
        .attach('document', Buffer.from('fake pdf content'), {
          filename: 'team-doc.pdf',
          contentType: 'application/pdf',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.recipientType).toBe('team');
      expect(response.body.data.teamId).toBe(teamId);
    });

    it('should upload salary document with year/month', async () => {
      const response = await request(app)
        .post('/api/v2/documents')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('category', 'salary')
        .field('recipientType', 'user')
        .field('userId', regularUser.id.toString())
        .field('year', '2025')
        .field('month', '7')
        .field('description', 'July 2025 salary')
        .attach('document', Buffer.from('fake pdf content'), {
          filename: 'salary-07-2025.pdf',
          contentType: 'application/pdf',
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        category: 'salary',
        year: 2025,
        month: '7',
      });
    });
  });

  describe('GET /api/v2/documents', () => {
    let userDocId: number;
    let teamDocId: number;
    let companyDocId: number;

    beforeAll(async () => {
      // Create test documents
      const userDocRes = await request(app)
        .post('/api/v2/documents')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('category', 'personal')
        .field('recipientType', 'user')
        .field('userId', regularUser.id.toString())
        .attach('document', Buffer.from('user doc'), {
          filename: 'user-doc.pdf',
          contentType: 'application/pdf',
        });
      userDocId = userDocRes.body.data.id;

      const teamDocRes = await request(app)
        .post('/api/v2/documents')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('category', 'work')
        .field('recipientType', 'team')
        .field('teamId', teamId.toString())
        .attach('document', Buffer.from('team doc'), {
          filename: 'team-doc.pdf',
          contentType: 'application/pdf',
        });
      teamDocId = teamDocRes.body.data.id;

      const companyDocRes = await request(app)
        .post('/api/v2/documents')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('category', 'general')
        .field('recipientType', 'company')
        .attach('document', Buffer.from('company doc'), {
          filename: 'company-doc.pdf',
          contentType: 'application/pdf',
        });
      companyDocId = companyDocRes.body.data.id;
    });

    it('should list all documents for admin', async () => {
      const response = await request(app)
        .get('/api/v2/documents')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.documents).toBeInstanceOf(Array);
      expect(response.body.data.documents.length).toBeGreaterThanOrEqual(3);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should filter documents by category', async () => {
      const response = await request(app)
        .get('/api/v2/documents?category=personal')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const docs = response.body.data.documents;
      expect(docs.every((d: any) => d.category === 'personal')).toBe(true);
    });

    it('should filter documents by recipient type', async () => {
      const response = await request(app)
        .get('/api/v2/documents?recipientType=team')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const docs = response.body.data.documents;

      // Filter should return at least one team document (the one we created)
      expect(docs.length).toBeGreaterThanOrEqual(1);

      // All documents should have recipientType === "team"
      const nonTeamDocs = docs.filter((d: any) => d.recipientType !== 'team');
      if (nonTeamDocs.length > 0) {
        // Debug output if test will fail
        throw new Error(
          `Found ${nonTeamDocs.length} documents with wrong recipientType. First few: ${JSON.stringify(
            nonTeamDocs.slice(0, 3).map((d: any) => ({
              id: d.id,
              recipientType: d.recipientType,
              category: d.category,
              filename: d.filename,
            })),
            null,
            2,
          )}`,
        );
      }

      expect(docs.every((d: any) => d.recipientType === 'team')).toBe(true);
    });

    it('should show only accessible documents for regular user', async () => {
      const response = await request(app)
        .get('/api/v2/documents')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      const docs = response.body.data.documents;

      // User should see: personal docs, team docs (member), company docs
      const docIds = docs.map((d: any) => d.id);
      expect(docIds).toContain(userDocId); // Personal doc
      expect(docIds).toContain(teamDocId); // Team doc (user is member)
      expect(docIds).toContain(companyDocId); // Company doc
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v2/documents?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.documents.length).toBeLessThanOrEqual(2);
      expect(response.body.data.pagination).toMatchObject({
        page: 1,
        limit: 2,
      });
    });

    it('should support search', async () => {
      const response = await request(app)
        .get('/api/v2/documents?search=team')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      // Should find documents with "team" in filename or description
      expect(response.body.data.documents.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v2/documents/:id', () => {
    let documentId: number;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/v2/documents')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('category', 'training')
        .field('recipientType', 'user')
        .field('userId', regularUser.id.toString())
        .field('description', 'Training material')
        .field('tags', JSON.stringify(['training', 'onboarding']))
        .attach('document', Buffer.from('training content'), {
          filename: 'training.pdf',
          contentType: 'application/pdf',
        });
      documentId = response.body.data.id;
    });

    it('should get document by ID', async () => {
      const response = await request(app)
        .get(`/api/v2/documents/${documentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: documentId,
        category: 'training',
        description: 'Training material',
        tags: ['training', 'onboarding'],
        isRead: true, // Should be marked as read after fetching
      });
    });

    it('should return 404 for non-existent document', async () => {
      const response = await request(app)
        .get('/api/v2/documents/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should deny access to unauthorized user', async () => {
      // Create document for a different user
      const otherUser = await createTestUser(testDb, {
        username: '__AUTOTEST__other_doctest',
        email: '__AUTOTEST__other@doctest.com',
        password: 'OtherPass123!',
        role: 'employee',
        tenant_id: tenantId,
        department_id: departmentId,
      });

      const docRes = await request(app)
        .post('/api/v2/documents')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('category', 'personal')
        .field('recipientType', 'user')
        .field('userId', otherUser.id.toString())
        .attach('document', Buffer.from('private content'), {
          filename: 'private.pdf',
          contentType: 'application/pdf',
        });

      // Try to access with regular user token
      const response = await request(app)
        .get(`/api/v2/documents/${docRes.body.data.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/v2/documents/:id', () => {
    let documentId: number;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/v2/documents')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('category', 'general')
        .field('recipientType', 'company')
        .field('description', 'Original description')
        .attach('document', Buffer.from('content'), {
          filename: 'update-test.pdf',
          contentType: 'application/pdf',
        });
      documentId = response.body.data.id;
    });

    it('should update document metadata', async () => {
      const response = await request(app)
        .put(`/api/v2/documents/${documentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send({
          filename: 'updated-name.pdf',
          category: 'work',
          description: 'Updated description',
          tags: ['updated', 'test'],
        });

      if (response.status !== 200) {
        console.error('Update metadata error response:', JSON.stringify(response.body, null, 2));
      }

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        filename: 'updated-name.pdf',
        category: 'work',
        description: 'Updated description',
        tags: ['updated', 'test'],
      });
    });

    it('should allow clearing optional fields', async () => {
      const response = await request(app)
        .put(`/api/v2/documents/${documentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send({
          description: null,
          tags: null,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.description).toBeNull();
      expect(response.body.data.tags).toBeNull();
    });

    it('should require admin role for update', async () => {
      const response = await request(app)
        .put(`/api/v2/documents/${documentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .set('Content-Type', 'application/json')
        .send({
          description: 'Hacker attempt',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/v2/documents/:id', () => {
    let documentId: number;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/v2/documents')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('category', 'general')
        .field('recipientType', 'company')
        .attach('document', Buffer.from('delete me'), {
          filename: 'delete-test.pdf',
          contentType: 'application/pdf',
        });
      documentId = response.body.data.id;
    });

    it('should delete document', async () => {
      const response = await request(app)
        .delete(`/api/v2/documents/${documentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.message).toContain('deleted successfully');

      // Verify it's deleted
      const getResponse = await request(app)
        .get(`/api/v2/documents/${documentId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getResponse.status).toBe(404);
    });

    it('should require admin role for delete', async () => {
      const response = await request(app)
        .delete(`/api/v2/documents/${documentId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('Archive/Unarchive', () => {
    let documentId: number;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/v2/documents')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('category', 'general')
        .field('recipientType', 'company')
        .attach('document', Buffer.from('archive me'), {
          filename: 'archive-test.pdf',
          contentType: 'application/pdf',
        });

      if (response.status !== 201) {
        console.error('Failed to create document for archive test:', response.body);
        throw new Error('Failed to create test document for archive test');
      }

      documentId = response.body.data?.id;
      if (!documentId) {
        throw new Error('No document ID returned from creation');
      }
    });

    it('should archive document', async () => {
      // Verify documentId was set correctly
      expect(documentId).toBeDefined();
      expect(typeof documentId).toBe('number');
      expect(documentId).toBeGreaterThan(0);

      const response = await request(app)
        .post(`/api/v2/documents/${documentId}/archive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json');

      if (response.status !== 200) {
        console.error('Archive error response:', JSON.stringify(response.body, null, 2));
        console.error('Archive error status:', response.status);
        console.error('Archive error headers:', response.headers);
      }

      expect(response.status).toBe(200);
      expect(response.body.data.message).toContain('archived successfully');

      // Verify it's archived
      const listResponse = await request(app)
        .get('/api/v2/documents?isArchived=true')
        .set('Authorization', `Bearer ${adminToken}`);

      const archivedDoc = listResponse.body.data.documents.find((d: any) => d.id === documentId);
      expect(archivedDoc).toBeDefined();
    });

    it('should unarchive document', async () => {
      const response = await request(app)
        .post(`/api/v2/documents/${documentId}/unarchive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json');

      if (response.status !== 200) {
        console.error('Unarchive error response:', JSON.stringify(response.body, null, 2));
      }

      expect(response.status).toBe(200);
      expect(response.body.data.message).toContain('unarchived successfully');
    });
  });

  describe('Download/Preview', () => {
    let documentId: number;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/v2/documents')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('category', 'general')
        .field('recipientType', 'company')
        .attach('document', Buffer.from('download me'), {
          filename: 'download-test.pdf',
          contentType: 'application/pdf',
        });
      documentId = response.body.data.id;
    });

    it('should download document', async () => {
      const response = await request(app)
        .get(`/api/v2/documents/${documentId}/download`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status !== 200) {
        console.error('Download error response:', JSON.stringify(response.body, null, 2));
      }

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/^application\/pdf/);
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('download-test.pdf');
    });

    it('should preview document inline', async () => {
      const response = await request(app)
        .get(`/api/v2/documents/${documentId}/preview`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status !== 200) {
        console.error('Preview error response:', JSON.stringify(response.body, null, 2));
      }

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/^application\/pdf/);
      expect(response.headers['content-disposition']).toContain('inline');
    });
  });

  describe('GET /api/v2/documents/stats', () => {
    it('should get document statistics', async () => {
      const response = await request(app)
        .get('/api/v2/documents/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        unreadCount: expect.any(Number),
        storageUsed: expect.any(Number), // Admin only
        categoryCounts: {
          personal: expect.any(Number),
          work: expect.any(Number),
          training: expect.any(Number),
          general: expect.any(Number),
          salary: expect.any(Number),
        },
      });
    });

    it('should not show storage for regular users', async () => {
      const response = await request(app)
        .get('/api/v2/documents/stats')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.storageUsed).toBe(0);
      expect(response.body.data.unreadCount).toBeDefined();
    });
  });

  describe('Validation', () => {
    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v2/documents')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('document', Buffer.from('test'), {
          filename: 'test.pdf',
          contentType: 'application/pdf',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.details).toBeDefined();
    });

    it('should validate category values', async () => {
      const response = await request(app)
        .post('/api/v2/documents')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('category', 'invalid-category')
        .field('recipientType', 'company')
        .attach('document', Buffer.from('test'), {
          filename: 'test.pdf',
          contentType: 'application/pdf',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.details).toContainEqual(
        expect.objectContaining({
          field: 'category',
          message: expect.stringContaining('Invalid category'),
        }),
      );
    });

    it('should validate recipient requirements', async () => {
      const response = await request(app)
        .post('/api/v2/documents')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('category', 'general')
        .field('recipientType', 'user') // But no userId
        .attach('document', Buffer.from('test'), {
          filename: 'test.pdf',
          contentType: 'application/pdf',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('User ID is required');
    });
  });
});
