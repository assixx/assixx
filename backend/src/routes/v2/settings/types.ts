/**
 * Type definitions for Settings v2 API
 */

export interface SystemSetting {
  setting_key: string;
  setting_value: string | number | boolean | Record<string, unknown>;
  value_type?: 'string' | 'number' | 'boolean' | 'json';
  category?: string;
  is_public?: boolean;
  description?: string;
}

export interface UserSetting {
  setting_key: string;
  setting_value: string | number | boolean | Record<string, unknown>;
  value_type?: 'string' | 'number' | 'boolean' | 'json';
  category?: string;
  description?: string;
}

export interface SettingsFilters {
  category?: string;
  is_public?: boolean;
  search?: string;
}

export interface MailSettings {
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_secure?: boolean;
  mail_from?: string;
  mail_from_name?: string;
}

export interface GeneralSettings {
  site_name?: string;
  site_description?: string;
  maintenance_mode?: boolean;
  maintenance_message?: string;
  default_language?: string;
  timezone?: string;
}

export interface BulkUpdateRequest {
  type: 'system' | 'tenant' | 'user';
  settings: {
    setting_key: string;
    setting_value: string | number | boolean | Record<string, unknown>;
    value_type?: 'string' | 'number' | 'boolean' | 'json';
    category?: string;
    is_public?: boolean;
    description?: string;
  }[];
}
