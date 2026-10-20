// Delete build leftovers from docs/assets.
//
// Vite writes into ../docs, which lies outside the frontend, so it never
// empties that folder (and must not: docs/data lives beside it). Every build
// therefore leaves its old content-hashed bundles behind. This keeps only
// what the current build uses: the files docs/index.html names, plus every
// asset those files name in turn (the KaTeX fonts the CSS points at).
//
// Runs automatically after `npm run build` (the "postbuild" script).
// By hand:  node scripts/prune-assets.mjs            (delete)
//           node scripts/prune-assets.mjs --dry-run  (only list)
// Only docs/assets is touched, never docs/data or anything else.

import { readFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const docs = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs');
const assets = join(docs, 'assets');
const dryRun = process.argv.includes('--dry-run');

const files = readdirSync(assets);
const mentioned = text => files.filter(f => text.includes(f));

// Follow references from index.html through the files it loads.
const keep = new Set();
const queue = mentioned(readFileSync(join(docs, 'index.html'), 'utf8'));
while (queue.length) {
  const f = queue.pop();
  if (keep.has(f)) continue;
  keep.add(f);
  if (/\.(js|css)$/.test(f)) queue.push(...mentioned(readFileSync(join(assets, f), 'utf8')));
}

if (!files.some(f => /\.js$/.test(f) && keep.has(f))) {
  // index.html names no bundle in assets/: something is off, delete nothing.
  console.error('prune-assets: docs/index.html references no bundle in docs/assets; nothing deleted.');
  process.exit(1);
}

let bytes = 0, n = 0;
for (const f of files) {
  if (keep.has(f)) continue;
  bytes += statSync(join(assets, f)).size;
  n += 1;
  if (dryRun) console.log(`would delete ${f}`);
  else unlinkSync(join(assets, f));
}
console.log(`prune-assets: kept ${keep.size}, ${dryRun ? 'would delete' : 'deleted'} ${n} ` +
            `(${(bytes / 1e6).toFixed(1)} MB) in docs/assets`);
