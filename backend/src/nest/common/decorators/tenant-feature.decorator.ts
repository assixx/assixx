/**
 * Tenant Feature Decorator
 *
 * Marks a controller as requiring an active tenant feature.
 * Used with TenantFeatureGuard (global APP_GUARD) to check tenant_features table.
 *
 * Applied at class level — ALL endpoints in the controller require the feature.
 *
 * @example
 * ```typescript
 * @Controller('blackboard')
 * @TenantFeature('blackboard')
 * export class BlackboardController {}
 * ```
 */
import { SetMetadata } from '@nestjs/common';

export const TENANT_FEATURE_KEY = 'tenantFeature';

/**
 * Decorator: requires the tenant to have the specified feature activated.
 *
 * @param featureCode - Feature code from the `features` table (e.g., 'vacation', 'blackboard')
 */
export const TenantFeature = (
  featureCode: string,
): ReturnType<typeof SetMetadata> =>
  SetMetadata(TENANT_FEATURE_KEY, featureCode);
