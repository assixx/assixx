/**
 * Server Entry Point
 * Starts the Express server and WebSocket
 */

const app = require('./app');
const http = require('http');
const { logger } = require('./utils/logger');
const setupWebSocket = require('./websocket');

// Create HTTP server
const server = http.createServer(app);

// Setup WebSocket
const ChatWebSocketServer = require('./websocket');
const wsServer = new ChatWebSocketServer(server);

// Get port from environment
const PORT = process.env.PORT || 3000;

// Start server
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`WebSocket server running on ws://localhost:${PORT}`);

  // Log environment
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // Create required directories
  createRequiredDirectories();
});

// Create required directories
function createRequiredDirectories() {
  const fs = require('fs');
  const path = require('path');

  const dirs = [
    path.join(__dirname, '../../uploads'),
    path.join(__dirname, '../../uploads/profile_pictures'),
    path.join(__dirname, '../../uploads/documents'),
    path.join(__dirname, '../../uploads/chat-attachments'),
    path.join(__dirname, '../../uploads/kvp-attachments'),
    path.join(__dirname, '../logs'),
  ];

  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created directory: ${dir}`);
    }
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

module.exports = server;
