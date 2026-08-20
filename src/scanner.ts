import type {
  StargazerConfig,
  StargazerComponent,
  ResolvedComponent,
  StargazerVariant,
} from './types.js';
import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import { join, relative, extname, basename } from 'node:path';
import { discoverCallSites, createVariantsFromUsages } from './inference/callsite.js';
import { inferStructuralProps } from './inference/fuzzer.js';

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function mergeProps(
  ...sources: (Record<string, unknown> | undefined)[]
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const source of sources) {
    if (source) Object.assign(merged, source);
  }
  return merged;
}

function categoryFromPath(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  const srcIdx = parts.findIndex((p) => p === 'components' || p === 'src');
  if (srcIdx >= 0 && srcIdx < parts.length - 1) {
    const subParts = parts.slice(srcIdx + 1, -1);
    if (subParts.length > 0) return subParts.join('/');
  }
  return 'Uncategorized';
}

function findAstroFiles(
  dir: string,
  excludedPaths: string[],
  root: string,
  results: string[] = []
): string[] {
  if (!existsSync(dir)) return results;
  const entries = readdirSync(dir);
  for (const entry of entries) {
    if (entry.startsWith('.') || entry === 'node_modules') continue;
    const full = join(dir, entry);
    const rel = relative(root, full).replace(/\\/g, '/');
    if (excludedPaths.some((ex) => rel.startsWith(ex.replace(/^\.\//, '')))) continue;
    try {
      const stat = statSync(full);
      if (stat.isDirectory()) {
        findAstroFiles(full, excludedPaths, root, results);
      } else if (extname(entry) === '.astro') {
        results.push(full);
      }
    } catch { }
  }
  return results;
}

function autoScanComponents(
  config: StargazerConfig,
  root: string
): StargazerComponent[] {
  let rawScanDir = config.scanDir;
  if (!rawScanDir) {
    if (existsSync(join(root, 'src', 'components'))) {
      rawScanDir = 'src/components';
    } else {
      rawScanDir = 'src';
    }
  }
  const scanDir = join(root, rawScanDir.replace(/^\.?\//, ''));
  const defaultExcludes = [
    'src/layouts',
    'src/pages',
    'src/templates',
    'src/styles',
    'src/css',
    'src/assets',
    'src/content',
    'src/i18n',
    'src/middleware',
    'src/routes',
  ];
  const userExcludes = config.exclude || [];
  const excludedPaths = [...defaultExcludes, ...userExcludes];
  const files = findAstroFiles(scanDir, excludedPaths, root);
  return files.map((file) => ({
    name: basename(file, '.astro'),
    path: './' + relative(root, file).replace(/\\/g, '/'),
  }));
}

function resolveLayoutKey(
  componentPath: string,
  config: StargazerConfig
): string | undefined {
  if (config.layoutMap) {
    const normPath = componentPath.replace(/\\/g, '/').replace(/^\.\//, '');
    const sorted = Object.entries(config.layoutMap).sort(
      ([a], [b]) => b.length - a.length
    );
    for (const [dir, key] of sorted) {
      const normDir = dir.replace(/\\/g, '/').replace(/^\.\//, '');
      if (normPath.startsWith(normDir)) return key;
    }
  }
  return config.defaultLayout;
}

function resolveComponent(
  entry: StargazerComponent,
  config: StargazerConfig,
  callsiteMap?: Map<string, Array<{ pagePath: string; pageName: string; props: Record<string, unknown> }>>,
  projectRoot?: string
): ResolvedComponent[] {
  const results: ResolvedComponent[] = [];
  const layoutKey = entry.layout ?? resolveLayoutKey(entry.path, config);
  const layoutPath = layoutKey && config.layouts ? config.layouts[layoutKey] : undefined;
  const category = entry.category || categoryFromPath(entry.path);

  // Layer 3: Structural Type-Safe Fallbacks (Anti-Crash)
  let structuralProps: Record<string, unknown> = {};
  if (config.inferProps !== false && projectRoot && entry.path) {
    try {
      const absPath = join(projectRoot, entry.path.replace(/^\.\//, ''));
      if (existsSync(absPath)) {
        const src = readFileSync(absPath, 'utf-8');
        structuralProps = inferStructuralProps(src);
      }
    } catch { }
  }

  // Layer 1: Manual Variants (Explicitly declared in config)
  if (entry.variants && entry.variants.length > 0) {
    for (const variant of entry.variants) {
      results.push({
        slug: slugify(`${entry.name}-${variant.name}`),
        name: `${entry.name} / ${variant.name}`,
        description: entry.description,
        componentPath: entry.path,
        layoutPath,
        layoutKey,
        props: mergeProps(structuralProps, config.defaults, entry.props, variant.props),
        category,
        variantName: variant.name,
      });
    }
    return results;
  }

  // Layer 2: Call-Site Usages Discovered in Pages
  const normKey = entry.path.replace(/^\.\//, '').replace(/\\/g, '/');
  const usages = (config.inferUsages !== false && callsiteMap) ? (callsiteMap.get(normKey) || []) : [];
  const singleUsageProps = usages.length >= 1 ? usages[0].props : undefined;

  // Single clean entry per component
  results.push({
    slug: slugify(entry.name),
    name: entry.name,
    description: entry.description,
    componentPath: entry.path,
    layoutPath,
    layoutKey,
    props: mergeProps(structuralProps, config.defaults, singleUsageProps, entry.props),
    category,
  });

  return results;
}

export function scanComponents(
  config: StargazerConfig,
  root?: string
): ResolvedComponent[] {
  // Auto-discover layouts if not already populated
  if (root && (!config.layouts || Object.keys(config.layouts).length === 0)) {
    config.layouts = config.layouts || {};
    const layoutsDir = join(root, 'src', 'layouts');
    if (existsSync(layoutsDir)) {
      try {
        for (const file of readdirSync(layoutsDir)) {
          if (file.endsWith('.astro')) {
            const name = file.replace('.astro', '');
            config.layouts[name] = `/src/layouts/${file}`;
          }
        }
        if (!config.defaultLayout && Object.keys(config.layouts).length === 1) {
          config.defaultLayout = Object.keys(config.layouts)[0];
        }
      } catch { }
    }
  }

  let components: StargazerComponent[] = [];

  // Discover real call-sites across pages if enabled
  let callsiteMap: Map<string, Array<{ pagePath: string; pageName: string; props: Record<string, unknown> }>> | undefined;
  if (config.inferUsages !== false && root) {
    try {
      callsiteMap = discoverCallSites(root) as any;
    } catch { }
  }

  if (config.mode === 'auto' && root) {
    // In auto mode: start with auto-scanned components, then merge any manual overrides
    const scanned = autoScanComponents(config, root);
    const manualOverrides = new Map((config.components || []).map(c => [c.path.replace(/^\.\//, ''), c]));

    components = scanned.map(scannedComp => {
      const key = scannedComp.path.replace(/^\.\//, '');
      const manual = manualOverrides.get(key);
      if (manual) {
        manualOverrides.delete(key);
        return { ...scannedComp, ...manual };
      }
      return scannedComp;
    });

    // Add any manual components that were not picked up by auto-scan
    for (const manual of manualOverrides.values()) {
      components.push(manual);
    }
  } else {
    components = config.components || [];
  }

  const resolved: ResolvedComponent[] = [];
  for (const entry of components) {
    resolved.push(...resolveComponent(entry, config, callsiteMap, root));
  }

  const slugCounts = new Map<string, number>();
  for (const item of resolved) {
    const base = item.slug;
    const count = slugCounts.get(base) || 0;
    if (count > 0) {
      item.slug = `${base}-${count}`;
    }
    slugCounts.set(base, count + 1);
  }

  return resolved;
}
