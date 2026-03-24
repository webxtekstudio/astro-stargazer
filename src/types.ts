export interface StargazerVariant {
  /** Display name for this variant. */
  name: string;
  /** Props to pass to the component when rendering this variant. */
  props?: Record<string, unknown>;
}

export interface StargazerComponent {
  /** Display name for the component in the UI. */
  name: string;
  /** Path to the component file, relative to project root (e.g. `src/components/Button.astro`). */
  path: string;
  /** Optional description shown in the component card. */
  description?: string;
  /** Layout key to use (must match a key in `layouts`). */
  layout?: string;
  /** Default props to pass to the component. */
  props?: Record<string, unknown>;
  /** Multiple prop scenarios to render as separate preview entries. */
  variants?: StargazerVariant[];
  /** Category label for grouping. Defaults to the folder name. */
  category?: string;
}

export interface StargazerNavLink {
  /** Display label for the link. */
  label: string;
  /** URL the link navigates to. */
  href: string;
  /** Optional: open in new tab. */
  target?: '_blank' | '_self';
  /** Optional: highlight this link with accent styling to make it stand out. */
  highlight?: boolean;
}

export interface StargazerConfig {
  mode?: 'files' | 'auto';
  /** Glob patterns to exclude from auto-discovery (relative to project root). */
  exclude?: string[];
  /** Default props shared across all components. */
  defaults?: Record<string, unknown>;
  /** Default layout key to use when no `layout` is specified on a component. */
  defaultLayout?: string;
  /** @deprecated Use `layouts` instead. */
  layoutMap?: Record<string, string>;
  /**
   * Named layouts available for component previews.
   * Keys are used as layout identifiers; values are paths relative to project root.
   * @example `{ main: '/src/layouts/MainLayout.astro' }`
   */
  layouts?: Record<string, string>;
  /** Component list — used when `mode` is `files` or `single`. */
  components?: StargazerComponent[];
  /** Directory to scan for components (default: `./src`). Only used in `auto` mode. */
  scanDir?: string;
  /** URL base path for the Stargazer UI (default: `/stargazer`). */
  base?: string;
  /** Set to `true` to include Stargazer routes in production builds. Default: `false` (dev-only). */
  buildable?: boolean;
  /** Dark mode integration. Set to `false` to disable. */
  darkMode?: false | DarkModeConfig;
  /**
   * Custom navigation links shown at the end of the top navbar.
   * @example `[{ label: 'Home', href: '/' }, { label: 'Docs', href: '/docs' }]`
   */
  navLinks?: StargazerNavLink[];
  /**
   * Override the URL the logo links to. Defaults to the stargazer base path.
   * @example `'/'` to link back to the main site home.
   */
  logoHref?: string;
}

export interface DarkModeConfig {
  /** How to apply the theme to the host document. Default: `attribute`. */
  method?: 'attribute' | 'class' | 'data-theme';
  /** Attribute name when `method` is `attribute`. Default: `color-scheme`. */
  attribute?: string;
  /** CSS selector for the target element. Default: `:root`. */
  target?: string;
  /** Value applied for dark mode. Default: `dark`. */
  dark?: string;
  /** Value applied for light mode. Default: `light`. */
  light?: string;
}

export interface ResolvedComponent {
  slug: string;
  name: string;
  description?: string;
  componentPath: string;
  layoutPath?: string;
  layoutKey?: string;
  props: Record<string, unknown>;
  category: string;
  variantName?: string;
}

/**
 * Type helper for `stargazer.config.ts` — provides full autocomplete with no runtime cost.
 *
 * @example
 * ```ts
 * // stargazer.config.ts
 * import { defineConfig } from 'astro-stargazer';
 * export default defineConfig({ mode: 'auto', base: '/stargazer' });
 * ```
 */
export function defineConfig(config: StargazerConfig): StargazerConfig {
  return config;
}
