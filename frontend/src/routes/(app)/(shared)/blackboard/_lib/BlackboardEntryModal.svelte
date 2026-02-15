<script lang="ts">
  import { onClickOutsideDropdown } from '$lib/actions/click-outside';
  import AppDatePicker from '$lib/components/AppDatePicker.svelte';
  import {
    filterAvailableDepartments,
    filterDepartmentIdsByAreas,
    filterAvailableTeams,
    filterTeamIdsByDepartments,
  } from '$lib/utils';

  import {
    COLOR_OPTIONS,
    PRIORITY_OPTIONS,
    MESSAGES,
    FILE_UPLOAD_CONFIG,
  } from './constants';
  import { getPriorityLabel } from './utils';

  import type {
    Priority,
    EntryColor,
    Department,
    Team,
    Area,
    FormMode,
  } from './types';

  interface Props {
    mode: FormMode;
    title: string;
    content: string;
    priority: Priority;
    color: EntryColor;
    expiresAt: string;
    companyWide: boolean;
    departmentIds: number[];
    teamIds: number[];
    areaIds: number[];
    attachmentFiles: File[] | null;
    departments: Department[];
    teams: Team[];
    areas: Area[];
    onclose: () => void;
    onsubmit: (e: Event) => void;
    ontitlechange: (value: string) => void;
    oncontentchange: (value: string) => void;
    onprioritychange: (value: Priority) => void;
    oncolorchange: (value: EntryColor) => void;
    onexpireschange: (value: string) => void;
    oncompanywidechange: (value: boolean) => void;
    ondepartmentschange: (value: number[]) => void;
    onteamschange: (value: number[]) => void;
    onareaschange: (value: number[]) => void;
    onfileschange: (files: File[] | null) => void;
  }

  const {
    mode,
    title,
    content,
    priority,
    color,
    expiresAt,
    companyWide,
    departmentIds,
    teamIds,
    areaIds,
    attachmentFiles,
    departments,
    teams,
    areas,
    onclose,
    onsubmit,
    ontitlechange,
    oncontentchange,
    onprioritychange,
    oncolorchange,
    onexpireschange,
    oncompanywidechange,
    ondepartmentschange,
    onteamschange,
    onareaschange,
    onfileschange,
  }: Props = $props();

  let priorityDropdownOpen = $state(false);

  const priorityLabel = $derived(getPriorityLabel(priority));

  // Filter departments based on selected areas (inheritance logic)
  const availableDepartments = $derived.by(() => {
    return filterAvailableDepartments(departments, areaIds, companyWide);
  });

  // All department IDs covered by selection (explicit + area-inherited)
  const coveredDepartmentIds = $derived.by(() => {
    const inherited = departments
      .filter((d) => areaIds.includes(d.areaId ?? -1))
      .map((d) => d.id);
    return [...departmentIds, ...inherited];
  });

  // Filter teams: hide teams whose department is already covered
  const availableTeams = $derived.by(() => {
    return filterAvailableTeams(teams, coveredDepartmentIds, companyWide);
  });

  /**
   * Handle area selection change.
   * Filters out departments and teams covered by selected areas (inheritance).
   */
  function handleAreaChange(newAreaIds: number[]): void {
    onareaschange(newAreaIds);
    // Remove departments that are now covered by selected areas
    const filteredDeptIds = filterDepartmentIdsByAreas(
      departmentIds,
      departments,
      newAreaIds,
    );
    if (filteredDeptIds.length !== departmentIds.length) {
      ondepartmentschange(filteredDeptIds);
    }
    // Remove teams whose department is now covered (explicit + area-inherited)
    const areaDeptIds = departments
      .filter((d) => newAreaIds.includes(d.areaId ?? -1))
      .map((d) => d.id);
    const filteredTeamIds = filterTeamIdsByDepartments(teamIds, teams, [
      ...filteredDeptIds,
      ...areaDeptIds,
    ]);
    if (filteredTeamIds.length !== teamIds.length) {
      onteamschange(filteredTeamIds);
    }
  }

  /**
   * Handle department selection change.
   * Filters out teams covered by selected departments.
   */
  function handleDepartmentChange(newDeptIds: number[]): void {
    ondepartmentschange(newDeptIds);
    // Remove teams whose department is now covered (explicit + area-inherited)
    const areaDeptIds = departments
      .filter((d) => areaIds.includes(d.areaId ?? -1))
      .map((d) => d.id);
    const filteredTeamIds = filterTeamIdsByDepartments(teamIds, teams, [
      ...newDeptIds,
      ...areaDeptIds,
    ]);
    if (filteredTeamIds.length !== teamIds.length) {
      onteamschange(filteredTeamIds);
    }
  }

  function setPriority(value: Priority): void {
    onprioritychange(value);
    priorityDropdownOpen = false;
  }

  function removeAttachment(index: number): void {
    if (!attachmentFiles) return;
    const filtered = attachmentFiles.filter((_, i) => i !== index);
    onfileschange(filtered.length > 0 ? filtered : null);
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      priorityDropdownOpen = false;
      onclose();
    }
  }

  // Capture-phase click-outside: works inside modals (bypasses stopPropagation)
  $effect(() => {
    return onClickOutsideDropdown(() => {
      priorityDropdownOpen = false;
    });
  });
</script>

<svelte:window onkeydown={handleKeyDown} />

<div
  class="modal-overlay modal-overlay--active"
  onclick={onclose}
  onkeydown={(e) => {
    if (e.key === 'Escape') onclose();
  }}
  role="dialog"
  aria-modal="true"
  tabindex="-1"
>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <form
    class="ds-modal ds-modal--lg"
    onclick={(e) => {
      e.stopPropagation();
    }}
    onkeydown={(e) => {
      e.stopPropagation();
    }}
    {onsubmit}
  >
    <div class="ds-modal__header">
      <h3 class="ds-modal__title">
        {mode === 'edit' ?
          MESSAGES.MODAL_TITLE_EDIT
        : MESSAGES.MODAL_TITLE_CREATE}
      </h3>
      <button
        type="button"
        class="ds-modal__close"
        onclick={onclose}
        aria-label="Schließen"
      >
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="ds-modal__body">
      <div class="form-field">
        <label
          for="entryTitle"
          class="form-field__label">Titel</label
        >
        <input
          type="text"
          class="form-field__control"
          id="entryTitle"
          required
          placeholder="Was ist das Thema?"
          value={title}
          oninput={(e) => {
            ontitlechange((e.target as HTMLInputElement).value);
          }}
        />
      </div>
      <div class="form-field">
        <label
          for="entryContent"
          class="form-field__label">Inhalt</label
        >
        <textarea
          class="form-field__control"
          id="entryContent"
          rows="6"
          required
          placeholder="Ihre Nachricht hier..."
          value={content}
          oninput={(e) => {
            oncontentchange((e.target as HTMLTextAreaElement).value);
          }}
        ></textarea>
      </div>

      <!-- Visibility -->
      <div class="form-field">
        <span class="form-field__label">Wer soll den Eintrag sehen?</span>
        <p class="form-field__hint">{MESSAGES.MULTI_SELECT_HINT}</p>
      </div>
      <div class="form-field">
        <label class="toggle-switch toggle-switch--danger">
          <input
            type="checkbox"
            class="toggle-switch__input"
            checked={companyWide}
            onchange={(e) => {
              oncompanywidechange((e.target as HTMLInputElement).checked);
            }}
          />
          <span class="toggle-switch__slider"></span>
          <span class="toggle-switch__label"
            ><i class="fas fa-building mr-2"></i>Ganze Firma</span
          >
        </label>
        <span class="form-field__message form-field__message--warning">
          <i class="fas fa-exclamation-triangle mr-1"
          ></i>{MESSAGES.COMPANY_WIDE_WARNING}
        </span>
      </div>

      <div
        class="form-field"
        class:opacity-50={companyWide}
      >
        <label
          for="entry-area-select"
          class="form-field__label"
        >
          <i class="fas fa-layer-group mr-1"></i>Bereiche (Areas)
        </label>
        <select
          id="entry-area-select"
          multiple
          class="form-field__control form-field__control--multiselect"
          value={areaIds}
          disabled={companyWide}
          onchange={(e) => {
            const select = e.target as HTMLSelectElement;
            handleAreaChange(
              Array.from(select.selectedOptions).map((o) => Number(o.value)),
            );
          }}
        >
          {#each areas as area (area.id)}
            <option value={area.id}>
              {area.name}{(
                area.departmentCount !== undefined && area.departmentCount > 0
              ) ?
                ` (${area.departmentCount} Abt.)`
              : ''}
            </option>
          {/each}
        </select>
        <span class="form-field__message text-(--color-text-secondary)">
          <i class="fas fa-info-circle mr-1"></i>
          Strg/Cmd + Klick für Mehrfachauswahl. Bereiche vererben Zugriff auf zugehörige
          Abteilungen.
        </span>
      </div>
      <div
        class="form-field"
        class:opacity-50={companyWide}
      >
        <label
          for="entry-department-select"
          class="form-field__label"
        >
          <i class="fas fa-sitemap mr-1"></i>Zusätzliche Abteilungen
        </label>
        <select
          id="entry-department-select"
          multiple
          class="form-field__control form-field__control--multiselect"
          value={departmentIds}
          disabled={companyWide}
          onchange={(e) => {
            const select = e.target as HTMLSelectElement;
            handleDepartmentChange(
              Array.from(select.selectedOptions).map((o) => Number(o.value)),
            );
          }}
        >
          {#each availableDepartments as dept (dept.id)}
            <option value={dept.id}>
              {dept.name}{dept.areaName !== undefined && dept.areaName !== '' ?
                ` (${dept.areaName})`
              : ''}
            </option>
          {/each}
        </select>
        <span class="form-field__message text-(--color-text-secondary)">
          <i class="fas fa-info-circle mr-1"></i>
          Strg/Cmd + Klick für Mehrfachauswahl. Nur Abteilungen die nicht bereits
          durch Bereiche abgedeckt sind.
        </span>
      </div>
      <div
        class="form-field"
        class:opacity-50={companyWide}
      >
        <label
          for="entry-team-select"
          class="form-field__label"
        >
          <i class="fas fa-users mr-1"></i>Teams
        </label>
        <select
          id="entry-team-select"
          multiple
          class="form-field__control form-field__control--multiselect"
          value={teamIds}
          disabled={companyWide}
          onchange={(e) => {
            const select = e.target as HTMLSelectElement;
            onteamschange(
              Array.from(select.selectedOptions).map((o) => Number(o.value)),
            );
          }}
        >
          {#each availableTeams as team (team.id)}
            <option value={team.id}>{team.name}</option>
          {/each}
        </select>
        <span class="form-field__message text-(--color-text-secondary)">
          <i class="fas fa-info-circle mr-1"></i>
          Teams werden automatisch vererbt: Bereich-/Abteilungs-Auswahl blendet zugehörige
          Teams aus.
        </span>
      </div>

      <!-- Priority -->
      <div class="form-field">
        <span class="form-field__label">Priorität</span>
        <div
          class="dropdown"
          id="entry-priority-dropdown"
          role="listbox"
        >
          <div
            class="dropdown__trigger"
            onclick={() => (priorityDropdownOpen = !priorityDropdownOpen)}
            role="button"
            tabindex="0"
            onkeydown={(e) => {
              if (e.key === 'Enter')
                priorityDropdownOpen = !priorityDropdownOpen;
            }}
          >
            <span>{priorityLabel}</span>
            <i class="fas fa-chevron-down"></i>
          </div>
          {#if priorityDropdownOpen}
            <div class="dropdown__menu active">
              {#each PRIORITY_OPTIONS as opt (opt.value)}
                <div
                  class="dropdown__option"
                  onclick={() => {
                    setPriority(opt.value);
                  }}
                  onkeydown={(e) => {
                    if (e.key === 'Enter') setPriority(opt.value);
                  }}
                  role="option"
                  tabindex="0"
                  aria-selected={priority === opt.value}
                >
                  {opt.label}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <!-- Expires -->
      <div class="form-field">
        <label
          for="entryExpiresAt"
          class="form-field__label">Gültig bis (optional)</label
        >
        <AppDatePicker
          value={expiresAt}
          onchange={(v: string) => {
            onexpireschange(v);
          }}
        />
      </div>

      <!-- Color Picker -->
      <div class="form-field">
        <span class="form-field__label"
          ><i class="fas fa-palette mr-2"></i>Farbe</span
        >
        <div
          class="color-picker"
          role="radiogroup"
        >
          {#each COLOR_OPTIONS as opt (opt.value)}
            <button
              type="button"
              class="color-option"
              class:active={color === opt.value}
              data-color={opt.value}
              onclick={() => {
                oncolorchange(opt.value);
              }}
              role="radio"
              aria-checked={color === opt.value}
            >
              <span class="color-option__swatch"></span>
              <span class="color-option__label">{opt.label}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- File Upload -->
      <div class="form-field">
        <span class="form-field__label">Anhänge (optional)</span>
        <div class="file-upload-zone file-upload-zone--compact">
          <input
            type="file"
            class="file-upload-zone__input"
            id="attachmentInput"
            multiple
            accept={FILE_UPLOAD_CONFIG.ACCEPTED_TYPES}
            onchange={(e) => {
              const files = (e.target as HTMLInputElement).files;
              onfileschange(files !== null ? Array.from(files) : null);
            }}
          />
          <label
            for="attachmentInput"
            class="file-upload-zone__label"
          >
            <div class="file-upload-zone__icon">
              <i class="fas fa-cloud-upload-alt"></i>
            </div>
            <div class="file-upload-zone__text">
              <p class="file-upload-zone__title">Dateien hierher ziehen</p>
            </div>
          </label>
        </div>
        {#if attachmentFiles && attachmentFiles.length > 0}
          <div class="file-upload-list file-upload-list--compact">
            {#each attachmentFiles as file, i (i)}
              <div class="file-upload-list__item">
                <i class="fas fa-file file-upload-list__icon"></i>
                <span class="file-upload-list__name">{file.name}</span>
                <span class="file-upload-list__size"
                  >{(file.size / 1024 / 1024).toFixed(2)} MB</span
                >
                <button
                  type="button"
                  class="file-upload-list__remove"
                  onclick={() => {
                    removeAttachment(i);
                  }}
                  aria-label="Datei entfernen"
                >
                  <i class="fas fa-times"></i>
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
    <div class="ds-modal__footer ds-modal__footer--right">
      <button
        type="button"
        class="btn btn-cancel"
        onclick={onclose}>Abbrechen</button
      >
      <button
        type="submit"
        class="btn btn-primary">Speichern</button
      >
    </div>
  </form>
</div>

<style>
  .form-field__hint {
    margin-bottom: 0.5rem;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
  }

  .form-field__message--warning {
    color: var(--color-danger);
  }

  .form-field__control--multiselect {
    min-height: 120px;
  }

  /* ─── Color Picker ──────── */

  .color-picker {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: var(--spacing-3);
  }

  .color-option {
    display: flex;
    position: relative;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: var(--spacing-2);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    border: 2px solid transparent;
    border-radius: var(--radius-lg);
    background: var(--color-surface-primary);
    padding: var(--spacing-3);
    min-height: 80px;
    color: var(--color-text-primary);
    font-weight: 500;
    font-size: 13px;
    user-select: none;
  }

  .color-option:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
    border-color: var(--color-border-hover);
  }

  .color-option:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .color-option.active {
    box-shadow:
      var(--shadow-md),
      0 0 0 4px rgb(var(--color-primary-rgb) / 10%);
    border-color: var(--color-primary);
  }

  .color-option.active::after {
    position: absolute;
    top: 6px;
    right: 6px;
    box-shadow: 0 2px 4px rgb(0 0 0 / 20%);
    border-radius: 50%;
    background: var(--color-primary);
    width: 18px;
    height: 18px;
    content: '';
  }

  .color-option.active::before {
    position: absolute;
    top: 7px;
    right: 10px;
    z-index: 1;
    content: '\2713';
    color: #fff;
    font-weight: 700;
    font-size: 12px;
  }

  .color-option__swatch {
    display: block;
    box-shadow: 0 2px 8px rgb(0 0 0 / 15%);
    border: 2px solid rgb(255 255 255 / 30%);
    border-radius: 50%;
    width: 32px;
    height: 32px;
  }

  .color-option__label {
    color: var(--color-text-primary);
    font-weight: 500;
    font-size: 13px;
  }

  /* Color Swatch Variants */

  .color-option[data-color='yellow'] .color-option__swatch {
    background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  }

  .color-option[data-color='pink'] .color-option__swatch {
    background: linear-gradient(135deg, #ec4899 0%, #db2777 100%);
  }

  .color-option[data-color='blue'] .color-option__swatch {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  }

  .color-option[data-color='green'] .color-option__swatch {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  }

  .color-option[data-color='orange'] .color-option__swatch {
    background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
  }
</style>
