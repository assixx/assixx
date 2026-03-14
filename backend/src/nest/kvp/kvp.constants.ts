/**
 * KVP Constants
 *
 * Error messages and static defaults for the KVP module.
 */
import type { ExtendedUserOrgInfo } from './kvp.types.js';

export const ERROR_SUGGESTION_NOT_FOUND = 'Suggestion not found';

/** Default empty org info — used in tests and as type reference */
export const EMPTY_ORG_INFO: ExtendedUserOrgInfo = {
  teamIds: [],
  departmentIds: [],
  areaIds: [],
  teamLeadOf: [],
  departmentLeadOf: [],
  areaLeadOf: [],
  teamsDepartmentIds: [],
  departmentsAreaIds: [],
  hasFullAccess: false,
};
