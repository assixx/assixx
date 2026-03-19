<script lang="ts">
  /**
   * LogsDeleteModal - Confirmation modal for deleting filtered logs
   * Handles confirm text + password validation internally.
   * Parent controls mounting via {#if showDeleteModal}.
   */
  import { MESSAGES } from './constants';

  interface Props {
    /** Whether any filter is currently active */
    hasActiveFilters: boolean;
    /** Raw filter values for badge display */
    filterUser: string;
    filterAction: string;
    filterEntity: string;
    filterTimerange: string;
    /** Pre-computed display texts for active filter badges */
    actionDisplayText: string;
    entityDisplayText: string;
    timerangeDisplayText: string;
    /** Called when modal is closed */
    onclose: () => void;
    /** Called with password when user confirms deletion */
    ondelete: (password: string) => void;
  }

  const {
    hasActiveFilters,
    filterUser,
    filterAction,
    filterEntity,
    filterTimerange,
    actionDisplayText,
    entityDisplayText,
    timerangeDisplayText,
    onclose,
    ondelete,
  }: Props = $props();

  let confirmText = $state('');
  let password = $state('');

  const canConfirm = $derived(confirmText === 'LÖSCHEN' && password !== '');
</script>

<div
  id="logs-delete-modal"
  class="modal-overlay modal-overlay--active"
  role="dialog"
  aria-modal="true"
  aria-labelledby="delete-modal-title"
  tabindex="-1"
>
  <div
    class="ds-modal ds-modal--md"
    role="document"
  >
    <!-- Header -->
    <div class="ds-modal__header ds-modal__header--danger">
      <h3
        class="ds-modal__title flex items-center gap-3"
        id="delete-modal-title"
      >
        <i class="fas fa-exclamation-triangle text-(--color-danger)"></i>
        {MESSAGES.DELETE_MODAL_TITLE}
      </h3>
    </div>

    <div class="ds-modal__body">
      <!-- Warning Alert -->
      <div class="alert alert--danger mb-6">
        <p class="font-bold">
          <i class="fas fa-skull-crossbones mr-2"></i>
          {MESSAGES.DELETE_WARNING}
        </p>
      </div>

      <!-- Active Filters Display -->
      <div class="mb-6">
        <p class="mb-2 text-(--color-text-secondary)">
          Folgende Filter werden gelöscht:
        </p>
        <div
          class="rounded-lg border border-(--color-glass-border) bg-(--glass-bg) p-4"
        >
          {#if hasActiveFilters}
            {#if filterUser !== ''}
              <span class="badge badge--info mr-2 mb-2"
                >Benutzer: {filterUser}</span
              >
            {/if}
            {#if filterAction !== '' && filterAction !== 'all'}
              <span class="badge badge--info mr-2 mb-2"
                >Aktion: {actionDisplayText}</span
              >
            {/if}
            {#if filterEntity !== '' && filterEntity !== 'all'}
              <span class="badge badge--info mr-2 mb-2"
                >Entitätstyp: {entityDisplayText}</span
              >
            {/if}
            {#if filterTimerange !== '' && filterTimerange !== 'all'}
              <span class="badge badge--info mr-2 mb-2"
                >Zeitraum: {timerangeDisplayText}</span
              >
            {/if}
          {:else}
            <span class="text-(--color-text-secondary)"
              >{MESSAGES.NO_FILTERS_WARNING}</span
            >
          {/if}
        </div>
      </div>

      <!-- Confirmation Input -->
      <div class="form-field mb-4">
        <label
          class="form-field__label"
          for="deleteLogsConfirmation"
        >
          {MESSAGES.DELETE_CONFIRM_LABEL.split('LÖSCHEN')[0]}
          <strong class="text-(--color-danger)">LÖSCHEN</strong>
          {MESSAGES.DELETE_CONFIRM_LABEL.split('LÖSCHEN')[1]}
        </label>
        <input
          type="text"
          id="deleteLogsConfirmation"
          class="form-field__control"
          placeholder="LÖSCHEN"
          autocomplete="off"
          bind:value={confirmText}
        />
      </div>

      <!-- Password Section -->
      <div class="form-field">
        <label
          class="form-field__label flex items-center gap-2"
          for="deleteLogsPassword"
        >
          <i class="fas fa-lock text-(--color-danger)"></i>
          {MESSAGES.DELETE_PASSWORD_LABEL}
        </label>
        <input
          type="password"
          id="deleteLogsPassword"
          class="form-field__control"
          placeholder="Ihr Root-Passwort"
          bind:value={password}
        />
        <span class="form-field__message">{MESSAGES.DELETE_PASSWORD_HINT}</span>
      </div>
    </div>

    <!-- Footer -->
    <div class="ds-modal__footer">
      <button
        type="button"
        class="btn btn-cancel"
        onclick={onclose}>Abbrechen</button
      >
      <button
        type="button"
        class="btn btn-danger"
        onclick={() => {
          ondelete(password);
        }}
        disabled={!canConfirm}
      >
        <i class="fas fa-trash mr-2"></i>
        Endgültig löschen
      </button>
    </div>
  </div>
</div>
