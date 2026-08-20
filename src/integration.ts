import type { AstroIntegration } from 'astro';
import type { StargazerConfig, ResolvedComponent } from './types.js';
import { scanComponents } from './scanner.js';
import { generateRegistry, getPreviewData } from './generator.js';
import { generateWrappers } from './wrapper-generator.js';
import { readFileSync, watch, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const INTEGRATION_NAME = 'astro-stargazer';
const pkgRoot = normalizePath(fileURLToPath(new URL('..', import.meta.url)));

function normalizePath(p: string): string {
    return p.replace(/\\/g, '/');
}

function normalizeRootPath(p: string): string {
    let clean = normalizePath(p);
    if (/^\/[A-Za-z]:\//.test(clean)) {
        clean = clean.slice(1);
    }
    return clean.replace(/\/$/, '');
}

function findConfigFile(root: string): string | null {
    for (const ext of ['ts', 'js', 'mjs']) {
        const p = join(root, `stargazer.config.${ext}`);
        if (existsSync(p)) return p;
    }
    return null;
}

function toAbsolutePath(baseDir: string, targetPath: string): string {
    const clean = normalizePath(targetPath);
    if (/^[A-Za-z]:\//.test(clean)) return clean;
    if (clean.startsWith('/') && !clean.startsWith('/src/') && existsSync(clean)) return clean;
    const rel = clean.startsWith('/') ? '.' + clean : clean;
    return normalizePath(join(baseDir, rel));
}

export default function stargazer(
    inlineConfig?: Partial<StargazerConfig>
): AstroIntegration {
    let resolvedComponents: ResolvedComponent[] = [];
    let config: StargazerConfig = {};
    let projectRoot = '';
    const autoDiscoveredLayouts = new Set<string>();

    return {
        name: INTEGRATION_NAME,
        hooks: {
            'astro:config:setup': async ({
                command,
                injectRoute,
                injectScript,
                config: astroConfig,
                logger,
                updateConfig,
            }) => {
                const mergedConfig = { ...config, ...inlineConfig };
                if (command === 'build' && !mergedConfig.buildable) {
                    logger.info('Skipping (set buildable: true to include in builds).');
                    return;
                }
                if (command !== 'dev' && command !== 'build') {
                    return;
                }

                projectRoot = normalizePath(fileURLToPath(astroConfig.root)).replace(/\/$/, '');
                const basePath = inlineConfig?.base || '/stargazer';
                const pkgSrc = `${pkgRoot}src/`;

                // ── Load Config ──────────────────────────────────────────────
                let fileConfig: StargazerConfig = {};
                const configFile = findConfigFile(projectRoot);
                if (configFile) {
                    try {
                        const { loadConfigFromFile } = await import('vite');
                        const res = await loadConfigFromFile({ command: 'serve', mode: 'development' }, configFile);
                        fileConfig = (res?.config || {}) as StargazerConfig;
                    } catch (e) {
                        logger.warn(`[stargazer] Could not load config at ${configFile}: ${e}`);
                    }
                }
                config = { ...fileConfig, ...inlineConfig };
                config.mode = config.mode || 'auto';
                config.base = config.base || '/stargazer';

                // ── Discover Layouts ─────────────────────────────────────────
                config.layouts = config.layouts || {};
                const layoutsDir = join(projectRoot, 'src', 'layouts');
                if (existsSync(layoutsDir)) {
                    try {
                        for (const file of readdirSync(layoutsDir)) {
                            if (file.endsWith('.astro')) {
                                const name = file.replace('.astro', '');
                                const filePath = `/src/layouts/${file}`;
                                if (!config.layouts[name]) {
                                    config.layouts[name] = filePath;
                                    autoDiscoveredLayouts.add(name);
                                }
                            }
                        }
                    } catch { }
                }
                if (!config.defaultLayout) {
                    const keys = Object.keys(config.layouts);
                    if (keys.length === 1) {
                        config.defaultLayout = keys[0];
                        logger.info(`[stargazer] Auto-detected default layout: "${config.defaultLayout}"`);
                    }
                }
                if (!config.defaultLayout && Object.keys(config.layouts).length === 0) {
                    const builtinPath = normalizePath(
                        join(pkgRoot, 'src', 'layouts', 'stargazer-default.astro')
                    );
                    config.layouts['__sg_default'] = builtinPath;
                    config.defaultLayout = '__sg_default';
                    if (!config.darkMode) {
                        config.darkMode = { method: 'data-theme', dark: 'dark', light: 'light' };
                    }
                    logger.info('[stargazer] No layout found — using built-in preview layout.');
                }

                // ── Discover Global CSS ──────────────────────────────────────
                const globalCssImports: string[] = [];
                if (config.globalCss && Array.isArray(config.globalCss)) {
                    for (const css of config.globalCss) {
                        const clean = css.startsWith('/') ? css : '/' + css.replace(/^\.\//, '');
                        if (!globalCssImports.includes(clean)) globalCssImports.push(clean);
                    }
                } else {
                    for (const dir of ['src/css', 'src/styles', 'src']) {
                        const absDir = join(projectRoot, dir);
                        if (existsSync(absDir)) {
                            try {
                                for (const file of readdirSync(absDir)) {
                                    if ((file.endsWith('.css') || file.endsWith('.scss')) && !file.includes('node_modules')) {
                                        const relPath = `/${dir}/${file}`.replace(/\/\/+/g, '/');
                                        if (!globalCssImports.includes(relPath)) globalCssImports.push(relPath);
                                    }
                                }
                            } catch { }
                        }
                    }
                }

                // ── Scan Components ──────────────────────────────────────────
                resolvedComponents = scanComponents(config, projectRoot);
                logger.info(`Found ${resolvedComponents.length} component(s) to preview${config.mode === 'auto' ? ' (auto)' : ''}.`);

                // ── Generate Wrapper Pages ───────────────────────────────────
                const wrapperPaths = generateWrappers(
                    resolvedComponents,
                    config,
                    projectRoot,
                    globalCssImports
                );
                logger.info(`Generated ${wrapperPaths.size} wrapper page(s) in .stargazer/previews/`);

                // ── Inject Routes ────────────────────────────────────────────

                // Stargazer UI routes (from package)
                injectRoute({
                    pattern: basePath,
                    entrypoint: join(pkgSrc, 'routes', 'index.astro'),
                    prerender: false,
                });
                injectRoute({
                    pattern: `${basePath}/[slug]`,
                    entrypoint: join(pkgSrc, 'routes', 'preview.astro'),
                    prerender: false,
                });
                injectRoute({
                    pattern: `${basePath}/category/[cat]`,
                    entrypoint: join(pkgSrc, 'routes', 'category.astro'),
                    prerender: false,
                });
                injectRoute({
                    pattern: `${basePath}/documentation`,
                    entrypoint: join(pkgSrc, 'routes', 'documentation.astro'),
                    prerender: false,
                });
                injectRoute({
                    pattern: `${basePath}/frame-cat/[...cat]`,
                    entrypoint: join(pkgSrc, 'routes', 'frame-cat', '[...cat].astro'),
                    prerender: false,
                });
                injectRoute({
                    pattern: '/__stargazer_controls.js',
                    entrypoint: join(pkgSrc, 'routes', 'controls.ts'),
                    prerender: false,
                });

                // Component wrapper routes — one per component
                for (const [slug, wrapperPath] of wrapperPaths) {
                    injectRoute({
                        pattern: `${basePath}/frame/${slug}`,
                        entrypoint: wrapperPath,
                        prerender: false,
                    });
                }

                // ── Theme Script ─────────────────────────────────────────────
                injectScript('head-inline', `
(function(){
  try {
    var t = localStorage.getItem('sg-theme');
    if (!t) t = window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
    var cfg = {};
    try { cfg = JSON.parse(localStorage.getItem('sg-darkMode-config') || '{}'); } catch(e) {}
    var method = cfg.method || 'attribute';
    var attr = cfg.attribute || 'color-scheme';
    var dark = cfg.dark || 'dark';
    var light = cfg.light || 'light';
    var val = t === 'dark' ? dark : light;
    if (method === 'class') {
      document.documentElement.classList.add(val);
    } else if (method === 'data-theme') {
      document.documentElement.setAttribute('data-theme', val);
    } else {
      document.documentElement.setAttribute(attr, val);
    }
  } catch(e) {}
})();
                `);

                logger.info('Routes injected.');
            },

            'astro:server:setup': async ({ server, logger }) => {
                const controlsPath = join(pkgRoot, 'src', 'client', 'controls.js');
                const viteRoot: string = (server.config as any)?.root ?? projectRoot;
                const configFile = findConfigFile(viteRoot);

                async function ssrImport(path: string): Promise<any> {
                    const ssrEnv = (server as any).environments?.ssr;
                    if (ssrEnv?.runner?.import) {
                        try { return await ssrEnv.runner.import(path); } catch { }
                    }
                    if (typeof ssrEnv?.import === 'function') {
                        try { return await ssrEnv.import(path); } catch { }
                    }
                    if (typeof (server as any).ssrLoadModule === 'function') {
                        try { return await (server as any).ssrLoadModule(path); } catch { }
                    }
                    return {};
                }

                // ── Runtime for preview.astro and index.astro ────────────────
                (globalThis as any).__STARGAZER_RUNTIME__ = {
                    getConfig: () => config,
                    getResolvedComponents: () => resolvedComponents,
                    getPreviewData: (s: string) => getPreviewData(s, resolvedComponents),
                };

                // ── Middleware for JSON APIs and controls.js ──────────────────
                server.middlewares.use(async (req: any, res: any, next: any) => {
                    if (req.url?.startsWith('/__stargazer_controls.js')) {
                        res.setHeader('Content-Type', 'application/javascript');
                        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                        try {
                            res.end(readFileSync(controlsPath, 'utf-8'));
                        } catch {
                            res.end('');
                        }
                        return;
                    }
                    if (req.url === '/__stargazer/registry.json') {
                        const registry = generateRegistry(resolvedComponents);
                        res.setHeader('Content-Type', 'application/json');
                        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
                        res.end(JSON.stringify({ components: registry, config }));
                        return;
                    }
                    if (req.url?.startsWith('/__stargazer/preview/')) {
                        const slug = req.url.replace('/__stargazer/preview/', '');
                        const data = getPreviewData(slug, resolvedComponents);
                        res.setHeader('Content-Type', 'application/json');
                        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
                        if (!data) {
                            res.statusCode = 404;
                            res.end(JSON.stringify({ error: 'Component not found' }));
                        } else {
                            res.end(JSON.stringify(data));
                        }
                        return;
                    }
                    if (req.url?.startsWith('/__stargazer/render-category-meta/')) {
                        const urlObj = new URL(req.url, 'http://localhost');
                        const cat = decodeURIComponent(urlObj.pathname.replace('/__stargazer/render-category-meta/', ''));
                        const catComps = resolvedComponents.filter(c => c.category.toLowerCase() === cat.toLowerCase());
                        res.setHeader('Content-Type', 'application/json');
                        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
                        res.end(JSON.stringify(catComps.map(c => ({
                            slug: c.slug,
                            name: c.name,
                            path: c.componentPath,
                        }))));
                        return;
                    }
                    next();
                });

                // ── Config hot-reload ────────────────────────────────────────
                if (configFile) {
                    let debounce: ReturnType<typeof setTimeout> | null = null;
                    watch(configFile, (eventType: string) => {
                        if (eventType !== 'change') return;
                        if (!existsSync(configFile)) return;
                        if (debounce) clearTimeout(debounce);
                        debounce = setTimeout(async () => {
                            try {
                                await ssrImport(configFile + `?t=${Date.now()}`);
                                // Re-scan and re-generate wrappers would need a full restart
                                // since we can't inject new routes after startup
                                logger.info('[stargazer] Config changed — restart dev server to apply.');
                                server.ws.send({ type: 'full-reload', path: '*' });
                            } catch (e) {
                                logger.error(`[stargazer] Hot reload failed: ${e}`);
                            }
                        }, 300);
                    });
                }
            },
        },
    };
}

export type { StargazerConfig, StargazerComponent, StargazerVariant, DarkModeConfig } from './types.js';
export { isStargazerPath, STARGAZER_DEFAULT_BASE } from './helpers.js';