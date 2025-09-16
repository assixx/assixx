// Department Groups Management
import domPurify from 'dompurify';
import { ApiClient } from '../utils/api-client';
import { showSuccessAlert, showErrorAlert, showConfirm } from './utils/alerts';
// import { $id } from '../utils/dom-utils'; // Currently not used

(() => {
  // Constants
  const CREATE_GROUP_MODAL_SELECTOR = '#createGroupModal';

  // Auth check
  const userRole = localStorage.getItem('userRole');

  if (userRole !== 'root') {
    window.location.href = '/login';
    return;
  }

  // Initialize API client
  const apiClient = ApiClient.getInstance();

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

  let groups: DepartmentGroup[] = [];
  let departments: Department[] = [];
  let selectedGroupId: number | null = null;
  let editingGroupId: number | null = null;

  // Load groups
  async function loadGroups() {
    try {
      const data = await apiClient.request<{ data: DepartmentGroup[] }>('/department-groups', {
        method: 'GET',
      });

      groups = data.data;
      renderGroupTree();
    } catch (error) {
      console.error('Error loading groups:', error);
      showErrorAlert('Netzwerkfehler beim Laden der Gruppen');
    }
  }

  // Load departments
  async function loadDepartments() {
    try {
      departments = await apiClient.request<Department[]>('/departments', { method: 'GET' });
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  }

  // Render group tree
  function renderGroupTree() {
    const container = document.querySelector('#groupTree');
    if (!container) return;

    if (groups.length === 0) {
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
    container.innerHTML = domPurify.sanitize(renderGroupItems(groups));
  }

  // Render group items recursively
  function renderGroupItems(items: DepartmentGroup[], level = 0): string {
    return items
      .map(
        (group) => `
    <div style="margin-left: ${level * 20}px;">
      <div class="tree-item ${selectedGroupId === group.id ? 'active' : ''}"
           onclick="selectGroup(${group.id})"
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
          ? `<div class="tree-children">${renderGroupItems(group.subgroups, level + 1)}</div>`
          : ''
      }
    </div>
  `,
      )
      .join('');
  }

  // Select a group
  interface ManageDeptGroupsWindow extends Window {
    selectGroup: (groupId: number) => void;
    editGroup: (groupId: number) => void;
    showCreateGroupModal: () => void;
    closeModal: () => void;
    deleteGroup: (groupId: number) => Promise<void>;
    addDepartmentsToGroup: (groupId: number) => Promise<void>;
  }

  (window as unknown as ManageDeptGroupsWindow).selectGroup = function (groupId: number) {
    selectedGroupId = groupId;

    // Update active state
    document.querySelectorAll('.tree-item').forEach((item) => {
      item.classList.remove('active');
    });
    document.querySelector(`[data-group-id="${groupId}"]`)?.classList.add('active');

    // Show group details
    showGroupDetails(groupId);
  };

  // Show group details
  function showGroupDetails(groupId: number) {
    const group = findGroupById(groupId);
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
      <button class="btn btn-primary" onclick="editGroup(${group.id})">
        <i class="fas fa-edit"></i> Bearbeiten
      </button>
      <button class="btn btn-secondary" onclick="addDepartmentsToGroup(${group.id})">
        <i class="fas fa-plus"></i> Abteilungen hinzufügen
      </button>
      <button class="btn btn-danger" onclick="deleteGroup(${group.id})">
        <i class="fas fa-trash"></i> Löschen
      </button>
    </div>
  `);
  }

  // Find group by ID recursively
  function findGroupById(id: number, items: DepartmentGroup[] = groups): DepartmentGroup | null {
    for (const group of items) {
      if (group.id === id) return group;
      if (group.subgroups) {
        const found = findGroupById(id, group.subgroups);
        if (found) return found;
      }
    }
    return null;
  }

  // Close modal
  function closeModal() {
    const modal = document.querySelector(CREATE_GROUP_MODAL_SELECTOR);
    if (modal) {
      modal.classList.remove('show');
    }
  }

  // Edit group (first implementation - removed duplicate)

  // Show create group modal
  (window as unknown as ManageDeptGroupsWindow).showCreateGroupModal = function () {
    editingGroupId = null;
    const modalTitle = document.querySelector('#modalTitle');
    if (modalTitle) modalTitle.textContent = 'Neue Abteilungsgruppe erstellen';
    const form = document.querySelector('#createGroupForm');
    if (form instanceof HTMLFormElement) {
      form.reset();
    }

    // Load parent groups
    updateParentGroupSelect();

    // Load departments
    updateDepartmentChecklist([]);

    document.querySelector(CREATE_GROUP_MODAL_SELECTOR)?.classList.add('active');
  };

  // Edit group
  (window as unknown as ManageDeptGroupsWindow).editGroup = function (groupId: number) {
    const group = findGroupById(groupId);
    if (!group) return;

    editingGroupId = groupId;
    const modalTitle = document.querySelector('#modalTitle');
    if (modalTitle) modalTitle.textContent = 'Gruppe bearbeiten';

    // Fill form
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

    // Update selects
    updateParentGroupSelect(groupId);
    updateDepartmentChecklist(group.departments?.map((d) => d.id) ?? []);

    document.querySelector(CREATE_GROUP_MODAL_SELECTOR)?.classList.add('active');
  };

  // Update parent group select
  function updateParentGroupSelect(excludeId?: number) {
    const select = document.querySelector('#parentGroup');
    if (!(select instanceof HTMLSelectElement)) return;

    select.innerHTML = '<option value="">Keine (Hauptgruppe)</option>';

    function addOptions(items: DepartmentGroup[], targetSelect: HTMLSelectElement, level = 0) {
      items.forEach((group) => {
        if (group.id !== excludeId) {
          const option = document.createElement('option');
          option.value = group.id.toString();
          option.textContent = '  '.repeat(level) + group.name;
          targetSelect.append(option);

          if (group.subgroups) {
            addOptions(group.subgroups, targetSelect, level + 1);
          }
        }
      });
    }

    addOptions(groups, select);
  }

  // Update department checklist
  function updateDepartmentChecklist(selectedIds: number[]) {
    const container = document.querySelector('#departmentChecklist');
    if (!container) return;

    // eslint-disable-next-line no-unsanitized/property -- sanitized with domPurify
    container.innerHTML = domPurify.sanitize(
      departments
        .map(
          (dept) => `
    <label class="department-checkbox">
      <input type="checkbox" name="department" value="${dept.id}"
             ${selectedIds.includes(dept.id) ? 'checked' : ''} />
      <span>${dept.name}</span>
    </label>
  `,
        )
        .join(''),
    );
  }

  // Close modal
  (window as unknown as ManageDeptGroupsWindow).closeModal = function () {
    document.querySelector(CREATE_GROUP_MODAL_SELECTOR)?.classList.remove('active');
    editingGroupId = null;
  };

  // Form submit
  document.querySelector('#createGroupForm')?.addEventListener('submit', (e) => {
    void (async () => {
      e.preventDefault();

      const groupNameInput = document.querySelector('#groupName');
      const groupDescInput = document.querySelector('#groupDescription');
      const parentGroupSelect = document.querySelector('#parentGroup');

      if (
        !(groupNameInput instanceof HTMLInputElement) ||
        !(groupDescInput instanceof HTMLTextAreaElement) ||
        !(parentGroupSelect instanceof HTMLSelectElement)
      ) {
        showErrorAlert('Formularfelder nicht gefunden');
        return;
      }

      const formData = {
        name: groupNameInput.value,
        description: groupDescInput.value,
        parentGroupId: parentGroupSelect.value !== '' ? parentGroupSelect.value : null,
        // eslint-disable-next-line promise/prefer-await-to-callbacks -- map is synchronous, not async callback
        departmentIds: [...document.querySelectorAll('input[name="department"]:checked')].map((cb) =>
          Number.parseInt((cb as HTMLInputElement).value, 10),
        ),
      };

      try {
        const url = editingGroupId !== null ? `/department-groups/${editingGroupId}` : '/department-groups';

        const method = editingGroupId !== null ? 'PUT' : 'POST';

        await apiClient.request(url, {
          method,
          body: JSON.stringify(formData),
        });

        showSuccessAlert(editingGroupId !== null ? 'Gruppe aktualisiert' : 'Gruppe erstellt');
        closeModal();
        await loadGroups();
      } catch (error) {
        console.error('Error saving group:', error);
        showErrorAlert('Netzwerkfehler beim Speichern');
      }
    })();
  });

  // Delete group
  (window as unknown as ManageDeptGroupsWindow).deleteGroup = async function (groupId: number) {
    const group = findGroupById(groupId);
    if (!group) return;

    // Use custom confirmation dialog
    const userConfirmed = await showConfirm(`Möchten Sie die Gruppe "${group.name}" wirklich löschen?`);
    if (!userConfirmed) {
      return;
    }

    try {
      await apiClient.request(`/department-groups/${groupId}`, { method: 'DELETE' });

      showSuccessAlert('Gruppe gelöscht');
      selectedGroupId = null;
      await loadGroups();
      const groupDetails = document.querySelector('#groupDetails');
      if (groupDetails) {
        groupDetails.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <i class="fas fa-info-circle"></i>
          </div>
          <div>Wählen Sie eine Gruppe aus, um Details anzuzeigen</div>
        </div>
      `;
      }
    } catch (error) {
      console.error('Error deleting group:', error);
      showErrorAlert('Netzwerkfehler beim Löschen');
    }
  };

  // Add departments to group
  (window as unknown as ManageDeptGroupsWindow).addDepartmentsToGroup = async function (
    groupId: number,
  ): Promise<void> {
    // For now, just open edit modal
    (window as unknown as ManageDeptGroupsWindow).editGroup(groupId);
    await Promise.resolve();
  };

  // Note: showError, showSuccess, and showConfirmDialog are now imported from utils/alerts

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    void (async () => {
      await loadDepartments();
      await loadGroups();
    })();
  });

  // Close modal on outside click
  window.addEventListener('click', (e) => {
    const modal = document.querySelector(CREATE_GROUP_MODAL_SELECTOR);
    if (e.target === modal) {
      closeModal();
    }
  });
})(); // End of IIFE
