<script lang="ts">
  import { STATUS_FILTER_OPTIONS } from './constants';

  interface Props {
    activeFilter: number | 'all';
    onfilter: (value: number | 'all') => void;
  }

  const { activeFilter, onfilter }: Props = $props();
</script>

<div class="toggle-group">
  {#each STATUS_FILTER_OPTIONS as opt (opt.value)}
    <button
      type="button"
      class="toggle-group__btn"
      class:active={activeFilter === opt.value}
      onclick={() => {
        onfilter(opt.value);
      }}
    >
      <i class="fas {opt.icon}"></i>
      {opt.label}
    </button>
  {/each}
</div>
