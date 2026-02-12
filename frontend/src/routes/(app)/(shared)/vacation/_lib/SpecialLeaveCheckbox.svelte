<script lang="ts">
  /**
   * SpecialLeaveCheckbox — Toggle for marking special leave on approval.
   * Used in the approve/deny flow for certain vacation types.
   */

  const {
    checked,
    onchange,
  }: {
    checked: boolean;
    onchange: (value: boolean) => void;
  } = $props();
</script>

<label class="special-leave-checkbox">
  <input
    type="checkbox"
    {checked}
    onchange={(e) => {
      onchange(e.currentTarget.checked);
    }}
  />
  <span class="special-leave-checkbox__label">
    <i class="fas fa-star mr-1"></i>
    Als Sonderurlaub genehmigen
  </span>
  <span class="special-leave-checkbox__hint">
    (Wird nicht vom Urlaubskonto abgezogen)
  </span>
</label>

<style>
  .special-leave-checkbox {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: var(--radius-sm, 0.25rem);
    background: var(--glass-bg, hsl(0deg 0% 100% / 5%));
  }

  .special-leave-checkbox__label {
    font-weight: 500;
  }

  .special-leave-checkbox__hint {
    color: var(--text-muted);
    font-size: 0.75rem;
  }
</style>
