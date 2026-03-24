import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

export const prerender = false;

export function GET() {
  const dir = dirname(fileURLToPath(import.meta.url));
  const js = readFileSync(join(dir, '../client/controls.js'), 'utf-8');
  return new Response(js, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
