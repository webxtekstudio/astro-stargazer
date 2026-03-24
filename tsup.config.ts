import { defineConfig } from 'tsup';

export default defineConfig({
    entry: [
        'src/integration.ts',
        'src/types.ts',
        'src/scanner.ts',
        'src/generator.ts',
    ],
    format: ['esm'],
    dts: true,
    clean: true,
    external: ['astro', 'vite'],
    outDir: 'dist',
    splitting: false,
    sourcemap: false,
    treeshake: true,
});
