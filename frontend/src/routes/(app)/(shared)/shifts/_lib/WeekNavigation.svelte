<!--
  WeekNavigation.svelte
  Week navigation controls with previous/next buttons and week display
  Extracted from +page.svelte for maintainability
-->
<script lang="ts">
  interface Props {
    weekRangeText: string;
    onnavigateWeek: (direction: number) => void;
  }

  const { weekRangeText, onnavigateWeek }: Props = $props();
</script>

<div class="week-navigation">
  <button
    type="button"
    class="btn btn-secondary"
    onclick={() => {
      onnavigateWeek(-1);
    }}
    aria-label="Vorherige Woche"
  >
    <i class="fas fa-chevron-left mr-1"></i>
    Vorherige Woche
  </button>
  <div class="week-info">
    <span>{weekRangeText}</span>
  </div>
  <button
    type="button"
    class="btn btn-secondary"
    onclick={() => {
      onnavigateWeek(1);
    }}
    aria-label="Nächste Woche"
  >
    Nächste Woche
    <i class="fas fa-chevron-right ml-1"></i>
  </button>
</div>
