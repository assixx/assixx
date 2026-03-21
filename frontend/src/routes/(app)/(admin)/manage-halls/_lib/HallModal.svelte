<script lang="ts">
  import { getStatusBadgeClass, getStatusLabel } from './utils';

  import type { HallMessages } from './constants';
  import type { FormIsActiveStatus } from './types';

  interface Props {
    show: boolean;
    isEditMode: boolean;
    modalTitle: string;
    formName: string;
    formDescription: string;
    formIsActive: FormIsActiveStatus;
    submitting: boolean;
    messages: HallMessages;
    onclose: () => void;
    onsubmit: (e: Event) => void;
  }

  /* eslint-disable prefer-const, @typescript-eslint/no-useless-default-assignment -- Svelte $bindable() requires let and is not a useless default */
  // prettier-ignore
  let { show, isEditMode, modalTitle, formName = $bindable(), formDescription = $bindable(), formIsActive = $bindable(), submitting, messages, onclose, onsubmit }: Props = $props();
  /* eslint-enable prefer-const, @typescript-eslint/no-useless-default-assignment */

  let statusDropdownOpen = $state(false);

  function toggleStatusDropdown(e: MouseEvent): void {
    e.stopPropagation();
    statusDropdownOpen = !statusDropdownOpen;
  }

  function selectStatus(status: FormIsActiveStatus): void {
    formIsActive = status;
    statusDropdownOpen = false;
  }

  function isClickOutsideElement(target: HTMLElement, elementId: string): boolean {
    const el = document.getElementById(elementId);
    return el?.contains(target) !== true;
  }

  $effect(() => {
    if (show) {
      statusDropdownOpen = false;
    }
  });

  $effect(() => {
    if (!statusDropdownOpen) return;

    const handleClick = (e: MouseEvent): void => {
      const target = e.target as HTMLElement;
      if (isClickOutsideElement(target, 'hall-status-dropdown')) {
        statusDropdownOpen = false;
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  });
</script>

{#if show}
  <div
    id="hall-modal"
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="hall-modal-title"
    tabindex="-1"
  >
    <form
      id="hall-form"
      class="ds-modal"
      {onsubmit}
    >
      <div class="ds-modal__header">
        <h3
          class="ds-modal__title"
          id="hall-modal-title"
        >
          {modalTitle}
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schließen"
          onclick={onclose}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="ds-modal__body">
        <div class="form-field">
          <label
            class="form-field__label"
            for="hall-name"
          >
            {messages.LABEL_NAME} <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="hall-name"
            name="name"
            class="form-field__control"
            required
            bind:value={formName}
          />
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="hall-description">{messages.LABEL_DESCRIPTION}</label
          >
          <textarea
            id="hall-description"
            name="description"
            class="form-field__control"
            rows="3"
            bind:value={formDescription}
          ></textarea>
        </div>

        {#if isEditMode}
          <div
            class="form-field"
            id="hall-status-field-group"
          >
            <label
              class="form-field__label"
              for="hall-status-hidden"
            >
              {messages.LABEL_STATUS} <span class="text-red-500">*</span>
            </label>
            <input
              type="hidden"
              id="hall-status-hidden"
              value={formIsActive}
            />
            <div
              class="dropdown"
              id="hall-status-dropdown"
            >
              <button
                type="button"
                class="dropdown__trigger"
                class:active={statusDropdownOpen}
                onclick={toggleStatusDropdown}
              >
                <span class="badge {getStatusBadgeClass(formIsActive)}"
                  >{getStatusLabel(formIsActive)}</span
                >
                <i class="fas fa-chevron-down"></i>
              </button>
              <div
                class="dropdown__menu"
                class:active={statusDropdownOpen}
              >
                <button
                  type="button"
                  class="dropdown__option"
                  onclick={() => {
                    selectStatus(1);
                  }}
                >
                  <span class="badge badge--success">Aktiv</span>
                </button>
                <button
                  type="button"
                  class="dropdown__option"
                  onclick={() => {
                    selectStatus(0);
                  }}
                >
                  <span class="badge badge--warning">Inaktiv</span>
                </button>
                <button
                  type="button"
                  class="dropdown__option"
                  onclick={() => {
                    selectStatus(3);
                  }}
                >
                  <span class="badge badge--secondary">Archiviert</span>
                </button>
              </div>
            </div>
            <span class="form-field__message mt-1 block text-(--color-text-secondary)">
              {messages.STATUS_HINT}
            </span>
          </div>
        {/if}
      </div>

      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={onclose}>{messages.BTN_CANCEL}</button
        >
        <button
          type="submit"
          class="btn btn-primary"
          disabled={submitting}
        >
          {#if submitting}<span class="spinner-ring spinner-ring--sm mr-2"></span>{/if}
          {messages.BTN_SAVE}
        </button>
      </div>
    </form>
  </div>
{/if}
