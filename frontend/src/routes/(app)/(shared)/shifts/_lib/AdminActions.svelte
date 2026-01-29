<!--
  AdminActions.svelte
  Admin action buttons for saving, editing, and discarding shift plans
  Extracted from +page.svelte for maintainability
-->
<script lang="ts">
  /**
   * Props interface for AdminActions
   */
  interface Props {
    currentPatternId: number | null; // Current rotation pattern
    isPlanLocked: boolean; // True if plan is saved/locked (shows "Edit" button)
    isEditMode: boolean;

    // Event handlers
    onreset: () => void;
    onsave: () => void;
    ondiscardWeek: () => void;
    ondiscardTeamPlan: () => void; // Deletes ONLY current pattern
    ondiscardYearPlan: () => void; // Deletes ALL patterns for team (this year)
    onenterEditMode: () => void;
  }

  const {
    currentPatternId,
    isPlanLocked,
    isEditMode,
    onreset,
    onsave,
    ondiscardWeek,
    ondiscardTeamPlan,
    ondiscardYearPlan,
    onenterEditMode,
  }: Props = $props();

  const hasPattern = $derived(currentPatternId !== null);
  const currentYear = new Date().getFullYear();

  // Decision logic:
  // 1. isPlanLocked=false + isEditMode=false → New plan being created → Show "Save"
  // 2. isPlanLocked=true + isEditMode=true → Editing existing plan → Show all buttons
  // 3. isPlanLocked=true + isEditMode=false → Saved plan, locked → Show "Edit" button
</script>

<div class="admin-actions flex flex-wrap gap-4">
  {#if !isPlanLocked && !isEditMode}
    <!-- NEW/UNLOCKED: Creating new plan - show Save button -->
    <button
      type="button"
      class="btn btn-cancel"
      style="display: none;"
      onclick={onreset}
    >
      <i class="fas fa-times mr-2"></i>
      Abbrechen
    </button>
    <button
      type="button"
      class="btn btn-manage"
      onclick={onsave}
    >
      <i class="fas fa-save mr-2"></i>
      Schichtplan speichern
    </button>
    <button
      type="button"
      class="btn btn-danger hidden"
      onclick={ondiscardWeek}
      title="Alle Schichten dieser Woche löschen"
    >
      <i class="fas fa-calendar-times mr-2"></i>
      Woche verwerfen
    </button>
  {:else if isEditMode}
    <!-- EDIT MODE: Editing existing plan - show all buttons -->
    <button
      type="button"
      class="btn btn-cancel"
      onclick={onreset}
    >
      <i class="fas fa-times mr-2"></i>
      Abbrechen
    </button>
    <button
      type="button"
      class="btn btn-success"
      onclick={onsave}
    >
      <i class="fas fa-save mr-2"></i>
      Schichtplan aktualisieren
    </button>
    <button
      type="button"
      class="btn btn-danger"
      onclick={ondiscardWeek}
      title="Alle Schichten dieser Woche löschen"
    >
      <i class="fas fa-calendar-times mr-2"></i>
      Woche verwerfen
    </button>
    {#if hasPattern}
      <button
        type="button"
        class="btn btn-danger"
        onclick={ondiscardTeamPlan}
        title="Aktuellen Rotationsplan löschen (andere Pläne bleiben erhalten)"
      >
        <i class="fas fa-trash-alt mr-2"></i>
        Aktuellen Plan verwerfen
      </button>
    {/if}
    <button
      type="button"
      class="btn btn-danger"
      style="background-color: #8b0000;"
      onclick={ondiscardYearPlan}
      title="ALLE Rotationspläne für dieses Team löschen ({currentYear})"
    >
      <i class="fas fa-skull-crossbones mr-2"></i>
      Kompletten Plan verwerfen ({currentYear})
    </button>
  {:else}
    <!-- LOCKED: Saved plan - show Edit button only -->
    <button
      type="button"
      class="btn btn-edit"
      onclick={onenterEditMode}
    >
      <i class="fas fa-edit mr-2"></i>
      Bearbeiten
    </button>
  {/if}
</div>
