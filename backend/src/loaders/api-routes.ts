/**
 * API Routes Configuration Loader
 * Mounts all API v2 routes in the correct order
 *
 * Note: This file intentionally has many imports (26+ routes).
 * This is the central router that must import all API v2 endpoints.
 */
/* eslint-disable import-x/max-dependencies */
import express, { Application } from 'express';

// V2 Routes imports
import adminPermissionsV2Routes from '../routes/v2/admin-permissions/index.js';
import areasV2Routes from '../routes/v2/areas/index.js';
import auditTrailV2Routes from '../routes/v2/audit-trail/index.js';
import authV2Routes from '../routes/v2/auth/index.js';
import blackboardV2Routes from '../routes/v2/blackboard/index.js';
import calendarV2Routes from '../routes/v2/calendar/index.js';
import chatV2Routes from '../routes/v2/chat/index.js';
import departmentGroupsV2Routes from '../routes/v2/department-groups/index.js';
import departmentsV2Routes from '../routes/v2/departments/index.js';
import documentsV2Routes from '../routes/v2/documents/index.js';
import featuresV2Routes from '../routes/v2/features/index.js';
import kvpV2Routes from '../routes/v2/kvp/index.js';
import logsV2Routes from '../routes/v2/logs/index.js';
import machinesV2Routes from '../routes/v2/machines/index.js';
import notificationsV2Routes from '../routes/v2/notifications/index.js';
import plansV2Routes from '../routes/v2/plans/index.js';
import reportsV2Routes from '../routes/v2/reports/index.js';
import roleSwitchV2Routes from '../routes/v2/role-switch/index.js';
import rolesV2Routes from '../routes/v2/roles/index.js';
import rootV2Routes from '../routes/v2/root/index.js';
import settingsV2Routes from '../routes/v2/settings/index.js';
import shiftsV2Routes from '../routes/v2/shifts/index.js';
import signupV2Routes from '../routes/v2/signup/index.js';
import surveysV2Routes from '../routes/v2/surveys/index.js';
import teamsV2Routes from '../routes/v2/teams/index.js';
import usersV2Routes from '../routes/v2/users/index.js';

/**
 * Helper function to mount routes with error handling
 * @param app - Express application
 * @param path - Route path
 * @param router - Express router or middleware
 */
function mountRoute(
  app: Application,
  path: string,
  router: express.Router | express.RequestHandler,
): void {
  app.use(path, router);
  if (process.env.NODE_ENV !== 'production') {
    console.info(`[DEBUG] Route mounted: ${path}`);
  }
}

/**
 * Load API routes configuration
 * @param app - Express application instance
 */
export function loadAPIRoutes(app: Application): void {
  // Mount V2 API routes in order of importance/frequency
  // Auth routes first (most critical)
  mountRoute(app, '/api/v2/signup', signupV2Routes);
  mountRoute(app, '/api/v2/auth', authV2Routes);
  mountRoute(app, '/api/v2/users', usersV2Routes);

  // Core functionality routes
  mountRoute(app, '/api/v2/calendar', calendarV2Routes);
  mountRoute(app, '/api/v2/chat', chatV2Routes);
  mountRoute(app, '/api/v2/departments', departmentsV2Routes);
  mountRoute(app, '/api/v2/documents', documentsV2Routes);
  mountRoute(app, '/api/v2/teams', teamsV2Routes);
  mountRoute(app, '/api/v2/blackboard', blackboardV2Routes);

  // Feature routes
  mountRoute(app, '/api/v2/role-switch', roleSwitchV2Routes);
  mountRoute(app, '/api/v2/kvp', kvpV2Routes);
  mountRoute(app, '/api/v2/logs', logsV2Routes);
  mountRoute(app, '/api/v2/machines', machinesV2Routes);
  mountRoute(app, '/api/v2/shifts', shiftsV2Routes);
  mountRoute(app, '/api/v2/surveys', surveysV2Routes);
  mountRoute(app, '/api/v2/notifications', notificationsV2Routes);

  // Administrative routes
  mountRoute(app, '/api/v2/plans', plansV2Routes);
  mountRoute(app, '/api/v2/reports', reportsV2Routes);
  mountRoute(app, '/api/v2/settings', settingsV2Routes);
  mountRoute(app, '/api/v2/features', featuresV2Routes);
  mountRoute(app, '/api/v2/audit-trail', auditTrailV2Routes);
  mountRoute(app, '/api/v2/areas', areasV2Routes);
  mountRoute(app, '/api/v2/root', rootV2Routes);
  mountRoute(app, '/api/v2/admin-permissions', adminPermissionsV2Routes);
  mountRoute(app, '/api/v2/department-groups', departmentGroupsV2Routes);
  mountRoute(app, '/api/v2/roles', rolesV2Routes);

  console.log('✅ API v2 routes mounted');
}
