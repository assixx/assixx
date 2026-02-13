<script lang="ts">
  /**
   * AppDatePicker - Wrapper around bits-ui DatePicker
   *
   * Accepts and emits YYYY-MM-DD strings while using bits-ui's
   * CalendarDate internally. Styled with the glassmorphism design system.
   */
  import {
    CalendarDate,
    type DateValue,
    today,
    getLocalTimeZone,
  } from '@internationalized/date';
  import { DatePicker } from 'bits-ui';

  interface Props {
    /** Date value as YYYY-MM-DD string */
    value?: string;
    /** Minimum selectable date as YYYY-MM-DD string */
    min?: string;
    /** Maximum selectable date as YYYY-MM-DD string */
    max?: string;
    /** Initial month to show when no value is set (YYYY-MM-DD string) */
    placeholder?: string;
    /** Label text shown above the picker */
    label?: string;
    /** HTML name attribute */
    name?: string;
    /** Whether the field is required */
    required?: boolean;
    /** Whether the picker is disabled */
    disabled?: boolean;
    /** Visual state variant */
    variant?: 'error' | 'success' | 'warning';
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Callback when value changes */
    onchange?: (value: string) => void;
  }

  /* eslint-disable prefer-const -- Svelte reactive props must use let */
  let {
    value = $bindable(''),
    min,
    max,
    placeholder,
    label,
    name,
    required = false,
    disabled = false,
    variant,
    size = 'md',
    onchange,
  }: Props = $props();
  /* eslint-enable prefer-const */

  /** Parse YYYY-MM-DD string to CalendarDate */
  function parseDate(dateStr: string | undefined): CalendarDate | undefined {
    if (dateStr === undefined || dateStr === '') {
      return undefined;
    }
    const parts = dateStr.split('-');
    if (parts.length !== 3) return undefined;
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
      return undefined;
    }
    return new CalendarDate(year, month, day);
  }

  /** Format CalendarDate to YYYY-MM-DD string */
  function formatDate(date: DateValue | undefined): string {
    if (date === undefined) return '';
    const y = String(date.year).padStart(4, '0');
    const m = String(date.month).padStart(2, '0');
    const d = String(date.day).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const calendarValue: DateValue | undefined = $derived(parseDate(value));
  const minValue: DateValue | undefined = $derived(parseDate(min));
  const maxValue: DateValue | undefined = $derived(parseDate(max));
  const placeholderValue: DateValue = $derived(
    parseDate(value) ?? parseDate(placeholder) ?? today(getLocalTimeZone()),
  );

  function handleValueChange(newValue: DateValue | undefined): void {
    const formatted = formatDate(newValue);
    value = formatted;
    onchange?.(formatted);
  }

  let open = $state(false);
</script>

<div
  class="app-date-picker"
  class:app-date-picker--sm={size === 'sm'}
  class:app-date-picker--lg={size === 'lg'}
  class:app-date-picker--error={variant === 'error'}
  class:app-date-picker--success={variant === 'success'}
  class:app-date-picker--warning={variant === 'warning'}
  class:app-date-picker--disabled={disabled}
>
  <DatePicker.Root
    value={calendarValue}
    onValueChange={handleValueChange}
    placeholder={placeholderValue}
    bind:open
    locale="de-DE"
    weekStartsOn={1}
    fixedWeeks={true}
    {disabled}
    {minValue}
    {maxValue}
    closeOnDateSelect={true}
  >
    {#if label}
      <DatePicker.Label class="app-date-picker__label">
        {label}
        {#if required}<span class="app-date-picker__required">*</span>{/if}
      </DatePicker.Label>
    {/if}

    <!-- Trigger wraps entire field so popover anchors to full width -->
    <DatePicker.Trigger>
      {#snippet child({ props })}
        <!-- eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- bits-ui child snippet spread -->
        <div
          {...props}
          class="app-date-picker__field"
        >
          <i class="app-date-picker__icon fas fa-calendar"></i>
          <DatePicker.Input
            {name}
            class="app-date-picker__input"
          >
            {#snippet children({ segments })}
              {#each segments as { part, value: segValue }, segIndex (segIndex)}
                <DatePicker.Segment
                  {part}
                  class="app-date-picker__segment"
                >
                  {segValue}
                </DatePicker.Segment>
              {/each}
            {/snippet}
          </DatePicker.Input>
          <i class="app-date-picker__chevron fas fa-chevron-down"></i>
        </div>
      {/snippet}
    </DatePicker.Trigger>

    <DatePicker.Portal>
      <DatePicker.Content
        class="app-date-picker__content"
        side="bottom"
        align="start"
        sideOffset={8}
        collisionPadding={16}
      >
        <DatePicker.Calendar class="app-date-picker__calendar">
          {#snippet children({ months, weekdays })}
            <DatePicker.Header class="app-date-picker__header">
              <DatePicker.PrevButton class="app-date-picker__nav-btn">
                <i class="fas fa-chevron-left"></i>
              </DatePicker.PrevButton>
              <DatePicker.Heading class="app-date-picker__heading" />
              <DatePicker.NextButton class="app-date-picker__nav-btn">
                <i class="fas fa-chevron-right"></i>
              </DatePicker.NextButton>
            </DatePicker.Header>

            <!-- eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- bits-ui snippet props not resolvable by eslint-plugin-svelte -->
            {#each months as month (`${String(month.value.year)}-${String(month.value.month)}`)}
              <DatePicker.Grid class="app-date-picker__grid">
                <DatePicker.GridHead>
                  <DatePicker.GridRow class="app-date-picker__grid-row">
                    {#each weekdays as weekday, wdIndex (wdIndex)}
                      <DatePicker.HeadCell class="app-date-picker__head-cell">
                        {weekday}
                      </DatePicker.HeadCell>
                    {/each}
                  </DatePicker.GridRow>
                </DatePicker.GridHead>
                <DatePicker.GridBody>
                  {#each month.weeks as week, weekIndex (weekIndex)}
                    <DatePicker.GridRow class="app-date-picker__grid-row">
                      <!-- eslint-disable-next-line @typescript-eslint/no-unsafe-call -- bits-ui snippet props not resolvable by eslint-plugin-svelte -->
                      {#each week as day (day.toString())}
                        <DatePicker.Cell
                          date={day}
                          month={month.value}
                          class="app-date-picker__cell"
                        >
                          <DatePicker.Day class="app-date-picker__day">
                            {day.day}
                          </DatePicker.Day>
                        </DatePicker.Cell>
                      {/each}
                    </DatePicker.GridRow>
                  {/each}
                </DatePicker.GridBody>
              </DatePicker.Grid>
            {/each}
          {/snippet}
        </DatePicker.Calendar>
      </DatePicker.Content>
    </DatePicker.Portal>
  </DatePicker.Root>
</div>

<style>
  /* ============================================================
     BASE - Structure & Layout
     ============================================================ */

  .app-date-picker {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: var(--spacing-1);
  }

  /* Label */
  .app-date-picker :global(.app-date-picker__label) {
    color: var(--color-text-secondary);
    font-size: 13px;
    font-weight: 500;
    margin-bottom: var(--spacing-1);
  }

  .app-date-picker__required {
    color: var(--color-danger);
    margin-left: 2px;
  }

  /* Field wrapper = Trigger (full-width anchor for popover) */
  .app-date-picker__field {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    backdrop-filter: blur(10px);
    transition:
      border-color var(--duration-fast) var(--ease-standard),
      background var(--duration-fast) var(--ease-standard),
      box-shadow var(--duration-fast) var(--ease-standard);
    border: 1px solid var(--color-glass-border);
    border-radius: var(--radius-xl);
    background: var(--glass-bg-hover);
    padding: var(--spacing-3) var(--spacing-4);
    padding-left: calc(var(--spacing-4) * 2 + 16px);
    color: var(--color-text-primary);
    font-size: 14px;
    line-height: 1.5;
    font-family: var(--font-family-sans);
    cursor: pointer;
  }

  .app-date-picker__field:focus-within {
    outline: none;
    box-shadow: 0 0 0 3px rgb(33 150 243 / 10%);
    border-color: var(--color-primary);
    background: var(--glass-bg-active);
  }

  /* Input (segments container inside field) */
  .app-date-picker :global(.app-date-picker__input) {
    display: flex;
    align-items: center;
    gap: 1px;
    flex: 1;
    min-width: 0;
  }

  /* Calendar icon (left) */
  .app-date-picker__icon {
    position: absolute;
    top: 50%;
    left: var(--spacing-4);
    transform: translateY(-50%);
    z-index: 1;
    pointer-events: none;
    color: var(--color-text-secondary);
    font-size: 16px;
    transition: color var(--duration-fast) var(--ease-standard);
  }

  .app-date-picker__field:focus-within .app-date-picker__icon {
    color: var(--color-primary);
  }

  /* Chevron icon (right) */
  .app-date-picker__chevron {
    margin-left: auto;
    color: var(--color-text-secondary);
    font-size: 12px;
    transition: color var(--duration-fast) var(--ease-standard);
  }

  .app-date-picker__field:hover .app-date-picker__chevron {
    color: var(--color-primary);
  }

  /* Segments */
  .app-date-picker :global(.app-date-picker__segment) {
    color: var(--color-text-primary);
    font-size: 14px;
    font-variant-numeric: tabular-nums;
    padding: 1px 2px;
    border-radius: var(--radius-sm);
    outline: none;
  }

  .app-date-picker :global(.app-date-picker__segment:focus) {
    background: var(--color-primary);
    color: var(--color-text-on-primary, #fff);
  }

  .app-date-picker :global(.app-date-picker__segment[data-placeholder]) {
    color: var(--color-text-tertiary);
  }

  /* ============================================================
     POPOVER / CALENDAR CONTENT (Portal → rendered in <body>)
     ============================================================ */

  :global(.app-date-picker__content) {
    z-index: 2100;
    backdrop-filter: blur(20px);
    background: rgb(255 255 255 / 95%);
    border: 1px solid var(--color-glass-border);
    border-radius: var(--radius-2xl);
    box-shadow: 0 20px 40px rgb(0 0 0 / 12%);
    padding: var(--spacing-4);
    min-width: 280px;
  }

  :global(html.dark .app-date-picker__content) {
    background: rgb(15 15 15 / 95%);
    box-shadow:
      0 20px 40px rgb(0 0 0 / 30%),
      0 0 1px rgb(255 255 255 / 10%);
  }

  :global(.app-date-picker__calendar) {
    width: 100%;
  }

  /* Header (nav + month label) */
  :global(.app-date-picker__header) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-3);
  }

  :global(.app-date-picker__heading) {
    color: var(--color-text-primary);
    font-size: 15px;
    font-weight: 600;
    text-transform: capitalize;
  }

  :global(.app-date-picker__nav-btn) {
    all: unset;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-lg);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition:
      background var(--duration-fast) var(--ease-standard),
      color var(--duration-fast) var(--ease-standard);
  }

  :global(.app-date-picker__nav-btn:hover) {
    background: var(--glass-bg-hover);
    color: var(--color-text-primary);
  }

  :global(.app-date-picker__nav-btn:disabled) {
    opacity: 30%;
    cursor: not-allowed;
  }

  /* Grid */
  :global(.app-date-picker__grid) {
    width: 100%;
    border-collapse: collapse;
  }

  :global(.app-date-picker__grid-row) {
    display: flex;
    width: 100%;
  }

  :global(.app-date-picker__head-cell) {
    flex: 1;
    text-align: center;
    color: var(--color-text-tertiary);
    font-size: 12px;
    font-weight: 500;
    padding: var(--spacing-2) 0;
    text-transform: capitalize;
  }

  /* Day cells */
  :global(.app-date-picker__cell) {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1px;
  }

  :global(.app-date-picker__day) {
    all: unset;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: var(--radius-lg);
    color: var(--color-text-primary);
    font-size: 13px;
    cursor: pointer;
    transition:
      background var(--duration-fast) var(--ease-standard),
      color var(--duration-fast) var(--ease-standard);
  }

  :global(.app-date-picker__day:hover) {
    background: var(--glass-bg-hover);
  }

  :global(.app-date-picker__day[data-selected]) {
    background: var(--color-primary);
    color: var(--color-text-on-primary, #fff);
    font-weight: 600;
  }

  :global(.app-date-picker__day[data-today]:not([data-selected])) {
    border: 1px solid var(--color-primary);
    color: var(--color-primary);
  }

  :global(.app-date-picker__day[data-outside-month]) {
    color: var(--color-text-tertiary);
    opacity: 40%;
  }

  :global(.app-date-picker__day[data-disabled]) {
    color: var(--color-text-tertiary);
    opacity: 30%;
    cursor: not-allowed;
  }

  :global(.app-date-picker__day[data-unavailable]) {
    color: var(--color-danger);
    opacity: 50%;
    cursor: not-allowed;
    text-decoration: line-through;
  }

  :global(.app-date-picker__day:focus-visible) {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  /* ============================================================
     SIZE VARIANTS
     ============================================================ */

  .app-date-picker--sm .app-date-picker__field {
    padding: var(--spacing-2) var(--spacing-3);
    padding-left: calc(var(--spacing-3) * 2 + 14px);
    font-size: 13px;
  }

  .app-date-picker--sm .app-date-picker__icon {
    left: var(--spacing-3);
    font-size: 14px;
  }

  .app-date-picker--lg .app-date-picker__field {
    padding: var(--spacing-4) var(--spacing-5);
    padding-left: calc(var(--spacing-5) * 2 + 18px);
    font-size: 16px;
  }

  .app-date-picker--lg .app-date-picker__icon {
    left: var(--spacing-5);
    font-size: 18px;
  }

  /* ============================================================
     STATE VARIANTS
     ============================================================ */

  .app-date-picker--error .app-date-picker__field {
    border-color: var(--color-danger);
    background: rgb(244 67 54 / 5%);
  }

  .app-date-picker--error .app-date-picker__field:focus-within {
    box-shadow: 0 0 0 3px rgb(244 67 54 / 10%);
    border-color: var(--color-danger);
  }

  .app-date-picker--error .app-date-picker__icon {
    color: var(--color-danger);
  }

  .app-date-picker--success .app-date-picker__field {
    border-color: var(--color-success);
    background: rgb(76 175 80 / 5%);
  }

  .app-date-picker--success .app-date-picker__field:focus-within {
    box-shadow: 0 0 0 3px rgb(76 175 80 / 10%);
    border-color: var(--color-success);
  }

  .app-date-picker--success .app-date-picker__icon {
    color: var(--color-success);
  }

  .app-date-picker--warning .app-date-picker__field {
    border-color: var(--color-warning);
    background: rgb(255 152 0 / 5%);
  }

  .app-date-picker--warning .app-date-picker__field:focus-within {
    box-shadow: 0 0 0 3px rgb(255 152 0 / 10%);
    border-color: var(--color-warning);
  }

  .app-date-picker--warning .app-date-picker__icon {
    color: var(--color-warning);
  }

  /* Disabled */
  .app-date-picker--disabled .app-date-picker__field {
    opacity: 50%;
    cursor: not-allowed;
    background: var(--glass-bg);
  }

  .app-date-picker--disabled .app-date-picker__icon {
    opacity: 50%;
  }

  /* ============================================================
     ACCESSIBILITY
     ============================================================ */

  @media (prefers-contrast: more) {
    .app-date-picker__field {
      border-width: 2px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .app-date-picker__field {
      transition: none;
    }
  }
</style>
