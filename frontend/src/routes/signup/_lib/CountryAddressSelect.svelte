<script lang="ts">
  import { ADDRESS_COUNTRIES, DEFAULT_ADDRESS_COUNTRY } from './constants';

  import type { AddressCountry } from './types';

  interface Props {
    countryCode: string;
    disabled?: boolean;
  }

  /* eslint-disable prefer-const, @typescript-eslint/no-useless-default-assignment -- $bindable() is a Svelte semantic marker, not a JS default */
  let { countryCode = $bindable(), disabled = false }: Props = $props();
  /* eslint-enable prefer-const, @typescript-eslint/no-useless-default-assignment */

  let dropdownOpen = $state(false);

  const selectedCountry = $derived(
    ADDRESS_COUNTRIES.find((c: AddressCountry) => c.iso === countryCode) ??
      DEFAULT_ADDRESS_COUNTRY,
  );

  function selectCountry(country: AddressCountry): void {
    countryCode = country.iso;
    dropdownOpen = false;
  }

  function toggleDropdown(): void {
    if (!disabled) dropdownOpen = !dropdownOpen;
  }

  $effect(() => {
    function handler(event: MouseEvent): void {
      if (!(event.target instanceof HTMLElement)) return;
      if (!event.target.closest('.country-address-select')) {
        dropdownOpen = false;
      }
    }
    document.addEventListener('click', handler, true);
    return () => {
      document.removeEventListener('click', handler, true);
    };
  });
</script>

<div class="form-field">
  <label
    class="form-field__label form-field__label--required"
    for="address_country">Land</label
  >
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="country-address-select">
    <div
      class="country-display"
      class:active={dropdownOpen}
      class:disabled
      onclick={toggleDropdown}
    >
      <span class="flag-text">{selectedCountry.flag}</span>
      <span class="country-name">{selectedCountry.name}</span>
      <svg
        width="10"
        height="6"
        viewBox="0 0 10 6"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M1 1L5 5L9 1"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
    </div>
    <div
      class="country-dropdown"
      class:active={dropdownOpen}
    >
      {#each ADDRESS_COUNTRIES as country (country.iso)}
        <div
          class="country-option"
          class:selected={country.iso === countryCode}
          onclick={() => {
            selectCountry(country);
          }}
        >
          <span class="flag-text">{country.flag}</span>
          <span>{country.name}</span>
          <span class="country-iso">{country.iso}</span>
        </div>
      {/each}
    </div>
  </div>
  <!-- Hidden input for form semantics -->
  <input
    type="hidden"
    id="address_country"
    name="address_country"
    value={countryCode}
  />
</div>

<style>
  .flag-text,
  .country-option {
    font-family:
      Outfit,
      'Noto Color Emoji',
      'Apple Color Emoji',
      'Segoe UI Emoji',
      'Segoe UI Symbol',
      -apple-system,
      BlinkMacSystemFont,
      'Segoe UI',
      Roboto,
      Arial,
      sans-serif;
  }

  .country-address-select {
    position: relative;
  }

  .country-display {
    display: flex;
    align-items: center;
    gap: 8px;
    backdrop-filter: var(--glass-form-backdrop);
    transition:
      var(--form-field-transition), var(--form-field-transition-shadow);
    cursor: pointer;
    border: var(--form-field-border);
    border-radius: var(--form-field-radius);
    background: var(--form-field-bg);
    padding: var(--form-field-padding-y) var(--form-field-padding-x);
    min-height: 44px;
    color: var(--form-field-text);
    font-size: var(--form-field-font-size);
  }

  .country-display:hover:not(.disabled) {
    border: var(--form-field-border-hover);
    background: var(--form-field-bg-hover);
  }

  .country-display.disabled {
    opacity: 60%;
    cursor: not-allowed;
  }

  .country-name {
    flex: 1;
  }

  .country-display svg {
    opacity: 60%;
    margin-left: auto;
    flex-shrink: 0;
  }

  .country-display.active svg {
    transform: rotate(180deg);
  }

  .country-dropdown {
    position: absolute;
    top: calc(100% + 5px);
    right: 0;
    left: 0;
    transform: translateY(-10px);
    visibility: hidden;
    opacity: 0%;
    z-index: 1000;

    border: 1px solid color-mix(in oklch, var(--color-white) 10%, transparent);
    border-radius: var(--radius-xl);
    background: oklch(18.22% 0 263.28 / 100%);
    max-height: 200px;
    overflow-y: auto;
  }

  .country-dropdown.active {
    transform: translateY(0);
    visibility: visible;
    opacity: 100%;
  }

  .country-option {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    border-bottom: 1px solid
      color-mix(in oklch, var(--color-white) 5%, transparent);
    padding: 10px 12px;
    color: var(--text-primary);
    font-size: 13px;
  }

  .country-option:last-child {
    border-bottom: none;
  }

  .country-option:hover {
    background: color-mix(in oklch, var(--color-primary) 20%, transparent);
    padding-left: 16px;
    color: var(--color-white);
  }

  .country-option:active {
    background: color-mix(in oklch, var(--color-primary) 30%, transparent);
  }

  .country-option.selected {
    background: color-mix(in oklch, var(--color-primary) 15%, transparent);
  }

  .country-iso {
    margin-left: auto;
    opacity: 50%;
    font-size: 11px;
  }

  .country-dropdown::-webkit-scrollbar {
    width: 4px;
  }

  .country-dropdown::-webkit-scrollbar-track {
    background: color-mix(in oklch, var(--color-white) 5%, transparent);
  }

  .country-dropdown::-webkit-scrollbar-thumb {
    border-radius: 2px;
    background: color-mix(in oklch, var(--color-white) 20%, transparent);
  }

  .country-dropdown::-webkit-scrollbar-thumb:hover {
    background: color-mix(in oklch, var(--color-white) 30%, transparent);
  }
</style>
