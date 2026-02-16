/**
 * Settings Design Page - API Functions
 * @module settings/design/_lib/api
 */

import { getApiClient } from '$lib/utils/api-client';
import { createLogger } from '$lib/utils/logger';

import type { UserSettingResponse } from './types';

const log = createLogger('DesignSettingsApi');

/** Get the current theme setting from the API */
export async function getThemeSetting(): Promise<'dark' | 'light' | null> {
  try {
    const api = getApiClient();
    const result = await api.get<UserSettingResponse>('/settings/user/theme', {
      skipCache: true,
    });

    const value = result.settingValue;
    if (value === 'dark' || value === 'light') {
      return value;
    }
    return null;
  } catch {
    log.debug('No theme setting found in API');
    return null;
  }
}
