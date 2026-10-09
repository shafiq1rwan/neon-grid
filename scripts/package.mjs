// Zips the production build (dist/) for upload to Poki or any static host.
// index.html ends up at the root of the archive. Run via `npm run package`.
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { zipSync } from 'fflate';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const dist = join(root, 'dist');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const files = {};
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else files[relative(dist, full).split(sep).join('/')] = readFileSync(full);
  }
};
walk(dist);

if (!files['index.html']) {
  console.error('dist/index.html not found. Run `npm run build` first.');
  process.exit(1);
}

const outDir = join(root, 'release');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `${pkg.name}-v${pkg.version}.zip`);
const zip = zipSync(files, { level: 9 });
writeFileSync(out, zip);

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const raw = Object.values(files).reduce((sum, f) => sum + f.length, 0);
console.log(`Packaged ${Object.keys(files).length} files (${kb(raw)} unzipped) -> ${relative(root, out)} (${kb(zip.length)})`);
