<script lang="ts">
  /**
   * AppTimePicker - Custom time picker with hour/minute segments
   *
   * Accepts and emits HH:MM strings. Styled to match AppDatePicker
   * with glassmorphism design system. 24h format (German standard).
   */

  interface Props {
    /** Time value as HH:MM string */
    value?: string;
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
    /** Minute step (default 5) */
    step?: number;
    /** Callback when value changes */
    onchange?: (value: string) => void;
  }

  /* eslint-disable prefer-const -- Svelte reactive props must use let */
  let {
    value = $bindable(''),
    label,
    name,
    required = false,
    disabled = false,
    variant,
    size = 'md',
    step = 5,
    onchange,
  }: Props = $props();
  /* eslint-enable prefer-const */

  /** Parse HH:MM into numeric parts */
  function parseTime(val: string): { hours: number; minutes: number } {
    if (val === '') return { hours: 9, minutes: 0 };
    const parts = val.split(':');
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return { hours: 9, minutes: 0 };
    }
    return { hours, minutes };
  }

  /** Format numeric parts to HH:MM */
  function formatTime(hours: number, minutes: number): string {
    const h = String(hours).padStart(2, '0');
    const m = String(minutes).padStart(2, '0');
    return `${h}:${m}`;
  }

  /** Clamp a number within min/max (inclusive) */
  function clamp(val: number, min: number, max: number): number {
    if (val < min) return max;
    if (val > max) return min;
    return val;
  }

  let focusedSegment = $state<'hours' | 'minutes' | null>(null);
  let digitBuffer = $state('');
  let digitBufferTimeout = $state<ReturnType<typeof setTimeout> | null>(null);

  const parsed = $derived(parseTime(value));

  /** Emit a new time value */
  function emitValue(hours: number, minutes: number): void {
    const formatted = formatTime(hours, minutes);
    value = formatted;
    onchange?.(formatted);
  }

  /** Clear digit buffer */
  function clearBuffer(): void {
    digitBuffer = '';
    if (digitBufferTimeout !== null) {
      clearTimeout(digitBufferTimeout);
      digitBufferTimeout = null;
    }
  }

  /** Emit value for a specific segment */
  function emitSegment(segment: 'hours' | 'minutes', val: number): void {
    if (segment === 'hours') {
      emitValue(val, parsed.minutes);
    } else {
      emitValue(parsed.hours, val);
    }
  }

  /** Focus the minutes segment (auto-advance after hours input) */
  function focusMinutes(): void {
    const el = document.querySelector<HTMLElement>(
      '.app-time-picker__segment--minutes',
    );
    el?.focus();
  }

  /** Handle arrow key increment/decrement */
  function handleArrowKey(
    segment: 'hours' | 'minutes',
    direction: 1 | -1,
  ): void {
    const maxVal = segment === 'hours' ? 23 : 59;
    const currentVal = segment === 'hours' ? parsed.hours : parsed.minutes;
    const stepVal = segment === 'minutes' ? step : 1;
    const next = clamp(currentVal + stepVal * direction, 0, maxVal);
    emitSegment(segment, next);
    clearBuffer();
  }

  /** Handle digit typing with 2-char buffer + auto-advance */
  function handleDigitInput(segment: 'hours' | 'minutes', digit: string): void {
    const maxVal = segment === 'hours' ? 23 : 59;
    const firstDigitMax = segment === 'hours' ? 2 : 5;

    if (digitBufferTimeout !== null) {
      clearTimeout(digitBufferTimeout);
    }

    // Single digit exceeds max first digit → commit immediately
    if (digitBuffer === '' && Number(digit) > firstDigitMax) {
      emitSegment(segment, Math.min(Number(digit), maxVal));
      clearBuffer();
      if (segment === 'hours') focusMinutes();
      return;
    }

    const newBuffer = digitBuffer + digit;

    // Two digits → commit and advance
    if (newBuffer.length >= 2) {
      emitSegment(segment, Math.min(Number(newBuffer), maxVal));
      clearBuffer();
      if (segment === 'hours') focusMinutes();
      return;
    }

    // First digit → buffer + auto-commit after 800ms
    digitBuffer = newBuffer;
    digitBufferTimeout = setTimeout(() => {
      emitSegment(segment, Math.min(Number(newBuffer), maxVal));
      clearBuffer();
    }, 800);
  }

  /** Handle keyboard input on a segment */
  function handleKeydown(e: KeyboardEvent, segment: 'hours' | 'minutes'): void {
    if (disabled) return;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleArrowKey(segment, 1);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleArrowKey(segment, -1);
      return;
    }
    if (e.key === 'Tab') {
      clearBuffer();
      return;
    }
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      handleDigitInput(segment, e.key);
    }
  }
</script>

{#if name !== undefined}
  <input
    type="hidden"
    {name}
    {value}
  />
{/if}

<div
  class="app-time-picker"
  class:app-time-picker--sm={size === 'sm'}
  class:app-time-picker--lg={size === 'lg'}
  class:app-time-picker--error={variant === 'error'}
  class:app-time-picker--success={variant === 'success'}
  class:app-time-picker--warning={variant === 'warning'}
  class:app-time-picker--disabled={disabled}
>
  {#if label !== undefined}
    <span class="app-time-picker__label">
      {label}
      {#if required}<span class="app-time-picker__required">*</span>{/if}
    </span>
  {/if}

  <div class="app-time-picker__field">
    <i class="app-time-picker__icon fas fa-clock"></i>
    <div class="app-time-picker__segments">
      <!-- Hours -->
      <span
        class="app-time-picker__segment app-time-picker__segment--hours"
        class:app-time-picker__segment--focused={focusedSegment === 'hours'}
        role="spinbutton"
        tabindex={disabled ? -1 : 0}
        aria-label="Stunden"
        aria-valuenow={parsed.hours}
        aria-valuemin={0}
        aria-valuemax={23}
        onfocus={() => {
          focusedSegment = 'hours';
          clearBuffer();
        }}
        onblur={() => {
          focusedSegment = null;
          clearBuffer();
        }}
        onkeydown={(e) => {
          handleKeydown(e, 'hours');
        }}
      >
        {String(parsed.hours).padStart(2, '0')}
      </span>
      <span class="app-time-picker__separator">:</span>
      <!-- Minutes -->
      <span
        class="app-time-picker__segment app-time-picker__segment--minutes"
        class:app-time-picker__segment--focused={focusedSegment === 'minutes'}
        role="spinbutton"
        tabindex={disabled ? -1 : 0}
        aria-label="Minuten"
        aria-valuenow={parsed.minutes}
        aria-valuemin={0}
        aria-valuemax={59}
        onfocus={() => {
          focusedSegment = 'minutes';
          clearBuffer();
        }}
        onblur={() => {
          focusedSegment = null;
          clearBuffer();
        }}
        onkeydown={(e) => {
          handleKeydown(e, 'minutes');
        }}
      >
        {String(parsed.minutes).padStart(2, '0')}
      </span>
      <span class="app-time-picker__suffix">Uhr</span>
    </div>
  </div>
</div>

<style>
  /* ============================================================
     BASE - Structure & Layout (mirrors AppDatePicker exactly)
     ============================================================ */

  .app-time-picker {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: var(--spacing-1);
  }

  /* Label */
  .app-time-picker__label {
    color: var(--color-text-secondary);
    font-size: 13px;
    font-weight: 500;
    margin-bottom: var(--spacing-1);
  }

  .app-time-picker__required {
    color: var(--color-danger);
    margin-left: 2px;
  }

  /* Field wrapper (matches .app-date-picker__field 1:1) */
  .app-time-picker__field {
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
    cursor: default;
  }

  .app-time-picker__field:focus-within {
    outline: none;
    box-shadow: 0 0 0 3px rgb(33 150 243 / 10%);
    border-color: var(--color-primary);
    background: var(--glass-bg-active);
  }

  /* Clock icon (left, matches date picker icon position) */
  .app-time-picker__icon {
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

  .app-time-picker__field:focus-within .app-time-picker__icon {
    color: var(--color-primary);
  }

  /* Segments container */
  .app-time-picker__segments {
    display: flex;
    align-items: center;
    gap: 1px;
    flex: 1;
    min-width: 0;
  }

  /* Individual segment (matches .app-date-picker__segment) */
  .app-time-picker__segment {
    color: var(--color-text-primary);
    font-size: 14px;
    font-variant-numeric: tabular-nums;
    padding: 1px 4px;
    border-radius: var(--radius-sm);
    outline: none;
    cursor: pointer;
    transition:
      background var(--duration-fast) var(--ease-standard),
      color var(--duration-fast) var(--ease-standard);
    user-select: none;
  }

  .app-time-picker__segment:hover {
    background: var(--glass-bg-hover);
  }

  .app-time-picker__segment--focused {
    background: var(--color-primary);
    color: var(--color-text-on-primary, #fff);
  }

  /* Separator colon */
  .app-time-picker__separator {
    color: var(--color-text-secondary);
    font-size: 14px;
    font-weight: 600;
    padding: 0 1px;
    user-select: none;
  }

  /* "Uhr" suffix */
  .app-time-picker__suffix {
    color: var(--color-text-tertiary);
    font-size: 12px;
    margin-left: var(--spacing-2);
    user-select: none;
  }

  /* ============================================================
     SIZE VARIANTS (matches AppDatePicker)
     ============================================================ */

  .app-time-picker--sm .app-time-picker__field {
    padding: var(--spacing-2) var(--spacing-3);
    padding-left: calc(var(--spacing-3) * 2 + 14px);
    font-size: 13px;
  }

  .app-time-picker--sm .app-time-picker__icon {
    left: var(--spacing-3);
    font-size: 14px;
  }

  .app-time-picker--sm .app-time-picker__segment {
    font-size: 13px;
  }

  .app-time-picker--lg .app-time-picker__field {
    padding: var(--spacing-4) var(--spacing-5);
    padding-left: calc(var(--spacing-5) * 2 + 18px);
    font-size: 16px;
  }

  .app-time-picker--lg .app-time-picker__icon {
    left: var(--spacing-5);
    font-size: 18px;
  }

  .app-time-picker--lg .app-time-picker__segment {
    font-size: 16px;
  }

  /* ============================================================
     STATE VARIANTS (matches AppDatePicker)
     ============================================================ */

  .app-time-picker--error .app-time-picker__field {
    border-color: var(--color-danger);
    background: rgb(244 67 54 / 5%);
  }

  .app-time-picker--error .app-time-picker__field:focus-within {
    box-shadow: 0 0 0 3px rgb(244 67 54 / 10%);
    border-color: var(--color-danger);
  }

  .app-time-picker--error .app-time-picker__icon {
    color: var(--color-danger);
  }

  .app-time-picker--success .app-time-picker__field {
    border-color: var(--color-success);
    background: rgb(76 175 80 / 5%);
  }

  .app-time-picker--success .app-time-picker__field:focus-within {
    box-shadow: 0 0 0 3px rgb(76 175 80 / 10%);
    border-color: var(--color-success);
  }

  .app-time-picker--success .app-time-picker__icon {
    color: var(--color-success);
  }

  .app-time-picker--warning .app-time-picker__field {
    border-color: var(--color-warning);
    background: rgb(255 152 0 / 5%);
  }

  .app-time-picker--warning .app-time-picker__field:focus-within {
    box-shadow: 0 0 0 3px rgb(255 152 0 / 10%);
    border-color: var(--color-warning);
  }

  .app-time-picker--warning .app-time-picker__icon {
    color: var(--color-warning);
  }

  /* Disabled */
  .app-time-picker--disabled .app-time-picker__field {
    opacity: 50%;
    cursor: not-allowed;
    background: var(--glass-bg);
  }

  .app-time-picker--disabled .app-time-picker__icon {
    opacity: 50%;
  }

  .app-time-picker--disabled .app-time-picker__segment {
    cursor: not-allowed;
  }

  /* ============================================================
     ACCESSIBILITY
     ============================================================ */

  @media (prefers-contrast: more) {
    .app-time-picker__field {
      border-width: 2px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .app-time-picker__field {
      transition: none;
    }
  }
</style>
