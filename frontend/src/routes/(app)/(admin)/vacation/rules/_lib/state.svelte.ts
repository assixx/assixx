// =============================================================================
// VACATION RULES — REACTIVE STATE (Svelte 5 Runes)
// Blackouts, staffing rules, settings + UI modals
// =============================================================================

import type { RulesTab } from './constants';
import type {
  OrgArea,
  OrgDepartment,
  OrgTeam,
  VacationBlackout,
  VacationSettings,
  VacationStaffingRule,
} from './types';

// ─── Data ───────────────────────────────────────────────────────────

let blackouts = $state<VacationBlackout[]>([]);
let staffingRules = $state<VacationStaffingRule[]>([]);
let settings = $state<VacationSettings | null>(null);
let areas = $state<OrgArea[]>([]);
let departments = $state<OrgDepartment[]>([]);
let teams = $state<OrgTeam[]>([]);

// ─── UI ─────────────────────────────────────────────────────────────

let isLoading = $state(false);
let activeTab = $state<RulesTab>('blackouts');

// Blackout modals
let showBlackoutForm = $state(false);
let editingBlackout = $state<VacationBlackout | null>(null);
let showDeleteBlackoutConfirm = $state(false);
let deletingBlackout = $state<VacationBlackout | null>(null);

// Staffing rule modals
let showStaffingRuleForm = $state(false);
let editingStaffingRule = $state<VacationStaffingRule | null>(null);
let showDeleteStaffingRuleConfirm = $state(false);
let deletingStaffingRule = $state<VacationStaffingRule | null>(null);

// Settings
let isEditingSettings = $state(false);

// ─── Methods ────────────────────────────────────────────────────────

function setActiveTab(tab: RulesTab) {
  activeTab = tab;
}

// Blackout methods
function openCreateBlackout() {
  editingBlackout = null;
  showBlackoutForm = true;
}

function openEditBlackout(blackout: VacationBlackout) {
  editingBlackout = blackout;
  showBlackoutForm = true;
}

function closeBlackoutForm() {
  showBlackoutForm = false;
  editingBlackout = null;
}

function openDeleteBlackout(blackout: VacationBlackout) {
  deletingBlackout = blackout;
  showDeleteBlackoutConfirm = true;
}

function closeDeleteBlackout() {
  showDeleteBlackoutConfirm = false;
  deletingBlackout = null;
}

// Staffing rule methods
function openCreateStaffingRule() {
  editingStaffingRule = null;
  showStaffingRuleForm = true;
}

function openEditStaffingRule(rule: VacationStaffingRule) {
  editingStaffingRule = rule;
  showStaffingRuleForm = true;
}

function closeStaffingRuleForm() {
  showStaffingRuleForm = false;
  editingStaffingRule = null;
}

function openDeleteStaffingRule(rule: VacationStaffingRule) {
  deletingStaffingRule = rule;
  showDeleteStaffingRuleConfirm = true;
}

function closeDeleteStaffingRule() {
  showDeleteStaffingRuleConfirm = false;
  deletingStaffingRule = null;
}

// Settings methods
function startEditSettings() {
  isEditingSettings = true;
}

function stopEditSettings() {
  isEditingSettings = false;
}

function reset() {
  blackouts = [];
  staffingRules = [];
  settings = null;
  areas = [];
  departments = [];
  teams = [];
  isLoading = false;
  activeTab = 'blackouts';
  showBlackoutForm = false;
  editingBlackout = null;
  showDeleteBlackoutConfirm = false;
  deletingBlackout = null;
  showStaffingRuleForm = false;
  editingStaffingRule = null;
  showDeleteStaffingRuleConfirm = false;
  deletingStaffingRule = null;
  isEditingSettings = false;
}

export const rulesState = {
  // Data getters
  get blackouts() {
    return blackouts;
  },
  get staffingRules() {
    return staffingRules;
  },
  get settings() {
    return settings;
  },
  get areas() {
    return areas;
  },
  get departments() {
    return departments;
  },
  get teams() {
    return teams;
  },

  // Data setters
  setBlackouts: (data: VacationBlackout[]) => {
    blackouts = data;
  },
  setStaffingRules: (data: VacationStaffingRule[]) => {
    staffingRules = data;
  },
  setSettings: (data: VacationSettings | null) => {
    settings = data;
  },
  setAreas: (data: OrgArea[]) => {
    areas = data;
  },
  setDepartments: (data: OrgDepartment[]) => {
    departments = data;
  },
  setTeams: (data: OrgTeam[]) => {
    teams = data;
  },

  // UI getters
  get isLoading() {
    return isLoading;
  },
  get activeTab() {
    return activeTab;
  },
  get showBlackoutForm() {
    return showBlackoutForm;
  },
  get editingBlackout() {
    return editingBlackout;
  },
  get showDeleteBlackoutConfirm() {
    return showDeleteBlackoutConfirm;
  },
  get deletingBlackout() {
    return deletingBlackout;
  },
  get showStaffingRuleForm() {
    return showStaffingRuleForm;
  },
  get editingStaffingRule() {
    return editingStaffingRule;
  },
  get showDeleteStaffingRuleConfirm() {
    return showDeleteStaffingRuleConfirm;
  },
  get deletingStaffingRule() {
    return deletingStaffingRule;
  },
  get isEditingSettings() {
    return isEditingSettings;
  },

  // UI setters
  setLoading: (val: boolean) => {
    isLoading = val;
  },
  setActiveTab,

  // Blackout
  openCreateBlackout,
  openEditBlackout,
  closeBlackoutForm,
  openDeleteBlackout,
  closeDeleteBlackout,

  // Staffing rules
  openCreateStaffingRule,
  openEditStaffingRule,
  closeStaffingRuleForm,
  openDeleteStaffingRule,
  closeDeleteStaffingRule,

  // Settings
  startEditSettings,
  stopEditSettings,

  // Global
  reset,
};
