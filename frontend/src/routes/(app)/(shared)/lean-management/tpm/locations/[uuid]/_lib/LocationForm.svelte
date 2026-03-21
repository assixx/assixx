<script lang="ts">
  /**
   * LocationForm — Create or edit a TPM location
   *
   * Uses design system form-field components.
   * Photo upload is done separately after creation.
   */
  import { MESSAGES } from '../../../_lib/constants';

  import type { TpmLocation } from '../../../_lib/types';

  interface Props {
    location?: TpmLocation;
    nextPosition?: number;
    saving?: boolean;
    onSave: (data: { positionNumber: number; title: string; description: string | null }) => void;
    onCancel: () => void;
  }

  const { location, nextPosition = 1, saving = false, onSave, onCancel }: Props = $props();

  const isEdit = $derived(location !== undefined);

  let positionNumber = $state(0);
  let title = $state('');
  let description = $state('');

  /** Sync form fields when props change (create ↔ edit switch) */
  $effect(() => {
    positionNumber = location?.positionNumber ?? nextPosition;
    title = location?.title ?? '';
    description = location?.description ?? '';
  });

  function handleSubmit(event: SubmitEvent): void {
    event.preventDefault();
    onSave({
      positionNumber,
      title: title.trim(),
      description: description.trim() !== '' ? description.trim() : null,
    });
  }
</script>

<form onsubmit={handleSubmit}>
  <div class="loc-form__row">
    <!-- Position Number -->
    <div class="form-field loc-form__position">
      <label
        class="form-field__label form-field__label--required"
        for="loc-position"
      >
        {MESSAGES.LOCATIONS_POSITION}
      </label>
      <input
        id="loc-position"
        type="number"
        class="form-field__control"
        bind:value={positionNumber}
        min={1}
        max={200}
        required
        disabled={saving}
      />
    </div>

    <!-- Title -->
    <div class="form-field loc-form__title">
      <label
        class="form-field__label form-field__label--required"
        for="loc-title"
      >
        {MESSAGES.LOCATIONS_TITLE}
      </label>
      <input
        id="loc-title"
        type="text"
        class="form-field__control"
        bind:value={title}
        maxlength={255}
        required
        disabled={saving}
        placeholder="z.B. Antriebsseite links"
      />
    </div>
  </div>

  <!-- Description -->
  <div class="form-field">
    <label
      class="form-field__label"
      for="loc-description"
    >
      {MESSAGES.LOCATIONS_DESC_LABEL}
    </label>
    <textarea
      id="loc-description"
      class="form-field__control form-field__control--textarea"
      bind:value={description}
      maxlength={5000}
      rows={3}
      disabled={saving}
      placeholder={MESSAGES.LOCATIONS_DESC_PH}
    ></textarea>
  </div>

  <!-- Actions -->
  <div class="loc-form__actions">
    <button
      type="button"
      class="btn btn-cancel"
      onclick={onCancel}
      disabled={saving}
    >
      {MESSAGES.LOCATIONS_CANCEL}
    </button>
    <button
      type="submit"
      class="btn btn-primary"
      disabled={saving || title.trim() === ''}
    >
      {#if saving}
        <i class="fas fa-spinner fa-spin mr-1"></i>
        {MESSAGES.LOCATIONS_SAVING}
      {:else}
        <i class="fas fa-save mr-1"></i>
        {isEdit ? MESSAGES.LOCATIONS_SAVE : MESSAGES.LOCATIONS_ADD}
      {/if}
    </button>
  </div>
</form>

<style>
  .loc-form__row {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
  }

  .loc-form__position {
    width: 110px;
    flex-shrink: 0;
  }

  .loc-form__title {
    flex: 1;
  }

  .loc-form__actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    margin-top: 0.25rem;
  }

  @media (width <= 480px) {
    .loc-form__row {
      flex-direction: column;
    }

    .loc-form__position {
      width: 100%;
    }
  }
</style>
