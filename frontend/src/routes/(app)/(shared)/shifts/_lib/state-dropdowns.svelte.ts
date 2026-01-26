// =============================================================================
// SHIFTS STATE - DROPDOWNS MODULE
// Dropdown open/close state management
// =============================================================================

function createDropdownState() {
  let areaDropdownOpen = $state(false);
  let departmentDropdownOpen = $state(false);
  let machineDropdownOpen = $state(false);
  let teamDropdownOpen = $state(false);

  function toggleAreaDropdown() {
    departmentDropdownOpen = false;
    machineDropdownOpen = false;
    teamDropdownOpen = false;
    areaDropdownOpen = !areaDropdownOpen;
  }

  function toggleDepartmentDropdown() {
    areaDropdownOpen = false;
    machineDropdownOpen = false;
    teamDropdownOpen = false;
    departmentDropdownOpen = !departmentDropdownOpen;
  }

  function toggleMachineDropdown() {
    areaDropdownOpen = false;
    departmentDropdownOpen = false;
    teamDropdownOpen = false;
    machineDropdownOpen = !machineDropdownOpen;
  }

  function toggleTeamDropdown() {
    areaDropdownOpen = false;
    departmentDropdownOpen = false;
    machineDropdownOpen = false;
    teamDropdownOpen = !teamDropdownOpen;
  }

  function closeAllDropdowns() {
    areaDropdownOpen = false;
    departmentDropdownOpen = false;
    machineDropdownOpen = false;
    teamDropdownOpen = false;
  }

  function reset() {
    closeAllDropdowns();
  }

  return {
    get areaDropdownOpen() {
      return areaDropdownOpen;
    },
    get departmentDropdownOpen() {
      return departmentDropdownOpen;
    },
    get machineDropdownOpen() {
      return machineDropdownOpen;
    },
    get teamDropdownOpen() {
      return teamDropdownOpen;
    },
    toggleAreaDropdown,
    toggleDepartmentDropdown,
    toggleMachineDropdown,
    toggleTeamDropdown,
    closeAllDropdowns,
    reset,
  };
}

export const dropdownState = createDropdownState();
