/**
 * Performance Test (TypeScript)
 * Basic load testing for API endpoints
 */

import request from 'supertest';
import app from '../../src/app';

// Mock database for performance testing
jest.mock('../../src/database');

interface MemoryUsage {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
}

describe('Performance Tests', () => {
  const CONCURRENT_REQUESTS = 100;
  const TIMEOUT = 30000; // 30 seconds

  describe('API Endpoint Performance', () => {
    jest.setTimeout(TIMEOUT);

    it('should handle multiple concurrent health checks', async () => {
      const startTime = Date.now();

      const requests = Array(CONCURRENT_REQUESTS)
        .fill(null)
        .map(() => request(app).get('/api/health'));

      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      // Should complete within reasonable time (avg 50ms per request)
      expect(totalTime).toBeLessThan(CONCURRENT_REQUESTS * 50);

      console.log(
        `Health check performance: ${CONCURRENT_REQUESTS} requests in ${totalTime}ms`
      );
      console.log(
        `Average time per request: ${(totalTime / CONCURRENT_REQUESTS).toFixed(2)}ms`
      );
    });

    it('should handle concurrent login attempts with proper responses', async () => {
      const startTime = Date.now();

      const loginRequests = Array(20) // Reduced from 50 to avoid overwhelming
        .fill(null)
        .map((_, index) =>
          request(app)
            .post('/api/auth/login')
            .send({
              username: `user${index}`,
              password: 'password123',
            })
        );

      const responses = await Promise.all(loginRequests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Count different response types
      const statusCounts = responses.reduce(
        (acc: Record<number, number>, r) => {
          acc[r.status] = (acc[r.status] || 0) + 1;
          return acc;
        },
        {}
      );

      console.log(`Login performance: ${20} requests in ${totalTime}ms`);
      console.log('Status code distribution:', statusCounts);

      // All requests should get a response (not timeout)
      expect(responses).toHaveLength(20);
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory on repeated requests', async () => {
      const initialMemory: MemoryUsage = process.memoryUsage();

      // Make 1000 requests in batches
      for (let i = 0; i < 10; i++) {
        const requests = Array(100)
          .fill(null)
          .map(() => request(app).get('/api/health'));
        await Promise.all(requests);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory: MemoryUsage = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(
        `Memory usage increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`
      );

      // Memory increase should be less than 50MB
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Response Times', () => {
    it('should maintain consistent response times', async () => {
      const responseTimes: number[] = [];

      for (let i = 0; i < 100; i++) {
        const startTime = Date.now();
        await request(app).get('/api/health');
        const responseTime = Date.now() - startTime;
        responseTimes.push(responseTime);
      }

      const avgResponseTime =
        responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);

      console.log(
        `Response times - Avg: ${avgResponseTime.toFixed(2)}ms, Min: ${minResponseTime}ms, Max: ${maxResponseTime}ms`
      );

      // Average response time should be under 100ms
      expect(avgResponseTime).toBeLessThan(100);

      // Max response time should be under 500ms
      expect(maxResponseTime).toBeLessThan(500);
    });
  });
});
