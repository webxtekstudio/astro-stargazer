# ✦ Astro Stargazer

> A lightweight, zero-config component preview tool built specifically for Astro.

Preview every `.astro` component you've ever built — isolated, with viewport switching, zoom, dark mode, and layout wrapping — right inside your existing dev server.

![Version](https://img.shields.io/badge/astro-%3E%3D4.9.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

![Stargazer Demo](https://raw.githubusercontent.com/webxtekagency/astro-stargazer/main/assets/demo.gif)

---

## Quick Start

### Option A — `astro add` (recommended)

```bash
npx astro add astro-stargazer
```

This automatically updates your `astro.config.mjs`.

### Option B — Manual install

```bash
npm install astro-stargazer
```

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import stargazer from 'astro-stargazer';

export default defineConfig({
  integrations: [stargazer()],
});
```

Then run `npm run dev` and open **`/stargazer`** in your browser.

---

## Configuration

Create `stargazer.config.ts` in your project root. Use `defineConfig` for full autocomplete:

```ts
// stargazer.config.ts
import { defineConfig } from 'astro-stargazer';

export default defineConfig({
  mode: 'auto',
  defaultLayout: 'main',
  layouts: {
    main: '/src/layouts/Layout.astro',
  },
});
```

Or use the setup wizard:

```bash
npx create-stargazer
```

---

## Configuration Reference

| Option | Type | Default | Description |
|---|---|---|---|
| `mode` | `'auto' \| 'files' \| 'single'` | `'auto'` | Component discovery mode |
| `components` | `StargazerComponent[]` | — | Component list (used in `files`/`single` modes) |
| `layouts` | `Record<string, string>` | — | Named layouts available for component previews |
| `defaultLayout` | `string` | — | Layout key applied to components without an explicit layout |
| `layoutMap` | `Record<string, string>` | — | Map directory prefixes to layout keys automatically |
| `scanDir` | `string` | `./src/components` | Directory to scan in `auto` mode |
| `exclude` | `string[]` | — | Paths to exclude from auto-discovery |
| `defaults` | `Record<string, unknown>` | — | Default props shared across all components |
| `base` | `string` | `/stargazer` | URL base path for the Stargazer UI |
| `buildable` | `boolean` | `false` | Include in production builds |
| `darkMode` | `DarkModeConfig \| false` | — | Dark mode integration config |

### Dark Mode Config

```ts
darkMode: {
  method: 'attribute',   // 'attribute' | 'class' | 'data-theme'
  attribute: 'color-scheme',
  dark: 'dark',
  light: 'light',
}
```

---

## Modes

### `auto` (default)
Scans `src/` for `.astro` files (excluding `layouts/`, `pages/`, `styles/`).

### `files`
Manually list components in `stargazer.config.ts`:

```ts
import { defineConfig } from 'astro-stargazer';

export default defineConfig({
  mode: 'files',
  components: [
    {
      name: 'Button',
      path: 'src/components/Button.astro',
      props: { label: 'Click me' },
      variants: [
        { name: 'Primary', props: { variant: 'primary' } },
        { name: 'Ghost', props: { variant: 'ghost' } },
      ],
    },
  ],
});
```

---

## Platform Compatibility

| Platform | Supported |
|---|---|
| Node.js ≥ 18 | ✅ |
| Astro ≥ 4.9 | ✅ |
| Vercel / Netlify | ✅ (dev-only, no production impact) |
| Cloudflare Workers | ✅ (dev-only) |
| Any Astro adapter | ✅ |

> Stargazer is **dev-only by default** — it injects routes only when `command === 'dev'`. Set `buildable: true` to include in production builds.

---

## Development

```bash
cd astro-stargazer

# Build the package
npm run build

# Watch mode
npm run dev

# Run tests
npm test
```

---

## License

MIT — [Webxtek](https://webxtek.com)
