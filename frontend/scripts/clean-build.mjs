// Clean up after `vite build`, so the built app and the frontend folder stay
// small and hold only what is used. Three steps, in this order:
//
// 1. Fonts: KaTeX's CSS offers every font three times (woff2, woff, ttf).
//    Every browser this site supports reads woff2, so each @font-face src
//    list that has a woff2 entry is cut down to it. The woff and ttf files
//    are then named by nothing, and step 2 deletes them (about 0.8 MB).
// 2. Stale bundles: Vite writes into ../docs, which lies outside the
//    frontend, so it never empties that folder (and must not: docs/data lives
//    beside it). Every build leaves its old content-hashed bundles behind.
//    This keeps only what the current build uses: the files docs/index.html
//    names, plus every asset those files name in turn.
// 3. Dev leftovers in the frontend folder: screenshots taken while working
//    on the UI (*.png directly in frontend/, nothing in the app uses them)
//    and Playwright's output (test-results/, playwright-report/).
//
// Runs automatically after `npm run build` (the "postbuild" script).
// By hand:  node scripts/clean-build.mjs            (clean)
//           node scripts/clean-build.mjs --dry-run  (only list what would go)
// Never touches docs/data, docs/index.html, the favicons, or frontend/src.

import { readFileSync, writeFileSync, readdirSync, statSync, unlinkSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontend = join(dirname(fileURLToPath(import.meta.url)), '..');
const docs = join(frontend, '..', 'docs');
const assets = join(docs, 'assets');
const dryRun = process.argv.includes('--dry-run');
const mb = b => `${(b / 1e6).toFixed(2)} MB`;
const sizeOf = p => {
  const s = statSync(p);
  return s.isDirectory() ? readdirSync(p).reduce((a, f) => a + sizeOf(join(p, f)), 0) : s.size;
};
const remove = (p, label) => {
  const b = sizeOf(p);
  if (dryRun) console.log(`  would delete ${label}`);
  else rmSync(p, { recursive: true, force: true });
  return b;
};

/* 1. Fonts: woff2 only, wherever a woff2 is offered */
let trimmed = 0;
for (const f of readdirSync(assets).filter(f => f.endsWith('.css'))) {
  const css = readFileSync(join(assets, f), 'utf8');
  const out = css.replace(/src:([^;}]*)/g, (whole, list) => {
    const entries = list.split(/,(?=\s*url\()/);
    const woff2 = entries.filter(e => /format\(["']woff2["']\)/.test(e));
    if (!woff2.length || woff2.length === entries.length) return whole;
    trimmed += entries.length - woff2.length;
    return `src:${woff2.join(',')}`;
  });
  if (out !== css && !dryRun) writeFileSync(join(assets, f), out);
}
console.log(`clean-build 1/3 fonts: ${dryRun ? 'would drop' : 'dropped'} ${trimmed} woff/ttf fallbacks from the CSS`);

/* 2. Stale bundles: keep what index.html reaches, delete the rest */
const files = readdirSync(assets);
// in a dry run step 1 did not write, so read the CSS as step 1 would leave it
const readAsset = f => {
  const t = readFileSync(join(assets, f), 'utf8');
  return dryRun && f.endsWith('.css')
    ? t.replace(/,url\([^)]*\)\s*format\(["'](woff|truetype)["']\)/g, '')
    : t;
};
const mentioned = text => files.filter(f => text.includes(f));
const keep = new Set();
const queue = mentioned(readFileSync(join(docs, 'index.html'), 'utf8'));
while (queue.length) {
  const f = queue.pop();
  if (keep.has(f)) continue;
  keep.add(f);
  if (/\.(js|css)$/.test(f)) queue.push(...mentioned(readAsset(f)));
}
if (!files.some(f => /\.js$/.test(f) && keep.has(f))) {
  // index.html names no bundle in assets/: something is off, delete nothing.
  console.error('clean-build: docs/index.html references no bundle in docs/assets; nothing deleted.');
  process.exit(1);
}
let bytes = 0, n = 0;
for (const f of files) {
  if (keep.has(f)) continue;
  bytes += statSync(join(assets, f)).size;
  n += 1;
  if (dryRun) console.log(`  would delete docs/assets/${f}`);
  else unlinkSync(join(assets, f));
}
console.log(`clean-build 2/3 docs/assets: kept ${keep.size}, ${dryRun ? 'would delete' : 'deleted'} ${n} (${mb(bytes)})`);

/* 3. Dev leftovers in frontend/ */
let left = 0, ln = 0;
for (const f of readdirSync(frontend)) {
  const p = join(frontend, f);
  if (f.endsWith('.png') && statSync(p).isFile()) { left += remove(p, `frontend/${f}`); ln += 1; }
}
for (const d of ['test-results', 'playwright-report']) {
  const p = join(frontend, d);
  if (existsSync(p)) { left += remove(p, `frontend/${d}/`); ln += 1; }
}
console.log(`clean-build 3/3 frontend: ${dryRun ? 'would delete' : 'deleted'} ${ln} leftovers (${mb(left)})`);
