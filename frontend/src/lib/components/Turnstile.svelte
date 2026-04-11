<!--
  Cloudflare Turnstile Widget — Reusable Svelte 5 Component

  Loads the Turnstile script, renders the challenge widget,
  and exposes the verification token via $bindable.

  Usage:
    <Turnstile bind:this={ref} bind:token={myToken} action="login" />
    ref.reset() // after failed submit

  @see https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import { env } from '$env/dynamic/public';

  interface Props {
    /** Turnstile action name — must match server-side expectedAction */
    action: string;
    /** Verification token — bind with bind:token={myVar} */
    token?: string;
  }

  // eslint-disable-next-line no-useless-assignment, prefer-const -- $bindable requires let for $props() destructuring
  let { action, token = $bindable('') }: Props = $props();

  let container: HTMLDivElement | undefined = $state();
  let widgetId: string | null = $state(null);

  // Widen through an optional-property annotation so the absent-key case
  // survives svelte-kit's sync-time type generation. See lib/server/turnstile.ts
  // for the full local/CI rationale.
  const publicEnv: { PUBLIC_TURNSTILE_SITE_KEY?: string } = env;
  const siteKey = publicEnv.PUBLIC_TURNSTILE_SITE_KEY ?? '';

  /** Token setter — extracted to avoid naming-convention lint on Turnstile callback keys */
  function setToken(t: string): void {
    token = t;
  }

  function clearToken(): void {
    token = '';
  }

  function renderWidget(): void {
    if (container === undefined || widgetId !== null || window.turnstile === undefined) return;

    // NOTE: No `size` param — Cloudflare only accepts 'compact'|'flexible'|'normal'.
    // Invisible rendering is configured in the Cloudflare Dashboard (Widget Mode),
    // not via the client API. Setting size='invisible' here throws a TurnstileError.
    const options: TurnstileRenderOptions = {
      sitekey: siteKey,
      callback: setToken,
      theme: 'auto',
      action,
      language: 'de',
    };

    // Turnstile API uses kebab-case keys
    options['expired-callback'] = clearToken;
    options['error-callback'] = clearToken;

    widgetId = window.turnstile.render(container, options);
  }

  /** Reset the widget — call after failed form submission */
  export function reset(): void {
    clearToken();
    if (widgetId !== null && window.turnstile !== undefined) {
      window.turnstile.reset(widgetId);
    }
  }

  onMount(() => {
    if (siteKey === '') return;

    window.onTurnstileLoad = renderWidget;

    if (window.turnstile !== undefined) {
      renderWidget();
    } else if (
      document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]') === null
    ) {
      const script = document.createElement('script');
      script.src =
        'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    return () => {
      if (widgetId !== null && window.turnstile !== undefined) {
        window.turnstile.remove(widgetId);
        widgetId = null;
      }
    };
  });
</script>

{#if siteKey !== ''}
  <div
    bind:this={container}
    aria-label="Sicherheitsprüfung"
  ></div>
{/if}
