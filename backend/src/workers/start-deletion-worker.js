#!/usr/bin/env node
/**
 * Start script for the deletion worker
 * This script ensures the worker runs with proper TypeScript support
 */

// Register TypeScript
require('../register-ts');

// Load environment variables
require('dotenv').config();

// Import and start the worker
const { DeletionWorker } = require('./deletionWorker');

console.log('Starting Tenant Deletion Worker...');

const worker = new DeletionWorker();
worker.start().catch((error) => {
  console.error('Fatal error starting deletion worker:', error);
  process.exit(1);
});
