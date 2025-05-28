/**
 * Central Route Registry
 * All API routes are registered here
 */

const express = require('express');
const router = express.Router();

// Import all route modules
const authRoutes = require('./auth.routes');
const userRoutes = require('./users');
const documentRoutes = require('./documents');
const blackboardRoutes = require('./blackboard');
const calendarRoutes = require('./calendar');
const chatRoutes = require('./chat');
const kvpRoutes = require('./kvp');
const shiftRoutes = require('./shifts');
const surveyRoutes = require('./surveys');
const featureRoutes = require('./features');
const departmentRoutes = require('./departments');
const teamRoutes = require('./teams');
const adminRoutes = require('./admin');
const rootRoutes = require('./root');
const employeeRoutes = require('./employee');
const machineRoutes = require('./machines');
const areaRoutes = require('./areas');

// API Version prefix
const API_PREFIX = '/api';

// Public routes (no prefix needed)
console.log('[DEBUG] Mounting auth routes at /api/auth');
router.use('/api/auth', authRoutes);

// Protected routes with prefix
router.use(`${API_PREFIX}/users`, userRoutes);
router.use(`${API_PREFIX}/documents`, documentRoutes);
router.use(`${API_PREFIX}/blackboard`, blackboardRoutes);
router.use(`${API_PREFIX}/calendar`, calendarRoutes);
router.use(`${API_PREFIX}/chat`, chatRoutes);
router.use(`${API_PREFIX}/kvp`, kvpRoutes);
router.use(`${API_PREFIX}/shifts`, shiftRoutes);
router.use(`${API_PREFIX}/surveys`, surveyRoutes);
router.use(`${API_PREFIX}/features`, featureRoutes);
router.use(`${API_PREFIX}/departments`, departmentRoutes);
router.use(`${API_PREFIX}/teams`, teamRoutes);
router.use(`${API_PREFIX}/admin`, adminRoutes);
router.use(`${API_PREFIX}/root`, rootRoutes);
router.use(`${API_PREFIX}/employee`, employeeRoutes);
router.use(`${API_PREFIX}/machines`, machineRoutes);
router.use(`${API_PREFIX}/areas`, areaRoutes);

// Health check endpoint
router.get(`${API_PREFIX}/health`, (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 404 handler for API routes
router.use(`${API_PREFIX}`, (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    path: req.originalUrl,
  });
});

module.exports = router;
