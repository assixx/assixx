/**
 * HTML Routes
 * Serves frontend pages
 */

import express, { Router, Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticateToken, authorizeRole } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';

const router: Router = express.Router();

// ES modules fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extended Request interfaces - removed unused types

// Helper function to serve HTML files
const servePage =
  (pageName: string) =>
  (_req: Request, res: Response): void => {
    // Always serve from dist directory (built files)
    const distPath = path.join(
      __dirname,
      '../../../frontend/dist/pages',
      `${pageName}.html`
    );
    res.sendFile(distPath);
  };

// Public pages
// Root '/' is handled by redirectToDashboard middleware in app.ts
router.get('/index', rateLimiter.public, servePage('index'));
router.get('/pages/index', rateLimiter.public, (_req: Request, res: Response) =>
  res.redirect('/index')
); // Redirect old URL
router.get('/login', rateLimiter.auth, servePage('login'));
router.get('/signup', rateLimiter.auth, servePage('signup'));
router.get('/design-standards', rateLimiter.public, servePage('design-standards'));

// Authenticated pages - All users
router.get('/dashboard', rateLimiter.authenticated, authenticateToken, servePage('dashboard'));
router.get('/profile', rateLimiter.authenticated, authenticateToken, servePage('profile'));
router.get('/profile-picture', rateLimiter.authenticated, authenticateToken, servePage('profile-picture'));
router.get('/settings', rateLimiter.authenticated, authenticateToken, servePage('settings'));
router.get('/hilfe', rateLimiter.authenticated, authenticateToken, servePage('hilfe'));
router.get('/chat', rateLimiter.authenticated, authenticateToken, servePage('chat'));
router.get('/blackboard', rateLimiter.authenticated, authenticateToken, servePage('blackboard'));
router.get('/calendar', rateLimiter.authenticated, authenticateToken, servePage('calendar'));
router.get('/kvp', rateLimiter.authenticated, authenticateToken, servePage('kvp'));
router.get('/kvp-detail', rateLimiter.authenticated, authenticateToken, servePage('kvp-detail'));
router.get('/documents', rateLimiter.authenticated, authenticateToken, servePage('documents'));
router.get(
  '/documents-personal',
  rateLimiter.authenticated,
  authenticateToken,
  servePage('documents-personal')
);
router.get(
  '/documents-payroll',
  rateLimiter.authenticated,
  authenticateToken,
  servePage('documents-payroll')
);
router.get(
  '/documents-company',
  rateLimiter.authenticated,
  authenticateToken,
  servePage('documents-company')
);
router.get(
  '/documents-department',
  rateLimiter.authenticated,
  authenticateToken,
  servePage('documents-department')
);
router.get('/documents-team', rateLimiter.authenticated, authenticateToken, servePage('documents-team'));
router.get(
  '/documents-search',
  rateLimiter.authenticated,
  authenticateToken,
  servePage('documents-search')
);

// Employee pages
router.get(
  '/employee-dashboard',
  rateLimiter.authenticated,
  authenticateToken,
  servePage('employee-dashboard')
);
router.get(
  '/employee-profile',
  rateLimiter.authenticated,
  authenticateToken,
  servePage('employee-profile')
);
router.get(
  '/employee-documents',
  rateLimiter.authenticated,
  authenticateToken,
  servePage('employee-documents')
);
router.get(
  '/salary-documents',
  rateLimiter.authenticated,
  authenticateToken,
  servePage('salary-documents')
);
router.get('/survey-employee', rateLimiter.authenticated, authenticateToken, servePage('survey-employee'));
router.get('/shifts', rateLimiter.authenticated, authenticateToken, servePage('shifts'));

// Admin pages
router.get(
  '/admin-dashboard',
  rateLimiter.admin,
  authenticateToken,
  authorizeRole('admin'),
  servePage('admin-dashboard')
);
router.get(
  '/admin-config',
  rateLimiter.admin,
  authenticateToken,
  authorizeRole('admin'),
  servePage('admin-config')
);
router.get(
  '/org-management',
  rateLimiter.admin,
  authenticateToken,
  authorizeRole('admin'),
  servePage('org-management')
);
router.get(
  '/document-upload',
  rateLimiter.admin,
  authenticateToken,
  authorizeRole('admin'),
  servePage('document-upload')
);
router.get(
  '/archived-employees',
  rateLimiter.admin,
  authenticateToken,
  authorizeRole('admin'),
  servePage('archived-employees')
);
router.get(
  '/departments',
  rateLimiter.admin,
  authenticateToken,
  authorizeRole('admin'),
  servePage('departments')
);
router.get(
  '/admin-profile',
  rateLimiter.admin,
  authenticateToken,
  authorizeRole('admin'),
  servePage('admin-profile')
);
router.get(
  '/manage-admins',
  rateLimiter.admin,
  authenticateToken,
  authorizeRole('admin'),
  servePage('manage-admins')
);
router.get(
  '/manage-department-groups',
  rateLimiter.admin,
  authenticateToken,
  authorizeRole('admin'),
  servePage('manage-department-groups')
);
router.get(
  '/storage-upgrade',
  rateLimiter.admin,
  authenticateToken,
  authorizeRole('admin'),
  servePage('storage-upgrade')
);
router.get(
  '/feature-management',
  rateLimiter.admin,
  authenticateToken,
  authorizeRole('admin'),
  servePage('feature-management')
);
router.get(
  '/survey-admin',
  rateLimiter.admin,
  authenticateToken,
  authorizeRole('admin'),
  servePage('survey-admin')
);
router.get(
  '/survey-results',
  rateLimiter.admin,
  authenticateToken,
  authorizeRole('admin'),
  servePage('survey-results')
);
router.get('/survey-details', rateLimiter.authenticated, authenticateToken, servePage('survey-details'));

// Root pages
router.get(
  '/root-dashboard',
  rateLimiter.admin,
  authenticateToken,
  authorizeRole('root'),
  servePage('root-dashboard')
);
router.get(
  '/root-features',
  rateLimiter.admin,
  authenticateToken,
  authorizeRole('root'),
  servePage('root-features')
);
router.get(
  '/root-profile',
  rateLimiter.admin,
  authenticateToken,
  authorizeRole('root'),
  servePage('root-profile')
);
router.get(
  '/manage-root-users',
  rateLimiter.admin,
  authenticateToken,
  authorizeRole('root'),
  servePage('manage-root-users')
);
router.get(
  '/account-settings',
  rateLimiter.admin,
  authenticateToken,
  authorizeRole('root'),
  servePage('account-settings')
);
router.get(
  '/tenant-deletion-status',
  rateLimiter.admin,
  authenticateToken,
  authorizeRole('root'),
  servePage('tenant-deletion-status')
);
router.get(
  '/logs',
  rateLimiter.admin,
  authenticateToken,
  authorizeRole('root'),
  servePage('logs')
);

// Development only pages
if (process.env.NODE_ENV !== 'production') {
  router.get('/api-test', rateLimiter.public, servePage('api-test'));
  router.get('/test-db', rateLimiter.public, servePage('test-db'));
  router.get('/debug-dashboard', rateLimiter.public, servePage('debug-dashboard'));
  router.get('/token-debug', rateLimiter.public, servePage('token-debug'));
}

export default router;

// CommonJS compatibility
