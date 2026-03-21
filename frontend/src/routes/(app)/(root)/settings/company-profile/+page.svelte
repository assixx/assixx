<script lang="ts">
  /**
   * Company Profile Page
   * @module settings/company-profile/+page
   *
   * Root-only page for company address and contact information.
   * Two cards: readonly company info + editable address form.
   */
  import { untrack } from 'svelte';

  import { showSuccessAlert, showErrorAlert } from '$lib/stores/toast';
  import { getApiClient } from '$lib/utils/api-client';

  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();

  const apiClient = getApiClient();

  // =========================================================================
  // CONSTANTS
  // =========================================================================

  const ADDRESS_COUNTRIES = [
    { iso: 'DE', name: 'Deutschland', flag: '🇩🇪' },
    { iso: 'AT', name: 'Österreich', flag: '🇦🇹' },
    { iso: 'CH', name: 'Schweiz', flag: '🇨🇭' },
    { iso: 'FR', name: 'Frankreich', flag: '🇫🇷' },
    { iso: 'IT', name: 'Italien', flag: '🇮🇹' },
    { iso: 'ES', name: 'Spanien', flag: '🇪🇸' },
    { iso: 'NL', name: 'Niederlande', flag: '🇳🇱' },
    { iso: 'BE', name: 'Belgien', flag: '🇧🇪' },
    { iso: 'LU', name: 'Luxemburg', flag: '🇱🇺' },
    { iso: 'PL', name: 'Polen', flag: '🇵🇱' },
    { iso: 'CZ', name: 'Tschechien', flag: '🇨🇿' },
    { iso: 'US', name: 'USA', flag: '🇺🇸' },
    { iso: 'GB', name: 'Großbritannien', flag: '🇬🇧' },
  ] as const;

  // =========================================================================
  // FORM STATE
  // =========================================================================

  // Intentionally capture initial server values — form fields must NOT
  // reactively update when data is invalidated (user edits would be lost)
  const initial = untrack(() => data.company);

  let street = $state(initial?.street ?? '');
  let houseNumber = $state(initial?.houseNumber ?? '');
  let postalCode = $state(initial?.postalCode ?? '');
  let city = $state(initial?.city ?? '');
  let countryCode = $state(initial?.countryCode ?? 'DE');
  let saving = $state(false);
  let countryDropdownOpen = $state(false);

  // =========================================================================
  // DERIVED
  // =========================================================================

  const companyName = $derived(data.company?.companyName ?? '');
  const companyEmail = $derived(data.company?.email ?? '');
  const companyPhone = $derived(data.company?.phone ?? '');

  const selectedCountry = $derived(
    ADDRESS_COUNTRIES.find((c) => c.iso === countryCode) ?? ADDRESS_COUNTRIES[0],
  );

  const hasChanges = $derived(
    street !== (data.company?.street ?? '') ||
      houseNumber !== (data.company?.houseNumber ?? '') ||
      postalCode !== (data.company?.postalCode ?? '') ||
      city !== (data.company?.city ?? '') ||
      countryCode !== (data.company?.countryCode ?? 'DE'),
  );

  const isFormValid = $derived(
    street.trim() !== '' &&
      houseNumber.trim() !== '' &&
      postalCode.trim() !== '' &&
      city.trim() !== '',
  );

  // =========================================================================
  // HANDLERS
  // =========================================================================

  function toggleCountryDropdown(e: MouseEvent): void {
    e.stopPropagation();
    countryDropdownOpen = !countryDropdownOpen;
  }

  function selectCountry(iso: string): void {
    countryCode = iso;
    countryDropdownOpen = false;
  }

  function handleWindowClick(): void {
    countryDropdownOpen = false;
  }

  async function handleSave(): Promise<void> {
    if (!isFormValid || saving) return;

    saving = true;
    try {
      await apiClient.patch('/company', {
        street: street.trim(),
        houseNumber: houseNumber.trim(),
        postalCode: postalCode.trim(),
        city: city.trim(),
        countryCode,
      });
      showSuccessAlert('Firmendaten gespeichert');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Fehler beim Speichern';
      showErrorAlert(message);
    } finally {
      saving = false; // eslint-disable-line require-atomic-updates -- guarded by early return on saving===true
    }
  }
</script>

<svelte:window onclick={handleWindowClick} />

<svelte:head>
  <title>Firmenprofil - Einstellungen | Assixx</title>
</svelte:head>

<div class="container">
  <!-- ================================================================= -->
  <!-- SECTION 1: Company Info (readonly)                                 -->
  <!-- ================================================================= -->
  <div class="card mb-8">
    <div class="card__header">
      <h2 class="card__title">
        <i class="fas fa-building mr-2"></i>
        Firmendaten
      </h2>
      <p class="mt-2 text-(--color-text-secondary)">
        Grundlegende Informationen Ihres Unternehmens.
      </p>
    </div>

    <div class="card__body">
      {#if data.loadError}
        <div class="alert alert--danger">
          <div class="alert__icon">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          <div class="alert__content">Firmendaten konnten nicht geladen werden.</div>
        </div>
      {:else}
        <div class="flex flex-col gap-3">
          <div class="flex items-baseline gap-4">
            <span class="w-20 shrink-0 text-sm text-(--color-text-secondary)">Firma</span>
            <span class="font-medium text-(--color-text-primary)">{companyName}</span>
          </div>
          <div class="flex items-baseline gap-4">
            <span class="w-20 shrink-0 text-sm text-(--color-text-secondary)">E-Mail</span>
            <span class="font-medium text-(--color-text-primary)">{companyEmail}</span>
          </div>
          {#if companyPhone}
            <div class="flex items-baseline gap-4">
              <span class="w-20 shrink-0 text-sm text-(--color-text-secondary)">Telefon</span>
              <span class="font-medium text-(--color-text-primary)">{companyPhone}</span>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <!-- ================================================================= -->
  <!-- SECTION 2: Address (editable)                                      -->
  <!-- ================================================================= -->
  {#if !data.loadError}
    <div class="card">
      <div class="card__header">
        <h2 class="card__title">
          <i class="fas fa-map-marker-alt mr-2"></i>
          Adresse
        </h2>
        <p class="mt-2 text-(--color-text-secondary)">Firmenadresse bearbeiten.</p>
      </div>

      <div class="card__body">
        <form
          onsubmit={(e: Event) => {
            e.preventDefault();
            void handleSave();
          }}
        >
          <div class="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <div class="form-field col-span-2 max-sm:col-span-1">
              <label
                class="form-field__label form-field__label--required"
                for="street"
              >
                Straße
              </label>
              <input
                type="text"
                id="street"
                class="form-field__control"
                placeholder="Musterstraße"
                autocomplete="address-line1"
                bind:value={street}
                disabled={saving}
              />
            </div>

            <div class="form-field">
              <label
                class="form-field__label form-field__label--required"
                for="house_number"
              >
                Hausnummer
              </label>
              <input
                type="text"
                id="house_number"
                class="form-field__control"
                placeholder="42"
                autocomplete="address-line2"
                bind:value={houseNumber}
                disabled={saving}
              />
            </div>

            <div class="form-field">
              <label
                class="form-field__label form-field__label--required"
                for="postal_code"
              >
                PLZ
              </label>
              <input
                type="text"
                id="postal_code"
                class="form-field__control"
                placeholder="10115"
                autocomplete="postal-code"
                bind:value={postalCode}
                disabled={saving}
              />
            </div>

            <div class="form-field">
              <label
                class="form-field__label form-field__label--required"
                for="city"
              >
                Stadt
              </label>
              <input
                type="text"
                id="city"
                class="form-field__control"
                placeholder="Berlin"
                autocomplete="address-level2"
                bind:value={city}
                disabled={saving}
              />
            </div>

            <div class="form-field">
              <label
                class="form-field__label"
                for="country_code"
              >
                Land
              </label>
              <div class="dropdown">
                <button
                  type="button"
                  id="country_code"
                  class="dropdown__trigger"
                  class:active={countryDropdownOpen}
                  onclick={toggleCountryDropdown}
                  disabled={saving}
                >
                  <span>{selectedCountry.flag} {selectedCountry.name}</span>
                  <i class="fas fa-chevron-down"></i>
                </button>
                <div
                  class="dropdown__menu"
                  class:active={countryDropdownOpen}
                >
                  {#each ADDRESS_COUNTRIES as country (country.iso)}
                    <button
                      type="button"
                      class="dropdown__option"
                      onclick={() => {
                        selectCountry(country.iso);
                      }}
                    >
                      <span>{country.flag} {country.name}</span>
                      <span class="dropdown__option-secondary">{country.iso}</span>
                    </button>
                  {/each}
                </div>
              </div>
            </div>
          </div>

          <div class="mt-6 flex justify-end">
            <button
              type="submit"
              class="btn btn-primary"
              disabled={saving || !hasChanges || !isFormValid}
            >
              {#if saving}
                <span class="spinner-ring spinner-ring--sm"></span>
                Speichern...
              {:else}
                <i class="fas fa-save"></i>
                Speichern
              {/if}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>
