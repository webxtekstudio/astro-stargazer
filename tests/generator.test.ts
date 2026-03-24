import { describe, it, expect } from 'vitest';
import { generateRegistry, getPreviewData } from '../src/generator.js';
import type { ResolvedComponent } from '../src/types.js';

const mockComponents: ResolvedComponent[] = [
    {
        slug: 'button',
        name: 'Button',
        category: 'UI',
        componentPath: 'src/components/Button.astro',
        props: {},
    },
    {
        slug: 'card',
        name: 'Card',
        category: 'UI',
        componentPath: 'src/components/Card.astro',
        layoutPath: '/src/layouts/Main.astro',
        layoutKey: 'main',
        props: { size: 'md' },
    },
    {
        slug: 'hero-dark',
        name: 'Hero / Dark',
        category: 'Sections',
        componentPath: 'src/components/Hero.astro',
        variantName: 'Dark',
        props: { theme: 'dark' },
    },
];

describe('generateRegistry', () => {
    it('maps components to registry entries', () => {
        const registry = generateRegistry(mockComponents);
        expect(registry).toHaveLength(3);
        expect(registry[0]).toEqual({
            slug: 'button',
            name: 'Button',
            category: 'UI',
            hasLayout: false,
            description: undefined,
            variantName: undefined,
            layoutKey: undefined,
        });
    });

    it('marks hasLayout correctly', () => {
        const registry = generateRegistry(mockComponents);
        expect(registry[0].hasLayout).toBe(false);
        expect(registry[1].hasLayout).toBe(true);
    });

    it('includes variantName when present', () => {
        const registry = generateRegistry(mockComponents);
        expect(registry[2].variantName).toBe('Dark');
    });
});

describe('getPreviewData', () => {
    it('returns preview data for a known slug', () => {
        const data = getPreviewData('button', mockComponents);
        expect(data).not.toBeNull();
        expect(data!.slug).toBe('button');
        expect(data!.componentPath).toBe('src/components/Button.astro');
    });

    it('includes layout path when present', () => {
        const data = getPreviewData('card', mockComponents);
        expect(data!.layoutPath).toBe('/src/layouts/Main.astro');
        expect(data!.props).toEqual({ size: 'md' });
    });

    it('returns null for unknown slug', () => {
        const data = getPreviewData('non-existent', mockComponents);
        expect(data).toBeNull();
    });
});
