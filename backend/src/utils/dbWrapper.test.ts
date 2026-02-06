import { describe, expect, it, vi } from 'vitest';

import { ConnectionWrapper, wrapConnection } from './dbWrapper.js';

function createMockConn() {
  return {
    query: vi.fn(),
    execute: vi.fn(),
    beginTransaction: vi.fn(),
    commit: vi.fn(),
    rollback: vi.fn(),
    release: vi.fn(),
  };
}

describe('ConnectionWrapper', () => {
  describe('query', () => {
    it('should delegate to conn.query and return the rows', async () => {
      const mockConn = createMockConn();
      const rows = [{ id: 1, name: 'test' }];
      mockConn.query.mockResolvedValue([rows]);

      const wrapper = new ConnectionWrapper(mockConn as never);
      const result = await wrapper.query(
        'SELECT * FROM users WHERE id = $1',
        [1],
      );

      expect(result).toEqual(rows);
      expect(mockConn.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1',
        [1],
      );
    });

    it('should work without params', async () => {
      const mockConn = createMockConn();
      mockConn.query.mockResolvedValue([[]]);

      const wrapper = new ConnectionWrapper(mockConn as never);
      await wrapper.query('SELECT 1');

      expect(mockConn.query).toHaveBeenCalledWith('SELECT 1', undefined);
    });
  });

  describe('execute', () => {
    it('should delegate to conn.execute and return the result header', async () => {
      const mockConn = createMockConn();
      const resultHeader = { affectedRows: 1 };
      mockConn.execute.mockResolvedValue([resultHeader]);

      const wrapper = new ConnectionWrapper(mockConn as never);
      const result = await wrapper.execute(
        'INSERT INTO users (name) VALUES ($1)',
        ['test'],
      );

      expect(result).toEqual(resultHeader);
      expect(mockConn.execute).toHaveBeenCalledWith(
        'INSERT INTO users (name) VALUES ($1)',
        ['test'],
      );
    });
  });

  describe('transaction methods', () => {
    it('should delegate beginTransaction to conn', async () => {
      const mockConn = createMockConn();
      mockConn.beginTransaction.mockResolvedValue(undefined);

      const wrapper = new ConnectionWrapper(mockConn as never);
      await wrapper.beginTransaction();

      expect(mockConn.beginTransaction).toHaveBeenCalledOnce();
    });

    it('should delegate commit to conn', async () => {
      const mockConn = createMockConn();
      mockConn.commit.mockResolvedValue(undefined);

      const wrapper = new ConnectionWrapper(mockConn as never);
      await wrapper.commit();

      expect(mockConn.commit).toHaveBeenCalledOnce();
    });

    it('should delegate rollback to conn', async () => {
      const mockConn = createMockConn();
      mockConn.rollback.mockResolvedValue(undefined);

      const wrapper = new ConnectionWrapper(mockConn as never);
      await wrapper.rollback();

      expect(mockConn.rollback).toHaveBeenCalledOnce();
    });
  });

  describe('release', () => {
    it('should delegate release to conn', () => {
      const mockConn = createMockConn();

      const wrapper = new ConnectionWrapper(mockConn as never);
      wrapper.release();

      expect(mockConn.release).toHaveBeenCalledOnce();
    });
  });
});

describe('wrapConnection', () => {
  it('should return a ConnectionWrapper instance', () => {
    const mockConn = createMockConn();
    const wrapper = wrapConnection(mockConn as never);
    expect(wrapper).toBeInstanceOf(ConnectionWrapper);
  });
});
