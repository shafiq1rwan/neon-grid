// Zips the production build (dist/) for upload to Poki, CrazyGames or any static host.
// index.html ends up at the root of the archive. Run via `npm run package`
// (Poki) or `npm run package:crazygames`, which passes the portal name for the zip.
// CrazyGames' uploader takes the files, not a zip, so that build is also written
// unpacked to release/<name>/ (drag its contents into the upload area).
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { zipSync } from 'fflate';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const dist = join(root, 'dist');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const portal = process.argv[2];

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
const name = `${pkg.name}-v${pkg.version}${portal ? `-${portal}` : ''}`;
const out = join(outDir, `${name}.zip`);
const zip = zipSync(files, { level: 9 });
writeFileSync(out, zip);

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const raw = Object.values(files).reduce((sum, f) => sum + f.length, 0);
console.log(`Packaged ${Object.keys(files).length} files (${kb(raw)} unzipped) -> ${relative(root, out)} (${kb(zip.length)})`);

if (portal === 'crazygames') {
  const folder = join(outDir, name);
  rmSync(folder, { recursive: true, force: true });
  for (const [path, data] of Object.entries(files)) {
    const target = join(folder, ...path.split('/'));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, data);
  }
  console.log(`Unpacked for upload -> ${relative(root, folder)}`);
}
