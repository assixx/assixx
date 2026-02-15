<script lang="ts">
  /**
   * PasswordStrengthIndicator — Visual feedback for zxcvbn-ts password analysis
   *
   * Renders a color-coded progress bar with score label, crack time,
   * and optional feedback (warnings + suggestions).
   *
   * @example
   * <!-- Full (with feedback) -->
   * <PasswordStrengthIndicator
   *   score={result.score}
   *   label={result.label}
   *   crackTime={result.crackTime}
   *   feedback={result.feedback}
   *   loading={isAnalyzing}
   * />
   *
   * <!-- Simple (meter + label only) -->
   * <PasswordStrengthIndicator
   *   score={passwordScore}
   *   label={passwordLabel}
   *   crackTime={passwordTime}
   * />
   */

  interface Props {
    /** zxcvbn score: -1 (none), 0 (weak) to 4 (strong) */
    score: number;
    /** Human-readable strength label (e.g. "Stark", "Schwach") */
    label?: string;
    /** Estimated crack time (e.g. "3 Jahre") */
    crackTime?: string;
    /** Whether password analysis is in progress */
    loading?: boolean;
    /** Optional feedback with warning and suggestions */
    feedback?: {
      warning: string;
      suggestions: string[];
    } | null;
  }

  const {
    score,
    label = '',
    crackTime = '',
    loading = false,
    feedback = null,
  }: Props = $props();
</script>

<div
  class="password-strength-container"
  class:is-loading={loading}
>
  <div class="password-strength-meter">
    <div
      class="password-strength-bar"
      data-score={score}
    ></div>
  </div>
  {#if label}
    <div class="password-strength-info">
      <span class="password-strength-label">{label}</span>
      {#if crackTime}
        <span class="password-strength-time">{crackTime}</span>
      {/if}
    </div>
  {/if}
</div>

{#if feedback !== null && (feedback.warning !== '' || feedback.suggestions.length > 0)}
  <div class="password-feedback">
    {#if feedback.warning !== ''}
      <span class="password-feedback-warning">{feedback.warning}</span>
    {/if}
    {#if feedback.suggestions.length > 0}
      <ul class="password-feedback-suggestions">
        {#each feedback.suggestions as suggestion, i (i)}
          <li>{suggestion}</li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}

<style>
  /* Container */
  .password-strength-container {
    transition: all var(--transition-normal);
    margin-top: var(--spacing-3);
    border-radius: var(--radius-md);
    background: transparent;
    padding: var(--spacing-3);
  }

  /* Strength Meter (Progress Bar) */
  .password-strength-meter {
    margin-bottom: var(--spacing-2);
    border-radius: 3px;
    background: rgb(255 255 255 / 10%);
    height: 6px;
    overflow: hidden;
  }

  .password-strength-bar {
    transform-origin: left;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    border-radius: 3px;
    width: 0;
    height: 100%;
  }

  /* Score-based colors and widths */
  .password-strength-bar[data-score='-1'] {
    background: transparent;
    width: 0;
  }

  .password-strength-bar[data-score='0'] {
    box-shadow: 0 0 10px rgb(211 47 47 / 40%);
    background: linear-gradient(90deg, #d32f2f, #e53935);
    width: 20%;
  }

  .password-strength-bar[data-score='1'] {
    box-shadow: 0 0 10px rgb(245 124 0 / 40%);
    background: linear-gradient(90deg, #f57c00, #ff9800);
    width: 40%;
  }

  .password-strength-bar[data-score='2'] {
    box-shadow: 0 0 10px rgb(251 192 45 / 40%);
    background: linear-gradient(90deg, #fbc02d, #fdd835);
    width: 60%;
  }

  .password-strength-bar[data-score='3'] {
    box-shadow: 0 0 10px rgb(104 159 56 / 40%);
    background: linear-gradient(90deg, #689f38, #7cb342);
    width: 80%;
  }

  .password-strength-bar[data-score='4'] {
    animation: pulse-success 2s ease-in-out;
    box-shadow: 0 0 10px rgb(56 142 60 / 40%);
    background: linear-gradient(90deg, #388e3c, #4caf50);
    width: 100%;
  }

  /* Strength Info (Label & Time) */
  .password-strength-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 20px;
    font-size: 0.875rem;
  }

  .password-strength-label {
    transition: color var(--transition-fast);
    font-weight: 600;
  }

  /* Label colors matching score */
  .password-strength-container:has(.password-strength-bar[data-score='0'])
    .password-strength-label {
    color: #d32f2f;
  }

  .password-strength-container:has(.password-strength-bar[data-score='1'])
    .password-strength-label {
    color: #f57c00;
  }

  .password-strength-container:has(.password-strength-bar[data-score='2'])
    .password-strength-label {
    color: #fbc02d;
  }

  .password-strength-container:has(.password-strength-bar[data-score='3'])
    .password-strength-label {
    color: #689f38;
  }

  .password-strength-container:has(.password-strength-bar[data-score='4'])
    .password-strength-label {
    color: #388e3c;
  }

  .password-strength-time {
    color: var(--color-text-secondary);
    font-style: italic;
    font-size: 0.813rem;
  }

  /* Feedback Section */
  .password-feedback {
    margin-top: var(--spacing-3);
    border-left: 3px solid var(--color-warning);
    border-radius: 0 var(--radius-md) var(--radius-md) 0;
    background: rgb(255 193 7 / 5%);
    padding: var(--spacing-3);
    font-size: 0.875rem;
  }

  .password-feedback-warning {
    display: block;
    margin-bottom: var(--spacing-2);
    color: var(--color-warning);
    font-weight: 500;
  }

  .password-feedback-suggestions {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .password-feedback-suggestions li {
    position: relative;
    margin-bottom: var(--spacing-1);
    padding-left: var(--spacing-4);
    color: var(--color-text-secondary);
  }

  .password-feedback-suggestions li::before {
    position: absolute;
    left: 0;
    content: '\2192';
    color: var(--color-primary);
  }

  /* Loading State */
  .password-strength-container.is-loading .password-strength-meter {
    animation: pulse-loading 1.5s ease-in-out infinite;
    background: rgb(255 255 255 / 5%);
  }

  @keyframes pulse-loading {
    0%,
    100% {
      opacity: 50%;
    }

    50% {
      opacity: 100%;
    }
  }

  @keyframes pulse-success {
    0% {
      transform: scaleX(1);
    }

    50% {
      transform: scaleX(1.02);
    }

    100% {
      transform: scaleX(1);
    }
  }

  /* Responsive */
  @media (width < 768px) {
    .password-strength-info {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--spacing-1);
    }

    .password-strength-time {
      font-size: 0.75rem;
    }
  }

  /* Dark Mode */
  @media (prefers-color-scheme: dark) {
    .password-strength-container {
      background: transparent;
    }

    .password-strength-meter {
      background: transparent;
    }

    .password-feedback {
      background: rgb(255 193 7 / 10%);
    }
  }
</style>
