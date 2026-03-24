import type {
  StargazerConfig,
  StargazerComponent,
  ResolvedComponent,
} from './types.js';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname, basename } from 'node:path';

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
  const rawScanDir = config.scanDir || 'src';
  const scanDir = join(root, rawScanDir.replace(/^\.?\//, ''));
  const defaultExcludes = ['src/layouts', 'src/pages', 'src/styles'];
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
  config: StargazerConfig
): ResolvedComponent[] {
  const results: ResolvedComponent[] = [];
  const layoutKey = entry.layout ?? resolveLayoutKey(entry.path, config);
  const layoutPath = layoutKey && config.layouts ? config.layouts[layoutKey] : undefined;
  const category = entry.category || categoryFromPath(entry.path);

  if (entry.variants && entry.variants.length > 0) {
    for (const variant of entry.variants) {
      results.push({
        slug: slugify(`${entry.name}-${variant.name}`),
        name: `${entry.name} / ${variant.name}`,
        description: entry.description,
        componentPath: entry.path,
        layoutPath,
        layoutKey,
        props: mergeProps(config.defaults, entry.props, variant.props),
        category,
        variantName: variant.name,
      });
    }
  } else {
    results.push({
      slug: slugify(entry.name),
      name: entry.name,
      description: entry.description,
      componentPath: entry.path,
      layoutPath,
      layoutKey,
      props: mergeProps(config.defaults, entry.props),
      category,
    });
  }

  return results;
}

export function scanComponents(
  config: StargazerConfig,
  root?: string
): ResolvedComponent[] {
  let components: StargazerComponent[] = [];

  if (config.mode === 'auto' && root) {
    components = autoScanComponents(config, root);
  } else {
    components = config.components || [];
  }

  const resolved: ResolvedComponent[] = [];
  for (const entry of components) {
    resolved.push(...resolveComponent(entry, config));
  }

  const slugCounts = new Map<string, number>();
  for (const item of resolved) {
    const count = slugCounts.get(item.slug) || 0;
    if (count > 0) {
      item.slug = `${item.slug}-${count}`;
    }
    slugCounts.set(item.slug, count + 1);
  }

  return resolved;
}
