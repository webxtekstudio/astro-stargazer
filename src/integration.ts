import type { AstroIntegration } from 'astro';
import type { StargazerConfig, ResolvedComponent } from './types.js';
import { scanComponents } from './scanner.js';
import { generateRegistry, getPreviewData } from './generator.js';
import { readFileSync, watch, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
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
                projectRoot = normalizeRootPath(astroConfig.root.pathname);
                const currentOutput = astroConfig.output || 'static';
                if (currentOutput === 'static') {
                    logger.info('Switching output to "hybrid" for SSR route support.');
                    updateConfig({ output: 'hybrid' as any });
                }
                const pkgSrc = `${pkgRoot}src/`;
                injectRoute({
                    pattern: (inlineConfig?.base || '/stargazer'),
                    entrypoint: join(pkgSrc, 'routes', 'index.astro'),
                    prerender: false,
                });
                injectRoute({
                    pattern: `${inlineConfig?.base || '/stargazer'}/[slug]`,
                    entrypoint: join(pkgSrc, 'routes', 'preview.astro'),
                    prerender: false,
                });
                injectRoute({
                    pattern: `${inlineConfig?.base || '/stargazer'}/category/[cat]`,
                    entrypoint: join(pkgSrc, 'routes', 'category.astro'),
                    prerender: false,
                });
                injectRoute({
                    pattern: `${inlineConfig?.base || '/stargazer'}/frame/[slug]`,
                    entrypoint: join(pkgSrc, 'routes', 'frame', '[slug].astro'),
                    prerender: false,
                });
                injectRoute({
                    pattern: `${inlineConfig?.base || '/stargazer'}/documentation`,
                    entrypoint: join(pkgSrc, 'routes', 'documentation.astro'),
                    prerender: false,
                });
                injectRoute({
                    pattern: `${inlineConfig?.base || '/stargazer'}/frame-cat/[...cat]`,
                    entrypoint: join(pkgSrc, 'routes', 'frame-cat', '[...cat].astro'),
                    prerender: false,
                });
                injectRoute({
                    pattern: '/__stargazer_controls.js',
                    entrypoint: join(pkgSrc, 'routes', 'controls.ts'),
                    prerender: false,
                });
                logger.info('Routes injected. Config will be loaded when dev server starts.');
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
            },
            'astro:server:setup': async ({ server, logger }) => {
                async function ssrImport(path: string): Promise<any> {
                    const ssrRunner = (server as any).environments?.ssr?.runner;
                    if (ssrRunner?.import) {
                        try { return await ssrRunner.import(path); } catch { }
                    }
                    if ((server as any).environments) return {};
                    return (server as any).ssrLoadModule(path);
                }
                const controlsPath = join(pkgRoot, 'src', 'client', 'controls.js');
                const viteRoot: string = (server.config as any)?.root ?? projectRoot;
                const configFile = findConfigFile(viteRoot);
                async function loadAndScan() {
                    let fileConfig: StargazerConfig = {};
                    if (configFile) {
                        try {
                            const normalizedPath = normalizePath(configFile);
                            const mod = await ssrImport(normalizedPath);
                            fileConfig = (mod.default || mod) as StargazerConfig;
                        } catch (e) {
                            logger.error(`[stargazer] Failed to load config at ${configFile}: ${e}`);
                        }
                    }
                    config = { ...fileConfig, ...inlineConfig };
                    config.mode = config.mode || 'auto';
                    config.base = config.base || '/stargazer';
                    config.scanDir = config.scanDir || './src';
                    dynamicRescan();
                    logger.info(`Found ${resolvedComponents.length} component(s) to preview${config.mode === 'auto' ? ' (auto)' : ''}.`);
                }
                function dynamicRescan() {
                    config.layouts = config.layouts || {};
                    for (const key of autoDiscoveredLayouts) {
                        const p = config.layouts[key];
                        if (p) {
                            const absPath = join(viteRoot, p.startsWith('/') ? '.' + p : p);
                            if (!existsSync(absPath)) {
                                delete config.layouts[key];
                                autoDiscoveredLayouts.delete(key);
                            }
                        }
                    }
                    const layoutsDir = join(viteRoot, 'src', 'layouts');
                    if (existsSync(layoutsDir)) {
                        try {
                            const files = readdirSync(layoutsDir);
                            for (const file of files) {
                                if (file.endsWith('.astro')) {
                                    const name = file.replace('.astro', '');
                                    const filePath = `/src/layouts/${file}`;
                                    const alreadyExists = Object.values(config.layouts).some(
                                        p => normalizePath(String(p)).endsWith(filePath)
                                    );
                                    if (!config.layouts[name] && !alreadyExists) {
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
                        logger.info(`[stargazer] No layout found — using built-in preview layout.`);
                    }
                    resolvedComponents = scanComponents(config, viteRoot);
                }
                await loadAndScan();
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
                        dynamicRescan();
                        const registry = generateRegistry(resolvedComponents);
                        res.setHeader('Content-Type', 'application/json');
                        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
                        res.end(JSON.stringify({ components: registry, config }));
                        return;
                    }
                    if (req.url?.startsWith('/__stargazer/paths/')) {
                        dynamicRescan();
                        const urlObj = new URL(req.url, 'http://localhost');
                        const slug = decodeURIComponent(urlObj.pathname.replace('/__stargazer/paths/', ''));
                        const overrideLayout = urlObj.searchParams.get('overrideLayout') || '';
                        const data = getPreviewData(slug, resolvedComponents);
                        if (!data) {
                            res.statusCode = 404;
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ error: 'Component not found' }));
                            return;
                        }
                        let layoutPath2 = data.layoutPath;
                        if (overrideLayout && config.layouts?.[overrideLayout]) {
                            layoutPath2 = config.layouts[overrideLayout];
                        }
                        const compAbs = normalizePath(join(viteRoot, data.componentPath));
                        const layoutAbs = layoutPath2 ? normalizePath(join(viteRoot, layoutPath2)) : null;
                        function parseCssImports(absFilePath: string): string[] {
                            if (!absFilePath || !existsSync(absFilePath)) return [];
                            try {
                                const src = readFileSync(absFilePath, 'utf-8');
                                const regex = /import\s+['"]([^'"]+\.(?:css|scss|less|sass))['"];?/g;
                                const fileDir = normalizePath(dirname(absFilePath));
                                const normalizedRoot = normalizePath(viteRoot);
                                const urls: string[] = [];
                                let m: RegExpExecArray | null;
                                while ((m = regex.exec(src)) !== null) {
                                    const imp = m[1];
                                    let resolved: string;
                                    if (imp.startsWith('.')) {
                                        const abs = normalizePath(join(fileDir, imp));
                                        resolved = abs.startsWith(normalizedRoot)
                                            ? abs.slice(normalizedRoot.length)
                                            : abs;
                                    } else if (imp.startsWith('/')) {
                                        resolved = imp;
                                    } else {
                                        resolved = imp;
                                    }
                                    if (!urls.includes(resolved)) urls.push(resolved);
                                }
                                return urls;
                            } catch { return []; }
                        }
                        const cssLinks = layoutAbs ? parseCssImports(layoutAbs) : [];
                        try {
                            await ssrImport(compAbs);
                            const compMods = (server as any).moduleGraph.getModulesByFile(compAbs);
                            if (compMods) {
                                for (const mod of compMods) {
                                    const allDeps = new Set([
                                        ...(mod.importedModules || []),
                                        ...((mod as any).ssrImportedModules || [])
                                    ]);
                                    for (const dep of allDeps) {
                                        const du: string = dep.url || '';
                                        if ((du.includes('?astro&type=style') || du.includes('&lang.css')) && !cssLinks.includes(du)) {
                                            cssLinks.push(du);
                                        }
                                    }
                                }
                            }
                        } catch { }
                        res.setHeader('Content-Type', 'application/json');
                        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
                        res.end(JSON.stringify({
                            compFsUrl: `/@fs/${compAbs}`,
                            layoutFsUrl: layoutAbs ? `/@fs/${layoutAbs}` : null,
                            cssLinks,
                            darkMode: config.darkMode || {},
                        }));
                        return;
                    }
                    if (req.url?.startsWith('/__stargazer/render-category-meta/')) {
                        dynamicRescan();
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
                    next();
                });
                if (configFile) {
                    let debounce: ReturnType<typeof setTimeout> | null = null;
                    watch(configFile, (eventType: string) => {
                        if (eventType !== 'change') return;
                        if (!existsSync(configFile)) return;
                        if (debounce) clearTimeout(debounce);
                        debounce = setTimeout(async () => {
                            try {
                                await ssrImport(configFile + `?t=${Date.now()}`);
                                await loadAndScan();
                                server.ws.send({ type: 'full-reload', path: '*' });
                                logger.info(`Config reloaded — ${resolvedComponents.length} component(s).`);
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