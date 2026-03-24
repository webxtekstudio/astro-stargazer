import { describe, it, expect } from 'vitest';
import { scanComponents } from '../src/scanner.js';
import type { StargazerConfig } from '../src/types.js';

describe('scanComponents — files mode', () => {
    it('returns a resolved component from a simple entry', () => {
        const config: StargazerConfig = {
            mode: 'files',
            components: [{ name: 'Button', path: 'src/components/Button.astro' }],
        };
        const result = scanComponents(config);
        expect(result).toHaveLength(1);
        expect(result[0].slug).toBe('button');
        expect(result[0].name).toBe('Button');
        expect(result[0].componentPath).toBe('src/components/Button.astro');
    });

    it('expands variants into separate resolved components', () => {
        const config: StargazerConfig = {
            mode: 'files',
            components: [
                {
                    name: 'Badge',
                    path: 'src/components/Badge.astro',
                    variants: [
                        { name: 'Primary', props: { type: 'primary' } },
                        { name: 'Ghost', props: { type: 'ghost' } },
                    ],
                },
            ],
        };
        const result = scanComponents(config);
        expect(result).toHaveLength(2);
        expect(result[0].slug).toBe('badge-primary');
        expect(result[1].slug).toBe('badge-ghost');
        expect(result[0].props).toEqual({ type: 'primary' });
    });

    it('merges defaults + component props', () => {
        const config: StargazerConfig = {
            mode: 'files',
            defaults: { theme: 'dark' },
            components: [
                { name: 'Card', path: 'src/components/Card.astro', props: { size: 'lg' } },
            ],
        };
        const result = scanComponents(config);
        expect(result[0].props).toEqual({ theme: 'dark', size: 'lg' });
    });

    it('deduplicates slugs when same name appears multiple times', () => {
        const config: StargazerConfig = {
            mode: 'files',
            components: [
                { name: 'Button', path: 'src/a/Button.astro' },
                { name: 'Button', path: 'src/b/Button.astro' },
            ],
        };
        const result = scanComponents(config);
        expect(result[0].slug).toBe('button');
        expect(result[1].slug).toBe('button-1');
    });

    it('assigns category from path when not specified', () => {
        const config: StargazerConfig = {
            mode: 'files',
            components: [{ name: 'Card', path: 'src/components/ui/Card.astro' }],
        };
        const result = scanComponents(config);
        expect(result[0].category).toBe('components/ui');
    });

    it('assigns explicit category over path-derived one', () => {
        const config: StargazerConfig = {
            mode: 'files',
            components: [
                { name: 'Icon', path: 'src/components/misc/Icon.astro', category: 'Atoms' },
            ],
        };
        const result = scanComponents(config);
        expect(result[0].category).toBe('Atoms');
    });
});

describe('scanComponents — layout resolution', () => {
    it('resolves layout path from layouts map', () => {
        const config: StargazerConfig = {
            mode: 'files',
            layouts: { main: '/src/layouts/Main.astro' },
            components: [
                { name: 'Hero', path: 'src/components/Hero.astro', layout: 'main' },
            ],
        };
        const result = scanComponents(config);
        expect(result[0].layoutPath).toBe('/src/layouts/Main.astro');
        expect(result[0].layoutKey).toBe('main');
    });

    it('falls back to defaultLayout if no layout specified', () => {
        const config: StargazerConfig = {
            mode: 'files',
            layouts: { base: '/src/layouts/Base.astro' },
            defaultLayout: 'base',
            components: [{ name: 'Footer', path: 'src/components/Footer.astro' }],
        };
        const result = scanComponents(config);
        expect(result[0].layoutKey).toBe('base');
    });
});
