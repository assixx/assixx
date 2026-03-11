<script lang="ts">
  import { tick } from 'svelte';

  import {
    getStatusBadgeClass,
    getStatusLabel,
    getSelectedAreaName,
  } from './utils';

  import type { HallMessages } from './constants';
  import type { FormIsActiveStatus, Area } from './types';

  interface Props {
    show: boolean;
    isEditMode: boolean;
    modalTitle: string;
    formName: string;
    formDescription: string;
    formAreaId: number | null;
    formIsActive: FormIsActiveStatus;
    allAreas: Area[];
    submitting: boolean;
    messages: HallMessages;
    onclose: () => void;
    onsubmit: (e: Event) => void;
  }

  /* eslint-disable prefer-const, @typescript-eslint/no-useless-default-assignment -- Svelte $bindable() requires let and is not a useless default */
  // prettier-ignore
  let { show, isEditMode, modalTitle, formName = $bindable(), formDescription = $bindable(), formAreaId = $bindable(), formIsActive = $bindable(), allAreas, submitting, messages, onclose, onsubmit }: Props = $props();
  /* eslint-enable prefer-const, @typescript-eslint/no-useless-default-assignment */

  let areaDropdownOpen = $state(false);
  let statusDropdownOpen = $state(false);

  const selectedAreaName = $derived(getSelectedAreaName(formAreaId, allAreas));

  async function scrollDropdownIntoView(dropdownId: string): Promise<void> {
    await tick();
    const menu = document.querySelector<HTMLElement>(
      `#${dropdownId} .dropdown__menu`,
    );
    const modalBody = menu?.closest<HTMLElement>('.ds-modal__body');
    if (!menu || !modalBody) return;

    const menuRect = menu.getBoundingClientRect();
    const bodyRect = modalBody.getBoundingClientRect();
    const overflow = menuRect.bottom - bodyRect.bottom;

    if (overflow <= 0) return;

    const extraSpace = overflow + 16;

    // Lock modal height so vertical centering doesn't shift
    const modal = modalBody.closest<HTMLElement>('.ds-modal');
    if (modal) modal.style.height = `${modal.offsetHeight}px`;

    // Extend scroll area by exact overflow
    const currentPadding =
      parseFloat(getComputedStyle(modalBody).paddingBottom) || 0;
    modalBody.style.paddingBottom = `${currentPadding + extraSpace}px`;

    requestAnimationFrame(() => {
      modalBody.scrollBy({ top: extraSpace, behavior: 'smooth' });
    });
  }

  function resetModalScroll(): void {
    const modal = document.querySelector<HTMLElement>('#hall-form');
    const body = modal?.querySelector<HTMLElement>('.ds-modal__body');
    if (body) body.style.paddingBottom = '';
    if (modal) modal.style.height = '';
  }

  function toggleAreaDropdown(e: MouseEvent): void {
    e.stopPropagation();
    statusDropdownOpen = false;
    areaDropdownOpen = !areaDropdownOpen;
    if (areaDropdownOpen) void scrollDropdownIntoView('hall-area-dropdown');
  }

  function selectArea(areaId: number | null): void {
    formAreaId = areaId;
    areaDropdownOpen = false;
  }

  function toggleStatusDropdown(e: MouseEvent): void {
    e.stopPropagation();
    areaDropdownOpen = false;
    statusDropdownOpen = !statusDropdownOpen;
    if (statusDropdownOpen) void scrollDropdownIntoView('hall-status-dropdown');
  }

  function selectStatus(status: FormIsActiveStatus): void {
    formIsActive = status;
    statusDropdownOpen = false;
  }

  function handleOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onclose();
  }

  function isClickOutsideElement(
    target: HTMLElement,
    elementId: string,
  ): boolean {
    const el = document.getElementById(elementId);
    return el?.contains(target) !== true;
  }

  $effect(() => {
    if (show) {
      areaDropdownOpen = false;
      statusDropdownOpen = false;
    } else {
      resetModalScroll();
    }
  });

  $effect(() => {
    if (!areaDropdownOpen && !statusDropdownOpen) {
      resetModalScroll();
    }
  });

  $effect(() => {
    const anyDropdownOpen = areaDropdownOpen || statusDropdownOpen;
    if (!anyDropdownOpen) return;

    const handleClick = (e: MouseEvent): void => {
      const target = e.target as HTMLElement;
      if (
        areaDropdownOpen &&
        isClickOutsideElement(target, 'hall-area-dropdown')
      ) {
        areaDropdownOpen = false;
      }
      if (
        statusDropdownOpen &&
        isClickOutsideElement(target, 'hall-status-dropdown')
      ) {
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
    onclick={handleOverlayClick}
    onkeydown={(e) => {
      if (e.key === 'Escape') onclose();
    }}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
    <form
      id="hall-form"
      class="ds-modal"
      onclick={(e) => {
        e.stopPropagation();
      }}
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

        <div class="form-field">
          <label
            class="form-field__label"
            for="hall-area-hidden">{messages.LABEL_AREA}</label
          >
          <input
            type="hidden"
            id="hall-area-hidden"
            value={formAreaId ?? ''}
          />
          <div
            class="dropdown"
            id="hall-area-dropdown"
          >
            <button
              type="button"
              class="dropdown__trigger"
              class:active={areaDropdownOpen}
              onclick={toggleAreaDropdown}
            >
              <span>{selectedAreaName}</span>
              <i class="fas fa-chevron-down"></i>
            </button>
            <div
              class="dropdown__menu"
              class:active={areaDropdownOpen}
            >
              <button
                type="button"
                class="dropdown__option"
                onclick={() => {
                  selectArea(null);
                }}
              >
                {messages.NO_AREA}
              </button>
              {#each allAreas as area (area.id)}
                <button
                  type="button"
                  class="dropdown__option"
                  onclick={() => {
                    selectArea(area.id);
                  }}
                >
                  {area.name}
                </button>
              {/each}
            </div>
          </div>
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
            <span
              class="form-field__message mt-1 block text-(--color-text-secondary)"
            >
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
          {#if submitting}<span class="spinner-ring spinner-ring--sm mr-2"
            ></span>{/if}
          {messages.BTN_SAVE}
        </button>
      </div>
    </form>
  </div>
{/if}
