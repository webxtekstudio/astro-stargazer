#!/usr/bin/env node

import { createInterface } from 'node:readline';
import { writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const cwd = process.cwd();
const ACCENT = '\x1b[93m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function log(msg) { console.log(msg); }
function ok(msg) { console.log(`${GREEN}  ✔${RESET}  ${msg}`); }
function info(msg) { console.log(`${DIM}     ${msg}${RESET}`); }
function heading(msg) { console.log(`\n${BOLD}${ACCENT}${msg}${RESET}\n`); }

const rl = createInterface({ input: process.stdin, output: process.stdout });
function ask(question, defaultVal = '') {
  return new Promise((resolve) => {
    const hint = defaultVal ? ` ${DIM}(${defaultVal})${RESET}` : '';
    rl.question(`  ${ACCENT}?${RESET} ${question}${hint}: `, (ans) => {
      resolve(ans.trim() || defaultVal);
    });
  });
}
function askBool(question, defaultVal = true) {
  return new Promise((resolve) => {
    const hint = defaultVal ? 'Y/n' : 'y/N';
    rl.question(`  ${ACCENT}?${RESET} ${question} ${DIM}(${hint})${RESET}: `, (ans) => {
      const v = ans.trim().toLowerCase();
      if (!v) resolve(defaultVal);
      else resolve(v === 'y' || v === 'yes');
    });
  });
}

// Find .astro files in a directory (recursive, limited depth)
function findAstroFiles(dir, depth = 0) {
  if (depth > 4) return [];
  const results = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        results.push(...findAstroFiles(full, depth + 1));
      } else if (extname(entry) === '.astro') {
        results.push(full);
      }
    }
  } catch { /* skip unreadable dirs */ }
  return results;
}

function findLayouts() {
  const layoutsDir = join(cwd, 'src', 'layouts');
  if (!existsSync(layoutsDir)) return [];
  return findAstroFiles(layoutsDir);
}

function findComponents() {
  const compsDir = join(cwd, 'src', 'components');
  if (!existsSync(compsDir)) return findAstroFiles(join(cwd, 'src'));
  return findAstroFiles(compsDir);
}

async function main() {
  console.clear();
  log(`${ACCENT}`);
  log(`  ★ ASTRO STARGAZER — Setup Wizard`);
  log(`${RESET}`);
  log(`  This wizard will create ${ACCENT}stargazer.config.ts${RESET} in your project root.`);
  log('');

  // Check if config already exists
  const configPath = join(cwd, 'stargazer.config.ts');
  if (existsSync(configPath)) {
    const overwrite = await askBool('stargazer.config.ts already exists. Overwrite?', false);
    if (!overwrite) {
      log('\n  Cancelled.\n');
      rl.close();
      process.exit(0);
    }
  }

  // ── (1/5) Mode ────────────────────────────────────────────────
  heading('(1/5) Mode');

  log(`  ${DIM}1.${RESET} auto   ${DIM}— discovers all .astro files in src/ automatically (recommended)${RESET}`);
  log(`  ${DIM}2.${RESET} files  ${DIM}— you list components manually in stargazer.config.ts${RESET}`);
  log('');

  const modeChoice = await ask('Mode (1/2)', '1');
  const modeMap = { '1': 'auto', '2': 'files' };
  const mode = modeMap[modeChoice] || 'auto';
  ok(`Mode: ${mode}`);

  // ── (2/5) Layouts ─────────────────────────────────────────────
  heading('(2/5) Layouts');

  const layouts = findLayouts();
  let defaultLayout = '';
  let layoutsMap = {};

  if (layouts.length > 0) {
    log(`  Found ${layouts.length} layout(s):\n`);
    layouts.forEach((l, i) => {
      const rel = './' + relative(cwd, l).replace(/\\/g, '/');
      log(`   ${DIM}${i + 1}.${RESET} ${rel}`);
    });
    log('');
    const useLayouts = await askBool('Use a default layout?', true);
    if (useLayouts) {
      const choices = layouts.map((l) => './' + relative(cwd, l).replace(/\\/g, '/'));
      if (choices.length === 1) {
        defaultLayout = 'main';
        layoutsMap['main'] = choices[0];
        ok(`Using: ${choices[0]}`);
      } else {
        const pick = await ask('Enter layout path (or press Enter for #1)', choices[0]);
        defaultLayout = 'main';
        layoutsMap['main'] = pick;
        ok(`Using: ${pick}`);
      }
    }
  } else {
    info('No src/layouts directory found — you can add layouts later.');
    const layoutPath = await ask('Layout path (leave empty to skip)', '');
    if (layoutPath) {
      defaultLayout = 'main';
      layoutsMap['main'] = layoutPath;
    }
  }

  // ── (3/5) Components (only for single mode) ───────────────────
  const selectedComponents = [];

  if (mode === 'files') {
    heading('(3/5) Components');

    const components = findComponents();

    if (components.length === 0) {
      info('No components found in src/components.');
      info('You can add them manually to stargazer.config.ts.');
    } else {
      log(`  Found ${components.length} component(s):\n`);
      components.forEach((c, i) => {
        const rel = './' + relative(cwd, c).replace(/\\/g, '/');
        log(`   ${DIM}${i + 1}.${RESET} ${rel}`);
      });
      log('');
      const addAll = await askBool(`Add all ${components.length} components?`, true);
      if (addAll) {
        for (const c of components) {
          const rel = './' + relative(cwd, c).replace(/\\/g, '/');
          const name = c.split(/[/\\]/).pop().replace('.astro', '');
          selectedComponents.push({ name, path: rel });
        }
        ok(`Added ${selectedComponents.length} components`);
      } else {
        info('Add components manually to stargazer.config.ts after setup.');
      }
    }
  } else {
    heading('(3/5) Components');
    if (mode === 'auto') {
      ok('Auto mode: all .astro files in src/ will be discovered automatically.');
      info('Layouts, pages and styles are excluded by default.');
    } else {
      ok('Files mode: list components manually in stargazer.config.ts after setup.');
    }
  }

  // ── (4/5) Dark Mode ───────────────────────────────────────────
  heading('(4/5) Dark Mode');

  const useDarkMode = await askBool('Enable dark mode toggle?', true);
  let darkModeConfig = null;
  if (useDarkMode) {
    log('\n  Method options:');
    log(`   ${DIM}1.${RESET} attribute ${DIM}— <html color-scheme="dark"> (default)${RESET}`);
    log(`   ${DIM}2.${RESET} class     ${DIM}— <html class="dark"> (Tailwind)${RESET}`);
    log(`   ${DIM}3.${RESET} data-theme ${DIM}— <html data-theme="dark"> (DaisyUI, Pico)${RESET}`);
    log('');
    const method = await ask('Method (1/2/3)', '1');
    const methodMap = { '1': 'attribute', '2': 'class', '3': 'data-theme' };
    darkModeConfig = { method: methodMap[method] || 'attribute' };
    ok(`Dark mode: ${darkModeConfig.method}`);
  }

  // ── (5/5) Defaults ────────────────────────────────────────────
  heading('(5/5) Defaults');
  const lang = await ask('Default language prop (lang)', 'en');

  // ── Generate config ───────────────────────────────────────────
  const modeStr = `  mode: '${mode}',\n`;
  const layoutsStr = Object.keys(layoutsMap).length > 0
    ? `  layouts: {\n${Object.entries(layoutsMap).map(([k, v]) => `    ${k}: '${v}',`).join('\n')}\n  },\n`
    : '';
  const defaultLayoutStr = defaultLayout ? `  defaultLayout: '${defaultLayout}',\n` : '';
  const defaultsStr = lang ? `  defaults: { lang: '${lang}' },\n` : '';
  const darkModeStr = darkModeConfig
    ? `  darkMode: { method: '${darkModeConfig.method}' },\n`
    : `  darkMode: false,\n`;

  let componentsStr = '';
  if (mode === 'files') {
    componentsStr = selectedComponents.length > 0
      ? `  components: [\n${selectedComponents.map((c) => `    { name: '${c.name}', path: '${c.path}' },`).join('\n')}\n  ],\n`
      : `  // components: [\n  //   { name: 'Hero', path: './src/components/Hero.astro' },\n  // ],\n`;
  }

  let excludeStr = '';
  if (mode === 'auto') {
    excludeStr = `  // exclude: ['src/partials'], // add paths to exclude from auto-discovery\n`;
  }

  const configContent = `import type { StargazerConfig } from 'astro-stargazer';

const config: StargazerConfig = {
${modeStr}${excludeStr}${defaultsStr}${defaultLayoutStr}${layoutsStr}${darkModeStr}${componentsStr}};

export default config;
`;

  writeFileSync(configPath, configContent, 'utf-8');

  log('');
  log(`${GREEN}${BOLD}  ★ Done! stargazer.config.ts created.${RESET}`);
  log('');
  log(`  Next steps:`);
  log(`   ${ACCENT}1.${RESET} Make sure astro-stargazer is in your astro.config.mjs integrations`);
  log(`   ${ACCENT}2.${RESET} Run ${ACCENT}npm run dev${RESET}`);
  log(`   ${ACCENT}3.${RESET} Open ${ACCENT}/stargazer${RESET} in your local dev URL (check your terminal for the port) 🔭`);
  log('');

  rl.close();
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
