/**
 * Settings Design Page - Types
 * @module settings/design/_lib/types
 */

/** User setting response from GET /settings/user/:key */
export interface UserSettingResponse {
  settingKey: string;
  settingValue: string | number | boolean | Record<string, unknown> | null;
  valueType: string;
  category?: string;
  createdAt?: string;
  updatedAt?: string;
}
