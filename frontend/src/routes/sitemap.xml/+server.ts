/**
 * Dynamic sitemap.xml
 *
 * Only public pages are listed. Authenticated routes are excluded.
 * @see https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
 */
import type { RequestHandler } from './$types';

export const prerender = true;

const SITE_URL = 'https://www.assixx.com';

interface SitemapEntry {
  loc: string;
  priority: string;
  changefreq: string;
}

const PAGES: SitemapEntry[] = [
  { loc: '/', priority: '1.0', changefreq: 'monthly' },
  { loc: '/login', priority: '0.5', changefreq: 'yearly' },
  { loc: '/signup', priority: '0.8', changefreq: 'monthly' },
];

export const GET: RequestHandler = () => {
  const today = new Date().toISOString().split('T')[0] ?? '';

  const urls = PAGES.map(
    (page: SitemapEntry) =>
      `  <url>
    <loc>${SITE_URL}${page.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`,
  );

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
  ].join('\n');

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
