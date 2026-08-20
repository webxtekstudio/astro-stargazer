import type { ResolvedComponent } from './types.js';

export interface RegistryEntry {
  slug: string;
  name: string;
  description?: string;
  category: string;
  variantName?: string;
  hasLayout: boolean;
  layoutKey?: string;
}

export interface PreviewData {
  slug: string;
  name: string;
  category: string;
  componentPath: string;
  layoutPath?: string;
  props: Record<string, unknown>;
}

export function generateRegistry(
  components: ResolvedComponent[]
): RegistryEntry[] {
  return components.map((c) => ({
    slug: c.slug,
    name: c.name,
    description: c.description,
    category: c.category,
    variantName: c.variantName,
    hasLayout: !!c.layoutPath,
    layoutKey: c.layoutKey,
  }));
}

export function getPreviewData(
  slug: string,
  components: ResolvedComponent[]
): PreviewData | null {
  const norm = (slug || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  let comp = components.find((c) => c.slug === slug);
  if (!comp) {
    comp = components.find((c) => c.slug.toLowerCase().replace(/[^a-z0-9]/g, '') === norm);
  }
  if (!comp) {
    comp = components.find((c) => c.name.toLowerCase().replace(/[^a-z0-9]/g, '') === norm);
  }
  if (!comp) {
    comp = components.find((c) => c.slug.toLowerCase().replace(/[^a-z0-9]/g, '').startsWith(norm));
  }
  if (!comp) return null;
  return {
    slug: comp.slug,
    name: comp.name,
    category: comp.category,
    componentPath: comp.componentPath,
    layoutPath: comp.layoutPath,
    props: comp.props,
  };
}
