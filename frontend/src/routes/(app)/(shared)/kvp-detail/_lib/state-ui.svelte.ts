// =============================================================================
// KVP-DETAIL - UI STATE MODULE
// =============================================================================

import type { OrgLevel, Attachment } from './types';

/** Creates loading-related state */
function createLoadingState() {
  let isLoading = $state(true);
  let isUpdatingStatus = $state(false);
  let isAddingComment = $state(false);
  let isSharing = $state(false);

  return {
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
    setLoading: (val: boolean) => {
      isLoading = val;
    },
    setUpdatingStatus: (val: boolean) => {
      isUpdatingStatus = val;
    },
    setAddingComment: (val: boolean) => {
      isAddingComment = val;
    },
    setSharing: (val: boolean) => {
      isSharing = val;
    },
  };
}

/** Creates modal-related state */
function createModalState() {
  let showShareModal = $state(false);
  let showRejectionModal = $state(false);
  let showPreviewModal = $state(false);
  let selectedShareLevel = $state<OrgLevel | null>(null);
  let selectedOrgId = $state<number | null>(null);
  let previewAttachment = $state<Attachment | null>(null);

  return {
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
    setShowShareModal: (val: boolean) => {
      showShareModal = val;
    },
    setShowRejectionModal: (val: boolean) => {
      showRejectionModal = val;
    },
    setShowPreviewModal: (val: boolean) => {
      showPreviewModal = val;
    },
    setSelectedShareLevel: (level: OrgLevel | null) => {
      selectedShareLevel = level;
    },
    setSelectedOrgId: (id: number | null) => {
      selectedOrgId = id;
    },
    setPreviewAttachment: (att: Attachment | null) => {
      previewAttachment = att;
    },
  };
}

/** Creates dropdown-related state */
function createDropdownState() {
  let activeDropdown = $state<string | null>(null);

  return {
    get activeDropdown() {
      return activeDropdown;
    },
    setActiveDropdown: (id: string | null) => {
      activeDropdown = id;
    },
  };
}

/** Creates UI-related state (loading, modals, dropdowns) */
export function createUIState() {
  const loading = createLoadingState();
  const modal = createModalState();
  const dropdown = createDropdownState();

  // IMPORTANT: Do NOT use spread operator here!
  // Spread destroys getters and copies static values, breaking reactivity.
  // Must explicitly re-export getters to preserve Svelte 5 reactivity chain.
  return {
    // Loading state - explicit getters preserve reactivity
    get isLoading() {
      return loading.isLoading;
    },
    get isUpdatingStatus() {
      return loading.isUpdatingStatus;
    },
    get isAddingComment() {
      return loading.isAddingComment;
    },
    get isSharing() {
      return loading.isSharing;
    },
    setLoading: loading.setLoading,
    setUpdatingStatus: loading.setUpdatingStatus,
    setAddingComment: loading.setAddingComment,
    setSharing: loading.setSharing,

    // Modal state - explicit getters preserve reactivity
    get showShareModal() {
      return modal.showShareModal;
    },
    get showRejectionModal() {
      return modal.showRejectionModal;
    },
    get showPreviewModal() {
      return modal.showPreviewModal;
    },
    get selectedShareLevel() {
      return modal.selectedShareLevel;
    },
    get selectedOrgId() {
      return modal.selectedOrgId;
    },
    get previewAttachment() {
      return modal.previewAttachment;
    },
    setShowShareModal: modal.setShowShareModal,
    setShowRejectionModal: modal.setShowRejectionModal,
    setShowPreviewModal: modal.setShowPreviewModal,
    setSelectedShareLevel: modal.setSelectedShareLevel,
    setSelectedOrgId: modal.setSelectedOrgId,
    setPreviewAttachment: modal.setPreviewAttachment,

    // Dropdown state - explicit getters preserve reactivity
    get activeDropdown() {
      return dropdown.activeDropdown;
    },
    setActiveDropdown: dropdown.setActiveDropdown,
  };
}

export type UIState = ReturnType<typeof createUIState>;
