<script lang="ts">
  /**
   * Design Settings Page
   * @module settings/design/+page
   *
   * User-facing page for appearance settings.
   * Currently: Light/Dark mode toggle with cross-device sync.
   */
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import { getTheme } from '$lib/stores/theme.svelte';

  /** Reactive theme state for tooltip display */
  const theme = $derived(getTheme());
</script>

<svelte:head>
  <title>Design - Einstellungen | Assixx</title>
</svelte:head>

<div class="container">
  <div class="card">
    <div class="card__header">
      <h2 class="card__title">
        <i class="fas fa-palette mr-2"></i>
        Design
      </h2>
      <p class="mt-2 text-(--color-text-secondary)">
        Passe das Erscheinungsbild der Anwendung an deine Vorlieben an.
      </p>
    </div>

    <div class="card__body">
      <div
        class="flex items-center gap-20 rounded-lg border border-(--color-glass-border) bg-(--glass-bg) p-4 max-sm:flex-col max-sm:items-start"
      >
        <div class="flex flex-col gap-1">
          <span class="font-semibold text-(--color-text-primary)">
            Farbschema
          </span>
          <span class="text-sm text-(--color-text-secondary)">
            Wechsle zwischen hellem und dunklem Erscheinungsbild.
          </span>
          <span
            class="mt-1 flex items-center gap-1.5 text-xs text-(--color-text-muted)"
          >
            <i class="fas fa-sync-alt text-[0.625rem]"></i>
            Wird auf allen Geräten synchronisiert.
          </span>
        </div>

        <div class="flex shrink-0 items-center gap-3 max-sm:self-end">
          <ThemeToggle />
          <span class="tooltip">
            <i class="fas fa-info-circle"></i>
            <span
              class="tooltip__content tooltip__content--info tooltip__content--right"
              role="tooltip"
            >
              {theme === 'dark' ? 'Dunkelmodus aktiv' : 'Hellmodus aktiv'}
            </span>
          </span>
        </div>
      </div>
    </div>
  </div>
</div>
