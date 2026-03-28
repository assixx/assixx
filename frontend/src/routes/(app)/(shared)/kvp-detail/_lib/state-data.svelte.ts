// =============================================================================
// KVP-DETAIL - DATA STATE MODULE
// =============================================================================

import { IMAGE_FILE_TYPES } from './constants';

import type { KvpSuggestion, Comment, Attachment, Department, Team, Area, Asset } from './types';

type ImageFileType = (typeof IMAGE_FILE_TYPES)[number];

/** Creates org lookup state (departments, teams, areas) */
export function createOrgState() {
  let departments = $state<Department[]>([]);
  let teams = $state<Team[]>([]);
  let areas = $state<Area[]>([]);
  let assets = $state<Asset[]>([]);

  return {
    get departments() {
      return departments;
    },
    get teams() {
      return teams;
    },
    get areas() {
      return areas;
    },
    get assets() {
      return assets;
    },
    setDepartments: (data: Department[]) => {
      departments = data;
    },
    setTeams: (data: Team[]) => {
      teams = data;
    },
    setAreas: (data: Area[]) => {
      areas = data;
    },
    setAssets: (data: Asset[]) => {
      assets = data;
    },
  };
}

/** Creates content state (suggestion, comments, attachments) */
export function createDataState() {
  let suggestion = $state<KvpSuggestion | null>(null);
  let comments = $state<Comment[]>([]);
  let commentTotal = $state(0);
  let commentsHasMore = $state(false);
  let attachments = $state<Attachment[]>([]);

  const photoAttachments = $derived(
    attachments.filter((att) => IMAGE_FILE_TYPES.includes(att.fileType as ImageFileType)),
  );
  const otherAttachments = $derived(
    attachments.filter((att) => !IMAGE_FILE_TYPES.includes(att.fileType as ImageFileType)),
  );

  return {
    get suggestion() {
      return suggestion;
    },
    get comments() {
      return comments;
    },
    get commentTotal() {
      return commentTotal;
    },
    get commentsHasMore() {
      return commentsHasMore;
    },
    get attachments() {
      return attachments;
    },
    get photoAttachments() {
      return photoAttachments;
    },
    get otherAttachments() {
      return otherAttachments;
    },
    setSuggestion: (data: KvpSuggestion | null) => {
      suggestion = data;
    },
    setComments: (data: Comment[], total?: number, hasMore?: boolean) => {
      comments = data;
      if (total !== undefined) commentTotal = total;
      if (hasMore !== undefined) commentsHasMore = hasMore;
    },
    appendComments: (data: Comment[], hasMore: boolean) => {
      comments = [...comments, ...data];
      commentsHasMore = hasMore;
    },
    setAttachments: (data: Attachment[]) => {
      attachments = data;
    },
  };
}
