// =============================================================================
// VACATION ENTITLEMENTS — REACTIVE STATE (Svelte 5 Runes)
// Employee selection, balance display, entitlement form, add-days modal
// =============================================================================

import type { EmployeeListItem, VacationBalance } from './types';

// ─── Data ───────────────────────────────────────────────────────────

let employees = $state<EmployeeListItem[]>([]);
let selectedEmployee = $state<EmployeeListItem | null>(null);
let balance = $state<VacationBalance | null>(null);
let selectedYear = $state(new Date().getFullYear());

// ─── UI ─────────────────────────────────────────────────────────────

let isLoading = $state(false);
let isLoadingBalance = $state(false);
let searchQuery = $state('');

// Modals
let showEntitlementForm = $state(false);
let showAddDaysModal = $state(false);

// ─── Derived ────────────────────────────────────────────────────────

const filteredEmployees = $derived.by(() => {
  if (searchQuery.trim() === '') return employees;
  const q = searchQuery.trim().toLowerCase();
  return employees.filter((emp) => {
    const name = `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.toLowerCase();
    const empNum = emp.employeeNumber?.toLowerCase() ?? '';
    const pos = emp.position?.toLowerCase() ?? '';
    return (
      name.includes(q) ||
      emp.email.toLowerCase().includes(q) ||
      empNum.includes(q) ||
      pos.includes(q)
    );
  });
});

// ─── Methods ────────────────────────────────────────────────────────

function selectEmployee(emp: EmployeeListItem) {
  selectedEmployee = emp;
  balance = null;
}

function clearSelection() {
  selectedEmployee = null;
  balance = null;
  showEntitlementForm = false;
  showAddDaysModal = false;
}

function openEntitlementForm() {
  showEntitlementForm = true;
}

function closeEntitlementForm() {
  showEntitlementForm = false;
}

function openAddDaysModal() {
  showAddDaysModal = true;
}

function closeAddDaysModal() {
  showAddDaysModal = false;
}

function reset() {
  employees = [];
  selectedEmployee = null;
  balance = null;
  selectedYear = new Date().getFullYear();
  isLoading = false;
  isLoadingBalance = false;
  searchQuery = '';
  showEntitlementForm = false;
  showAddDaysModal = false;
}

export const entitlementsState = {
  // Data getters
  get employees() {
    return employees;
  },
  get selectedEmployee() {
    return selectedEmployee;
  },
  get balance() {
    return balance;
  },
  get selectedYear() {
    return selectedYear;
  },
  get filteredEmployees() {
    return filteredEmployees;
  },

  // Data setters
  setEmployees: (data: EmployeeListItem[]) => {
    employees = data;
  },
  setBalance: (data: VacationBalance | null) => {
    balance = data;
  },
  setSelectedYear: (year: number) => {
    selectedYear = year;
    balance = null;
  },

  // UI getters
  get isLoading() {
    return isLoading;
  },
  get isLoadingBalance() {
    return isLoadingBalance;
  },
  get searchQuery() {
    return searchQuery;
  },
  get showEntitlementForm() {
    return showEntitlementForm;
  },
  get showAddDaysModal() {
    return showAddDaysModal;
  },

  // UI setters
  setLoading: (val: boolean) => {
    isLoading = val;
  },
  setLoadingBalance: (val: boolean) => {
    isLoadingBalance = val;
  },
  setSearchQuery: (val: string) => {
    searchQuery = val;
  },

  // Employee selection
  selectEmployee,
  clearSelection,

  // Modals
  openEntitlementForm,
  closeEntitlementForm,
  openAddDaysModal,
  closeAddDaysModal,

  // Global
  reset,
};
