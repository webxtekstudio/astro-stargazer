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
  const comp = components.find((c) => c.slug === slug);
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
