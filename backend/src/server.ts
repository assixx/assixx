/**
 * Server Entry Point
 * Starts the Express server and WebSocket
 */

// import { Application } from 'express';
import http, { Server } from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './utils/logger';

// ES modules equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import app and WebSocket setup
import app from './app';
import { ChatWebSocketServer } from './websocket';

// Create HTTP server
const server: Server = http.createServer(app);

// Setup WebSocket
new ChatWebSocketServer(server);

// Get port from environment
const PORT: number = parseInt(process.env.PORT || '3000', 10);

// Start server
server.listen(PORT, (): void => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`WebSocket server running on ws://localhost:${PORT}`);

  // Log environment
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(
    '🚀 Live-Reload is working! Changed at: ' + new Date().toISOString()
  );

  // Create required directories
  createRequiredDirectories();
});

// Create required directories
function createRequiredDirectories(): void {
  const dirs: string[] = [
    path.join(__dirname, '../../uploads'),
    path.join(__dirname, '../../uploads/profile_pictures'),
    path.join(__dirname, '../../uploads/documents'),
    path.join(__dirname, '../../uploads/chat-attachments'),
    path.join(__dirname, '../../uploads/kvp-attachments'),
    path.join(__dirname, '../logs'),
  ];

  dirs.forEach((dir: string): void => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created directory: ${dir}`);
    }
  });
}

// Graceful shutdown
process.on('SIGTERM', (): void => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close((): void => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

export default server;

// CommonJS compatibility
