// Copies the built web app (dist/) into a platform folder, ready to package.
//   node scripts/prepare-tv.mjs tizen     -> platforms/tizen/app   (open in Tizen Studio / build .wgt)
//   node scripts/prepare-tv.mjs webos     -> platforms/webos/app   (ares-package platforms/webos/app)
//   node scripts/prepare-tv.mjs electron  -> platforms/electron/app
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2];
const allowed = ['tizen', 'webos', 'electron'];
if (!allowed.includes(target)) {
  console.error(`Usage: node scripts/prepare-tv.mjs <${allowed.join('|')}>`);
  process.exit(1);
}

const dist = join(root, 'dist');
if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/ not found. Run "npm run build" first.');
  process.exit(1);
}

const platformDir = join(root, 'platforms', target);
const out = join(platformDir, 'app');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(dist, out, { recursive: true });

if (target === 'tizen' || target === 'webos') {
  // TV web engines load apps from file://, where ES module scripts are blocked or unsupported.
  // Use only the ES5 "legacy" bundle that Vite also produced.
  const file = join(out, 'index.html');
  let html = readFileSync(file, 'utf8');
  html = html.replace(/<script type="module"[^>]*>[\s\S]*?<\/script>\s*/g, '');
  html = html.replace(/<script nomodule>[\s\S]*?<\/script>\s*/g, ''); // Safari 10 shim, not needed
  html = html.replace(/ nomodule/g, '').replace(/ crossorigin/g, '');
  html = html.replace(/<link rel="manifest"[^>]*>\s*/g, '');
  writeFileSync(file, html);

  if (target === 'tizen') {
    cpSync(join(platformDir, 'config.xml'), join(out, 'config.xml'));
    cpSync(join(platformDir, 'icon.png'), join(out, 'icon.png'));
  } else {
    cpSync(join(platformDir, 'appinfo.json'), join(out, 'appinfo.json'));
    cpSync(join(platformDir, 'icon.png'), join(out, 'icon.png'));
    cpSync(join(platformDir, 'largeIcon.png'), join(out, 'largeIcon.png'));
  }
}

console.log(`Ready: ${out}`);
