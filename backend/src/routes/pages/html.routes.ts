/**
 * HTML Routes
 * Serves frontend pages
 */
import express, { Request, RequestHandler, Response, Router } from 'express';
import path from 'path';

import { rateLimiter } from '../../middleware/rateLimiter.js';
import { authenticateV2, requireRoleV2 } from '../../middleware/v2/auth.middleware.js';

const router: Router = express.Router();

// Get project root directory
const projectRoot = process.cwd();

// Extended Request interfaces - removed unused types

// Helper function to serve HTML files
const servePage =
  (pageName: string) =>
  (_req: Request, res: Response): void => {
    // Always serve from dist directory (built files)
    const distPath = path.join(projectRoot, 'frontend/dist/pages', `${pageName}.html`);
    res.sendFile(distPath);
  };

// Public pages
// Root '/' is handled by redirectToDashboard middleware in app.ts
router.get('/index', rateLimiter.public, servePage('index'));
router.get('/pages/index', rateLimiter.public, (_req: Request, res: Response) => {
  res.redirect('/index');
}); // Redirect old URL
router.get('/login', rateLimiter.auth, servePage('login'));
router.get('/pages/login', rateLimiter.public, (_req: Request, res: Response) => {
  res.redirect('/login');
}); // Redirect old URL
router.get('/signup', rateLimiter.auth, servePage('signup'));
router.get('/pages/signup', rateLimiter.public, (_req: Request, res: Response) => {
  res.redirect('/signup');
}); // Redirect old URL

// Development only - Design System Style Guide
if (process.env['NODE_ENV'] !== 'production') {
  router.get('/design-standards', rateLimiter.public, servePage('design-standards'));
}

// Authenticated pages - All users
router.get('/dashboard', rateLimiter.authenticated, authenticateV2, servePage('dashboard'));
router.get('/profile', rateLimiter.authenticated, authenticateV2, servePage('profile'));
router.get(
  '/profile-picture',
  rateLimiter.authenticated,
  authenticateV2,
  servePage('profile-picture'),
);
router.get('/settings', rateLimiter.authenticated, authenticateV2, servePage('settings'));
router.get('/chat', rateLimiter.authenticated, authenticateV2, servePage('chat'));
router.get('/blackboard', rateLimiter.authenticated, authenticateV2, servePage('blackboard'));
router.get('/calendar', rateLimiter.authenticated, authenticateV2, servePage('calendar'));
router.get('/kvp', rateLimiter.authenticated, authenticateV2, servePage('kvp'));
router.get('/kvp-detail', rateLimiter.authenticated, authenticateV2, servePage('kvp-detail'));
router.get(
  '/blackboard-detail',
  rateLimiter.authenticated,
  authenticateV2,
  servePage('blackboard-detail'),
);
// Redirect main documents page to explorer
router.get(
  '/documents',
  rateLimiter.authenticated,
  authenticateV2,
  (_req: Request, res: Response) => {
    res.redirect('/documents-explorer');
  },
);
// Redirects from old document pages to new Documents Explorer
router.get(
  '/documents-personal',
  rateLimiter.authenticated,
  authenticateV2,
  (_req: Request, res: Response) => {
    res.redirect('/documents-explorer/personal');
  },
);
router.get(
  '/documents-payroll',
  rateLimiter.authenticated,
  authenticateV2,
  (_req: Request, res: Response) => {
    res.redirect('/documents-explorer/payroll');
  },
);
router.get(
  '/documents-company',
  rateLimiter.authenticated,
  authenticateV2,
  (_req: Request, res: Response) => {
    res.redirect('/documents-explorer/company');
  },
);
router.get(
  '/documents-department',
  rateLimiter.authenticated,
  authenticateV2,
  (_req: Request, res: Response) => {
    res.redirect('/documents-explorer/department');
  },
);
router.get(
  '/documents-team',
  rateLimiter.authenticated,
  authenticateV2,
  (_req: Request, res: Response) => {
    res.redirect('/documents-explorer/team');
  },
);
// Redirect old documents-search to new explorer
router.get('/documents-search', (_req: Request, res: Response) => {
  res.redirect('/documents-explorer');
});

// Documents Explorer - New unified view
router.get(
  '/documents-explorer',
  rateLimiter.authenticated,
  authenticateV2,
  servePage('documents-explorer'),
);
// Documents Explorer with category parameter (for client-side routing)
router.get(
  '/documents-explorer/:category',
  rateLimiter.authenticated,
  authenticateV2,
  servePage('documents-explorer'),
);

// Employee pages
router.get(
  '/employee-dashboard',
  rateLimiter.authenticated,
  authenticateV2,
  servePage('employee-dashboard'),
);
router.get(
  '/employee-profile',
  rateLimiter.authenticated,
  authenticateV2,
  servePage('employee-profile'),
);
router.get(
  '/employee-documents',
  rateLimiter.authenticated,
  authenticateV2,
  servePage('employee-documents'),
);
router.get(
  '/salary-documents',
  rateLimiter.authenticated,
  authenticateV2,
  servePage('salary-documents'),
);
router.get(
  '/survey-employee',
  rateLimiter.authenticated,
  authenticateV2,
  servePage('survey-employee'),
);
router.get('/shifts', rateLimiter.authenticated, authenticateV2, servePage('shifts'));

// Admin pages
router.get(
  '/admin-dashboard',
  rateLimiter.admin,
  authenticateV2,
  requireRoleV2('admin') as RequestHandler,
  servePage('admin-dashboard'),
);
router.get(
  '/admin-config',
  rateLimiter.admin,
  authenticateV2,
  requireRoleV2('admin') as RequestHandler,
  servePage('admin-config'),
);
router.get(
  '/org-management',
  rateLimiter.admin,
  authenticateV2,
  requireRoleV2('admin') as RequestHandler,
  servePage('org-management'),
);
// Redirect old upload page to explorer (upload is now integrated)
router.get(
  '/document-upload',
  rateLimiter.admin,
  authenticateV2,
  requireRoleV2('admin') as RequestHandler,
  (_req: Request, res: Response) => {
    res.redirect('/documents-explorer');
  },
);
router.get(
  '/archived-employees',
  rateLimiter.admin,
  authenticateV2,
  requireRoleV2('admin') as RequestHandler,
  servePage('archived-employees'),
);
router.get(
  '/manage-departments',
  rateLimiter.admin,
  authenticateV2,
  requireRoleV2('root') as RequestHandler,
  servePage('manage-departments'),
);
router.get(
  '/manage-employees',
  rateLimiter.admin,
  authenticateV2,
  requireRoleV2('admin') as RequestHandler,
  servePage('manage-employees'),
);
router.get(
  '/manage-areas',
  rateLimiter.admin,
  authenticateV2,
  requireRoleV2('root') as RequestHandler,
  servePage('manage-areas'),
);
router.get(
  '/manage-teams',
  rateLimiter.admin,
  authenticateV2,
  requireRoleV2('admin') as RequestHandler,
  servePage('manage-teams'),
);
router.get(
  '/manage-machines',
  rateLimiter.admin,
  authenticateV2,
  requireRoleV2('admin') as RequestHandler,
  servePage('manage-machines'),
);
router.get(
  '/admin-profile',
  rateLimiter.admin,
  authenticateV2,
  requireRoleV2('admin') as RequestHandler,
  servePage('admin-profile'),
);
router.get(
  '/manage-admins',
  rateLimiter.admin,
  authenticateV2,
  requireRoleV2('admin') as RequestHandler,
  servePage('manage-admins'),
);
// NOTE: /manage-department-groups route REMOVED - department_groups deprecated, use Areas instead
router.get(
  '/storage-upgrade',
  rateLimiter.admin,
  authenticateV2,
  requireRoleV2('admin') as RequestHandler,
  servePage('storage-upgrade'),
);
router.get(
  '/feature-management',
  rateLimiter.admin,
  authenticateV2,
  requireRoleV2('admin') as RequestHandler,
  servePage('feature-management'),
);
router.get(
  '/survey-admin',
  rateLimiter.admin,
  authenticateV2,
  requireRoleV2('admin') as RequestHandler,
  servePage('survey-admin'),
);
router.get(
  '/survey-results',
  rateLimiter.admin,
  authenticateV2,
  requireRoleV2('admin') as RequestHandler,
  servePage('survey-results'),
);
router.get(
  '/survey-details',
  rateLimiter.authenticated,
  authenticateV2,
  servePage('survey-details'),
);

// Root pages
router.get(
  '/root-dashboard',
  rateLimiter.admin,
  authenticateV2,
  requireRoleV2('root') as RequestHandler,
  servePage('root-dashboard'),
);
router.get(
  '/root-features',
  rateLimiter.admin,
  authenticateV2,
  requireRoleV2('root') as RequestHandler,
  servePage('root-features'),
);
router.get(
  '/root-profile',
  rateLimiter.admin,
  authenticateV2,
  requireRoleV2('root') as RequestHandler,
  servePage('root-profile'),
);
router.get(
  '/manage-root',
  rateLimiter.admin,
  authenticateV2,
  requireRoleV2('root') as RequestHandler,
  servePage('manage-root'),
);
router.get(
  '/account-settings',
  rateLimiter.admin,
  authenticateV2,
  requireRoleV2('root') as RequestHandler,
  servePage('account-settings'),
);
router.get(
  '/tenant-deletion-status',
  rateLimiter.admin,
  authenticateV2,
  requireRoleV2('root') as RequestHandler,
  servePage('tenant-deletion-status'),
);
router.get(
  '/logs',
  rateLimiter.admin,
  authenticateV2,
  requireRoleV2('root') as RequestHandler,
  servePage('logs'),
);

// Development only pages
if (process.env['NODE_ENV'] !== 'production') {
  router.get('/api-test', rateLimiter.public, servePage('api-test'));
  router.get('/test-db', rateLimiter.public, servePage('test-db'));
  router.get('/debug-dashboard', rateLimiter.public, servePage('debug-dashboard'));
  router.get('/token-debug', rateLimiter.public, servePage('token-debug'));
  // Note: Design System documentation moved to Storybook (localhost:6006)
  // Run: pnpm run storybook
}

export default router;

// CommonJS compatibility
