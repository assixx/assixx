<script lang="ts">
  import { filterAvailableDepartments, filterDepartmentIdsByAreas } from '$lib/utils';

  import { RECURRENCE_OPTIONS, RECURRENCE_END_OPTIONS } from './constants';

  import type { EventFormData, CalendarEvent, Department, Team, Area } from './types';

  interface Props {
    formData: EventFormData;
    editingEvent: CalendarEvent | null;
    isAdmin: boolean;
    departments: Department[];
    teams: Team[];
    areas: Area[];
    onclose: () => void;
    onsave: () => void;
  }

  /* eslint-disable */
  // prettier-ignore
  let { formData = $bindable(), editingEvent, isAdmin, departments, teams, areas, onclose, onsave }: Props = $props();
  /* eslint-enable */

  // Dropdown states
  let recurrenceDropdownOpen = $state(false);
  let recurrenceEndDropdownOpen = $state(false);

  // Get display text for current selection
  const selectedRecurrenceText = $derived(
    RECURRENCE_OPTIONS.find((o) => o.value === formData.recurrence)?.label ?? 'Keine Wiederholung',
  );
  const selectedRecurrenceEndText = $derived(
    RECURRENCE_END_OPTIONS.find((o) => o.value === formData.recurrenceEndType)?.label ?? 'Nie',
  );

  // Derived: Is company-wide event selected?
  const isCompanyWide = $derived(formData.orgLevel === 'company');

  // Filter departments based on selected areas (inheritance logic)
  const availableDepartments = $derived.by(() => {
    return filterAvailableDepartments(departments, formData.areaIds, isCompanyWide);
  });

  /**
   * Handle area selection change.
   * Also filters out departments that are now covered by selected areas.
   */
  function handleAreaChange(e: Event): void {
    const select = e.target as HTMLSelectElement;
    const newAreaIds = Array.from(select.selectedOptions).map((o) => Number(o.value));
    formData.areaIds = newAreaIds;
    // Remove departments that are now covered by selected areas
    formData.departmentIds = filterDepartmentIdsByAreas(
      formData.departmentIds,
      departments,
      newAreaIds,
    );
  }

  // Close all dropdowns
  function closeAllDropdowns() {
    recurrenceDropdownOpen = false;
    recurrenceEndDropdownOpen = false;
  }

  // Outside-click handler for dropdowns
  $effect(() => {
    const anyDropdownOpen = recurrenceDropdownOpen || recurrenceEndDropdownOpen;
    if (!anyDropdownOpen) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown')) {
        closeAllDropdowns();
      }
    }

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });
</script>

<div class="modal-overlay modal-overlay--active" role="presentation" onclick={onclose}>
  <form
    class="ds-modal ds-modal--lg"
    role="presentation"
    onclick={(e) => {
      e.stopPropagation();
    }}
    onsubmit={(e) => {
      e.preventDefault();
      onsave();
    }}
  >
    <div class="ds-modal__header">
      <h3 class="ds-modal__title">
        {editingEvent !== null ? 'Termin bearbeiten' : 'Neuer Termin'}
      </h3>
      <button type="button" class="ds-modal__close" aria-label="Schliessen" onclick={onclose}>
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="ds-modal__body">
      <!-- Title -->
      <div class="form-field">
        <label class="form-field__label" for="eventTitle">
          Titel <span class="text-red-500">*</span>
        </label>
        <input
          type="text"
          class="form-field__control"
          id="eventTitle"
          bind:value={formData.title}
          placeholder="Titel des Termins eingeben"
          required
        />
      </div>

      <!-- Description -->
      <div class="form-field">
        <label class="form-field__label" for="eventDescription">Beschreibung</label>
        <textarea
          class="form-field__control"
          id="eventDescription"
          bind:value={formData.description}
          rows="4"
          placeholder="Beschreibung des Termins (Markdown-Formatierung moeglich)"
        ></textarea>
        <span class="form-field__message text-[var(--color-text-secondary)]">
          <i class="fas fa-info-circle"></i> Markdown-Formatierung moeglich
        </span>
      </div>

      <!-- Date/Time -->
      <div class="grid grid-cols-2 gap-4">
        <div class="form-field">
          <label class="form-field__label" for="eventStart">
            Beginn <span class="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            class="form-field__control"
            id="eventStart"
            bind:value={formData.startTime}
            required
          />
        </div>
        <div class="form-field">
          <label class="form-field__label" for="eventEnd">
            Ende <span class="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            class="form-field__control"
            id="eventEnd"
            bind:value={formData.endTime}
            required
          />
        </div>
      </div>

      <!-- All Day -->
      <div class="form-field">
        <label class="toggle-switch toggle-switch--sm">
          <input type="checkbox" class="toggle-switch__input" bind:checked={formData.allDay} />
          <span class="toggle-switch__slider"></span>
          <span class="toggle-switch__label">Ganztaegiger Termin</span>
        </label>
      </div>

      <!-- Location -->
      <div class="form-field">
        <label class="form-field__label" for="eventLocation">Ort</label>
        <input
          type="text"
          class="form-field__control"
          id="eventLocation"
          bind:value={formData.location}
          placeholder="z.B. Konferenzraum 1, Online Meeting, etc."
        />
      </div>

      <!-- Org Level (Admin only) -->
      {#if isAdmin}
        <!-- Sichtbarkeit Header -->
        <div class="form-field">
          <span class="form-field__label">
            <i class="fas fa-users mr-2"></i>
            Sichtbarkeit
          </span>
          <p class="text-sm text-[var(--color-text-secondary)] mb-2">
            Waehlen Sie keine Organisation für firmenweite Events oder eine/mehrere spezifische
            Organisationen.
          </p>
        </div>

        <!-- Ganze Firma Toggle -->
        <div class="form-field">
          <label class="toggle-switch toggle-switch--danger">
            <input
              type="checkbox"
              class="toggle-switch__input"
              checked={formData.orgLevel === 'company'}
              onchange={(e) => {
                formData.orgLevel = (e.target as HTMLInputElement).checked ? 'company' : 'personal';
              }}
            />
            <span class="toggle-switch__slider"></span>
            <span class="toggle-switch__label">
              <i class="fas fa-building mr-2"></i>
              Ganze Firma (Alle Mitarbeiter)
            </span>
          </label>
          <span class="form-field__message text-[var(--color-danger)]">
            <i class="fas fa-exclamation-triangle mr-1"></i>
            Wenn aktiviert, sehen ALLE Mitarbeiter der Firma diesen Termin
          </span>
        </div>

        <!-- Area Selection -->
        <div class="form-field" class:opacity-50={isCompanyWide}>
          <label class="form-field__label" for="event-area-select">
            <i class="fas fa-layer-group mr-1"></i> Bereiche (Areas)
          </label>
          <select
            id="event-area-select"
            multiple
            class="form-field__control min-h-[100px]"
            value={formData.areaIds}
            disabled={isCompanyWide}
            onchange={handleAreaChange}
          >
            {#each areas as area (area.id)}
              <option value={area.id} selected={formData.areaIds.includes(area.id)}>
                {area.name}{area.departmentCount !== undefined && area.departmentCount > 0
                  ? ` (${area.departmentCount} Abt.)`
                  : ''}
              </option>
            {/each}
          </select>
          <span class="form-field__message text-[var(--color-text-secondary)]">
            <i class="fas fa-info-circle mr-1"></i>
            Strg/Cmd + Klick für Mehrfachauswahl. Bereiche vererben Zugriff auf zugehoerige Abteilungen.
          </span>
        </div>

        <!-- Department Selection -->
        <div class="form-field" class:opacity-50={isCompanyWide}>
          <label class="form-field__label" for="event-department-select">
            <i class="fas fa-sitemap mr-1"></i> Zusaetzliche Abteilungen
          </label>
          <select
            id="event-department-select"
            multiple
            class="form-field__control min-h-[100px]"
            bind:value={formData.departmentIds}
            disabled={isCompanyWide}
          >
            {#each availableDepartments as dept (dept.id)}
              <option value={dept.id}>
                {dept.name}{dept.areaName !== undefined && dept.areaName !== ''
                  ? ` (${dept.areaName})`
                  : ''}
              </option>
            {/each}
          </select>
          <span class="form-field__message text-[var(--color-text-secondary)]">
            <i class="fas fa-info-circle mr-1"></i>
            Strg/Cmd + Klick für Mehrfachauswahl. Nur Abteilungen die nicht bereits durch Bereiche abgedeckt
            sind.
          </span>
        </div>

        <!-- Team Selection -->
        <div class="form-field" class:opacity-50={isCompanyWide}>
          <label class="form-field__label" for="event-team-select">
            <i class="fas fa-users mr-1"></i> Teams
          </label>
          <select
            id="event-team-select"
            multiple
            class="form-field__control min-h-[100px]"
            bind:value={formData.teamIds}
            disabled={isCompanyWide}
          >
            {#each teams as team (team.id)}
              <option value={team.id}>{team.name}</option>
            {/each}
          </select>
          <span class="form-field__message text-[var(--color-text-secondary)]">
            <i class="fas fa-info-circle mr-1"></i>
            Teams werden automatisch vererbt: Bereich-/Abteilungs-Auswahl beinhaltet zugehoerige Teams.
          </span>
        </div>

        <!-- Attendees Section -->
        <div class="form-field">
          <span class="form-field__label">Teilnehmer</span>
          <div id="attendeesContainer">
            <p class="text-[var(--color-info)] flex items-center gap-2">
              <i class="fas fa-info-circle"></i>
              Alle Mitarbeiter der Firma werden automatisch eingeladen
            </p>
          </div>
        </div>
      {/if}

      <!-- Recurrence (Custom Dropdown like Legacy) -->
      <div class="form-field">
        <span class="form-field__label">Wiederkehrend</span>
        <div class="dropdown">
          <button
            type="button"
            class="dropdown__trigger"
            class:active={recurrenceDropdownOpen}
            onclick={() => {
              closeAllDropdowns();
              recurrenceDropdownOpen = !recurrenceDropdownOpen;
            }}
          >
            <span>{selectedRecurrenceText}</span>
            <i class="fas fa-chevron-down"></i>
          </button>
          <div class="dropdown__menu" class:active={recurrenceDropdownOpen}>
            {#each RECURRENCE_OPTIONS as option (option.label)}
              <button
                type="button"
                class="dropdown__option"
                class:dropdown__option--selected={formData.recurrence === option.value}
                onclick={() => {
                  formData.recurrence = option.value as typeof formData.recurrence;
                  recurrenceDropdownOpen = false;
                }}
              >
                {option.label}
              </button>
            {/each}
          </div>
        </div>
      </div>

      {#if formData.recurrence !== undefined}
        <!-- Recurrence End (Custom Dropdown) -->
        <div class="form-field">
          <span class="form-field__label">Wiederkehrung endet</span>
          <div class="dropdown">
            <button
              type="button"
              class="dropdown__trigger"
              class:active={recurrenceEndDropdownOpen}
              onclick={() => {
                closeAllDropdowns();
                recurrenceEndDropdownOpen = !recurrenceEndDropdownOpen;
              }}
            >
              <span>{selectedRecurrenceEndText}</span>
              <i class="fas fa-chevron-down"></i>
            </button>
            <div class="dropdown__menu" class:active={recurrenceEndDropdownOpen}>
              {#each RECURRENCE_END_OPTIONS as option (option.value)}
                <button
                  type="button"
                  class="dropdown__option"
                  class:dropdown__option--selected={formData.recurrenceEndType === option.value}
                  onclick={() => {
                    formData.recurrenceEndType = option.value as typeof formData.recurrenceEndType;
                    recurrenceEndDropdownOpen = false;
                  }}
                >
                  {option.label}
                </button>
              {/each}
            </div>
          </div>
        </div>

        {#if formData.recurrenceEndType === 'after'}
          <div class="form-field">
            <label class="form-field__label" for="recurrenceCount">Anzahl der Wiederholungen</label>
            <input
              type="number"
              class="form-field__control"
              id="recurrenceCount"
              bind:value={formData.recurrenceCount}
              min="1"
              placeholder="Anzahl der Wiederholungen"
            />
          </div>
        {/if}

        {#if formData.recurrenceEndType === 'until'}
          <div class="form-field">
            <label class="form-field__label" for="recurrenceUntil">Enddatum</label>
            <input
              type="date"
              class="form-field__control"
              id="recurrenceUntil"
              bind:value={formData.recurrenceUntil}
            />
          </div>
        {/if}
      {/if}
    </div>
    <div class="ds-modal__footer">
      <button type="button" class="btn btn-cancel" onclick={onclose}> Abbrechen </button>
      <button type="submit" class="btn btn-modal">
        <i class="fas fa-save"></i> Speichern
      </button>
    </div>
  </form>
</div>
