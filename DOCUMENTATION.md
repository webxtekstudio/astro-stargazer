# Astro Stargazer — Full Documentation

## Table of Contents

- [Why Stargazer?](#why-stargazer)
- [Comparison](#comparison)
- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration Reference](#configuration-reference)
- [Modes](#modes)
- [Variants](#variants)
- [Props Inheritance](#props-inheritance)
- [Layout Wrapping](#layout-wrapping)
- [Override Editor](#override-editor)
- [CSS and Global Styles](#css-and-global-styles)
- [Viewport & Zoom](#viewport--zoom)
- [Dark Mode](#dark-mode)
- [Search](#search)
- [Category View All](#category-view-all)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Copy Props](#copy-props)
- [URL State](#url-state)
- [Hot Reload](#hot-reload)
- [Error Boundary](#error-boundary)
- [Architecture](#architecture)
- [Platform Compatibility](#platform-compatibility)
- [Framework Compatibility](#framework-compatibility)
- [Architecture](#architecture)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Troubleshooting](#troubleshooting)

---

## Why Stargazer?

If you've ever built a component-based website, you've probably done this:

1. Build a component
2. Move on to the next one
3. Three weeks later… "wait, what did that Hero look like again?"
4. Create a random test page, import the component, check it, delete the page
5. Repeat forever

Think of Stargazer as a **permanent, always-in-sync preview room** for every component you've ever built — living right inside your existing dev server. No throwaway pages, no separate process, no per-component config files. Just open `/stargazer` and everything's there.

Just list your components in **one config file** and get a full visual catalog with viewport testing, zoom, and dark mode toggle. It runs inside your existing Astro dev server. No extra tools, no extra build step, no heavy install.

### Inspired By

- **[Storybook](https://storybook.js.org/)** — the OG, massive ecosystem, addon library for days
- **[Histoire](https://histoire.dev/)** — beautiful, great for Vue and Svelte
- **[Ladle](https://ladle.dev/)** — lightweight Storybook alternative for React

All great tools. But none of them are built **for Astro**, and most come with setup overhead that felt like overkill.

> This isn't a Storybook replacement. If you need interactive controls, docs generation, or a huge addon ecosystem, Storybook is the right choice. Stargazer is for when you just want to **see your components** quickly.

---

## Comparison

| | Storybook | Histoire | Astro Stargazer |
|---|---|---|---|
| Install size | ~50MB+ | ~15MB | **~0.5MB** |
| Config per component | 1 `.stories` file each | 1 `.story` file each | **1 file total** |
| Extra dev server | Yes | Yes | **No, uses Astro's** |
| Learning curve | Decorators, args, controls | Story syntax | **Just a list of paths** |
| Astro-native | ❌ | ❌ | **✅** |

---

## Requirements

| Requirement | Version |
|---|---|
| Astro | **≥ 4.9.0** (including Astro 5 and Astro 6) |
| Node.js | **≥ 18.0.0** |

> Framework components (React, Vue, Svelte, Solid…) work out of the box if you already have them set up in your Astro project — no extra config needed.

> [!NOTE]
> v1.4.0 adds full compatibility with **Astro 6 / Vite 7**, including support for the `@astrojs/cloudflare` adapter. Previous versions crashed on startup when the Cloudflare adapter was active.

---

## Installation

### Option A — `astro add` (recommended)

```bash
npx astro add astro-stargazer
```

This automatically updates `astro.config.mjs`.

### Option B — Manual install

```bash
npm install astro-stargazer
```

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import stargazer from 'astro-stargazer';

export default defineConfig({
  integrations: [stargazer()]
});
```

### Create your config (optional)

Use `stargazer.config.ts` for advanced options like variants, per-directory layouts, or custom nav links. For basic usage, no config file is needed:

```ts
// stargazer.config.ts (optional)
import { defineConfig } from 'astro-stargazer';

export default defineConfig({
  defaults: { lang: 'en' },
});
```

Or run the setup wizard if you prefer:

```bash
npx create-stargazer
```

### Run

```bash
npm run dev
```

Open **`/stargazer`** in your browser (usually `http://localhost:4321/stargazer`). 🔭

---


## Override Editor & Global Defaults

Each component card has a `✎` button (always visible, yellow) that opens the override editor modal. Changes are stored in `localStorage` — they never modify your config files.

### Per-component override

Click `✎` on any card to:
- **Switch layout** — choose from any layout defined in `layouts`
- **Set props** — enter a JSON object that merges on top of the component's existing props

### Global Defaults & Visibility

The **⚙ Global Defaults** button in the status bar applies overrides to every component in the session. Per-component overrides take priority:

```
component override  >  global override  >  config
```

Inside the Global Defaults modal, you have exclusive access to **Visibility Toggles**:
- **Hide Categories:** Uncheck an entire category to collapse it perfectly and grey out all its children.
- **Hide Components:** Disable specific items to declutter your active search index.
- **Persistence:** These layout toggles are persisted indefinitely in your browser and do not mutate your team's tracking configurations.

### Indicators

- Cards show `✎ overridden` badge when an active override exists
- The ⚙ button turns bright yellow when a global override is active

### Notes

- Overrides persist across page refreshes (localStorage)
- Use **Reset to Config** in the modal to remove an override
- Only works in dev mode — overrides have no effect on production builds


---

## Configuration Reference

Create `stargazer.config.ts` (or `.js` / `.mjs`) in your project root:

```ts
import type { StargazerConfig } from 'astro-stargazer';

const config: StargazerConfig = { ... };
export default config;
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `mode` | `'files' \| 'auto'` | `'auto'` | How components are discovered |
| `exclude` | `string[]` | `['src/layouts','src/pages','src/styles']` | Paths to exclude (auto mode only) |
| `defaults` | `Record<string, unknown>` | `{}` | Global props applied to all components |
| `defaultLayout` | `string` | `undefined` | Key from `layouts` map to use by default |
| `layoutMap` | `Record<string, string>` | `undefined` | Map directory paths to layout keys (auto/files mode) |
| `layouts` | `Record<string, string>` | `{}` | Map of layout names to file paths |
| `components` | `StargazerComponent[]` | `[]` | Components to preview (used with `files` mode) |
| `scanDir` | `string` | `'./src'` | Directory to scan (auto mode only) |
| `base` | `string` | `'/stargazer'` | URL path for Stargazer |
| `buildable` | `boolean` | `false` | Include in production builds (default: dev-only) |
| `darkMode` | `false \| DarkModeConfig` | `{}` (enabled) | Dark mode toggle, set to `false` to hide |

### Component Entry

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | ✅ | Display name in the index |
| `path` | `string` | ✅ | Path to `.astro` file (relative to project root) |
| `description` | `string` | ❌ | Short description shown on the index card |
| `layout` | `string` | ❌ | Layout key, overrides `defaultLayout` |
| `props` | `Record<string, unknown>` | ❌ | Props, overrides `defaults` |
| `variants` | `StargazerVariant[]` | ❌ | Multiple prop combinations for the same component |
| `category` | `string` | ❌ | Custom category label (default: detected from folder) |

### Variant Entry

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | ✅ | Variant display name |
| `props` | `Record<string, unknown>` | ❌ | Props for this variant, overrides component-level props |

---

## Modes

### Auto Mode (recommended for new projects)

**Zero config.** Just install and run. Stargazer recursively scans `src/` and discovers all `.astro` files. Layouts, pages and styles are excluded by default. Component and layout discovery happen at *runtime* — create a new component or drop a new layout inside `/src/layouts/`, refresh the browser and Stargazer picks it up instantly without restarting.

```js
// astro.config.mjs
import stargazer from 'astro-stargazer';
export default defineConfig({
  integrations: [stargazer()],
});
```

That's it. No `stargazer.config.ts` needed.

#### Layout auto-detection

Stargazer automatically picks up layouts from `src/layouts/`:

- **Single layout found** → used automatically as the default. No config needed.
- **Multiple layouts found** → set `defaultLayout` to choose the default.
- **No layouts** → the built-in Stargazer preview layout is used as a fallback (see [Layout Wrapping](#layout-wrapping)).

#### Auto mode + global defaults

Most projects have components that require common props like `lang`, `theme`, or a logged-in user object. Use `defaults` to pass them to every component automatically:

```ts
const config: StargazerConfig = {
  mode: 'auto',
  defaults: {
    lang: 'en',
    theme: 'default',
  },
};
```

> [!IMPORTANT]
> In `auto` mode, components that require props but don't receive them will throw a runtime error in the preview. The error is shown inline in the preview frame. Add any required props to `defaults` to fix this.

#### Auto mode + multiple layouts (`layoutMap`)

If your project has more than one layout, use `layoutMap` to assign layouts by directory:

```ts
const config: StargazerConfig = {
  defaultLayout: 'main',
  layouts: {
    main: './src/layouts/Layout.astro',
    blog: './src/layouts/BlogLayout.astro',
  },
  layoutMap: {
    'src/components/blog': 'blog',
    'src/components': 'main',
  },
};
```

To exclude extra paths:

```ts
const config: StargazerConfig = {
  exclude: ['src/partials', 'src/blocks/internal'],
};
```

**Best for:** Quick start, solo projects, when you want everything visible.


### Files Mode

All components listed in one config file:

```ts
const config: StargazerConfig = {
  mode: 'files',
  components: [
    { name: 'Hero', path: './src/components/Hero.astro', description: 'Landing hero section' },
    { name: 'Footer', path: './src/components/Footer.astro' },
  ],
};
```

**Best for:** Full control over what's shown — choose exactly which components appear and in what order.

---

## Variants

Variants let you preview the same component with different props — ideal for design system components like buttons, badges, and cards.

### Example — Button with variants

```ts
const config: StargazerConfig = {
  components: [
    {
      name: 'Button',
      path: './src/components/Button.astro',
      description: 'Core button component',
      variants: [
        { name: 'Primary',        props: { variant: 'primary',   size: 'md' } },
        { name: 'Primary Large',  props: { variant: 'primary',   size: 'lg' } },
        { name: 'Secondary',      props: { variant: 'secondary', size: 'md' } },
        { name: 'Ghost',          props: { variant: 'ghost',     size: 'md' } },
        { name: 'Danger',         props: { variant: 'danger',    size: 'md' } },
        { name: 'Disabled',       props: { variant: 'primary',   disabled: true } },
      ],
    },
  ],
};
```

Each variant appears as a separate card in the index: `Button / Primary`, `Button / Ghost`, etc. Each has its own preview URL.

### Example — Badge colors

```ts
{
  name: 'Badge',
  path: './src/components/Badge.astro',
  variants: [
    { name: 'Green',   props: { color: 'green',   label: 'Active' } },
    { name: 'Red',     props: { color: 'red',     label: 'Error' } },
    { name: 'Yellow',  props: { color: 'yellow',  label: 'Warning' } },
    { name: 'Blue',    props: { color: 'blue',    label: 'Info' } },
  ],
}
```



---

## Props Inheritance

Props are merged in this order (later wins):

```
Global defaults → Component props → Variant props
```

### Example

```ts
const config: StargazerConfig = {
  defaults: { lang: 'en', colorMode: 'dark' },
  components: [
    {
      name: 'Hero',
      path: './src/components/Hero.astro',
      props: { colorMode: 'light' },         // overrides default
      variants: [
        { name: 'English' },                 // gets: { lang: 'en', colorMode: 'light' }
        { name: 'Portuguese', props: { lang: 'pt' } }, // gets: { lang: 'pt', colorMode: 'light' }
      ],
    },
  ],
};
```

| Prop | Global | Component | Variant (PT) | Final |
|---|---|---|---|---|
| `lang` | `'en'` | - | `'pt'` | **`'pt'`** |
| `colorMode` | `'dark'` | `'light'` | - | **`'light'`** |

---

## Layout Wrapping

Components often need their parent layout for correct rendering — global CSS, navigation, fonts, etc.

### Layout Resolution Order

Stargazer resolves which layout to use in this order:

1. **Explicit per-component `layout` key** (in config or override editor)
2. **`defaultLayout`** from your config
3. **Auto-detected** — if your project has exactly one file in `src/layouts/`, it's used automatically
4. **Built-in fallback** — if no layouts exist, Stargazer uses its own minimal preview layout with dark/light mode support

When using the built-in fallback, a warning banner appears below the nav bar in the preview, reminding you that your project styles are not loaded.

### Custom Layout Setup

```ts
const config: StargazerConfig = {
  defaultLayout: 'main',
  layouts: {
    main: './src/layouts/Layout.astro',
    blog: './src/layouts/BlogLayout.astro',
  },
  components: [
    { name: 'Hero', path: './src/components/Hero.astro' },
    { name: 'Blog Card', path: './src/components/BlogCard.astro', layout: 'blog' },
    { name: 'Icon', path: './src/components/Icon.astro', layout: undefined },
  ],
};
```

- With layout: component renders **inside the layout** as `<slot />` child
- `layout: undefined`: component renders standalone, no wrapping
- No `layout` field: `defaultLayout` is used

### The `isStargazer` Prop

Stargazer automatically injects `{ isStargazer: true }` into the `Astro.props` of your Layout when rendering a component preview.
This allows you to hide elements that don't make sense in isolation:

```astro
---
const { isStargazer } = Astro.props;
---
<html lang="en">
  <body>
    {!isStargazer && <Header />}
    <slot />
    {!isStargazer && <Footer />}
  </body>
</html>
```

### Dark Mode with Custom Layouts

When using your own layout, configure the `darkMode` option to match how your layout applies themes. The Stargazer controls will then correctly switch themes in the preview:

```ts
// astro.config.mjs or stargazer.config.ts
stargazer({
  darkMode: { method: 'attribute', attribute: 'color-scheme' },
});
```

See the [Dark Mode](#dark-mode) section for all options.

---

## CSS and Global Styles

Stargazer handles CSS automatically:

| Source | Works? | Why |
|---|---|---|
| Scoped `<style>` inside `.astro` | ✅ Always | Collected from Vite's module graph and injected automatically |
| Global CSS imported in a layout | ✅ With layout | Parsed from the layout file and injected as `<link>` tags |
| Global CSS not in a layout | ❌ | Only exists if the layout imports it |

If you're using the built-in Stargazer layout (no user layouts configured), your project's global styles are **not** loaded. The preview will show a warning. To fix this, add your own layout to `src/layouts/` — Stargazer will detect it automatically.

---

## Viewport & Zoom

### Viewport Buttons

| Button | Width | Use case |
|---|---|---|
| FULL | 100% | Current browser width |
| 2560px | 2560px | 4K / Ultra-wide |
| 1440px | 1440px | Standard desktop |
| 1024px | 1024px | Tablet landscape / Small laptop |
| 780px | 780px | Tablet portrait |
| 390px | 390px | Mobile |

- **Viewport > screen width**: Preview scales down visually but media queries respond to the real selected viewport width.
- **Viewport ≤ screen width**: Renders at exact width, centered.

### Zoom

Zoom appears only when viewport is ≤ 1024px:

| Button | Scale |
|---|---|
| 100% | 1.0 |
| 75% | 0.75 |
| 50% | 0.5 |
| 25% | 0.25 — full page at a glance |

Zoom resets to 100% when switching to a viewport > 1024px.

---

## Dark Mode

The dark/light toggle is enabled by default. Configure to match your project:

```ts
// Disable entirely
darkMode: false

// Tailwind (class)
darkMode: { method: 'class' }

// DaisyUI / Pico CSS
darkMode: { method: 'data-theme' }

// Custom attribute (default behavior)
darkMode: { method: 'attribute', attribute: 'color-scheme' }

// Custom values
darkMode: { method: 'data-theme', dark: 'night', light: 'day' }
```

### Full options

| Option | Type | Default | Description |
|---|---|---|---|
| `method` | `'attribute' \| 'class' \| 'data-theme'` | `'attribute'` | How dark mode is applied |
| `attribute` | `string` | `'color-scheme'` | Attribute name (attribute method only) |
| `target` | `string` | `'html'` | CSS selector for the target element |
| `dark` | `string` | `'dark'` | Value/class for dark mode |
| `light` | `string` | `'light'` | Value/class for light mode |

---

## Search

The index shows a search input when **more than 4 components** are registered.

- Type to filter by **component name** or **category**
- Press `/` anywhere on the index page to focus the search input
- Press `Escape` to clear and blur the input
- Categories with no matching components are hidden automatically

---

## Category View All

Every category on the index page has a **View All** link. Clicking it opens `/stargazer/category/[cat]`, a scrollable page showing every component in that category rendered at full size.

- All components render inside **one shared Layout** — the same layout they use in your real pages
- Components are stacked vertically in a single page, no iframes
- A sticky label marks each component boundary as you scroll
- Global CSS, scoped styles, and scripts all work correctly because it's a real Astro page
- All nav bar controls (viewport, zoom, dark mode) apply to the entire page

---

## Keyboard Shortcuts

Available on any preview page. A **shortcut hint bar** appears at the bottom-center of the screen when you move your cursor near the bottom edge.

| Key | Action |
|---|---|
| `F` | Switch to FULL viewport |
| `1` | Switch to 2560px viewport |
| `2` | Switch to 1440px viewport |
| `3` | Switch to 1024px viewport |
| `4` | Switch to 780px viewport |
| `5` | Switch to 390px viewport |
| `+` / `=` | Zoom in (only when viewport ≤ 1024px) |
| `-` | Zoom out (only when viewport ≤ 1024px) |
| `D` | Switch to DARK theme |
| `L` | Switch to LIGHT theme |
| `R` | Reload the component frame |
| `C` | Copy component props as JSON |
| `←` | Navigate to previous component |
| `→` | Navigate to next component |
| `/` | Focus search input (index only) |
| `Escape` | Clear search (index only) |

Shortcuts are disabled when focus is inside a text input.

---

## Copy Props

The **COPY PROPS** button in the preview nav bar copies the current component's props as formatted JSON to your clipboard.

Useful for:
- Sharing exact prop states with teammates
- Debugging component behavior
- Copying props into your codebase

---

## URL State

Viewport and zoom are persisted in the URL query string:

```
/stargazer/hero?vp=390&zoom=0.75
```

- Paste the URL to share the exact view with a teammate
- State is also saved to `localStorage` as a fallback
- When opening a fresh preview, Stargazer restores your last viewport/zoom automatically

---

## Hot Reload

When you edit `stargazer.config.ts`, the browser reloads automatically — no need to restart the dev server.

- Only fires on `change` events (not on file deletion)
- 300ms debounce to avoid double triggers on save
- Logs to console: `[astro-stargazer] Config reloaded — X component(s)`

---

## Error Boundary

If a component fails to load or throws at runtime, Stargazer shows a styled error card instead of a blank page:

- **Server-side errors** (component file not found, import failures): caught by the SSR route, shows error message + file path + Reload button
- **Client-side runtime errors** (JS errors inside the component): caught by `window.onerror`, replaces the body with the same styled error UI

Fix the error in your component and click Reload.

---

## Troubleshooting

### Components not showing up

1. Check that `stargazer.config.ts` exists in project root
2. Verify `path` values start with `./` and are relative to project root
3. Run `npm run dev` and check console for `[astro-stargazer] Found X component(s)`
4. In `mode: 'auto'`, make sure the component is inside `src/` and not in an excluded path

### Styles missing in preview

- If you see a **yellow warning banner** in the preview, you're using the built-in Stargazer layout and your project styles are not loaded
- Add a layout file to `src/layouts/` — Stargazer detects it automatically
- Or configure `defaultLayout` explicitly in your config
- Use `isStargazer` in your layout to hide elements that don't make sense in isolation

### Layout not wrapping correctly

- Ensure your layout uses `<slot />` to render children
- Verify the layout key in `components` matches a key in `layouts`

### Stargazer not in production

By design — dev-only. Set `buildable: true` to include it in production builds.

> [!IMPORTANT]
> When using `buildable: true`, your Astro project **must have a server adapter configured** (Cloudflare, Vercel, Netlify, Node, etc.). Stargazer's routes are SSR-only and cannot be statically pre-rendered.

### My site switched to hybrid output — will this break my build?

No. Stargazer temporarily switches `output` to `hybrid` **in memory during `astro dev`** so its SSR routes work. This change is never written to your config file and does not affect `astro build`.

During a production build, Stargazer exits immediately and never modifies anything:

| Command | Effect |
|---|---|
| `astro dev` | Stargazer active, output set to `hybrid` in memory only |
| `astro build` | Stargazer skipped entirely — your output stays `static` |
| `astro build` + `buildable: true` | Stargazer included in the build, output set to `hybrid`, **requires a server adapter** |

### What adapter should I use with `buildable: true`?

Any official Astro adapter works: `@astrojs/cloudflare`, `@astrojs/vercel`, `@astrojs/netlify`, `@astrojs/node`. Configure it as you normally would — Stargazer does not add any adapter-specific code.

If your project currently uses `output: 'static'` with no adapter (common for purely static sites), the simplest option for staging is `@astrojs/node` in standalone mode, or just leave `buildable` at its default `false` and use Stargazer in dev only.

### Component shows an error page

The error boundary caught a failure. Read the error message shown in the iframe, fix the component, click Reload.

If the error says **`Cannot read properties of undefined`**, the component is trying to use a prop that wasn't passed. This is common in `auto` mode where components are discovered without knowing what props they need. Fix by adding the required prop to `defaults`:

```ts
const config: StargazerConfig = {
  mode: 'auto',
  defaults: {
    lang: 'en',   // fix: 'Cannot read properties of undefined (reading 'contact')'
  },
};
```

### Dark mode toggle not working

CSS must respond to the method you configured:
- `attribute`: `[color-scheme="dark"]` on `<html>`
- `class`: `html.dark`
- `data-theme`: `[data-theme="dark"]`

### Search bar not showing up

The search input only appears when there are **more than 4 components** registered. With 4 or fewer, it's hidden since there's nothing to filter.

### Copy Props button doesn't work

The browser's Clipboard API requires either **HTTPS or localhost**. It won't work over plain HTTP on a network address (e.g. `http://192.168.1.x`). This is a browser security restriction, not a Stargazer bug.

### Preview is blank but shows no error

The component probably renders no visible HTML (empty output, whitespace only, or a `display: none` element). Check the component itself — open the browser devtools inside the iframe to inspect.

### Can I change the `/stargazer` URL?

Yes. Set the `base` option in your config:

```ts
const config: StargazerConfig = {
  base: '/preview',  // now available at /preview and /preview/[slug]
};
```

### Zoom buttons are not showing

Zoom only appears when the selected viewport is **≤ 1024px** (tablet or mobile). At larger viewports there is no zoom — use the FULL or 2560/1440 buttons instead.

---

## Platform Compatibility

Astro Stargazer runs on **macOS, Linux and Windows** — any OS that supports Node.js >= 18.

- Pure Node.js — no native binaries
- No shell scripts or OS-specific paths
- The wizard uses only `readline` and `fs` from the Node standard library

---

## Framework Compatibility

Stargazer previews `.astro` files. Since Astro natively supports **React, Vue, Svelte, Solid, Preact, Alpine** and others via its island architecture, any framework component imported inside an `.astro` file works automatically.

```astro
---
// src/components/Card.astro
import Button from './Button.tsx';    // React
import Tooltip from './Tooltip.vue';  // Vue
import Badge from './Badge.svelte';   // Svelte
---
<Button variant="primary" />
<Tooltip text="hello" client:hover />
<Badge color="green" />
```

Stargazer previews `Card.astro` and everything inside it renders exactly as it would in your real page — hydration directives included.

---

## Architecture

```
Your Astro Project
├── astro.config.mjs          ← adds stargazer() integration
├── stargazer.config.ts       ← your component registry
└── src/
    ├── components/           ← your components
    └── layouts/              ← your layouts

astro-stargazer (npm package)
├── src/
│   ├── integration.ts        ← Astro hooks, route injection, JSON API middleware
│   ├── scanner.ts            ← component discovery (all three modes)
│   ├── generator.ts          ← builds registry JSON
│   ├── types.ts              ← TypeScript interfaces
│   ├── routes/
│   │   ├── index.astro       ← component registry page with search
│   │   ├── preview.astro     ← single component view shell (nav + iframe)
│   │   ├── category.astro    ← category "View All" shell (nav + iframe)
│   │   ├── frame/[slug].astro    ← renders a single component with its Layout (native Astro SSR)
│   │   ├── frame-cat/[...cat].astro ← renders all components in a category inside one Layout
│   │   └── _Nav.astro        ← shared nav bar component
│   └── client/
│       └── controls.js       ← viewport/zoom/theme/shortcuts
└── bin/
    └── create-stargazer.mjs  ← npx setup wizard
```

### API Endpoints (Vite middleware)

| Endpoint | Description |
|---|---|
| `/__stargazer/registry.json` | Full component list + config |
| `/__stargazer/preview/:slug` | Component metadata as JSON (props, name, path) |
| `/__stargazer/paths/:slug` | Returns `/@fs/` URLs for component + layout + collected CSS links |
| `/__stargazer/render-category-meta/:cat` | Returns JSON list of component slugs for a category |

### Astro SSR Routes

| Route | Description |
|---|---|
| `/stargazer` | Index page — component cards with search |
| `/stargazer/[slug]` | Preview shell — nav bar + iframe pointing to frame route |
| `/stargazer/frame/[slug]` | Renders a single component inside its Layout via dynamic import |
| `/stargazer/category/[cat]` | Category shell — nav bar + iframe pointing to frame-cat route |
| `/stargazer/frame-cat/[...cat]` | Renders all components in a category inside one shared Layout |

### Data flow

**Single component view (`/stargazer/[slug]`):**
1. Integration reads `stargazer.config.ts` at dev server startup
2. Scanner resolves components and merges props (defaults → component → variant)
3. Route `/stargazer/[slug]` serves `preview.astro` — an HTML shell with the shared nav bar
4. The shell renders an `<iframe>` pointing to `/stargazer/frame/[slug]`
5. The frame route fetches component paths from `/__stargazer/paths/:slug`, dynamically imports the Layout and Component, and renders them as a native Astro page
6. CSS is collected from two sources: Layout file CSS imports (parsed with regex) and component scoped styles (collected via `ssrLoadModule` + module graph traversal)
7. The nav bar's viewport/zoom/theme controls communicate with `controls.js` in the iframe

**Category View All (`/stargazer/category/[cat]`):**
1. Route `/stargazer/category/[cat]` serves `category.astro` — an HTML shell with the shared nav bar
2. The shell renders an `<iframe>` pointing to `/stargazer/frame-cat/[...cat]`
3. The frame-cat route fetches all component paths, dynamically imports one Layout and all Components
4. All components render inside **one shared Layout** in a single page — stacked vertically with sticky labels
5. CSS from all components is merged and deduplicated before injection

---

## Roadmap

**Astro first. Then we expand.**

React, Vue, Svelte, and Solid components already work today — if you use them inside `.astro` files, Stargazer previews them with full hydration. No extra package needed.

Once Astro Stargazer hits v1.0, the plan is to bring the same zero-config experience to every major framework:

- `next-stargazer` — for pure Next.js / React projects
- `svelte-stargazer` — for pure SvelteKit projects
- `nuxt-stargazer` — for pure Nuxt / Vue projects

Every framework deserves a component browser that feels native to it. We're starting here.

---

## Contributing

Want to help? Contributions are welcome. Whether it's bug reports, feature ideas, or PRs for other framework support, feel free to jump in. Check the [issues](https://github.com/webxtekagency/astro-stargazer/issues) or just open one.

---

MIT © [Webxtek](https://webxtek.com)
