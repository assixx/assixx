import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
  return json({
    status: 'ok',
    service: 'sveltekit-frontend',
    timestamp: new Date().toISOString(),
  });
};
