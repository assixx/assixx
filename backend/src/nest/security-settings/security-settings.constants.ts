/**
 * Security Settings Constants
 *
 * Centralises the `tenant_settings.setting_key` identifiers used by the
 * Security-Settings module. The keys are namespaced with `security.` to
 * segregate them from other tenant-scoped settings (e.g. theme, shift times)
 * so that a future `GET /security-settings` list endpoint can filter by
 * prefix without colliding with unrelated settings.
 *
 * @see ADR-045 Permission & Visibility Design — Layer-1 management gates
 *      include "Passwort selbst ändern" as a tenant-level policy.
 */

/**
 * Setting key controlling whether non-root users may change their own
 * password via `PUT /api/v2/users/me/password`.
 *
 * Default: `false` (locked) — Root creates passwords during onboarding,
 * non-root users cannot rotate them self-service until Root enables it.
 * Root is ALWAYS allowed, independent of this flag.
 */
export const ALLOW_USER_PASSWORD_CHANGE_KEY = 'security.allow_user_password_change';

/**
 * Category under which all security-related tenant settings live in
 * `tenant_settings.category`. Matches the existing `SettingCategory` union
 * in settings.service.ts.
 */
export const SECURITY_SETTINGS_CATEGORY = 'security';
