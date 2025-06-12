/**
 * Unit Tests for Blackboard API Routes
 * Tests all endpoints and various scenarios
 */

import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';
import blackboardRoutes from '../blackboard';
import { authenticateToken } from '../../middleware/auth';
import blackboardModel from '../../models/blackboard';

// Mock dependencies
jest.mock('../../middleware/auth');
jest.mock('../../models/blackboard');
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Create test app
const app = express();
app.use(express.json());
app.use('/api/blackboard', blackboardRoutes);

// Mock authenticated user
const mockUser = {
  id: 1,
  tenant_id: 1,
  role: 'admin',
  departmentId: 1,
  teamId: 1,
  username: 'testuser',
  email: 'test@example.com',
};

// Setup mock middleware
beforeEach(() => {
  jest.clearAllMocks();
  (authenticateToken as jest.Mock).mockImplementation((req, res, next) => {
    req.user = mockUser;
    next();
  });
});

describe('Blackboard API Routes', () => {
  describe('GET /api/blackboard', () => {
    it('should fetch all blackboard entries', async () => {
      const mockEntries = {
        entries: [
          {
            id: 1,
            title: 'Test Entry',
            content: 'Test Content',
            org_level: 'company',
            org_id: null,
            priority: 'normal',
            color: 'blue',
          },
        ],
        pagination: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      };

      (blackboardModel.getAllEntries as jest.Mock).mockResolvedValue(
        mockEntries
      );

      const response = await request(app).get('/api/blackboard').expect(200);

      expect(response.body).toEqual(mockEntries);
      expect(blackboardModel.getAllEntries).toHaveBeenCalledWith(
        1, // tenant_id
        1, // user_id
        expect.objectContaining({
          status: 'active',
          filter: 'all',
          search: '',
          page: 1,
          limit: 10,
          sortBy: 'created_at',
          sortDir: 'DESC',
        })
      );
    });

    it('should handle query parameters correctly', async () => {
      (blackboardModel.getAllEntries as jest.Mock).mockResolvedValue({
        entries: [],
        pagination: {},
      });

      await request(app)
        .get(
          '/api/blackboard?status=archived&filter=department&search=test&page=2&limit=20'
        )
        .expect(200);

      expect(blackboardModel.getAllEntries).toHaveBeenCalledWith(
        1,
        1,
        expect.objectContaining({
          status: 'archived',
          filter: 'department',
          search: 'test',
          page: 2,
          limit: 20,
        })
      );
    });
  });

  describe('POST /api/blackboard', () => {
    it('should create a company-level entry', async () => {
      const newEntry = {
        title: 'Company Announcement',
        content: 'Important news for all',
        org_level: 'company',
        org_id: null,
        priority_level: 'high',
        color: 'red',
        tags: ['important', 'announcement'],
      };

      const createdEntry = {
        id: 1,
        ...newEntry,
        priority: 'high',
        tenant_id: 1,
        author_id: 1,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (blackboardModel.createEntry as jest.Mock).mockResolvedValue(
        createdEntry
      );

      const response = await request(app)
        .post('/api/blackboard')
        .send(newEntry)
        .expect(201);

      expect(response.body).toEqual(createdEntry);
      expect(blackboardModel.createEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 1,
          title: 'Company Announcement',
          content: 'Important news for all',
          org_level: 'company',
          org_id: null,
          author_id: 1,
          priority: 'high', // Should map priority_level to priority
          color: 'red',
          tags: ['important', 'announcement'],
        })
      );
    });

    it('should create a department-level entry', async () => {
      const newEntry = {
        title: 'Department Update',
        content: 'Department specific news',
        org_level: 'department',
        org_id: '5',
        priority: 'normal',
        color: 'green',
      };

      (blackboardModel.createEntry as jest.Mock).mockResolvedValue({
        id: 2,
        ...newEntry,
      });

      const response = await request(app)
        .post('/api/blackboard')
        .send(newEntry)
        .expect(201);

      expect(blackboardModel.createEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          org_level: 'department',
          org_id: 5, // Should convert string to number
          priority: 'normal',
        })
      );
    });

    it('should create a team-level entry', async () => {
      const newEntry = {
        title: 'Team Meeting',
        content: 'Weekly team sync',
        org_level: 'team',
        org_id: 10,
        priority: 'low',
      };

      (blackboardModel.createEntry as jest.Mock).mockResolvedValue({
        id: 3,
        ...newEntry,
      });

      await request(app).post('/api/blackboard').send(newEntry).expect(201);

      expect(blackboardModel.createEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          org_level: 'team',
          org_id: 10,
        })
      );
    });

    it('should handle missing required fields', async () => {
      const invalidEntry = {
        title: 'Missing Content',
        // Missing content and org_level
      };

      (blackboardModel.createEntry as jest.Mock).mockRejectedValue(
        new Error('Missing required fields')
      );

      const response = await request(app)
        .post('/api/blackboard')
        .send(invalidEntry)
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Missing required fields');
    });

    it('should set default values correctly', async () => {
      const minimalEntry = {
        title: 'Minimal Entry',
        content: 'Basic content',
        org_level: 'company',
      };

      (blackboardModel.createEntry as jest.Mock).mockResolvedValue({ id: 4 });

      await request(app).post('/api/blackboard').send(minimalEntry).expect(201);

      expect(blackboardModel.createEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'normal', // Default
          color: 'blue', // Default
          tags: [], // Default
          requires_confirmation: false, // Default
          expires_at: null, // Default
        })
      );
    });
  });

  describe('GET /api/blackboard/:id', () => {
    it('should fetch a specific entry', async () => {
      const mockEntry = {
        id: 1,
        title: 'Test Entry',
        content: 'Test Content',
        org_level: 'company',
        author_name: 'testuser',
        is_confirmed: false,
      };

      (blackboardModel.getEntryById as jest.Mock).mockResolvedValue(mockEntry);

      const response = await request(app).get('/api/blackboard/1').expect(200);

      expect(response.body).toEqual(mockEntry);
      expect(blackboardModel.getEntryById).toHaveBeenCalledWith(1, 1, 1);
    });

    it('should return 404 for non-existent entry', async () => {
      (blackboardModel.getEntryById as jest.Mock).mockResolvedValue(null);

      await request(app).get('/api/blackboard/999').expect(404);
    });
  });

  describe('PUT /api/blackboard/:id', () => {
    it('should update an entry', async () => {
      const updateData = {
        title: 'Updated Title',
        content: 'Updated Content',
        priority: 'urgent',
        color: 'yellow',
      };

      const updatedEntry = {
        id: 1,
        ...updateData,
        updated_at: new Date(),
      };

      // Mock canManageEntry middleware
      (blackboardModel.getEntryById as jest.Mock).mockResolvedValue({
        id: 1,
        author_id: 1,
      });

      (blackboardModel.updateEntry as jest.Mock).mockResolvedValue(
        updatedEntry
      );

      const response = await request(app)
        .put('/api/blackboard/1')
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual(updatedEntry);
      expect(blackboardModel.updateEntry).toHaveBeenCalledWith(
        1,
        expect.objectContaining(updateData),
        1
      );
    });
  });

  describe('DELETE /api/blackboard/:id', () => {
    it('should delete an entry', async () => {
      // Mock canManageEntry middleware
      (blackboardModel.getEntryById as jest.Mock).mockResolvedValue({
        id: 1,
        author_id: 1,
      });

      (blackboardModel.deleteEntry as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/blackboard/1')
        .expect(200);

      expect(response.body).toEqual({ message: 'Entry deleted successfully' });
      expect(blackboardModel.deleteEntry).toHaveBeenCalledWith(1, 1);
    });

    it('should return 404 if entry not found', async () => {
      (blackboardModel.getEntryById as jest.Mock).mockResolvedValue(null);

      await request(app).delete('/api/blackboard/999').expect(404);
    });
  });

  describe('POST /api/blackboard/:id/confirm', () => {
    it('should confirm an entry', async () => {
      (blackboardModel.confirmEntry as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .post('/api/blackboard/1/confirm')
        .expect(200);

      expect(response.body).toEqual({
        message: 'Entry confirmed successfully',
      });
      expect(blackboardModel.confirmEntry).toHaveBeenCalledWith(1, 1);
    });

    it('should handle confirmation failure', async () => {
      (blackboardModel.confirmEntry as jest.Mock).mockResolvedValue(false);

      await request(app).post('/api/blackboard/1/confirm').expect(400);
    });
  });

  describe('Permission Tests', () => {
    it('should allow admin to create any org_level entry', async () => {
      const entries = [
        { org_level: 'company', org_id: null },
        { org_level: 'department', org_id: 5 },
        { org_level: 'team', org_id: 10 },
      ];

      for (const entry of entries) {
        (blackboardModel.createEntry as jest.Mock).mockResolvedValue({ id: 1 });

        await request(app)
          .post('/api/blackboard')
          .send({
            title: 'Test',
            content: 'Test',
            ...entry,
          })
          .expect(201);
      }
    });

    it('should restrict non-admin users appropriately', async () => {
      // Change user role to regular employee
      (authenticateToken as jest.Mock).mockImplementation((req, res, next) => {
        req.user = { ...mockUser, role: 'employee' };
        next();
      });

      const response = await request(app)
        .post('/api/blackboard')
        .send({
          title: 'Employee trying company-wide',
          content: 'Should fail',
          org_level: 'company',
        })
        .expect(403);

      expect(response.body.message).toContain(
        'Only admins can create company-wide entries'
      );
    });
  });
});

describe('Edge Cases', () => {
  it('should handle database errors gracefully', async () => {
    (blackboardModel.getAllEntries as jest.Mock).mockRejectedValue(
      new Error('Database connection failed')
    );

    const response = await request(app).get('/api/blackboard').expect(500);

    expect(response.body.message).toBe('Error retrieving blackboard entries');
  });

  it('should handle invalid priority values', async () => {
    const entry = {
      title: 'Test',
      content: 'Test',
      org_level: 'company',
      priority: 'invalid-priority',
    };

    (blackboardModel.createEntry as jest.Mock).mockResolvedValue({ id: 1 });

    // Should still work as model handles validation
    await request(app).post('/api/blackboard').send(entry).expect(201);
  });

  it('should handle very long content', async () => {
    const longContent = 'A'.repeat(10000);
    const entry = {
      title: 'Long Content Test',
      content: longContent,
      org_level: 'company',
    };

    (blackboardModel.createEntry as jest.Mock).mockResolvedValue({ id: 1 });

    await request(app).post('/api/blackboard').send(entry).expect(201);

    expect(blackboardModel.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        content: longContent,
      })
    );
  });
});
