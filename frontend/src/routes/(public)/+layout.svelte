<!--
  Public Route Group Layout — ADR-050 §Decision "Local Dev: Unchanged + Optional Subdomain-Routing"

  This group hosts routes that must render equally on:
  - apex (`www.assixx.com` / `assixx.com`) — no tenant branding, default Assixx identity
  - tenant subdomains (`<slug>.assixx.com`) — per-tenant branding from +layout.server.ts
  - localhost (dev) — same as apex, no branding

  The layout itself is a pass-through ({@render children()}); tenant-specific
  UI is driven by PageData.brand which +layout.server.ts resolves.

  Route group parentheses `(public)` are URL-invisible (SvelteKit convention),
  so /login, /signup, /forgot-password URLs are unchanged after the move.

  @see docs/infrastructure/adr/ADR-012-frontend-route-security-groups.md
  @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md Phase 5 Step 5.2
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }
  const { children }: Props = $props();
</script>

{@render children()}
