<script lang="ts">
  import { MESSAGES } from './constants';

  interface Props {
    value: string;
    onsearch: (term: string) => void;
  }

  const { value, onsearch }: Props = $props();

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function handleInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const term = target.value;

    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      onsearch(term);
    }, 300);
  }

  function handleClear(): void {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    onsearch('');
  }
</script>

<div
  class="search-input"
  class:search-input--has-value={value.length > 0}
>
  <i class="search-input__icon fas fa-search"></i>
  <input
    type="search"
    class="search-input__field"
    placeholder={MESSAGES.SEARCH_PH}
    {value}
    oninput={handleInput}
  />
  <button
    type="button"
    class="search-input__clear"
    aria-label="Suche löschen"
    onclick={handleClear}
  >
    <i class="fas fa-times"></i>
  </button>
</div>
