#!/usr/bin/env node
// Platform drift check. Compares one site repo against the platform baseline it pins.
//
//   node scripts/check-drift.mjs --site <site dir> --platform <platform git checkout>
//
// The pinned baseline version comes from the site's @undrwrldcub/brand dependency
// (github:Kairzen/undrwrldcub-platform#vX.Y.Z). Rules are evaluated against baseline.json
// at that tag, so a site is judged by the baseline it chose, and warned when a newer one exists.
//
// Any mismatch must be listed in the site's platform.json "deviations" (by rule id), or the check fails.
// A listed deviation that no longer deviates is reported as stale so it can be removed.
// Zero dependencies; Node 18+.

import { existsSync, readFileSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]]);
  return acc;
}, []));
const SITE = resolve(args.site ?? '.');
const PLATFORM = resolve(args.platform ?? '.');

const read = (p) => readFileSync(join(SITE, p), 'utf8');
const has = (p) => existsSync(join(SITE, p));

// Strip // and /* */ comments outside strings, then trailing commas.
function parseJsonc(text) {
  let out = '', inStr = false, esc = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (inStr) { out += c; if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; out += c; continue; }
    if (c === '/' && n === '/') { while (i < text.length && text[i] !== '\n') i++; out += '\n'; continue; }
    if (c === '/' && n === '*') { i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++; i++; continue; }
    out += c;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

const semver = (v) => (v.match(/(\d+)\.(\d+)\.(\d+)/) ?? []).slice(1).map(Number);
const cmp = (a, b) => { const x = semver(a), y = semver(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
const git = (...a) => execFileSync('git', ['-C', PLATFORM, ...a], { encoding: 'utf8' }).trim();

// ---------- load site ----------
const findings = [];   // { rule, ok, detail }
const fatal = [];
const check = (rule, ok, detail) => findings.push({ rule, ok: Boolean(ok), detail });

if (!has('package.json')) { console.error(`No package.json in ${SITE}`); process.exit(2); }
const pkg = JSON.parse(read('package.json'));
const platformJson = has('platform.json') ? JSON.parse(read('platform.json')) : { deviations: [] };
const deviations = new Map((platformJson.deviations ?? []).map((d) => [d.rule, d]));
for (const d of platformJson.deviations ?? []) {
  for (const k of ['rule', 'why', 'decided']) if (!d[k]) fatal.push(`platform.json deviation ${JSON.stringify(d.rule ?? d)} is missing "${k}"`);
}

// ---------- resolve pinned baseline ----------
const latest = JSON.parse(readFileSync(join(PLATFORM, 'baseline.json'), 'utf8'));
const brandSpec = pkg.dependencies?.[latest.brandPackage] ?? pkg.devDependencies?.[latest.brandPackage];
let pinned = null, baseline = latest;
if (!brandSpec) {
  fatal.push(`${latest.brandPackage} is not a dependency, so the site pins no baseline`);
} else {
  const m = brandSpec.match(/#v(\d+\.\d+\.\d+)$/);
  if (!m || !brandSpec.startsWith(latest.brandSource)) {
    fatal.push(`${latest.brandPackage} must be "${latest.brandSource}#vX.Y.Z" (found "${brandSpec}")`);
  } else {
    pinned = m[1];
    try { baseline = JSON.parse(git('show', `v${pinned}:baseline.json`)); }
    catch { fatal.push(`platform tag v${pinned} not found; pin a released version`); }
  }
}

// ---------- rules ----------
// node
const nvmrc = has('.nvmrc') ? read('.nvmrc').trim().replace(/^v/, '') : null;
check('node', nvmrc && nvmrc.split('.')[0] === baseline.node, `.nvmrc is ${nvmrc ?? 'missing'}, baseline ${baseline.node}`);

// astro major
const astroSpec = pkg.dependencies?.astro ?? pkg.devDependencies?.astro;
const astroMajor = astroSpec ? Number((astroSpec.match(/(\d+)/) ?? [])[1]) : null;
check('astro', astroMajor === baseline.astroMajor, `astro ${astroSpec ?? 'missing'}, baseline major ${baseline.astroMajor}`);

// dependencies outside the allowed list
const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
const extras = Object.keys(allDeps).filter((d) => !baseline.allowedDependencies.includes(d));
for (const d of extras) check(`dependency:${d}`, false, `${d}@${allDeps[d]} is not in the baseline dependency set`);
for (const [rule] of deviations) if (rule.startsWith('dependency:') && !(rule.slice(11) in allDeps)) check(rule, true, 'dependency no longer present');

// build script
check('build-script', pkg.scripts?.build === baseline.buildScript, `build is "${pkg.scripts?.build}", baseline "${baseline.buildScript}"`);

// astro config
const cfgFile = ['astro.config.mjs', 'astro.config.ts', 'astro.config.js'].find(has);
const cfg = cfgFile ? read(cfgFile) : '';
const siteUrl = (cfg.match(/site:\s*['"]([^'"]+)['"]/) ?? [])[1];
const host = siteUrl ? new URL(siteUrl).hostname : null;
const onDomain = host && (host === baseline.astroConfig.siteDomain || host.endsWith('.' + baseline.astroConfig.siteDomain));
check('astro-config:site', onDomain, `site is ${siteUrl ?? 'missing'}`);
check('astro-config:trailingSlash', new RegExp(`trailingSlash:\\s*['"]${baseline.astroConfig.trailingSlash}['"]`).test(cfg), `trailingSlash '${baseline.astroConfig.trailingSlash}' required`);
check('astro-config:buildFormat', new RegExp(`format:\\s*['"]${baseline.astroConfig.buildFormat}['"]`).test(cfg), `build.format '${baseline.astroConfig.buildFormat}' required`);
if (baseline.astroConfig.brandIntegration) {
  const integ = new RegExp(`from\\s+['"]${baseline.brandPackage}['"]`).test(cfg) && /integrations:\s*\[[^\]]*\bbrand\(\)/s.test(cfg);
  check('astro-config:brand-integration', integ, `brand() from '${baseline.brandPackage}' in integrations required`);
}

// host
let siteHost = 'cloudflare-pages', hostDetail = 'no wrangler.jsonc at the repo root (Cloudflare Pages)';
if (has('wrangler.jsonc') || has('wrangler.json')) {
  try {
    const w = parseJsonc(read(has('wrangler.jsonc') ? 'wrangler.jsonc' : 'wrangler.json'));
    const dir = (w.assets?.directory ?? '').replace(/^\.\//, '').replace(/\/$/, '');
    if (dir === baseline.output) { siteHost = 'cloudflare-workers'; hostDetail = `Workers static assets from ./${dir}`; }
    else hostDetail = `wrangler assets.directory is "${w.assets?.directory}", expected ./${baseline.output}`;
  } catch (e) { hostDetail = `wrangler config unreadable: ${e.message}`; }
}
check('host', siteHost === baseline.host, `${hostDetail}; baseline ${baseline.host}`);

// required files
for (const f of baseline.requiredFiles) check(`file:${f}`, has(f), `${f} ${has(f) ? 'present' : 'missing'}`);

// gitignore entries
const gi = has('.gitignore') ? read('.gitignore').split(/\r?\n/).map((s) => s.trim()) : [];
for (const e of baseline.gitignore) check(`gitignore:${e}`, gi.includes(e), `.gitignore ${gi.includes(e) ? 'has' : 'lacks'} ${e}`);

// brand kit must come from the package, not be committed
let committedBrand = [];
try { committedBrand = execFileSync('git', ['-C', SITE, 'ls-files', 'public/brand'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean); } catch { /* not a git checkout */ }
check('brand-assets', committedBrand.length === 0, committedBrand.length ? `${committedBrand.length} committed file(s) under public/brand/ (the package provides them)` : 'brand kit comes from the package');

// renovate preset
let renovateOk = false;
if (has('renovate.json')) { try { renovateOk = (JSON.parse(read('renovate.json')).extends ?? []).includes(baseline.renovatePreset); } catch { /* invalid */ } }
check('renovate', renovateOk, `renovate.json extends "${baseline.renovatePreset}" required`);

// ---------- evaluate ----------
const seen = new Set(findings.map((f) => f.rule));
const rows = [];
let failures = 0, warnings = 0;
for (const f of findings) {
  const dev = deviations.get(f.rule);
  if (f.ok && !dev) rows.push(['pass', f.rule, f.detail]);
  else if (f.ok && dev) { rows.push(['stale', f.rule, `recorded deviation no longer applies (${f.detail}); remove it from platform.json`]); warnings++; }
  else if (!f.ok && dev) rows.push(['deviation', f.rule, `${f.detail} — ${dev.why} (decided ${dev.decided})`]);
  else { rows.push(['DRIFT', f.rule, `${f.detail} — fix it or record a deviation in platform.json`]); failures++; }
}
for (const [rule] of deviations) if (!seen.has(rule)) { rows.push(['stale', rule, 'no check with this rule id; remove or rename it']); warnings++; }
if (pinned && cmp(pinned, latest.version) < 0) { rows.push(['behind', 'baseline', `pins v${pinned}; latest is v${latest.version}`]); warnings++; }
for (const msg of fatal) { rows.push(['DRIFT', 'setup', msg]); failures++; }

// ---------- report ----------
const icon = { pass: '✅', deviation: '📝', stale: '⚠️', behind: '⚠️', DRIFT: '❌' };
const order = { DRIFT: 0, stale: 1, behind: 2, deviation: 3, pass: 4 };
rows.sort((a, b) => order[a[0]] - order[b[0]]);
const name = platformJson.site ?? pkg.name;
console.log(`Platform drift check: ${name} (baseline ${pinned ? 'v' + pinned : 'unpinned'}, latest v${latest.version})`);
for (const [s, r, d] of rows) console.log(`${s.padEnd(9)} ${r.padEnd(34)} ${d}`);
console.log(`\n${failures} drift, ${warnings} warning(s), ${rows.filter((r) => r[0] === 'deviation').length} recorded deviation(s)`);

if (process.env.GITHUB_STEP_SUMMARY) {
  const md = [`## Platform drift check: ${name}`, '',
    `Baseline ${pinned ? '**v' + pinned + '**' : '**unpinned**'} · latest v${latest.version} · ${failures} drift · ${warnings} warning(s)`, '',
    '| | Rule | Detail |', '|---|---|---|',
    ...rows.map(([s, r, d]) => `| ${icon[s]} ${s} | \`${r}\` | ${d.replace(/\|/g, '\\|')} |`), ''].join('\n');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
}
if (process.env.GITHUB_ACTIONS) {
  for (const [s, r, d] of rows) {
    if (s === 'DRIFT') console.log(`::error title=Platform drift (${r})::${d}`);
    else if (s === 'stale' || s === 'behind') console.log(`::warning title=Platform ${s} (${r})::${d}`);
  }
}
process.exit(failures ? 1 : 0);
