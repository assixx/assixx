/**
 * Require Addon Decorator
 *
 * Marks a controller as requiring an active tenant addon.
 * Used with TenantAddonGuard (global APP_GUARD) to check addon access.
 *
 * Applied at class level — ALL endpoints in the controller require the addon.
 *
 * @example
 * ```typescript
 * @Controller('blackboard')
 * @RequireAddon('blackboard')
 * export class BlackboardController {}
 * ```
 */
import { SetMetadata } from '@nestjs/common';

export const REQUIRE_ADDON_KEY = 'requireAddon';

/**
 * Decorator: requires the tenant to have the specified addon activated.
 *
 * @param addonCode - Addon code from the `addons` table (e.g., 'vacation', 'blackboard')
 */
export const RequireAddon = (addonCode: string): ReturnType<typeof SetMetadata> =>
  SetMetadata(REQUIRE_ADDON_KEY, addonCode);
