<script lang="ts">
  import { COUNTRIES, DEFAULT_COUNTRY, ERROR_MESSAGES } from './constants';
  import { isPhoneValid } from './validators';

  import type { Country } from './types';

  interface Props {
    phone: string;
    countryCode: string;
    disabled?: boolean;
  }

  /* eslint-disable prefer-const, @typescript-eslint/no-useless-default-assignment -- $bindable() is a Svelte semantic marker, not a JS default */
  let {
    phone = $bindable(),
    countryCode = $bindable(),
    disabled = false,
  }: Props = $props();
  /* eslint-enable prefer-const, @typescript-eslint/no-useless-default-assignment */

  let dropdownOpen = $state(false);
  let phoneError: string | null = $state(null);

  const selectedFlag = $derived(
    COUNTRIES.find((c: Country) => c.code === countryCode)?.flag ??
      DEFAULT_COUNTRY.flag,
  );

  function selectCountry(country: Country): void {
    countryCode = country.code;
    dropdownOpen = false;
  }

  function toggleDropdown(): void {
    dropdownOpen = !dropdownOpen;
  }

  function handlePhoneInput(): void {
    phoneError =
      phone !== '' && !isPhoneValid(phone) ? ERROR_MESSAGES.phoneInvalid : null;
  }

  $effect(() => {
    function handler(event: MouseEvent): void {
      if (!(event.target instanceof HTMLElement)) return;
      if (!event.target.closest('.custom-country-select')) {
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
    for="phone">Telefon</label
  >
  <div class="phone-input-group">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="custom-country-select">
      <div
        class="country-display"
        class:active={dropdownOpen}
        onclick={toggleDropdown}
      >
        <span class="flag-text">{selectedFlag}</span>
        <span>{countryCode}</span>
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
        {#each COUNTRIES as country (country.code)}
          <div
            class="country-option"
            onclick={() => {
              selectCountry(country);
            }}
          >
            {country.flag}
            {country.code}
          </div>
        {/each}
      </div>
    </div>
    <input
      type="tel"
      id="phone"
      name="phone"
      class="form-field__control phone-number"
      class:is-error={phoneError}
      placeholder="123 456789"
      autocomplete="tel-national"
      required
      bind:value={phone}
      oninput={handlePhoneInput}
      {disabled}
    />
  </div>
  {#if phoneError}
    <p class="form-field__message form-field__message--error">
      {phoneError}
    </p>
  {/if}
</div>

<style>
  /* Emoji font for flag rendering */
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

  .phone-input-group {
    display: flex;
    gap: 8px;
  }

  .custom-country-select {
    position: relative;
    width: 85px;
  }

  .country-display {
    display: flex;
    align-items: center;
    gap: 4px;
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

  .country-display:hover {
    border: var(--form-field-border-hover);
    background: var(--form-field-bg-hover);
  }

  .country-display svg {
    opacity: 60%;
    margin-left: auto;
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
    backdrop-filter: blur(20px) saturate(180%);
    box-shadow: var(--shadow-sm);
    border: 1px solid hsl(0deg 0% 100% / 10%);
    border-radius: var(--radius-xl);
    background: rgb(18 18 18 / 100%);
    max-height: 200px;
    overflow-y: auto;
  }

  .country-dropdown.active {
    transform: translateY(0);
    visibility: visible;
    opacity: 100%;
  }

  .country-option {
    cursor: pointer;
    border-bottom: 1px solid rgb(255 255 255 / 5%);
    padding: 10px 12px;
    color: var(--text-primary);
    font-size: 13px;
  }

  .country-option:last-child {
    border-bottom: none;
  }

  .country-option:hover {
    background: rgb(33 150 243 / 20%);
    padding-left: 16px;
    color: #fff;
  }

  .country-option:active {
    background: rgb(33 150 243 / 30%);
  }

  .country-dropdown::-webkit-scrollbar {
    width: 4px;
  }

  .country-dropdown::-webkit-scrollbar-track {
    background: rgb(255 255 255 / 5%);
  }

  .country-dropdown::-webkit-scrollbar-thumb {
    border-radius: 2px;
    background: rgb(255 255 255 / 20%);
  }

  .country-dropdown::-webkit-scrollbar-thumb:hover {
    background: rgb(255 255 255 / 30%);
  }

  .phone-input-group .phone-number {
    flex: 1;
  }
</style>
