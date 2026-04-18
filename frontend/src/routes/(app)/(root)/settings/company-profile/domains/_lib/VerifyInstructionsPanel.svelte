<!--
  VerifyInstructionsPanel.svelte
  Read-only panel showing the DNS TXT record details (host / type / value)
  with copy-to-clipboard buttons. Surfaced ONLY immediately after a successful
  `addDomain()` per masterplan §0.2.5 #10 — `verificationInstructions` is
  one-shot in the API, so we capture them in `state-ui.instructionsPanel`
  and display until the user clicks "Schließen".

  Display-only: no API calls, no state mutations beyond the parent's `onclose`
  callback. Copy uses the native `navigator.clipboard.writeText` per the
  Explore-mapping convention (no project-wide clipboard utility exists).

  @see masterplan §5.1 (UI flow), §0.2.5 #10 (one-shot instructions)
-->
<script lang="ts">
  import { showErrorAlert, showSuccessAlert } from '$lib/stores/toast';

  import type { VerificationInstructions } from './types.js';

  interface Props {
    domain: string;
    instructions: VerificationInstructions;
    onclose: () => void;
  }

  const { domain, instructions, onclose }: Props = $props();

  /**
   * Native clipboard write with toast feedback. Wraps in try/catch — the
   * Clipboard API throws on insecure contexts (non-HTTPS, non-localhost) and
   * on permission denial; we surface a concise German error in those cases
   * rather than letting the rejection bubble to the global error boundary.
   */
  async function copy(value: string, label: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      showSuccessAlert(`${label} in Zwischenablage kopiert`);
    } catch {
      showErrorAlert('Kopieren fehlgeschlagen — bitte manuell markieren und kopieren.');
    }
  }
</script>

<div
  class="card mt-4"
  data-testid="verify-instructions-panel"
>
  <div class="card__header">
    <h3 class="card__title">DNS TXT-Eintrag für <span class="font-mono">{domain}</span></h3>
    <p class="mt-2">
      Trage diesen TXT-Eintrag in der DNS-Zone Deiner Domain ein. Sobald die DNS-Propagation durch
      ist (kann ein paar Minuten dauern), klicke "Jetzt verifizieren" am Domain-Eintrag in der
      Tabelle.
    </p>
  </div>
  <div class="card__body">
    <dl class="grid gap-3">
      <div class="flex items-center gap-3">
        <dt class="w-20 font-medium">Host</dt>
        <dd
          class="flex-1 font-mono break-all"
          data-testid="txt-host"
        >
          {instructions.txtHost}
        </dd>
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          aria-label="Host kopieren"
          onclick={() => copy(instructions.txtHost, 'Host')}
        >
          <i
            class="fas fa-copy"
            aria-hidden="true"
          ></i>
        </button>
      </div>
      <div class="flex items-center gap-3">
        <dt class="w-20 font-medium">Typ</dt>
        <dd class="flex-1 font-mono">TXT</dd>
      </div>
      <div class="flex items-center gap-3">
        <dt class="w-20 font-medium">Value</dt>
        <dd
          class="flex-1 font-mono break-all"
          data-testid="txt-value"
        >
          {instructions.txtValue}
        </dd>
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          aria-label="Value kopieren"
          onclick={() => copy(instructions.txtValue, 'Value')}
        >
          <i
            class="fas fa-copy"
            aria-hidden="true"
          ></i>
        </button>
      </div>
    </dl>
    <div class="mt-4 flex justify-end">
      <button
        type="button"
        class="btn btn-secondary"
        onclick={onclose}>Schließen</button
      >
    </div>
  </div>
</div>
