/**
 * Department Groups API - API v2 Calls
 */

import { ApiClient } from '../../../utils/api-client';
import { showErrorAlert } from '../../utils/alerts';
import { $$id, setSafeHTML } from '../../../utils/dom-utils';
import type { DepartmentGroup, Department } from './types';

export class DepartmentGroupAPI {
  constructor(private readonly apiClient: ApiClient) {}

  /**
   * Fetch all department groups
   */
  async fetchAll(): Promise<DepartmentGroup[]> {
    try {
      const response = await this.apiClient.request<DepartmentGroup[]>('/department-groups', {
        method: 'GET',
      });
      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error('[DepartmentGroupAPI] Error loading groups:', error);
      showErrorAlert('Fehler beim Laden der Gruppen');
      return [];
    }
  }

  /**
   * Create new department group
   */
  async create(data: Partial<DepartmentGroup>): Promise<DepartmentGroup> {
    return await this.apiClient.request<DepartmentGroup>('/department-groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update existing department group
   */
  async update(id: number, data: Partial<DepartmentGroup>): Promise<DepartmentGroup> {
    return await this.apiClient.request<DepartmentGroup>(`/department-groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete department group
   */
  async delete(id: number): Promise<void> {
    await this.apiClient.request(`/department-groups/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get group details by ID
   */
  async getDetails(id: number): Promise<DepartmentGroup | null> {
    try {
      return await this.apiClient.request<DepartmentGroup>(`/department-groups/${id}`, {
        method: 'GET',
      });
    } catch (error) {
      console.error('[DepartmentGroupAPI] Error loading group details:', error);
      return null;
    }
  }

  /**
   * Fetch all departments for assignment
   */
  async fetchDepartments(): Promise<Department[]> {
    try {
      const response = await this.apiClient.request<Department[]>('/departments', {
        method: 'GET',
      });
      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error('[DepartmentGroupAPI] Error loading departments:', error);
      return [];
    }
  }

  /**
   * Load parent groups into custom dropdown
   * Populates the dropdown menu with folder icons and hierarchical indentation
   */
  loadParentGroups(groups: DepartmentGroup[], excludeId?: number): void {
    console.log('[loadParentGroups] Called with', groups.length, 'groups, excludeId:', excludeId);
    const menu = $$id('parent-group-menu');
    if (menu === null) {
      console.warn('[loadParentGroups] Dropdown menu not found');
      return;
    }
    console.log('[loadParentGroups] Menu element found:', menu);

    // Reset menu - keep only the first "Keine (Hauptgruppe)" option
    setSafeHTML(
      menu,
      `
      <div class="dropdown__option" data-value="">
        <i class="fas fa-folder-open"></i>
        Keine (Hauptgruppe)
      </div>
    `,
    );

    // Recursive function to add options with visual indentation
    const addOptions = (items: DepartmentGroup[], level = 0): void => {
      for (const group of items) {
        if (group.id !== excludeId) {
          const option = document.createElement('div');
          option.className = 'dropdown__option';
          option.dataset['value'] = group.id.toString();

          // Add indentation for subgroups (using margin-left)
          if (level > 0) {
            option.style.paddingLeft = `${16 + level * 16}px`;
          }

          // Icon and text
          const icon = document.createElement('i');
          icon.className = 'fas fa-folder';

          const text = document.createTextNode(group.name);

          option.append(icon, ' ', text);
          menu.append(option);

          // Add subgroups recursively
          if (group.subgroups !== undefined && group.subgroups.length > 0) {
            addOptions(group.subgroups, level + 1);
          }
        }
      }
    };

    addOptions(groups);
  }

  /**
   * Load departments into multi-select
   * Populates the department-select element with options
   */
  loadDepartmentChecklist(departments: Department[], selectedIds: number[]): void {
    const container = $$id('department-select') as HTMLSelectElement | null;
    if (container === null) {
      console.warn('[loadDepartmentChecklist] Multi-select container not found');
      return;
    }

    // Clear existing options
    container.innerHTML = '';

    if (departments.length === 0) {
      const emptyOption = document.createElement('option');
      emptyOption.disabled = true;
      emptyOption.textContent = 'Keine Abteilungen verfügbar';
      container.appendChild(emptyOption);
      return;
    }

    // Build options for multi-select
    departments.forEach((dept) => {
      const option = document.createElement('option');
      option.value = String(dept.id);
      option.textContent = dept.name;
      if (selectedIds.includes(dept.id)) {
        option.selected = true;
      }
      container.appendChild(option);
    });
  }
}
