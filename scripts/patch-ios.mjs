// Run after "npx cap add ios". Allows plain-http IPTV streams (App Transport Security)
// and background audio for AirPlay / Picture in Picture.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const plistPath = join(root, 'ios/App/App/Info.plist');
if (!existsSync(plistPath)) {
  console.error('ios/ not found. Run "npx cap add ios" first.');
  process.exit(1);
}

let plist = readFileSync(plistPath, 'utf8');
const additions = [];

if (!plist.includes('NSAppTransportSecurity')) {
  additions.push(`\t<key>NSAppTransportSecurity</key>
\t<dict>
\t\t<key>NSAllowsArbitraryLoads</key>
\t\t<true/>
\t\t<key>NSAllowsArbitraryLoadsForMedia</key>
\t\t<true/>
\t</dict>`);
}
if (!plist.includes('UIBackgroundModes')) {
  additions.push(`\t<key>UIBackgroundModes</key>
\t<array>
\t\t<string>audio</string>
\t</array>`);
}

if (additions.length) {
  const i = plist.lastIndexOf('</dict>');
  plist = plist.slice(0, i) + additions.join('\n') + '\n' + plist.slice(i);
  writeFileSync(plistPath, plist);
}
console.log('iOS project patched for http streams.');
