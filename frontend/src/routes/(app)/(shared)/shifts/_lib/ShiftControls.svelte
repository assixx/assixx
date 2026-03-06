<!--
  ShiftControls.svelte
  Toggle controls for autofill, standard rotation, and custom rotation
  Extracted from +page.svelte for maintainability
-->
<script lang="ts">
  import type { ShiftAutofillConfig } from './types';

  interface Props {
    autofillConfig: ShiftAutofillConfig;
    standardRotationEnabled: boolean;
    customRotationEnabled: boolean;
    tpmModeEnabled: boolean;
    isPlanLocked?: boolean; // Rotation toggles disabled when plan is locked

    // Event handlers
    onautofillChange: (enabled: boolean) => void;
    onstandardRotationChange: (enabled: boolean) => void;
    oncustomRotationChange: (enabled: boolean) => void;
    ontpmModeChange: (enabled: boolean) => void;
  }

  const {
    autofillConfig,
    standardRotationEnabled,
    customRotationEnabled,
    tpmModeEnabled,
    isPlanLocked = false,
    onautofillChange,
    onstandardRotationChange,
    oncustomRotationChange,
    ontpmModeChange,
  }: Props = $props();
</script>

<div class="shift-controls">
  <div class="controls-group">
    <!-- Autofill Toggle -->
    <label class="toggle-switch">
      <input
        type="checkbox"
        class="toggle-switch__input"
        checked={autofillConfig.enabled}
        onchange={(e) => {
          onautofillChange((e.target as HTMLInputElement).checked);
        }}
      />
      <span class="toggle-switch__slider"></span>
      <span class="toggle-switch__label">
        Autofill
        <small class="toggle-hint">Woche automatisch füllen</small>
      </span>
    </label>

    <div class="divider"></div>

    <!-- Standard Rotation Toggle (disabled when plan is locked) -->
    <label
      class="toggle-switch"
      class:toggle-switch--disabled={isPlanLocked}
    >
      <input
        type="checkbox"
        class="toggle-switch__input"
        checked={standardRotationEnabled}
        disabled={isPlanLocked}
        onchange={(e) => {
          onstandardRotationChange((e.target as HTMLInputElement).checked);
        }}
      />
      <span class="toggle-switch__slider"></span>
      <span class="toggle-switch__label">
        Standard
        <small class="toggle-hint">Einfache Rotation</small>
      </span>
    </label>

    <div class="divider"></div>

    <!-- Custom Rotation Toggle (disabled when plan is locked) -->
    <label
      class="toggle-switch"
      class:toggle-switch--disabled={isPlanLocked}
    >
      <input
        type="checkbox"
        class="toggle-switch__input"
        checked={customRotationEnabled}
        disabled={isPlanLocked}
        onchange={(e) => {
          oncustomRotationChange((e.target as HTMLInputElement).checked);
        }}
      />
      <span class="toggle-switch__slider"></span>
      <span class="toggle-switch__label">
        Benutzerdefiniert
        <small class="toggle-hint">Automatische Mustererkennung</small>
      </span>
    </label>

    <div class="divider"></div>

    <!-- TPM Mode Toggle -->
    <label class="toggle-switch">
      <input
        type="checkbox"
        class="toggle-switch__input"
        checked={tpmModeEnabled}
        onchange={(e) => {
          ontpmModeChange((e.target as HTMLInputElement).checked);
        }}
      />
      <span class="toggle-switch__slider"></span>
      <span class="toggle-switch__label">
        TPM-Modus
        <small class="toggle-hint">Wartungstermine einplanen</small>
      </span>
    </label>
  </div>
</div>

<style>
  .shift-controls {
    display: flex;
    justify-content: center;
    margin: var(--spacing-4) auto var(--spacing-6);
  }

  .controls-group {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--spacing-4);
    backdrop-filter: blur(10px);
    border: 1px solid var(--color-glass-border);
    border-radius: var(--radius-xl);

    background: var(--glass-bg);

    padding: var(--spacing-4);
  }

  .divider {
    margin: 0 var(--spacing-2);
    background: var(--accent-color);
    width: 1px;
    height: 40px;
  }

  .toggle-hint {
    display: block;
    color: var(--color-text-muted, rgb(255 255 255 / 50%));
    font-weight: 400;
    font-size: 11px;
  }

  @media (width < 768px) {
    .controls-group {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--spacing-2);
    }

    .divider {
      margin: var(--spacing-2) 0;
      width: 100%;
      height: 1px;
    }
  }
</style>
