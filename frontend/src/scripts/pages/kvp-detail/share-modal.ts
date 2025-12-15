/**
 * KVP Detail Share Modal Module
 * Handles share modal operations and organization selection
 */

import { openShareModal as openShareModalUI } from './ui';
import type { KvpSuggestion } from './ui';
import { KvpDetailDataLoader } from './data-loader';

/** CSS class for dropdown options */
const DROPDOWN_OPTION_CLASS = 'dropdown__option';
/** Attribute name for option values */
const DATA_VALUE_ATTR = 'data-value';

/**
 * Share modal handler for KVP detail page
 */
export class KvpDetailShareModal {
  private dataLoader: KvpDetailDataLoader;
  private suggestion: KvpSuggestion | null = null;

  constructor(dataLoader: KvpDetailDataLoader) {
    this.dataLoader = dataLoader;
  }

  setSuggestion(suggestion: KvpSuggestion | null): void {
    this.suggestion = suggestion;
  }

  /**
   * Open share modal with pre-populated organization data
   */
  async openModal(): Promise<void> {
    await this.loadOrganizations();
    this.preselectOrganization();
    this.triggerModalOpen();
  }

  /**
   * Load organizations (teams, departments, and areas) into custom dropdowns
   */
  private async loadOrganizations(): Promise<void> {
    await this.loadTeamsDropdown();
    await this.loadDepartmentsDropdown();
    await this.loadAreasDropdown();
  }

  /**
   * Load teams into dropdown
   */
  private async loadTeamsDropdown(): Promise<void> {
    const teams = await this.dataLoader.loadTeams();
    this.populateDropdown('teamMenu', teams, 'teamDropdown', 'teamTrigger');
  }

  /**
   * Load departments into dropdown
   */
  private async loadDepartmentsDropdown(): Promise<void> {
    const departments = await this.dataLoader.loadDepartments();
    this.populateDropdown('departmentMenu', departments, 'departmentDropdown', 'departmentTrigger');
  }

  /**
   * Load areas into dropdown
   */
  private async loadAreasDropdown(): Promise<void> {
    const areas = await this.dataLoader.loadAreas();
    this.populateDropdown('areaMenu', areas, 'areaDropdown', 'areaTrigger');
  }

  /**
   * Populate a dropdown menu with options
   */
  private populateDropdown(
    menuId: string,
    items: { id: number; name: string }[],
    dropdownId: string,
    triggerId: string,
  ): void {
    const menu = document.querySelector<HTMLElement>(`#${menuId}`);
    if (menu === null) return;

    menu.innerHTML = '';
    items.forEach((item) => {
      const option = document.createElement('div');
      option.className = DROPDOWN_OPTION_CLASS;
      option.setAttribute(DATA_VALUE_ATTR, String(item.id));
      option.textContent = item.name;
      menu.append(option);
    });

    // NOTE: Option click listeners handled by global event delegation in ui.ts

    // Pre-select if needed
    const dropdown = document.querySelector<HTMLElement>(`#${dropdownId}`);
    const preselect = dropdown?.dataset['preselect'];
    if (preselect !== undefined && dropdown !== null) {
      this.selectDropdownOption(triggerId, menuId, preselect);
      delete dropdown.dataset['preselect'];
    }
  }

  /**
   * Select a dropdown option programmatically
   * NOTE: User interactions are handled by global event delegation in ui.ts
   */
  private selectDropdownOption(triggerId: string, menuId: string, value: string): void {
    const trigger = document.querySelector<HTMLElement>(`#${triggerId}`);
    const menu = document.querySelector<HTMLElement>(`#${menuId}`);

    if (trigger === null || menu === null) return;

    const option = menu.querySelector<HTMLElement>(`.${DROPDOWN_OPTION_CLASS}[${DATA_VALUE_ATTR}="${value}"]`);
    if (option === null) return;

    const triggerSpan = trigger.querySelector('span');
    if (triggerSpan === null) return;

    // textContent is guaranteed to be non-null for HTMLElement
    triggerSpan.textContent = option.textContent;
    trigger.setAttribute(DATA_VALUE_ATTR, value);
  }

  /**
   * Pre-select the current organization level
   */
  private preselectOrganization(): void {
    if (this.suggestion === null) return;

    const { orgLevel, departmentId, teamId } = this.suggestion;
    const radioBtn = document.querySelector<HTMLInputElement>(
      `#share${orgLevel.charAt(0).toUpperCase() + orgLevel.slice(1)}`,
    );

    if (radioBtn === null) return;

    radioBtn.checked = true;
    this.preselectOrgLevel(orgLevel, teamId, departmentId);
  }

  /**
   * Pre-select organization level specific elements
   */
  private preselectOrgLevel(orgLevel: string, teamId?: number, departmentId?: number, areaId?: number): void {
    if (orgLevel === 'team') {
      this.preselectTeam(teamId);
    } else if (orgLevel === 'department') {
      this.preselectDepartment(departmentId);
    } else if (orgLevel === 'area') {
      this.preselectArea(areaId);
    }
  }

  /**
   * Pre-select team in custom dropdown
   */
  private preselectTeam(teamId?: number): void {
    if (teamId === undefined) return;

    const teamDropdown = document.querySelector<HTMLElement>('#teamDropdown');
    if (teamDropdown === null) return;

    teamDropdown.removeAttribute('hidden');
    teamDropdown.dataset['preselect'] = String(teamId);
  }

  /**
   * Pre-select department in custom dropdown
   */
  private preselectDepartment(departmentId?: number): void {
    if (departmentId === undefined) return;

    const deptDropdown = document.querySelector<HTMLElement>('#departmentDropdown');
    if (deptDropdown === null) return;

    deptDropdown.removeAttribute('hidden');
    deptDropdown.dataset['preselect'] = String(departmentId);
  }

  /**
   * Pre-select area in custom dropdown
   */
  private preselectArea(areaId?: number): void {
    if (areaId === undefined) return;

    const areaDropdown = document.querySelector<HTMLElement>('#areaDropdown');
    if (areaDropdown === null) return;

    areaDropdown.removeAttribute('hidden');
    areaDropdown.dataset['preselect'] = String(areaId);
  }

  /**
   * Trigger modal open via UI module
   */
  private triggerModalOpen(): void {
    openShareModalUI();
  }
}
