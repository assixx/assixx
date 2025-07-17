// Department Groups Management
(() => {
  // Auth check
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('userRole');

  if (!token || userRole !== 'root') {
    window.location.href = '/login';
    return;
  }

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
      const response = await fetch('/api/department-groups/hierarchy', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        groups = result.data ?? [];
        renderGroupTree();
      } else {
        showError('Fehler beim Laden der Gruppen');
      }
    } catch (error) {
      console.error('Error loading groups:', error);
      showError('Netzwerkfehler beim Laden der Gruppen');
    }
  }

  // Load departments
  async function loadDepartments() {
    try {
      const response = await fetch('/api/departments', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        departments = await response.json();
      }
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  }

  // Render group tree
  function renderGroupTree() {
    const container = document.getElementById('groupTree');
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

    container.innerHTML = renderGroupItems(groups);
  }

  // Render group items recursively
  function renderGroupItems(items: DepartmentGroup[], level: number = 0): string {
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

    const container = document.getElementById('groupDetails');
    if (!container) return;

    container.innerHTML = `
    <div class="detail-section">
      <h3>${group.name}</h3>
      ${group.description ? `<p class="text-secondary">${group.description}</p>` : ''}
    </div>

    <div class="detail-section">
      <h4>Zugeordnete Abteilungen (${group.departments?.length || 0})</h4>
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
  `;
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
    const modal = document.getElementById('createGroupModal');
    if (modal) {
      modal.classList.remove('show');
    }
  }

  // Edit group (first implementation - removed duplicate)

  // Show create group modal
  (window as unknown as ManageDeptGroupsWindow).showCreateGroupModal = function () {
    editingGroupId = null;
    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) modalTitle.textContent = 'Neue Abteilungsgruppe erstellen';
    (document.getElementById('createGroupForm') as HTMLFormElement)?.reset();

    // Load parent groups
    updateParentGroupSelect();

    // Load departments
    updateDepartmentChecklist([]);

    document.getElementById('createGroupModal')?.classList.add('active');
  };

  // Edit group
  (window as unknown as ManageDeptGroupsWindow).editGroup = function (groupId: number) {
    const group = findGroupById(groupId);
    if (!group) return;

    editingGroupId = groupId;
    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) modalTitle.textContent = 'Gruppe bearbeiten';

    // Fill form
    (document.getElementById('groupName') as HTMLInputElement).value = group.name;
    (document.getElementById('groupDescription') as HTMLTextAreaElement).value = group.description ?? '';
    (document.getElementById('parentGroup') as HTMLSelectElement).value = group.parent_group_id?.toString() ?? '';

    // Update selects
    updateParentGroupSelect(groupId);
    updateDepartmentChecklist(group.departments?.map((d) => d.id) || []);

    document.getElementById('createGroupModal')?.classList.add('active');
  };

  // Update parent group select
  function updateParentGroupSelect(excludeId?: number) {
    const select = document.getElementById('parentGroup') as HTMLSelectElement;
    if (!select) return;

    select.innerHTML = '<option value="">Keine (Hauptgruppe)</option>';

    function addOptions(items: DepartmentGroup[], level: number = 0) {
      items.forEach((group) => {
        if (group.id !== excludeId) {
          const option = document.createElement('option');
          option.value = group.id.toString();
          option.textContent = '  '.repeat(level) + group.name;
          select.appendChild(option);

          if (group.subgroups) {
            addOptions(group.subgroups, level + 1);
          }
        }
      });
    }

    addOptions(groups);
  }

  // Update department checklist
  function updateDepartmentChecklist(selectedIds: number[]) {
    const container = document.getElementById('departmentChecklist');
    if (!container) return;

    container.innerHTML = departments
      .map(
        (dept) => `
    <label class="department-checkbox">
      <input type="checkbox" name="department" value="${dept.id}" 
             ${selectedIds.includes(dept.id) ? 'checked' : ''} />
      <span>${dept.name}</span>
    </label>
  `,
      )
      .join('');
  }

  // Close modal
  (window as unknown as ManageDeptGroupsWindow).closeModal = function () {
    document.getElementById('createGroupModal')?.classList.remove('active');
    editingGroupId = null;
  };

  // Form submit
  document.getElementById('createGroupForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
      name: (document.getElementById('groupName') as HTMLInputElement).value,
      description: (document.getElementById('groupDescription') as HTMLTextAreaElement).value,
      parentGroupId: (document.getElementById('parentGroup') as HTMLSelectElement).value ?? null,
      departmentIds: Array.from(document.querySelectorAll('input[name="department"]:checked')).map((cb) =>
        parseInt((cb as HTMLInputElement).value),
      ),
    };

    try {
      const url = editingGroupId ? `/api/department-groups/${editingGroupId}` : '/api/department-groups';

      const method = editingGroupId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        showSuccess(editingGroupId ? 'Gruppe aktualisiert' : 'Gruppe erstellt');
        closeModal();
        await loadGroups();
      } else {
        const error = await response.json();
        showError(error.error || 'Fehler beim Speichern');
      }
    } catch (error) {
      console.error('Error saving group:', error);
      showError('Netzwerkfehler beim Speichern');
    }
  });

  // Delete group
  (window as unknown as ManageDeptGroupsWindow).deleteGroup = async function (groupId: number) {
    const group = findGroupById(groupId);
    if (!group) return;

    if (!confirm(`Möchten Sie die Gruppe "${group.name}" wirklich löschen?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/department-groups/${groupId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        showSuccess('Gruppe gelöscht');
        selectedGroupId = null;
        await loadGroups();
        const groupDetails = document.getElementById('groupDetails');
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
      } else {
        const error = await response.json();
        showError(error.error || 'Fehler beim Löschen');
      }
    } catch (error) {
      console.error('Error deleting group:', error);
      showError('Netzwerkfehler beim Löschen');
    }
  };

  // Add departments to group
  (window as unknown as ManageDeptGroupsWindow).addDepartmentsToGroup = async function (groupId: number) {
    // For now, just open edit modal
    (window as unknown as ManageDeptGroupsWindow).editGroup(groupId);
  };

  // Helper functions
  function showError(message: string) {
    alert(`Fehler: ${message}`);
  }

  function showSuccess(message: string) {
    alert(`Erfolg: ${message}`);
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', async () => {
    await loadDepartments();
    await loadGroups();
  });

  // Close modal on outside click
  window.addEventListener('click', (e) => {
    const modal = document.getElementById('createGroupModal');
    if (e.target === modal) {
      closeModal();
    }
  });
})(); // End of IIFE
