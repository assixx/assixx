import type { ApprovalApproverType, ApprovalConfig, PositionOption } from './types.js';

const API_BASE = '/api/v2/approvals';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export async function fetchConfigs(): Promise<ApprovalConfig[]> {
  const res = await fetch(`${API_BASE}/configs`);
  if (!res.ok) return [];
  const json = (await res.json()) as ApiResponse<ApprovalConfig[]>;
  return json.data;
}

export async function createConfig(
  addonCode: string,
  approverType: ApprovalApproverType,
  approverUserId: number | null,
  approverPositionId: string | null = null,
): Promise<ApprovalConfig | null> {
  const res = await fetch(`${API_BASE}/configs`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      addonCode,
      approverType,
      approverUserId,
      approverPositionId,
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as ApiResponse<ApprovalConfig>;
  return json.data;
}

export async function deleteConfig(uuid: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/configs/${uuid}`, {
    method: 'DELETE',
  });
  return res.ok;
}

export async function fetchPositions(): Promise<PositionOption[]> {
  const res = await fetch('/api/v2/organigram/positions');
  if (!res.ok) return [];
  const json = (await res.json()) as ApiResponse<PositionOption[]>;
  return json.data;
}
