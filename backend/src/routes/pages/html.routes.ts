/**
 * HTML Routes
 * Serves frontend pages
 */
import express, { Request, RequestHandler, Response, Router } from 'express';
import path from 'path';

import { authenticateToken, requireRole } from '../../middleware/auth.js';
import { rateLimiter } from '../../middleware/rateLimiter.js';

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
if (process.env.NODE_ENV !== 'production') {
  router.get('/design-standards', rateLimiter.public, servePage('design-standards'));
}

// Authenticated pages - All users
router.get('/dashboard', rateLimiter.authenticated, authenticateToken, servePage('dashboard'));
router.get('/profile', rateLimiter.authenticated, authenticateToken, servePage('profile'));
router.get(
  '/profile-picture',
  rateLimiter.authenticated,
  authenticateToken,
  servePage('profile-picture'),
);
router.get('/settings', rateLimiter.authenticated, authenticateToken, servePage('settings'));
router.get('/hilfe', rateLimiter.authenticated, authenticateToken, servePage('hilfe'));
router.get('/chat', rateLimiter.authenticated, authenticateToken, servePage('chat'));
router.get('/blackboard', rateLimiter.authenticated, authenticateToken, servePage('blackboard'));
router.get('/calendar', rateLimiter.authenticated, authenticateToken, servePage('calendar'));
router.get('/kvp', rateLimiter.authenticated, authenticateToken, servePage('kvp'));
router.get('/kvp-detail', rateLimiter.authenticated, authenticateToken, servePage('kvp-detail'));
// Redirect main documents page to explorer
router.get(
  '/documents',
  rateLimiter.authenticated,
  authenticateToken,
  (_req: Request, res: Response) => {
    res.redirect('/documents-explorer');
  },
);
// Redirects from old document pages to new Documents Explorer
router.get(
  '/documents-personal',
  rateLimiter.authenticated,
  authenticateToken,
  (_req: Request, res: Response) => {
    res.redirect('/documents-explorer/personal');
  },
);
router.get(
  '/documents-payroll',
  rateLimiter.authenticated,
  authenticateToken,
  (_req: Request, res: Response) => {
    res.redirect('/documents-explorer/payroll');
  },
);
router.get(
  '/documents-company',
  rateLimiter.authenticated,
  authenticateToken,
  (_req: Request, res: Response) => {
    res.redirect('/documents-explorer/company');
  },
);
router.get(
  '/documents-department',
  rateLimiter.authenticated,
  authenticateToken,
  (_req: Request, res: Response) => {
    res.redirect('/documents-explorer/department');
  },
);
router.get(
  '/documents-team',
  rateLimiter.authenticated,
  authenticateToken,
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
  authenticateToken,
  servePage('documents-explorer'),
);
// Documents Explorer with category parameter (for client-side routing)
router.get(
  '/documents-explorer/:category',
  rateLimiter.authenticated,
  authenticateToken,
  servePage('documents-explorer'),
);

// Employee pages
router.get(
  '/employee-dashboard',
  rateLimiter.authenticated,
  authenticateToken,
  servePage('employee-dashboard'),
);
router.get(
  '/employee-profile',
  rateLimiter.authenticated,
  authenticateToken,
  servePage('employee-profile'),
);
router.get(
  '/employee-documents',
  rateLimiter.authenticated,
  authenticateToken,
  servePage('employee-documents'),
);
router.get(
  '/salary-documents',
  rateLimiter.authenticated,
  authenticateToken,
  servePage('salary-documents'),
);
router.get(
  '/survey-employee',
  rateLimiter.authenticated,
  authenticateToken,
  servePage('survey-employee'),
);
router.get('/shifts', rateLimiter.authenticated, authenticateToken, servePage('shifts'));

// Admin pages
router.get(
  '/admin-dashboard',
  rateLimiter.admin,
  authenticateToken,
  requireRole('admin') as RequestHandler,
  servePage('admin-dashboard'),
);
router.get(
  '/admin-config',
  rateLimiter.admin,
  authenticateToken,
  requireRole('admin') as RequestHandler,
  servePage('admin-config'),
);
router.get(
  '/org-management',
  rateLimiter.admin,
  authenticateToken,
  requireRole('admin') as RequestHandler,
  servePage('org-management'),
);
// Redirect old upload page to explorer (upload is now integrated)
router.get(
  '/document-upload',
  rateLimiter.admin,
  authenticateToken,
  requireRole('admin') as RequestHandler,
  (_req: Request, res: Response) => {
    res.redirect('/documents-explorer');
  },
);
router.get(
  '/archived-employees',
  rateLimiter.admin,
  authenticateToken,
  requireRole('admin') as RequestHandler,
  servePage('archived-employees'),
);
router.get(
  '/manage-departments',
  rateLimiter.admin,
  authenticateToken,
  requireRole('admin') as RequestHandler,
  servePage('manage-departments'),
);
router.get(
  '/manage-employees',
  rateLimiter.admin,
  authenticateToken,
  requireRole('admin') as RequestHandler,
  servePage('manage-employees'),
);
router.get(
  '/manage-areas',
  rateLimiter.admin,
  authenticateToken,
  requireRole('admin') as RequestHandler,
  servePage('manage-areas'),
);
router.get(
  '/manage-teams',
  rateLimiter.admin,
  authenticateToken,
  requireRole('admin') as RequestHandler,
  servePage('manage-teams'),
);
router.get(
  '/manage-machines',
  rateLimiter.admin,
  authenticateToken,
  requireRole('admin') as RequestHandler,
  servePage('manage-machines'),
);
router.get(
  '/admin-profile',
  rateLimiter.admin,
  authenticateToken,
  requireRole('admin') as RequestHandler,
  servePage('admin-profile'),
);
router.get(
  '/manage-admins',
  rateLimiter.admin,
  authenticateToken,
  requireRole('admin') as RequestHandler,
  servePage('manage-admins'),
);
router.get(
  '/manage-department-groups',
  rateLimiter.admin,
  authenticateToken,
  requireRole('admin') as RequestHandler,
  servePage('manage-department-groups'),
);
router.get(
  '/storage-upgrade',
  rateLimiter.admin,
  authenticateToken,
  requireRole('admin') as RequestHandler,
  servePage('storage-upgrade'),
);
router.get(
  '/feature-management',
  rateLimiter.admin,
  authenticateToken,
  requireRole('admin') as RequestHandler,
  servePage('feature-management'),
);
router.get(
  '/survey-admin',
  rateLimiter.admin,
  authenticateToken,
  requireRole('admin') as RequestHandler,
  servePage('survey-admin'),
);
router.get(
  '/survey-results',
  rateLimiter.admin,
  authenticateToken,
  requireRole('admin') as RequestHandler,
  servePage('survey-results'),
);
router.get(
  '/survey-details',
  rateLimiter.authenticated,
  authenticateToken,
  servePage('survey-details'),
);

// Root pages
router.get(
  '/root-dashboard',
  rateLimiter.admin,
  authenticateToken,
  requireRole('root') as RequestHandler,
  servePage('root-dashboard'),
);
router.get(
  '/root-features',
  rateLimiter.admin,
  authenticateToken,
  requireRole('root') as RequestHandler,
  servePage('root-features'),
);
router.get(
  '/root-profile',
  rateLimiter.admin,
  authenticateToken,
  requireRole('root') as RequestHandler,
  servePage('root-profile'),
);
router.get(
  '/manage-root-users',
  rateLimiter.admin,
  authenticateToken,
  requireRole('root') as RequestHandler,
  servePage('manage-root-users'),
);
router.get(
  '/account-settings',
  rateLimiter.admin,
  authenticateToken,
  requireRole('root') as RequestHandler,
  servePage('account-settings'),
);
router.get(
  '/tenant-deletion-status',
  rateLimiter.admin,
  authenticateToken,
  requireRole('root') as RequestHandler,
  servePage('tenant-deletion-status'),
);
router.get(
  '/logs',
  rateLimiter.admin,
  authenticateToken,
  requireRole('root') as RequestHandler,
  servePage('logs'),
);

// Development only pages
if (process.env.NODE_ENV !== 'production') {
  router.get('/api-test', rateLimiter.public, servePage('api-test'));
  router.get('/test-db', rateLimiter.public, servePage('test-db'));
  router.get('/debug-dashboard', rateLimiter.public, servePage('debug-dashboard'));
  router.get('/token-debug', rateLimiter.public, servePage('token-debug'));
  // Note: Design System documentation moved to Storybook (localhost:6006)
  // Run: pnpm run storybook
}

export default router;

// CommonJS compatibility
