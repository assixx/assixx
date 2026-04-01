/** TPM Plan Revision (single revision snapshot) */
export interface TpmPlanRevision {
  uuid: string;
  revisionNumber: number;
  approvalVersion: number;
  revisionMinor: number;
  name: string;
  assetId: number;
  baseWeekday: number;
  baseRepeatEvery: number;
  baseTime: string | null;
  bufferHours: number;
  notes: string | null;
  changedBy: number;
  changedByName: string;
  changeReason: string | null;
  changedFields: string[];
  createdAt: string;
}

/** Paginated revision list response from API */
export interface TpmPlanRevisionList {
  currentVersion: number;
  currentApprovalVersion: number;
  currentRevisionMinor: number;
  planName: string;
  assetName: string;
  revisions: TpmPlanRevision[];
  total: number;
}
