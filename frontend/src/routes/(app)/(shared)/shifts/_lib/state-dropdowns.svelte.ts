// =============================================================================
// SHIFTS STATE - DROPDOWNS MODULE
// Dropdown open/close state management
// =============================================================================

function createDropdownState() {
  let areaDropdownOpen = $state(false);
  let departmentDropdownOpen = $state(false);
  let assetDropdownOpen = $state(false);
  let teamDropdownOpen = $state(false);

  function toggleAreaDropdown() {
    departmentDropdownOpen = false;
    assetDropdownOpen = false;
    teamDropdownOpen = false;
    areaDropdownOpen = !areaDropdownOpen;
  }

  function toggleDepartmentDropdown() {
    areaDropdownOpen = false;
    assetDropdownOpen = false;
    teamDropdownOpen = false;
    departmentDropdownOpen = !departmentDropdownOpen;
  }

  function toggleAssetDropdown() {
    areaDropdownOpen = false;
    departmentDropdownOpen = false;
    teamDropdownOpen = false;
    assetDropdownOpen = !assetDropdownOpen;
  }

  function toggleTeamDropdown() {
    areaDropdownOpen = false;
    departmentDropdownOpen = false;
    assetDropdownOpen = false;
    teamDropdownOpen = !teamDropdownOpen;
  }

  function closeAllDropdowns() {
    areaDropdownOpen = false;
    departmentDropdownOpen = false;
    assetDropdownOpen = false;
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
    get assetDropdownOpen() {
      return assetDropdownOpen;
    },
    get teamDropdownOpen() {
      return teamDropdownOpen;
    },
    toggleAreaDropdown,
    toggleDepartmentDropdown,
    toggleAssetDropdown,
    toggleTeamDropdown,
    closeAllDropdowns,
    reset,
  };
}

export const dropdownState = createDropdownState();
