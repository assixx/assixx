// =============================================================================
// KVP-DETAIL - REACTIVE STATE (Svelte 5 Runes)
// =============================================================================

import type {
  User,
  KvpSuggestion,
  Comment,
  Attachment,
  Department,
  Team,
  Area,
  OrgLevel,
} from './types';

/**
 * KVP Detail State using Svelte 5 Runes
 */
function createKvpDetailState() {
  // Current user
  let currentUser = $state<User | null>(null);
  let effectiveRole = $state<string>('employee');

  // Suggestion data
  let suggestion = $state<KvpSuggestion | null>(null);
  let comments = $state<Comment[]>([]);
  let attachments = $state<Attachment[]>([]);

  // Organization data (for share modal)
  let departments = $state<Department[]>([]);
  let teams = $state<Team[]>([]);
  let areas = $state<Area[]>([]);

  // Loading states
  let isLoading = $state(true);
  let isUpdatingStatus = $state(false);
  let isAddingComment = $state(false);
  let isSharing = $state(false);

  // Modal states
  let showShareModal = $state(false);
  let showRejectionModal = $state(false);
  let showPreviewModal = $state(false);
  let selectedShareLevel = $state<OrgLevel | null>(null);
  let selectedOrgId = $state<number | null>(null);
  let previewAttachment = $state<Attachment | null>(null);

  // Dropdown states
  let activeDropdown = $state<string | null>(null);

  // Derived: Is admin or root
  const isAdmin = $derived(effectiveRole === 'admin' || effectiveRole === 'root');

  // Derived: Photo attachments
  const photoAttachments = $derived(
    attachments.filter((att) => ['image/jpeg', 'image/jpg', 'image/png'].includes(att.fileType)),
  );

  // Derived: Other attachments
  const otherAttachments = $derived(
    attachments.filter((att) => !['image/jpeg', 'image/jpg', 'image/png'].includes(att.fileType)),
  );

  // Methods
  function setUser(user: User | null) {
    currentUser = user;
    updateEffectiveRole();
  }

  function updateEffectiveRole() {
    if (currentUser === null) {
      effectiveRole = 'employee';
      return;
    }

    // Check sessionStorage for role switch
    if (typeof sessionStorage !== 'undefined') {
      const roleSwitch = sessionStorage.getItem('roleSwitch');
      if (
        (currentUser.role === 'admin' || currentUser.role === 'root') &&
        roleSwitch === 'employee'
      ) {
        effectiveRole = 'employee';
        return;
      }
    }

    // Check localStorage for activeRole
    if (typeof localStorage !== 'undefined') {
      const activeRole = localStorage.getItem('activeRole');
      if (activeRole !== null && activeRole !== '' && activeRole !== currentUser.role) {
        effectiveRole = activeRole;
        return;
      }
    }

    effectiveRole = currentUser.role;
  }

  function setSuggestion(data: KvpSuggestion | null) {
    suggestion = data;
  }

  function setComments(data: Comment[]) {
    comments = data;
  }

  function setAttachments(data: Attachment[]) {
    attachments = data;
  }

  function setDepartments(data: Department[]) {
    departments = data;
  }

  function setTeams(data: Team[]) {
    teams = data;
  }

  function setAreas(data: Area[]) {
    areas = data;
  }

  function setLoading(val: boolean) {
    isLoading = val;
  }

  function setUpdatingStatus(val: boolean) {
    isUpdatingStatus = val;
  }

  function setAddingComment(val: boolean) {
    isAddingComment = val;
  }

  function setSharing(val: boolean) {
    isSharing = val;
  }

  // Modal methods
  function openShareModal() {
    selectedShareLevel = null;
    selectedOrgId = null;
    showShareModal = true;
  }

  function closeShareModal() {
    showShareModal = false;
    selectedShareLevel = null;
    selectedOrgId = null;
  }

  function openRejectionModal() {
    showRejectionModal = true;
  }

  function closeRejectionModal() {
    showRejectionModal = false;
  }

  function openPreviewModal(attachment: Attachment) {
    previewAttachment = attachment;
    showPreviewModal = true;
  }

  function closePreviewModal() {
    showPreviewModal = false;
    previewAttachment = null;
  }

  function setSelectedShareLevel(level: OrgLevel | null) {
    selectedShareLevel = level;
    selectedOrgId = null;
  }

  function setSelectedOrgId(id: number | null) {
    selectedOrgId = id;
  }

  // Dropdown methods
  function toggleDropdown(dropdownId: string) {
    activeDropdown = activeDropdown === dropdownId ? null : dropdownId;
  }

  function closeAllDropdowns() {
    activeDropdown = null;
  }

  function reset() {
    currentUser = null;
    effectiveRole = 'employee';
    suggestion = null;
    comments = [];
    attachments = [];
    departments = [];
    teams = [];
    areas = [];
    isLoading = true;
    isUpdatingStatus = false;
    isAddingComment = false;
    isSharing = false;
    showShareModal = false;
    showRejectionModal = false;
    showPreviewModal = false;
    selectedShareLevel = null;
    selectedOrgId = null;
    previewAttachment = null;
    activeDropdown = null;
  }

  return {
    // Getters (reactive)
    get currentUser() {
      return currentUser;
    },
    get effectiveRole() {
      return effectiveRole;
    },
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
    get isLoading() {
      return isLoading;
    },
    get isUpdatingStatus() {
      return isUpdatingStatus;
    },
    get isAddingComment() {
      return isAddingComment;
    },
    get isSharing() {
      return isSharing;
    },
    get showShareModal() {
      return showShareModal;
    },
    get showRejectionModal() {
      return showRejectionModal;
    },
    get showPreviewModal() {
      return showPreviewModal;
    },
    get selectedShareLevel() {
      return selectedShareLevel;
    },
    get selectedOrgId() {
      return selectedOrgId;
    },
    get previewAttachment() {
      return previewAttachment;
    },
    get activeDropdown() {
      return activeDropdown;
    },
    get isAdmin() {
      return isAdmin;
    },
    get photoAttachments() {
      return photoAttachments;
    },
    get otherAttachments() {
      return otherAttachments;
    },

    // Methods
    setUser,
    updateEffectiveRole,
    setSuggestion,
    setComments,
    setAttachments,
    setDepartments,
    setTeams,
    setAreas,
    setLoading,
    setUpdatingStatus,
    setAddingComment,
    setSharing,
    openShareModal,
    closeShareModal,
    openRejectionModal,
    closeRejectionModal,
    openPreviewModal,
    closePreviewModal,
    setSelectedShareLevel,
    setSelectedOrgId,
    toggleDropdown,
    closeAllDropdowns,
    reset,
  };
}

// Singleton export
export const kvpDetailState = createKvpDetailState();
