/**
 * Call-Site Usage Discovery Engine
 *
 * Scans project pages and layouts to discover real-world usages of components.
 * Extracts literal attributes and generates real usage scenarios / variants for Stargazer.
 */

import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import { join, relative, basename, extname } from 'node:path';
import type { StargazerVariant } from '../types.js';

interface DiscoveredUsage {
  componentPath: string; // Relative normalized path, e.g. './src/components/CtaButton.astro'
  pagePath: string;      // E.g. 'src/pages/index.astro'
  pageName: string;      // E.g. 'index.astro'
  props: Record<string, unknown>;
}

function parseJsxAttributes(tagString: string): Record<string, unknown> {
  const props: Record<string, unknown> = {};

  // 1. Strings: prop="value" or prop='value'
  const stringRegex = /([A-Za-z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  while ((match = stringRegex.exec(tagString)) !== null) {
    const key = match[1];
    const val = match[2] !== undefined ? match[2] : match[3];
    props[key] = val;
  }

  // 2. Expressions: prop={value}
  const exprRegex = /([A-Za-z0-9_-]+)\s*=\s*\{([^}]+)\}/g;
  while ((match = exprRegex.exec(tagString)) !== null) {
    const key = match[1];
    const rawVal = match[2].trim();

    if (rawVal === 'true') {
      props[key] = true;
    } else if (rawVal === 'false') {
      props[key] = false;
    } else if (/^-?\d+(?:\.\d+)?$/.test(rawVal)) {
      props[key] = Number(rawVal);
    } else if (/^`([^`]*)`$/.test(rawVal)) {
      // Template string without nested interpolation
      const strMatch = rawVal.match(/^`([^`]*)`$/);
      if (strMatch && !strMatch[1].includes('${')) {
        props[key] = strMatch[1];
      }
    } else if (/^['"]([^'"]*)['"]$/.test(rawVal)) {
      props[key] = rawVal.slice(1, -1);
    }
  }

  // 3. Boolean shorthand: <Component isSticky disabled />
  const boolRegex = /(?<=\s)([A-Za-z0-9_-]+)(?=\s|\/|>)/g;
  while ((match = boolRegex.exec(tagString)) !== null) {
    const key = match[1];
    if (props[key] === undefined && !['class', 'id', 'type'].includes(key)) {
      props[key] = true;
    }
  }

  return props;
}

function scanFiles(dir: string, results: string[] = []): string[] {
  if (!existsSync(dir)) return results;
  const entries = readdirSync(dir);
  for (const entry of entries) {
    if (entry.startsWith('.') || entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    try {
      const stat = statSync(full);
      if (stat.isDirectory()) {
        scanFiles(full, results);
      } else if (extname(entry) === '.astro') {
        results.push(full);
      }
    } catch { }
  }
  return results;
}

export function discoverCallSites(projectRoot: string): Map<string, DiscoveredUsage[]> {
  const usageMap = new Map<string, DiscoveredUsage[]>();
  const pagesDir = join(projectRoot, 'src');
  const allFiles = scanFiles(pagesDir);

  for (const file of allFiles) {
    const relPage = relative(projectRoot, file).replace(/\\/g, '/');
    let content = '';
    try {
      content = readFileSync(file, 'utf-8');
    } catch {
      continue;
    }

    // Parse component imports in frontmatter
    const importRegex = /import\s+([A-Za-z0-9_]+)\s+from\s+['"]([^'"]+\.astro)['"]/g;
    let impMatch: RegExpExecArray | null;
    const importedComponents: { localName: string; resolvedPath: string }[] = [];

    const fileDir = relative(projectRoot, file).replace(/\\/g, '/').split('/').slice(0, -1).join('/');

    while ((impMatch = importRegex.exec(content)) !== null) {
      const localName = impMatch[1];
      const impPath = impMatch[2];
      let normPath = impPath;
      if (impPath.startsWith('.')) {
        normPath = ('./' + join(fileDir, impPath)).replace(/\\/g, '/');
      }
      importedComponents.push({ localName, resolvedPath: normPath });
    }

    // Find JSX usage tags for each imported component
    for (const { localName, resolvedPath } of importedComponents) {
      const tagRegex = new RegExp(`<${localName}\\b([^>]*?)(?:\\/>|>)`, 'gs');
      let tagMatch: RegExpExecArray | null;

      while ((tagMatch = tagRegex.exec(content)) !== null) {
        const rawAttrs = tagMatch[1];
        const props = parseJsxAttributes(rawAttrs);

        // Normalize component path key
        const key = resolvedPath.replace(/^\.\//, '').replace(/\\/g, '/');
        const list = usageMap.get(key) || [];

        // Avoid adding duplicate prop signatures for the same page
        const isDuplicate = list.some(
          (u) => u.pagePath === relPage && JSON.stringify(u.props) === JSON.stringify(props)
        );

        if (!isDuplicate) {
          list.push({
            componentPath: './' + key,
            pagePath: relPage,
            pageName: basename(relPage),
            props,
          });
          usageMap.set(key, list);
        }
      }
    }
  }

  return usageMap;
}

export function createVariantsFromUsages(usages: DiscoveredUsage[]): StargazerVariant[] {
  return usages.map((usage, idx) => {
    const pageLabel = usage.pageName.replace('.astro', '');
    const name = usages.length > 1 ? `In ${pageLabel} (${idx + 1})` : `In ${pageLabel}`;
    return {
      name,
      props: usage.props,
    };
  });
}
