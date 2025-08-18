/**
 * Server Entry Point
 * Starts the Express server and WebSocket
 */

// import { Application } from 'express';
import fs from "fs";
import http, { Server } from "http";
import path from "path";
import app from "./app";
import { logger } from "./utils/logger";
import { ChatWebSocketServer } from "./websocket";
/**
 * Server Entry Point
 * Starts the Express server and WebSocket
 */

// import { Application } from 'express';

// Get project root directory
const projectRoot = process.cwd();

// Import app and WebSocket setup
// Create HTTP server
const server: Server = http.createServer(app);

// Setup WebSocket
new ChatWebSocketServer(server);

// Get port from environment
const PORT: number = Number.parseInt(process.env.PORT ?? "3000", 10);

// Start server
server.listen(PORT, (): void => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`WebSocket server running on ws://localhost:${PORT}`);

  // Log environment
  logger.info(`Environment: ${process.env.NODE_ENV ?? "development"}`);
  logger.info(
    "🚀 Live-Reload is working! Changed at: " + new Date().toISOString(),
  );

  // Create required directories
  createRequiredDirectories();
});

// Create required directories
function createRequiredDirectories(): void {
  const dirs: string[] = [
    path.join(projectRoot, "uploads"),
    path.join(projectRoot, "uploads/profile_pictures"),
    path.join(projectRoot, "uploads/documents"),
    path.join(projectRoot, "uploads/chat-attachments"),
    path.join(projectRoot, "uploads/kvp-attachments"),
    path.join(projectRoot, "backend/logs"),
  ];

  dirs.forEach((dir: string): void => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created directory: ${dir}`);
    }
  });
}

// Graceful shutdown
process.on("SIGTERM", (): void => {
  logger.info("SIGTERM signal received: closing HTTP server");
  server.close((): void => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
});

export default server;

// CommonJS compatibility
