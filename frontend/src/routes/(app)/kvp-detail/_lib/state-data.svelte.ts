// =============================================================================
// KVP-DETAIL - DATA STATE MODULE
// =============================================================================

import type { KvpSuggestion, Comment, Attachment, Department, Team, Area } from './types';

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

/** Creates data-related state (suggestion, comments, attachments, org data) */
export function createDataState() {
  let suggestion = $state<KvpSuggestion | null>(null);
  let comments = $state<Comment[]>([]);
  let attachments = $state<Attachment[]>([]);
  let departments = $state<Department[]>([]);
  let teams = $state<Team[]>([]);
  let areas = $state<Area[]>([]);

  // Derived: Photo attachments
  const photoAttachments = $derived(
    attachments.filter((att) => IMAGE_TYPES.includes(att.fileType)),
  );

  // Derived: Other attachments
  const otherAttachments = $derived(
    attachments.filter((att) => !IMAGE_TYPES.includes(att.fileType)),
  );

  return {
    get suggestion() {
      return suggestion;
    },
    get comments() {
      return comments;
    },
    get attachments() {
      return attachments;
    },
    get departments() {
      return departments;
    },
    get teams() {
      return teams;
    },
    get areas() {
      return areas;
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
    setComments: (data: Comment[]) => {
      comments = data;
    },
    setAttachments: (data: Attachment[]) => {
      attachments = data;
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
  };
}

export type DataState = ReturnType<typeof createDataState>;
