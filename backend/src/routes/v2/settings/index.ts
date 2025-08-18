/**
 * Settings v2 Routes
 * Manages system, tenant, and user settings
 */

import { Router } from "express";
import * as settingsController from "./settings.controller.js";
import * as validation from "./settings.validation.js";
import { authenticateV2 } from "../../../middleware/v2/auth.middleware.js";
import { typed } from "../../../utils/routeHandlers.js";

const router = Router();

// All routes require authentication
router.use(authenticateV2);

// ==================== SYSTEM SETTINGS ====================

/**
 * @swagger
 * /api/v2/settings/system:
 *   get:
 *     summary: Get all system settings
 *     description: Retrieve all system settings (admin/root only)
 *     tags: [Settings v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [general, appearance, notifications, security, workflow, integration, other]
 *       - in: query
 *         name: is_public
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Settings retrieved successfully
 *       403:
 *         description: Access denied
 */
router.get(
  "/system",
  validation.getSystemSettingsValidation,
  typed.auth(settingsController.getSystemSettings),
);

/**
 * @swagger
 * /api/v2/settings/system/{key}:
 *   get:
 *     summary: Get single system setting
 *     description: Retrieve a specific system setting by key
 *     tags: [Settings v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Setting retrieved successfully
 *       404:
 *         description: Setting not found
 */
router.get(
  "/system/:key",
  validation.getSystemSettingValidation,
  typed.auth(settingsController.getSystemSetting),
);

/**
 * @swagger
 * /api/v2/settings/system:
 *   post:
 *     summary: Create system setting
 *     description: Create a new system setting (root only)
 *     tags: [Settings v2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - setting_key
 *               - setting_value
 *             properties:
 *               setting_key:
 *                 type: string
 *               setting_value:
 *                 type: any
 *               value_type:
 *                 type: string
 *                 enum: [string, number, boolean, json]
 *               category:
 *                 type: string
 *               description:
 *                 type: string
 *               is_public:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Setting created successfully
 *       403:
 *         description: Access denied
 */
router.post(
  "/system",
  validation.createSystemSettingValidation,
  typed.auth(settingsController.upsertSystemSetting),
);

/**
 * @swagger
 * /api/v2/settings/system/{key}:
 *   put:
 *     summary: Update system setting
 *     description: Update an existing system setting (root only)
 *     tags: [Settings v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - setting_value
 *             properties:
 *               setting_value:
 *                 type: any
 *               value_type:
 *                 type: string
 *                 enum: [string, number, boolean, json]
 *               category:
 *                 type: string
 *               description:
 *                 type: string
 *               is_public:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Setting updated successfully
 *       403:
 *         description: Access denied
 */
router.put(
  "/system/:key",
  validation.updateSystemSettingValidation,
  typed.auth(settingsController.upsertSystemSetting),
);

/**
 * @swagger
 * /api/v2/settings/system/{key}:
 *   delete:
 *     summary: Delete system setting
 *     description: Delete a system setting (root only)
 *     tags: [Settings v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Setting deleted successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: Setting not found
 */
router.delete(
  "/system/:key",
  validation.deleteSystemSettingValidation,
  typed.auth(settingsController.deleteSystemSetting),
);

// ==================== TENANT SETTINGS ====================

/**
 * @swagger
 * /api/v2/settings/tenant:
 *   get:
 *     summary: Get all tenant settings
 *     description: Retrieve all settings for the current tenant
 *     tags: [Settings v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [general, appearance, notifications, security, workflow, integration, other]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Settings retrieved successfully
 */
router.get(
  "/tenant",
  validation.getTenantSettingsValidation,
  typed.auth(settingsController.getTenantSettings),
);

/**
 * @swagger
 * /api/v2/settings/tenant/{key}:
 *   get:
 *     summary: Get single tenant setting
 *     description: Retrieve a specific tenant setting by key
 *     tags: [Settings v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Setting retrieved successfully
 *       404:
 *         description: Setting not found
 */
router.get(
  "/tenant/:key",
  validation.getTenantSettingValidation,
  typed.auth(settingsController.getTenantSetting),
);

/**
 * @swagger
 * /api/v2/settings/tenant:
 *   post:
 *     summary: Create tenant setting
 *     description: Create a new tenant setting (admin/root only)
 *     tags: [Settings v2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - setting_key
 *               - setting_value
 *             properties:
 *               setting_key:
 *                 type: string
 *               setting_value:
 *                 type: any
 *               value_type:
 *                 type: string
 *                 enum: [string, number, boolean, json]
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Setting created successfully
 *       403:
 *         description: Access denied
 */
router.post(
  "/tenant",
  validation.createTenantSettingValidation,
  typed.auth(settingsController.upsertTenantSetting),
);

/**
 * @swagger
 * /api/v2/settings/tenant/{key}:
 *   put:
 *     summary: Update tenant setting
 *     description: Update an existing tenant setting (admin/root only)
 *     tags: [Settings v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - setting_value
 *             properties:
 *               setting_value:
 *                 type: any
 *               value_type:
 *                 type: string
 *                 enum: [string, number, boolean, json]
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Setting updated successfully
 *       403:
 *         description: Access denied
 */
router.put(
  "/tenant/:key",
  validation.updateTenantSettingValidation,
  typed.auth(settingsController.upsertTenantSetting),
);

/**
 * @swagger
 * /api/v2/settings/tenant/{key}:
 *   delete:
 *     summary: Delete tenant setting
 *     description: Delete a tenant setting (admin/root only)
 *     tags: [Settings v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Setting deleted successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: Setting not found
 */
router.delete(
  "/tenant/:key",
  validation.deleteTenantSettingValidation,
  typed.auth(settingsController.deleteTenantSetting),
);

// ==================== USER SETTINGS ====================

/**
 * @swagger
 * /api/v2/settings/user:
 *   get:
 *     summary: Get all user settings
 *     description: Retrieve all settings for the current user
 *     tags: [Settings v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [general, appearance, notifications, security, workflow, integration, other]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Settings retrieved successfully
 */
router.get(
  "/user",
  validation.getUserSettingsValidation,
  typed.auth(settingsController.getUserSettings),
);

/**
 * @swagger
 * /api/v2/settings/user/{key}:
 *   get:
 *     summary: Get single user setting
 *     description: Retrieve a specific user setting by key
 *     tags: [Settings v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Setting retrieved successfully
 *       404:
 *         description: Setting not found
 */
router.get(
  "/user/:key",
  validation.getUserSettingValidation,
  typed.auth(settingsController.getUserSetting),
);

/**
 * @swagger
 * /api/v2/settings/user:
 *   post:
 *     summary: Create user setting
 *     description: Create a new user setting
 *     tags: [Settings v2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - setting_key
 *               - setting_value
 *             properties:
 *               setting_key:
 *                 type: string
 *               setting_value:
 *                 type: any
 *               value_type:
 *                 type: string
 *                 enum: [string, number, boolean, json]
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Setting created successfully
 */
router.post(
  "/user",
  validation.createUserSettingValidation,
  typed.auth(settingsController.upsertUserSetting),
);

/**
 * @swagger
 * /api/v2/settings/user/{key}:
 *   put:
 *     summary: Update user setting
 *     description: Update an existing user setting
 *     tags: [Settings v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - setting_value
 *             properties:
 *               setting_value:
 *                 type: any
 *               value_type:
 *                 type: string
 *                 enum: [string, number, boolean, json]
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Setting updated successfully
 */
router.put(
  "/user/:key",
  validation.updateUserSettingValidation,
  typed.auth(settingsController.upsertUserSetting),
);

/**
 * @swagger
 * /api/v2/settings/user/{key}:
 *   delete:
 *     summary: Delete user setting
 *     description: Delete a user setting
 *     tags: [Settings v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Setting deleted successfully
 *       404:
 *         description: Setting not found
 */
router.delete(
  "/user/:key",
  validation.deleteUserSettingValidation,
  typed.auth(settingsController.deleteUserSetting),
);

// ==================== ADMIN USER SETTINGS ====================

/**
 * @swagger
 * /api/v2/settings/admin/users/{userId}:
 *   get:
 *     summary: Get another user's settings
 *     description: Retrieve settings for a specific user (admin/root only)
 *     tags: [Settings v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Settings retrieved successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: User not found
 */
router.get(
  "/admin/users/:userId",
  validation.getAdminUserSettingsValidation,
  typed.auth(settingsController.getAdminUserSettings),
);

// ==================== COMMON ====================

/**
 * @swagger
 * /api/v2/settings/categories:
 *   get:
 *     summary: Get settings categories
 *     description: Retrieve all available settings categories
 *     tags: [Settings v2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 */
router.get("/categories", typed.auth(settingsController.getCategories));

/**
 * @swagger
 * /api/v2/settings/bulk:
 *   put:
 *     summary: Bulk update settings
 *     description: Update multiple settings at once
 *     tags: [Settings v2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - settings
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [system, tenant, user]
 *               settings:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - setting_key
 *                     - setting_value
 *                   properties:
 *                     setting_key:
 *                       type: string
 *                     setting_value:
 *                       type: any
 *                     value_type:
 *                       type: string
 *                       enum: [string, number, boolean, json]
 *                     category:
 *                       type: string
 *     responses:
 *       200:
 *         description: Settings updated successfully
 */
router.put(
  "/bulk",
  validation.bulkUpdateValidation,
  typed.auth(settingsController.bulkUpdate),
);

export default router;
