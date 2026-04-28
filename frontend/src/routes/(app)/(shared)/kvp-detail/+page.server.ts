/**
 * KVP Detail - Server-Side Data Loading
 * @module kvp-detail/+page.server
 *
 * SSR: Loads suggestion, comments, attachments, and org data in parallel.
 */
import { redirect, error } from '@sveltejs/kit';

import { apiFetch, apiFetchWithPermission } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';
import { buildLoginUrl } from '$lib/utils/build-apex-url';

import type { PageServerLoad } from './$types';
import type {
  KvpSuggestion,
  ApprovalInfo,
  Attachment,
  Department,
  Team,
  Area,
  Asset,
  LinkedWorkOrder,
  PaginatedComments,
} from './_lib/types';

/**
 * Safely convert API response to array with empty fallback
 */
function ensureArray<T>(data: T[] | null): T[] {
  return Array.isArray(data) ? data : [];
}

const EMPTY_COMMENTS: PaginatedComments = {
  comments: [],
  total: 0,
  hasMore: false,
};

/** Derive departments from teams when scope-filtered endpoint returns empty */
function deriveDepartments(teamList: Team[]): Department[] {
  const map = new Map<number, Department>();
  for (const t of teamList) {
    if (t.departmentId !== undefined && t.departmentId !== null && t.departmentName !== undefined) {
      map.set(t.departmentId, { id: t.departmentId, name: t.departmentName });
    }
  }
  return [...map.values()];
}

/** Derive areas from teams when scope-filtered endpoint returns empty */
function deriveAreas(teamList: Team[]): Area[] {
  const map = new Map<number, Area>();
  for (const t of teamList) {
    if (
      t.departmentAreaId !== undefined &&
      t.departmentAreaId !== null &&
      t.departmentAreaName !== undefined
    ) {
      map.set(t.departmentAreaId, {
        id: t.departmentAreaId,
        name: t.departmentAreaName,
      });
    }
  }
  return [...map.values()];
}

/** Parallel fetch: comments, attachments, and org data for share modal */
async function fetchPageData(idOrUuid: string, token: string, fetchFn: typeof fetch) {
  const [commentsData, attachmentsData, depts, teams, areas, assets] = await Promise.all([
    apiFetch<PaginatedComments>(`/kvp/${idOrUuid}/comments?limit=20&offset=0`, token, fetchFn),
    apiFetch<Attachment[]>(`/kvp/${idOrUuid}/attachments`, token, fetchFn),
    apiFetch<Department[]>('/departments', token, fetchFn),
    apiFetch<Team[]>('/teams', token, fetchFn),
    apiFetch<Area[]>('/areas', token, fetchFn),
    apiFetch<Asset[]>('/assets', token, fetchFn),
  ]);

  const teamList = ensureArray(teams);
  const departmentList = ensureArray(depts);
  const areaList = ensureArray(areas);

  return {
    comments: commentsData ?? EMPTY_COMMENTS,
    attachments: ensureArray(attachmentsData),
    departments: departmentList.length > 0 ? departmentList : deriveDepartments(teamList),
    teams: teamList,
    areas: areaList.length > 0 ? areaList : deriveAreas(teamList),
    assets: ensureArray(assets),
  };
}

interface WorkOrderListItem {
  uuid: string;
  title: string;
  status: string;
  createdByName: string;
  createdAt: string;
}

interface PaginatedWorkOrders {
  items: WorkOrderListItem[];
  total: number;
}

async function fetchLinkedWorkOrders(
  kvpUuid: string,
  token: string,
  fetchFn: typeof fetch,
): Promise<LinkedWorkOrder[]> {
  const data = await apiFetch<PaginatedWorkOrders>(
    `/work-orders?sourceType=kvp_proposal&sourceUuid=${kvpUuid}&limit=10`,
    token,
    fetchFn,
  );
  if (data === null || !Array.isArray(data.items)) return [];
  return data.items.map((wo: WorkOrderListItem) => ({
    uuid: wo.uuid,
    title: wo.title,
    status: wo.status,
    createdByName: wo.createdByName,
    createdAt: wo.createdAt,
  }));
}

interface ApprovalConfigItem {
  approverUserId: number | null;
  addonCode: string;
}

/** Fetch approval data for a suggestion in parallel */
async function fetchApprovalInfo(
  idOrUuid: string,
  token: string,
  fetchFn: typeof fetch,
  currentUserId: number,
): Promise<{
  approval: ApprovalInfo | null;
  hasApprovalConfig: boolean;
  isApprovalMaster: boolean;
  rewardTiers: { id: number; amount: number; sortOrder: number }[];
}> {
  const [approvalData, configStatus, configs, rewardTiersData] = await Promise.all([
    apiFetch<{ approval: ApprovalInfo | null }>(`/kvp/${idOrUuid}/approval`, token, fetchFn),
    apiFetch<{ hasConfig: boolean }>('/kvp/approval-config-status', token, fetchFn),
    apiFetch<ApprovalConfigItem[]>('/approvals/configs', token, fetchFn),
    apiFetch<{ id: number; amount: number; sortOrder: number }[]>(
      '/kvp/reward-tiers',
      token,
      fetchFn,
    ),
  ]);

  const kvpConfigs =
    Array.isArray(configs) ? configs.filter((c: ApprovalConfigItem) => c.addonCode === 'kvp') : [];
  const isApprovalMaster = kvpConfigs.some(
    (c: ApprovalConfigItem) => c.approverUserId === currentUserId,
  );

  return {
    approval: approvalData?.approval ?? null,
    hasApprovalConfig: configStatus?.hasConfig ?? false,
    isApprovalMaster,
    rewardTiers: Array.isArray(rewardTiersData) ? rewardTiersData : [],
  };
}

/** Load suggestion and all related data */
async function loadSuggestionData(
  idOrUuid: string,
  suggestion: KvpSuggestion,
  token: string,
  fetchFn: typeof fetch,
  currentUserId: number,
) {
  const [pageData, linkedWorkOrders, approvalInfo] = await Promise.all([
    fetchPageData(idOrUuid, token, fetchFn),
    fetchLinkedWorkOrders(suggestion.uuid, token, fetchFn),
    fetchApprovalInfo(idOrUuid, token, fetchFn, currentUserId),
  ]);

  return { ...pageData, linkedWorkOrders, ...approvalInfo };
}

export const load: PageServerLoad = async ({ cookies, fetch, url, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, buildLoginUrl('session-expired', undefined, url));
  }

  const idOrUuid = url.searchParams.get('uuid') ?? url.searchParams.get('id');
  if (idOrUuid === null || idOrUuid === '') {
    error(400, 'Ungueltige Vorschlags-ID');
  }

  const parentData = await parent();
  requireAddon(parentData.activeAddons, 'kvp');

  const kvpResult = await apiFetchWithPermission<KvpSuggestion>(`/kvp/${idOrUuid}`, token, fetch);

  if (kvpResult.permissionDenied) {
    return {
      permissionDenied: true as const,
      suggestion: null,
      comments: EMPTY_COMMENTS,
      attachments: [] as Attachment[],
      departments: [] as Department[],
      teams: [] as Team[],
      areas: [] as Area[],
      assets: [] as Asset[],
      linkedWorkOrders: [] as LinkedWorkOrder[],
      approval: null as ApprovalInfo | null,
      hasApprovalConfig: false,
      isApprovalMaster: false,
      // Empty reward catalog keeps the page-type contract symmetric with the
      // success branch (line 164). The modal does not render in that branch anyway
      // (PermissionDenied component), but svelte-check still expects the field.
      rewardTiers: [] as { id: number; amount: number; sortOrder: number }[],
      currentUser: parentData.user,
    };
  }

  const suggestion = kvpResult.data;
  if (!suggestion) {
    error(404, 'Vorschlag nicht gefunden');
  }

  const currentUserId = (parentData.user as { id: number }).id;
  const allData = await loadSuggestionData(idOrUuid, suggestion, token, fetch, currentUserId);
  const isTeamLead = (parentData.user as { position?: string } | null)?.position === 'team_lead';

  return {
    permissionDenied: false as const,
    suggestion,
    ...allData,
    currentUser: parentData.user,
    isTeamLead,
  };
};
