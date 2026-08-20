# Changelog

All notable changes to **Astro Stargazer** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.6.0] - 2026-08-20

### 🚀 Added
- **Intelligent Type-Driven Prop Inference Engine**:
  - Recursive AST parser for TypeScript `interface Props`, `type Props = { ... }`, and inline type assertions `Astro.props as { ... }`.
  - Comprehensive support for Primitive types (`string`, `number`, `boolean`), string literal unions (`'sm' | 'md' | 'lg'`), nested objects, arrays (`T[]`, `Array<T>`), tuples, and intersections (`A & B`).
  - Automatic resolution of local types (e.g. `type TeamMember = { ... }`) referenced inside interfaces or assertions.
  - Transparent unwrapping for utility types: `Partial<T>`, `Required<T>`, `Readonly<T>`, `Promise<T>`, `Record<K, V>`.
  - Type-safe exclusion of functions and event callbacks (`() => void`, `(e: Event) => void`) from mock data.
- **Auto-Discovery of Layouts & Global Styles**:
  - `scanner` automatically discovers `src/layouts/Layout.astro` and maps it to components without requiring manual `stargazer.config.ts` configuration.
  - Auto-discovery of project global stylesheets in `src/css/`, `src/styles/`, and `src/` to guarantee components have all CSS custom properties, fonts, and resets available in preview mode.
- **DOM Origin Tracking & Teleportation Support**:
  - Added `data-sg-origin` tagging and `Element.prototype.appendChild` hook to ensure interactive modals, dialogs, and lightboxes moved to `document.body` by component scripts are recognized as component children and not hidden by overlay suppressors.
- **Preview Canvas Contrast Mode**:
  - Connected the top toolbar Light/Dark toggle directly to preview frame canvas styling (`html[data-sg-preview][data-theme="light"] body`) so dark components and decorative SVG cutout notches stand out with high contrast against light canvas backgrounds.
- **Static Wrapper Generation Architecture**:
  - Real `.astro` compilation pipeline via `.stargazer/previews/` allowing scoped CSS, client scripts, and asset imports to work natively.
- **Call-Site Usage Discovery**:
  - Automatically extracts realistic props from existing `.astro` page usages across your project.

### 🐛 Fixed
- Fixed blank screen / empty props issue on components using `Astro.props as { ... }` or `Astro.props as NamedType`.
- Fixed crash when components contained inline/block comments inside their `interface Props` definition.
- Fixed overlay suppressor inadvertently hiding modals and lightboxes that teleport to `document.body`.
- Fixed missing global CSS variables in isolated component previews.

---

## [1.5.45] - 2026-04-15

### 🔄 Changed
- Compatibility update for the latest Astro releases and dependencies.

---

## [1.5.44] - 2026-03-30

### 🐛 Fixed
- Fixed copy-to-clipboard button color and contrast in Light mode.

---

## [1.5.43] - 2026-03-28

### 🚀 Added
- Added copy-to-clipboard button for component filenames in the header breadcrumbs.

---

## [1.5.5] - 2026-03-27

### 🐛 Fixed
- Fixed iframe visibility height calculation in the preview frame.
- Made keyboard shortcut hint bar conditionally visible on narrower viewports.

---

## [1.5.4] - 2026-03-27

### 🚀 Added
- Added edge-safe subpath exports (`astro-stargazer/helpers` and `astro-stargazer/middleware`) with zero Node.js dependencies for Cloudflare Workers and Vercel Edge.
- Documentation link in UI now opens safely in a new tab.

---

## [1.5.2] - 2026-03-27

### 🚀 Added
- Exported `isStargazerPath()` helper function to allow i18n middleware and auth guards to bypass Stargazer routes easily.
- Centralized URL configuration in `config.ts` as a single source of truth.

---

## [1.5.0] - 2026-03-24

### 🚀 Added
- **Keyboard Shortcuts**:
  - Keys `1` to `5` for quick viewport switching (Full, 2560px, 1440px, 780px, 390px).
  - Keys `+` and `-` for instant zoom controls.
- Keyboard shortcut hints bar in the preview UI.

### 🐛 Fixed
- Fixed breadcrumb overflow and max-width truncation on long component paths.

---

## [1.4.0] - 2026-03-24

### 🚀 Added
- Added support for Astro 5/6 and Vite 7.
- Built-in fallback layout (`stargazer-default.astro`) when no project layout exists.
- Automatic detection of project layouts in `src/layouts/`.
- Warning banner when previewing components without layout styles.
- Performance improvements for preview rendering.

---

## [0.1.0] - 2026-03-24

### 🚀 Added
- Initial public release of `astro-stargazer` component explorer for Astro.
