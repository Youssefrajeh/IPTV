// Run after "npx cap add android". Makes the Android app work on phones, tablets,
// Android TV, Google TV and Fire TV, and allows plain-http IPTV streams.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'android/app/src/main/AndroidManifest.xml');
if (!existsSync(manifestPath)) {
  console.error('android/ not found. Run "npx cap add android" first.');
  process.exit(1);
}

let xml = readFileSync(manifestPath, 'utf8');

// TV: don't require a touchscreen, declare leanback support
if (!xml.includes('android.software.leanback')) {
  xml = xml.replace(
    /<application/,
    `<uses-feature android:name="android.software.leanback" android:required="false" />
    <uses-feature android:name="android.hardware.touchscreen" android:required="false" />

    <application`,
  );
}

// Allow http:// streams, add TV banner
if (!xml.includes('usesCleartextTraffic')) {
  xml = xml.replace(/<application/, '<application\n        android:usesCleartextTraffic="true"\n        android:banner="@drawable/tv_banner"');
}

// Show in the Android TV / Google TV home screen
if (!xml.includes('LEANBACK_LAUNCHER')) {
  xml = xml.replace(
    /(<category android:name="android.intent.category.LAUNCHER"\s*\/>)/,
    '$1\n                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />',
  );
}

// Keep the screen on while watching is handled by the video element; allow landscape + portrait.
writeFileSync(manifestPath, xml);

const drawable = join(root, 'android/app/src/main/res/drawable');
mkdirSync(drawable, { recursive: true });
copyFileSync(join(root, 'scripts/assets/tv-banner.png'), join(drawable, 'tv_banner.png'));

console.log('Android project patched for TV + http streams.');
