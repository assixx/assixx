// Department Groups Management
import domPurify from 'dompurify';
import { ApiClient } from '../utils/api-client';
import { isRoot } from '../utils/auth-helpers';
import { showSuccessAlert, showErrorAlert, showConfirm } from './utils/alerts';

interface Department {
  id: number;
  name: string;
  description?: string;
}

interface DepartmentGroup {
  id: number;
  name: string;
  description?: string;
  parent_group_id?: number;
  departments?: Department[];
  subgroups?: DepartmentGroup[];
}

interface ManageDeptGroupsWindow extends Window {
  createGroup: () => Promise<void>;
  editGroup: (id: number) => void;
  addDepartmentsToGroup: (id: number) => Promise<void>;
  deleteGroup: (id: number) => Promise<void>;
}

/**
 * Department Groups Manager class
 */
class DepartmentGroupsManager {
  private readonly CREATE_GROUP_MODAL_SELECTOR = '#createGroupModal';
  private apiClient: ApiClient;
  private groups: DepartmentGroup[] = [];
  private departments: Department[] = [];
  private selectedGroupId: number | null = null;
  private editingGroupId: number | null = null;

  constructor() {
    this.apiClient = ApiClient.getInstance();
    this.init();
  }

  private init(): void {
    // Auth check
    if (!isRoot()) {
      window.location.href = '/login';
      return;
    }

    this.setupEventListeners();
    void this.loadDepartments();
    void this.loadGroups();
    this.attachWindowMethods();
  }

  private attachWindowMethods(): void {
    const win = window as unknown as ManageDeptGroupsWindow;
    win.createGroup = () => this.createGroup();
    win.editGroup = (id: number) => {
      this.editGroup(id);
    };
    win.addDepartmentsToGroup = (id: number) => {
      this.addDepartmentsToGroup(id);
      return Promise.resolve();
    };
    win.deleteGroup = (id: number) => this.deleteGroup(id);
  }

  private async loadGroups(): Promise<void> {
    try {
      const data = await this.apiClient.request<{ data: DepartmentGroup[] }>('/department-groups', {
        method: 'GET',
      });
      this.groups = data.data;
      this.renderGroupTree();
    } catch (error) {
      console.error('Error loading groups:', error);
      showErrorAlert('Netzwerkfehler beim Laden der Gruppen');
    }
  }

  private async loadDepartments(): Promise<void> {
    try {
      this.departments = await this.apiClient.request<Department[]>('/departments', { method: 'GET' });
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  }

  private renderGroupTree(): void {
    const container = document.querySelector('#groupTree');
    if (!container) return;

    if (this.groups.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <i class="fas fa-folder-tree"></i>
          </div>
          <div>Keine Gruppen vorhanden</div>
          <div class="text-secondary" style="font-size: 14px;">Erstellen Sie Ihre erste Gruppe</div>
        </div>
      `;
      return;
    }

    // eslint-disable-next-line no-unsanitized/property -- sanitized with domPurify
    container.innerHTML = domPurify.sanitize(this.renderGroupItems(this.groups));
  }

  private renderGroupItems(items: DepartmentGroup[], level = 0): string {
    return items
      .map(
        (group) => `
          <div style="margin-left: ${level * 20}px;">
            <div class="tree-item ${this.selectedGroupId === group.id ? 'active' : ''}"
                 data-action="select-group"
                 data-group-id="${group.id}">
              <i class="fas fa-folder tree-item-icon"></i>
              <span class="tree-item-name">${group.name}</span>
              ${
                group.departments && group.departments.length > 0
                  ? `<span class="tree-item-count">${group.departments.length}</span>`
                  : ''
              }
            </div>
            ${
              group.subgroups && group.subgroups.length > 0
                ? `<div class="tree-children">${this.renderGroupItems(group.subgroups, level + 1)}</div>`
                : ''
            }
          </div>
        `,
      )
      .join('');
  }

  private selectGroup(groupId: number): void {
    this.selectedGroupId = groupId;

    document.querySelectorAll('.tree-item').forEach((item) => {
      item.classList.remove('active');
    });
    document.querySelector(`[data-group-id="${groupId}"]`)?.classList.add('active');

    this.showGroupDetails(groupId);
  }

  private showGroupDetails(groupId: number): void {
    const group = this.findGroupById(groupId);
    if (!group) return;

    const container = document.querySelector('#groupDetails');
    if (!container) return;

    // eslint-disable-next-line no-unsanitized/property -- sanitized with domPurify
    container.innerHTML = domPurify.sanitize(`
      <div class="detail-section">
        <h3>${group.name}</h3>
        ${group.description !== undefined && group.description !== '' ? `<p class="text-secondary">${group.description}</p>` : ''}
      </div>

      <div class="detail-section">
        <h4>Zugeordnete Abteilungen (${group.departments?.length ?? 0})</h4>
        <div>
          ${
            group.departments && group.departments.length > 0
              ? group.departments
                  .map(
                    (dept) => `
                      <div class="department-item">
                        <i class="fas fa-building" style="margin-right: 8px; color: var(--primary-color);"></i>
                        <span>${dept.name}</span>
                      </div>
                    `,
                  )
                  .join('')
              : '<p class="text-secondary">Keine Abteilungen zugeordnet</p>'
          }
        </div>
      </div>

      <div class="action-buttons">
        <button class="btn btn-primary" data-action="edit-group" data-group-id="${group.id}">
          <i class="fas fa-edit"></i> Bearbeiten
        </button>
        <button class="btn btn-secondary" data-action="add-departments" data-group-id="${group.id}">
          <i class="fas fa-plus"></i> Abteilungen hinzufügen
        </button>
        <button class="btn btn-danger" data-action="delete-group" data-group-id="${group.id}">
          <i class="fas fa-trash"></i> Löschen
        </button>
      </div>
    `);
  }

  private findGroupById(id: number, items: DepartmentGroup[] = this.groups): DepartmentGroup | null {
    for (const group of items) {
      if (group.id === id) return group;
      if (group.subgroups) {
        const found = this.findGroupById(id, group.subgroups);
        if (found) return found;
      }
    }
    return null;
  }

  private closeModal(): void {
    const modal = document.querySelector(this.CREATE_GROUP_MODAL_SELECTOR);
    if (modal) {
      modal.classList.remove('show');
    }
  }

  private showCreateGroupModal(): void {
    this.editingGroupId = null;
    const modalTitle = document.querySelector('#modalTitle');
    if (modalTitle) modalTitle.textContent = 'Neue Abteilungsgruppe erstellen';

    const form = document.querySelector('#createGroupForm');
    if (form instanceof HTMLFormElement) {
      form.reset();
    }

    this.updateParentGroupSelect();
    this.updateDepartmentChecklist([]);

    document.querySelector(this.CREATE_GROUP_MODAL_SELECTOR)?.classList.add('active');
  }

  private editGroup(groupId: number): void {
    const group = this.findGroupById(groupId);
    if (!group) return;

    this.editingGroupId = groupId;
    const modalTitle = document.querySelector('#modalTitle');
    if (modalTitle) modalTitle.textContent = 'Gruppe bearbeiten';

    const groupNameInput = document.querySelector('#groupName');
    if (groupNameInput instanceof HTMLInputElement) {
      groupNameInput.value = group.name;
    }

    const groupDescInput = document.querySelector('#groupDescription');
    if (groupDescInput instanceof HTMLTextAreaElement) {
      groupDescInput.value = group.description ?? '';
    }

    const parentGroupSelect = document.querySelector('#parentGroup');
    if (parentGroupSelect instanceof HTMLSelectElement) {
      parentGroupSelect.value = group.parent_group_id?.toString() ?? '';
    }

    this.updateParentGroupSelect(groupId);
    this.updateDepartmentChecklist(group.departments?.map((d) => d.id) ?? []);

    document.querySelector(this.CREATE_GROUP_MODAL_SELECTOR)?.classList.add('active');
  }

  private updateParentGroupSelect(excludeId?: number): void {
    const select = document.querySelector('#parentGroup');
    if (!(select instanceof HTMLSelectElement)) return;

    select.innerHTML = '<option value="">Keine (Hauptgruppe)</option>';

    const addOptions = (items: DepartmentGroup[], targetSelect: HTMLSelectElement, level = 0): void => {
      for (const group of items) {
        if (group.id !== excludeId) {
          const option = document.createElement('option');
          option.value = group.id.toString();
          option.textContent = `${'  '.repeat(level)}${group.name}`;
          targetSelect.append(option);
        }
        if (group.subgroups && group.id !== excludeId) {
          addOptions(group.subgroups, targetSelect, level + 1);
        }
      }
    };

    addOptions(this.groups, select);
  }

  private updateDepartmentChecklist(selectedIds: number[]): void {
    const container = document.querySelector('#departmentChecklist');
    if (!container) return;

    // eslint-disable-next-line no-unsanitized/property -- sanitized with domPurify
    container.innerHTML = domPurify.sanitize(
      this.departments
        .map(
          (dept) => `
            <label class="checkbox-label">
              <input type="checkbox" name="departments" value="${dept.id}"
                ${selectedIds.includes(dept.id) ? 'checked' : ''}>
              <span>${dept.name}</span>
            </label>
          `,
        )
        .join(''),
    );
  }

  private async createGroup(): Promise<void> {
    const form = document.querySelector('#createGroupForm');
    if (!(form instanceof HTMLFormElement)) return;

    const formData = new FormData(form);
    const departments = formData
      .getAll('departments')
      .filter((id): id is string => typeof id === 'string')
      .map((id) => Number.parseInt(id));
    const parentGroupIdRaw = formData.get('parent_group_id');
    const parentGroupIdValue = typeof parentGroupIdRaw === 'string' ? parentGroupIdRaw : '';

    const payload = {
      name: formData.get('name'),
      description: formData.get('description'),
      parent_group_id: parentGroupIdValue === '' ? null : Number.parseInt(parentGroupIdValue),
      departments: departments,
    };

    try {
      const url = this.editingGroupId !== null ? `/department-groups/${this.editingGroupId}` : '/department-groups';
      const method = this.editingGroupId !== null ? 'PUT' : 'POST';

      await this.apiClient.request(url, {
        method: method,
        body: JSON.stringify(payload),
      });

      showSuccessAlert(`Gruppe erfolgreich ${this.editingGroupId !== null ? 'aktualisiert' : 'erstellt'}!`);

      await this.loadGroups();
      this.closeModal();
    } catch (error) {
      console.error('Error saving group:', error);
      showErrorAlert('Fehler beim Speichern der Gruppe');
    }
  }

  private async deleteGroup(id: number): Promise<void> {
    const group = this.findGroupById(id);
    if (!group) return;

    const confirmed = await showConfirm(`Möchten Sie die Gruppe "${group.name}" wirklich löschen?`);
    if (!confirmed) return;

    try {
      await this.apiClient.request(`/department-groups/${id}`, {
        method: 'DELETE',
      });
      this.selectedGroupId = null;
      await this.loadGroups();
      showSuccessAlert('Gruppe erfolgreich gelöscht!');

      const container = document.querySelector('#groupDetails');
      if (container) {
        container.innerHTML = '<p class="text-secondary">Wählen Sie eine Gruppe aus, um Details anzuzeigen.</p>';
      }
    } catch (error) {
      console.error('Error deleting group:', error);
      showErrorAlert('Fehler beim Löschen der Gruppe');
    }
  }

  private addDepartmentsToGroup(id: number): void {
    const group = this.findGroupById(id);
    if (!group) return;

    console.info('Adding departments to group:', group);
    showErrorAlert('Diese Funktion ist noch nicht implementiert');
  }

  private handleSelectGroup(element: HTMLElement): void {
    const groupId = this.getGroupIdFromElement(element);
    if (groupId !== null) {
      this.selectGroup(groupId);
    }
  }

  private handleEditGroup(element: HTMLElement): void {
    const groupId = this.getGroupIdFromElement(element);
    if (groupId !== null) {
      this.editGroup(groupId);
    }
  }

  private handleAddDepartments(element: HTMLElement): void {
    const groupId = this.getGroupIdFromElement(element);
    if (groupId !== null) {
      this.addDepartmentsToGroup(groupId);
    }
  }

  private handleDeleteGroup(element: HTMLElement): void {
    const groupId = this.getGroupIdFromElement(element);
    if (groupId !== null) {
      void this.deleteGroup(groupId);
    }
  }

  private handleClickAction(target: HTMLElement): void {
    // Handle group selection
    const selectBtn = target.closest<HTMLElement>('[data-action="select-group"]');
    if (selectBtn) {
      this.handleSelectGroup(selectBtn);
      return;
    }

    // Handle create group button
    if (target.closest('[data-action="create-group"]')) {
      this.showCreateGroupModal();
      return;
    }

    // Handle close modal
    if (target.closest('[data-action="close-modal"]')) {
      this.closeModal();
      return;
    }

    // Handle edit group
    const editBtn = target.closest<HTMLElement>('[data-action="edit-group"]');
    if (editBtn) {
      this.handleEditGroup(editBtn);
      return;
    }

    // Handle add departments
    const addBtn = target.closest<HTMLElement>('[data-action="add-departments"]');
    if (addBtn) {
      this.handleAddDepartments(addBtn);
      return;
    }

    // Handle delete group
    const deleteBtn = target.closest<HTMLElement>('[data-action="delete-group"]');
    if (deleteBtn) {
      this.handleDeleteGroup(deleteBtn);
    }
  }

  private setupEventListeners(): void {
    // Form submission
    document.addEventListener('submit', (e) => {
      if (e.target instanceof HTMLFormElement && e.target.id === 'createGroupForm') {
        e.preventDefault();
        void this.createGroup();
      }
    });

    // Click events
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      this.handleClickAction(target);
    });

    // Close modal on outside click
    window.addEventListener('click', (e) => {
      const modal = document.querySelector(this.CREATE_GROUP_MODAL_SELECTOR);
      if (e.target === modal) {
        this.closeModal();
      }
    });
  }

  private getGroupIdFromElement(element: HTMLElement): number | null {
    const idStr = element.dataset.groupId;
    return idStr !== undefined && idStr !== '' ? Number.parseInt(idStr, 10) : null;
  }
}

// Initialize on DOM ready
(() => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new DepartmentGroupsManager());
  } else {
    new DepartmentGroupsManager();
  }
})();
