// Downloads the bundled default fonts (Google Fonts, OFL) into public/fonts/
// at build time, so we don't commit font binaries. Tolerant: a font that fails
// to download is simply skipped and never breaks the build.
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const cfg = JSON.parse(readFileSync(join(root, 'src', 'default-fonts.json'), 'utf8'));
const outDir = join(root, 'public', 'fonts');
mkdirSync(outDir, { recursive: true });

const BASE = 'https://raw.githubusercontent.com/google/fonts/main/';

let ok = 0;
let failed = 0;

for (const f of cfg) {
  const dest = join(outDir, `${f.slug}.ttf`);
  if (existsSync(dest)) {
    console.log(`skip (already present): ${f.slug}`);
    ok++;
    continue;
  }
  const url = BASE + encodeURI(f.path);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`FAIL  ${f.slug}  HTTP ${res.status}  ${url}`);
      failed++;
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(dest, buf);
    console.log(`ok    ${f.slug}  ${buf.length} bytes`);
    ok++;
  } catch (e) {
    console.warn(`ERROR ${f.slug}  ${e?.message ?? e}`);
    failed++;
  }
}

console.log(`\nFonts: ${ok} available, ${failed} failed (failures are non-fatal).`);
// Never fail the build because a font source moved.
process.exit(0);
