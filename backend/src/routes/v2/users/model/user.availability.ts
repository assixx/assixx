/**
 * User Availability Management
 * Handles user availability status and auto-reset of expired availabilities
 */
import { ResultSetHeader, query as executeQuery } from '../../../../utils/db.js';
import { logger } from '../../../../utils/logger.js';
import { AvailabilityData } from './user.types.js';

/**
 * Auto-reset expired availability statuses to 'available'
 * This should be called before fetching users to ensure current status
 */
export async function autoResetExpiredAvailability(tenantId: number): Promise<void> {
  try {
    // Reset all users whose availability_end date has passed
    await executeQuery<ResultSetHeader>(
      `UPDATE users
       SET availability_status = 'available',
           availability_start = NULL,
           availability_end = NULL,
           availability_notes = NULL,
           updated_at = NOW()
       WHERE tenant_id = $1
         AND availability_status != 'available'
         AND availability_end IS NOT NULL
         AND availability_end < CURRENT_DATE`,
      [tenantId],
    );
  } catch (error: unknown) {
    logger.error(`Error auto-resetting expired availability: ${(error as Error).message}`);
    // Don't throw - this is a non-critical operation
  }
}

/**
 * Update user availability status
 */
export async function updateUserAvailability(
  userId: number,
  tenantId: number,
  availabilityData: AvailabilityData,
): Promise<boolean> {
  try {
    const [result] = await executeQuery<ResultSetHeader>(
      `UPDATE users
         SET availability_status = $1,
             availability_start = $3,
             availability_end = $4,
             availability_notes = $5,
             updated_at = NOW()
         WHERE id = $6 AND tenant_id = $2`,
      [
        availabilityData.availability_status,
        availabilityData.availability_start ?? null,
        availabilityData.availability_end ?? null,
        availabilityData.availability_notes ?? null,
        userId,
        tenantId,
      ],
    );

    return result.affectedRows > 0;
  } catch (error: unknown) {
    logger.error(`Error updating availability: ${(error as Error).message}`);
    throw error;
  }
}
