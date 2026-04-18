<!--
  Root Group Layout — passthrough only.
  @module (app)/(root)/+layout

  Intentionally empty layout wrapper. RBAC runs in +layout.server.ts.
  The SingleRootWarningBanner is rendered in (app)/+layout.svelte where it
  can sit above AppHeader (alongside RoleSwitchBanner).

  This file can be deleted once SvelteKit allows layout-server-only routes
  without a matching .svelte file in this group (currently safe either way).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  const { children }: Props = $props();
</script>

{@render children()}
