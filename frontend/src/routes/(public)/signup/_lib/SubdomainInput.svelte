<script lang="ts">
  import { ERROR_MESSAGES } from './constants';
  import { isSubdomainValid } from './validators';

  interface Props {
    subdomain: string;
    disabled?: boolean;
  }

  // eslint-disable-next-line prefer-const, @typescript-eslint/no-useless-default-assignment -- $bindable() is a Svelte semantic marker, not a JS default
  let { subdomain = $bindable(), disabled = false }: Props = $props();

  let subdomainError: string | null = $state(null);

  // Touched-Flag: Required-Empty erst NACH Blur anzeigen (kein aggressives
  // Validieren beim ersten Öffnen). Analog zu companyName/firstName/lastName
  // in +page.svelte. Invalid-Pattern-Fehler (subdomainError) bleibt davon
  // unberührt — der greift ja nur wenn tatsächlich getippt wurde.
  let touched = $state(false);
  const showEmptyError = $derived(touched && subdomain === '');

  function handleInput(e: Event): void {
    const target = e.target as HTMLInputElement;
    subdomain = target.value.toLowerCase();
    subdomainError =
      subdomain !== '' && !isSubdomainValid(subdomain) ? ERROR_MESSAGES.subdomainInvalid : null;
  }
</script>

<div class="form-field">
  <label
    class="form-field__label form-field__label--required"
    for="subdomain">Subdomain</label
  >
  <div class="subdomain-input-group">
    <input
      type="text"
      id="subdomain"
      name="subdomain"
      class="subdomain-input"
      class:is-error={showEmptyError || subdomainError !== null}
      required
      pattern="[a-z0-9\-]+"
      placeholder="ihre-firma"
      value={subdomain}
      oninput={handleInput}
      onblur={() => {
        touched = true;
      }}
      {disabled}
    />
    <span class="subdomain-suffix">.assixx.com</span>
  </div>
  {#if subdomainError}
    <p class="form-field__message">{subdomainError}</p>
  {/if}
</div>

<style>
  .subdomain-input-group {
    display: flex;
    align-items: stretch;
  }

  .subdomain-input {
    flex: 1;
    backdrop-filter: var(--glass-form-backdrop);
    transition: var(--form-field-transition), var(--form-field-transition-shadow);
    border: var(--form-field-border);
    border-right: none;
    border-radius: var(--form-field-radius) 0 0 var(--form-field-radius);
    background: var(--form-field-bg);
    padding: var(--form-field-padding-y) var(--form-field-padding-x);
    min-height: 44px;
    color: var(--form-field-text);
    font-size: var(--form-field-font-size);
    line-height: 1.5;
  }

  .subdomain-input:hover {
    border: var(--form-field-border-hover);
    border-right: none;
    background: var(--form-field-bg-hover);
  }

  .subdomain-input:focus {
    outline: none;
    box-shadow: var(--form-field-focus-ring);
    border: var(--form-field-border-focus);
    border-right: none;
    background: var(--form-field-bg-focus);
  }

  .subdomain-suffix {
    display: flex;
    justify-content: center;
    align-items: center;
    backdrop-filter: blur(5px);
    transition: all 0.2s ease;
    border: var(--form-field-border);
    border-left: none;
    border-radius: 0 var(--form-field-radius) var(--form-field-radius) 0;
    background: color-mix(in oklch, var(--color-white) 8%, transparent);
    padding: 0 16px;
    color: var(--text-secondary);
    font-size: 14px;
    white-space: nowrap;
  }

  .subdomain-input:focus + .subdomain-suffix {
    border-color: var(--primary-color);
    background: color-mix(in oklch, var(--color-white) 12%, transparent);
  }

  /* Error-State: roter Border analog zu `.form-field__control.is-error`
     im Design-System. Suffix muss mitgefärbt werden, weil Input+Suffix
     einen visuellen Border-Group bilden (border-right: none am Input). */
  .subdomain-input.is-error {
    border: var(--form-field-border-error);
    border-right: none;
    color: var(--form-field-text-error);
  }

  .subdomain-input.is-error + .subdomain-suffix {
    border: var(--form-field-border-error);
    border-left: none;
  }
</style>
