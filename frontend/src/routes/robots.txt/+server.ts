/**
 * Dynamic robots.txt
 *
 * Assixx is a B2B SaaS — only landing, login, signup are public.
 * All authenticated routes are blocked. AI training bots are blocked entirely.
 */
import type { RequestHandler } from './$types';

export const prerender = true;

/** AI training bots that must be blocked entirely */
const AI_BOTS = [
  'GPTBot',
  'Claude-Web',
  'Google-Extended',
  'CCBot',
  'anthropic-ai',
  'Bytespider',
  'PerplexityBot',
  'Amazonbot',
  'FacebookBot',
];

export const GET: RequestHandler = () => {
  const disallowAll = 'Disallow: /';
  const aiRules = AI_BOTS.flatMap((bot: string) => [`User-agent: ${bot}`, disallowAll]);

  const body = [
    'User-agent: *',
    'Allow: /$',
    'Allow: /login$',
    'Allow: /signup$',
    disallowAll,
    '',
    '# Block AI training bots',
    ...aiRules,
    '',
    'Sitemap: https://www.assixx.com/sitemap.xml',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
