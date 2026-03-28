// =============================================================================
// KVP-DETAIL - COMPOSED STATE (Svelte 5 Runes)
// =============================================================================

import { createDataState, createOrgState } from './state-data.svelte';
import { createUIState } from './state-ui.svelte';
import { createUserState } from './state-user.svelte';

import type { OrgLevel } from './types';

/**
 * KVP Detail State Factory
 * Composes user, data, and UI state modules
 */
// eslint-disable-next-line max-lines-per-function -- Facade pattern: composing 3 sub-modules into unified API. Actual reactive logic is in sub-modules.
function createKvpDetailState() {
  const user = createUserState();
  const data = createDataState();
  const org = createOrgState();
  const ui = createUIState();

  // Modal action methods
  const openShareModal = () => {
    ui.setSelectedShareLevel(null);
    ui.setSelectedOrgId(null);
    ui.setShowShareModal(true);
  };

  const closeShareModal = () => {
    ui.setShowShareModal(false);
    ui.setSelectedShareLevel(null);
    ui.setSelectedOrgId(null);
  };

  const openRejectionModal = () => {
    ui.setShowRejectionModal(true);
  };

  const closeRejectionModal = () => {
    ui.setShowRejectionModal(false);
  };

  const setSelectedShareLevel = (level: OrgLevel | null) => {
    ui.setSelectedShareLevel(level);
    ui.setSelectedOrgId(null);
  };

  // Dropdown methods
  const toggleDropdown = (dropdownId: string) => {
    ui.setActiveDropdown(ui.activeDropdown === dropdownId ? null : dropdownId);
  };

  const closeAllDropdowns = () => {
    ui.setActiveDropdown(null);
  };

  // Reset all state
  const reset = () => {
    user.setUser(null);
    data.setSuggestion(null);
    data.setComments([]);
    data.setAttachments([]);
    org.setDepartments([]);
    org.setTeams([]);
    org.setAreas([]);
    org.setAssets([]);
    ui.setLoading(true);
    ui.setUpdatingStatus(false);
    ui.setAddingComment(false);
    ui.setSharing(false);
    ui.setShowShareModal(false);
    ui.setShowRejectionModal(false);
    ui.setSelectedShareLevel(null);
    ui.setSelectedOrgId(null);
    ui.setActiveDropdown(null);
  };

  return {
    // User state
    get currentUser() {
      return user.currentUser;
    },
    get effectiveRole() {
      return user.effectiveRole;
    },
    get isAdmin() {
      return user.isAdmin;
    },
    get canManage() {
      return user.canManage;
    },
    setUser: user.setUser,
    setTeamLead: user.setTeamLead,
    updateEffectiveRole: user.updateEffectiveRole,

    // Data state
    get suggestion() {
      return data.suggestion;
    },
    get comments() {
      return data.comments;
    },
    get commentTotal() {
      return data.commentTotal;
    },
    get commentsHasMore() {
      return data.commentsHasMore;
    },
    get attachments() {
      return data.attachments;
    },
    get departments() {
      return org.departments;
    },
    get teams() {
      return org.teams;
    },
    get areas() {
      return org.areas;
    },
    get assets() {
      return org.assets;
    },
    get photoAttachments() {
      return data.photoAttachments;
    },
    get otherAttachments() {
      return data.otherAttachments;
    },
    setSuggestion: data.setSuggestion,
    setComments: data.setComments,
    appendComments: data.appendComments,
    setAttachments: data.setAttachments,
    setDepartments: org.setDepartments,
    setTeams: org.setTeams,
    setAreas: org.setAreas,
    setAssets: org.setAssets,

    // UI state - Loading
    get isLoading() {
      return ui.isLoading;
    },
    get isUpdatingStatus() {
      return ui.isUpdatingStatus;
    },
    get isAddingComment() {
      return ui.isAddingComment;
    },
    get isSharing() {
      return ui.isSharing;
    },
    setLoading: ui.setLoading,
    setUpdatingStatus: ui.setUpdatingStatus,
    setAddingComment: ui.setAddingComment,
    setSharing: ui.setSharing,

    // UI state - Modals
    get showShareModal() {
      return ui.showShareModal;
    },
    get showRejectionModal() {
      return ui.showRejectionModal;
    },
    get selectedShareLevel() {
      return ui.selectedShareLevel;
    },
    get selectedOrgId() {
      return ui.selectedOrgId;
    },
    setSelectedOrgId: ui.setSelectedOrgId,

    // UI state - Dropdowns
    get activeDropdown() {
      return ui.activeDropdown;
    },

    // Modal methods
    openShareModal,
    closeShareModal,
    openRejectionModal,
    closeRejectionModal,
    setSelectedShareLevel,

    // Dropdown methods
    toggleDropdown,
    closeAllDropdowns,

    // Reset
    reset,
  };
}

// Singleton export
export const kvpDetailState = createKvpDetailState();
