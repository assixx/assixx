<script lang="ts">
  /**
   * FilterDropdown - Reusable dropdown filter component
   * Manages its own open/close state with click-outside detection.
   * Replaces repeated dropdown markup throughout the logs page.
   */
  import type { DropdownOption } from './types';

  interface Props {
    /** Visible label text */
    label: string;
    /** ID for accessibility (aria-labelledby) */
    labelId: string;
    /** Available options */
    options: readonly DropdownOption[];
    /** Currently selected value */
    selectedValue: string;
    /** Text shown on the trigger button */
    displayText: string;
    /** Enable scrollable menu for long option lists */
    scrollable?: boolean;
    /** Called when user selects an option */
    onselect: (value: string) => void;
  }

  const {
    label,
    labelId,
    options,
    selectedValue,
    displayText,
    scrollable = false,
    onselect,
  }: Props = $props();

  let open = $state(false);
  let containerRef: HTMLDivElement | undefined;

  function handleSelect(value: string): void {
    onselect(value);
    open = false;
  }

  // Close dropdown when clicking outside
  $effect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (
        containerRef !== undefined &&
        !containerRef.contains(event.target as Node)
      ) {
        open = false;
      }
    }

    document.addEventListener('click', handleClickOutside, true);
    return () => {
      document.removeEventListener('click', handleClickOutside, true);
    };
  });
</script>

<div class="form-field">
  <span
    class="form-field__label"
    id={labelId}>{label}</span
  >
  <div
    class="dropdown"
    bind:this={containerRef}
  >
    <button
      type="button"
      class="dropdown__trigger"
      class:active={open}
      aria-labelledby={labelId}
      aria-expanded={open}
      onclick={() => (open = !open)}
    >
      <span>{displayText}</span>
      <svg
        width="12"
        height="8"
        viewBox="0 0 12 8"
        fill="none"
      >
        <path
          d="M1 1L6 6L11 1"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
    </button>
    <div
      class="dropdown__menu"
      class:dropdown__menu--scrollable={scrollable}
      class:active={open}
    >
      {#each options as option (option.value)}
        <button
          type="button"
          class="dropdown__option"
          class:selected={selectedValue === option.value}
          onclick={() => {
            handleSelect(option.value);
          }}
        >
          {option.text}
        </button>
      {/each}
    </div>
  </div>
</div>
