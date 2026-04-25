<!--
  Reusable SEO meta tag component.
  Renders title, description, canonical, Open Graph, Twitter Card, and optional JSON-LD.

  Usage:
    <Seo
      title="Page Title"
      description="Page description for search results."
      canonical="https://www.assixx.com/page"
    />
-->
<script lang="ts">
  const SITE_NAME = 'Assixx';
  const SITE_URL = 'https://www.assixx.com';
  const DEFAULT_OG_IMAGE = `${SITE_URL}/images/logo_darkmode.webp`;

  interface Props {
    title: string;
    description: string;
    canonical?: string;
    ogImage?: string;
    ogType?: 'website' | 'article';
    noindex?: boolean;
    jsonLd?: Record<string, unknown>;
  }

  const {
    title,
    description,
    canonical,
    ogImage = DEFAULT_OG_IMAGE,
    ogType = 'website',
    noindex = false,
    jsonLd,
  }: Props = $props();

  const robotsContent: string = $derived(noindex ? 'noindex, nofollow' : 'index, follow');

  /* Svelte parser chokes on literal <script> in component code — build from tag variable */
  const LD_TAG = 'script';
  const jsonLdScript: string = $derived(
    jsonLd !== undefined ?
      `<${LD_TAG} type="application/ld+json">${JSON.stringify(jsonLd)}</${LD_TAG}>`
    : '',
  );
</script>

<svelte:head>
  <title>{title}</title>
  <meta
    name="description"
    content={description}
  />
  <meta
    name="robots"
    content={robotsContent}
  />

  {#if canonical !== undefined}
    <link
      rel="canonical"
      href={canonical}
    />
  {/if}

  <!-- Open Graph -->
  <meta
    property="og:title"
    content={title}
  />
  <meta
    property="og:description"
    content={description}
  />
  <meta
    property="og:type"
    content={ogType}
  />
  <meta
    property="og:locale"
    content="de_DE"
  />
  <meta
    property="og:site_name"
    content={SITE_NAME}
  />
  <meta
    property="og:image"
    content={ogImage}
  />
  {#if canonical !== undefined}
    <meta
      property="og:url"
      content={canonical}
    />
  {/if}

  <!-- Twitter Card -->
  <meta
    name="twitter:card"
    content="summary"
  />
  <meta
    name="twitter:title"
    content={title}
  />
  <meta
    name="twitter:description"
    content={description}
  />
  <meta
    name="twitter:image"
    content={ogImage}
  />

  <!-- JSON-LD Structured Data -->
  {#if jsonLd !== undefined}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- Static JSON-LD structured data, no user input -->
    {@html jsonLdScript}
  {/if}
</svelte:head>
