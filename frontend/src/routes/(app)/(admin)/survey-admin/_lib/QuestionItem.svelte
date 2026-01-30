<script lang="ts">
  import { QUESTION_TYPE_OPTIONS } from './constants';
  import { getQuestionTypeLabel, questionTypeNeedsOptions } from './utils';

  import type { QuestionType } from './types';

  // =============================================================================
  // PROPS
  // =============================================================================

  interface Props {
    question: {
      id: string;
      text: string;
      type: QuestionType;
      isOptional: boolean;
      options: string[];
    };
    questionIndex: number;
    isMandatory: boolean;
    activeDropdown: string | null;
    ontoggleDropdown: (dropdownId: string) => void;
    onremove: () => void;
    ontypechange: (type: QuestionType) => void;
    onaddoption: () => void;
    onremoveoption: (optionIndex: number) => void;
    onupdateoption: (optionIndex: number, text: string) => void;
  }

  const {
    question,
    questionIndex,
    isMandatory,
    activeDropdown,
    ontoggleDropdown,
    onremove,
    ontypechange,
    onaddoption,
    onremoveoption,
    onupdateoption,
  }: Props = $props();

  // =============================================================================
  // DERIVED
  // =============================================================================

  const dropdownId = $derived(`${question.id}_type`);
  const isDropdownActive = $derived(activeDropdown === dropdownId);
  const needsOptions = $derived(questionTypeNeedsOptions(question.type));
</script>

<div
  class="question-item"
  id={question.id}
>
  <div class="question-header">
    <span class="question-number">{questionIndex + 1}</span>
    <button
      type="button"
      class="remove-question"
      aria-label="Frage entfernen"
      onclick={onremove}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
      >
        <path
          d="M1 1L13 13M13 1L1 13"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
    </button>
  </div>

  <div class="form-field">
    <input
      type="text"
      class="form-field__control"
      placeholder="Fragetext eingeben..."
      required
      bind:value={question.text}
    />
  </div>

  <div class="question-controls mb-4">
    <!-- Question Type Dropdown -->
    <div
      class="dropdown"
      data-dropdown={dropdownId}
    >
      <button
        type="button"
        class="dropdown__trigger"
        class:active={isDropdownActive}
        onclick={() => {
          ontoggleDropdown(dropdownId);
        }}
      >
        <span>{getQuestionTypeLabel(question.type)}</span>
        <i class="fas fa-chevron-down"></i>
      </button>
      <div
        class="dropdown__menu"
        class:active={isDropdownActive}
      >
        {#each QUESTION_TYPE_OPTIONS as option (option.value)}
          <button
            type="button"
            class="dropdown__option"
            onclick={() => {
              ontypechange(option.value as QuestionType);
            }}
          >
            {option.label}
          </button>
        {/each}
      </div>
    </div>

    <!-- Optional question checkbox (only visible when mandatory) -->
    {#if isMandatory}
      <div class="mt-2 flex items-center gap-3">
        <input
          type="checkbox"
          id="{question.id}_required"
          class="h-5 w-5 cursor-pointer"
          bind:checked={question.isOptional}
        />
        <label
          for="{question.id}_required"
          class="cursor-pointer">Optionale Frage</label
        >
      </div>
    {/if}
  </div>

  <!-- Options for choice questions -->
  {#if needsOptions}
    <div class="mt-4">
      <div class="options-header mb-2 flex items-center justify-between">
        <span class="form-field__label">Antwortoptionen</span>
        <button
          type="button"
          class="add-option-btn"
          onclick={onaddoption}
        >
          <i class="fas fa-plus"></i> Option hinzufuegen
        </button>
      </div>
      <div class="option-list">
        {#each question.options as optionText, optIndex (optIndex)}
          <div class="option-item">
            <input
              type="text"
              class="option-input"
              placeholder="Option eingeben..."
              value={optionText}
              oninput={(e) => {
                onupdateoption(optIndex, (e.target as HTMLInputElement).value);
              }}
            />
            <button
              type="button"
              class="remove-option"
              aria-label="Option entfernen"
              onclick={() => {
                onremoveoption(optIndex);
              }}
            >
              <i class="fas fa-times"></i>
            </button>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
