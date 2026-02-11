/**
 * Presence Store
 *
 * In-memory registry of currently connected WebSocket user IDs.
 * Written by ChatWebSocketServer (on connect/disconnect),
 * read by ChatService (to enrich REST responses with live status).
 *
 * Singleton lifecycle: created by NestJS DI, passed to ChatWebSocketServer
 * via main.ts after bootstrap.
 */
import { Injectable } from '@nestjs/common';

@Injectable()
export class PresenceStore {
  private readonly onlineUsers = new Set<number>();

  /** Mark user as online (called on WebSocket connect) */
  add(userId: number): void {
    this.onlineUsers.add(userId);
  }

  /** Mark user as offline (called on WebSocket disconnect) */
  remove(userId: number): void {
    this.onlineUsers.delete(userId);
  }

  /** Check if a specific user is online */
  isOnline(userId: number): boolean {
    return this.onlineUsers.has(userId);
  }

  /** Get all online user IDs (read-only snapshot) */
  getOnlineUserIds(): ReadonlySet<number> {
    return this.onlineUsers;
  }
}
