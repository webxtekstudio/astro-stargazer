/**
 * Edge-safe helpers — no Node.js imports.
 * Use this in Astro middleware running on Cloudflare Workers, Vercel Edge, etc.
 *
 * @example
 * import { isStargazerPath } from 'astro-stargazer/helpers';
 *
 * export const onRequest = defineMiddleware(async (context, next) => {
 *   if (isStargazerPath(context.url.pathname)) return next();
 *   // ... your i18n / maintenance redirect logic
 * });
 */

/** Default base path for the Stargazer UI. */
export const STARGAZER_DEFAULT_BASE = '/stargazer';

/**
 * Returns `true` if `pathname` belongs to the Stargazer component browser.
 *
 * Edge-safe: zero Node.js imports — safe for Cloudflare Workers, Vercel Edge,
 * and any other non-Node runtime.
 *
 * @param pathname  - `context.url.pathname` from your middleware
 * @param base      - Your configured `base` option (default: `'/stargazer'`)
 */
export function isStargazerPath(pathname: string, base = STARGAZER_DEFAULT_BASE): boolean {
  const b = base.endsWith('/') ? base.slice(0, -1) : base;
  return (
    pathname === b ||
    pathname.startsWith(b + '/') ||
    pathname.startsWith('/__stargazer') ||
    pathname.startsWith('/_stargazer') ||
    pathname === '/__stargazer_controls.js'
  );
}
